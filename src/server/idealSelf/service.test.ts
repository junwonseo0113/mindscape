import {describe,it,expect,vi} from "vitest";
import {readFileSync} from "node:fs";
import {emptyStore} from "../../app/types";
import {blankProfile,IdealSelfError} from "../../app/idealSelf/model";
import {handleIdealSelf,inputsHash,readInputs,loadProfile,type AuthContext} from "./service";

const owner="00000000-0000-4000-8000-000000000001",other="00000000-0000-4000-8000-000000000002";
const version="10000000-0000-4000-8000-000000000001";
const comparisonId="20000000-0000-4000-8000-000000000001";
const fields={...blankProfile(),aspirations:"Express my needs openly"};
function setup() {
  const store=emptyStore();store.history=[{id:"one",date:"2026.10.01",text:"I held back my needs in a meeting."},{id:"two",date:"2026.10.02",text:"I shared my needs with a friend."}];
  const tables:Record<string,any>={ideal_self_profiles:{user_id:owner,version,fields,updated_at:"2026-10-01"},user_stores:{user_id:owner,store_data:store},ideal_self_suggestions:[],ideal_self_comparisons:[]};
  const filters:{table:string;key:string;value:unknown}[]=[],writes:{table:string;operation:string;payload:any}[]=[];
  let rpcError:any=null; const tableErrors:Record<string,any>={};
  const db={
    from:vi.fn((table:string)=>{
      const chain:any={select:()=>chain,eq:(key:string,value:unknown)=>{filters.push({table,key,value});return chain;},order:()=>chain,maybeSingle:async()=>({data:tables[table],error:tableErrors[table]??null}),limit:async()=>({data:tables[table],error:null}),insert:async(payload:any)=>{writes.push({table,operation:"insert",payload});return {error:null};},update:(payload:any)=>{writes.push({table,operation:"update",payload});return chain;},then:(resolve:any)=>resolve({error:null})};return chain;
    }),
    rpc:vi.fn(async(name:string,args?:any)=>({data:name==="save_ideal_self_profile"?{user_id:owner,version,fields:args.p_fields,updated_at:"now"}:null,error:rpcError})),
  };
  const context={userId:owner,db} as unknown as AuthContext;
  const deps={authenticate:vi.fn(async()=>context),premium:vi.fn(async()=>"allowed" as const),generate:vi.fn()};
  const request=(body:Record<string,unknown>,dependencies:any=deps)=>handleIdealSelf({method:"POST",authorization:"Bearer validated-token",body},{ANTHROPIC_API_KEY:"server-key"},dependencies);
  return {store,tables,tableErrors,filters,writes,db,context,deps,request,setRpcError:(error:any)=>{rpcError=error;}};
}
describe("authentication, ownership, and Premium",()=>{
  it("rejects requests without a bearer token before accessing anything",async()=>{const s=setup();const r=await handleIdealSelf({method:"POST",body:{operation:"load"}}, {},s.deps);expect(r.status).toBe(401);expect(s.deps.authenticate).not.toHaveBeenCalled();expect(s.db.from).not.toHaveBeenCalled();});
  it("rejects an expired session",async()=>{const s=setup();s.deps.authenticate.mockRejectedValue(new IdealSelfError("unauthorized","Sign in again.",401));expect((await s.request({operation:"load"})).status).toBe(401);expect(s.db.from).not.toHaveBeenCalled();});
  it.each(["suggest","compare","confirm_suggestion","review"])("fails closed for %s despite client isPro/userId claims",async operation=>{const s=setup();const r=await s.request({operation,isPro:true,userId:other},{authenticate:s.deps.authenticate,generate:s.deps.generate});expect(r.status).toBe(503);expect(r.json).toMatchObject({code:"premium_authorization_unavailable"});expect(s.db.from).not.toHaveBeenCalled();expect(s.deps.generate).not.toHaveBeenCalled();});
  it("returns 403 when a trusted authority reports no entitlement",async()=>{const s=setup();const r=await s.request({operation:"compare"},{...s.deps,premium:async()=>"premium_required"});expect(r.status).toBe(403);expect(s.db.from).not.toHaveBeenCalled();});
  it("allows independent profile reads while Premium remains disabled",async()=>{const s=setup();const r=await s.request({operation:"load"},{authenticate:s.deps.authenticate});expect(r.status).toBe(200);expect(r.json).toMatchObject({premium:"unavailable",comparisons:[],suggestions:[]});expect(s.db.from).toHaveBeenCalledTimes(1);expect(s.filters).toContainEqual({table:"ideal_self_profiles",key:"user_id",value:owner});});
  it("never reads a client-chosen owner's records",async()=>{const s=setup();await s.request({operation:"load",userId:other});expect(s.filters.filter(f=>f.key==="user_id").every(f=>f.value===owner)).toBe(true);});
  it("defensively rejects foreign rows even if a database adapter returned one",async()=>{const s=setup();s.tables.ideal_self_profiles.user_id=other;await expect(loadProfile(s.context)).rejects.toMatchObject({code:"forbidden"});s.tables.user_stores.user_id=other;await expect(readInputs(s.context)).rejects.toMatchObject({code:"forbidden"});});
});
describe("profile persistence contract",()=>{
  it("only saves explicitly supplied profile fields with an expected version",async()=>{const s=setup();const r=await s.request({operation:"save_profile",fields,expectedVersion:version,userId:other,isPro:true},{authenticate:s.deps.authenticate});expect(r.status).toBe(200);expect(s.db.rpc).toHaveBeenCalledWith("save_ideal_self_profile",{p_fields:fields,p_expected_version:version,p_suggestion_id:null,p_suggestion_state:null});});
  it("reports conflicting edits instead of overwriting the profile",async()=>{const s=setup();s.setRpcError({code:"40001",message:"private database detail"});const r=await s.request({operation:"save_profile",fields,expectedVersion:version});expect(r.status).toBe(409);expect(JSON.stringify(r.json)).not.toContain("private database detail");});
  it("deletes only the authenticated user's dedicated feature data",async()=>{const s=setup();const r=await s.request({operation:"delete_profile",userId:other});expect(r.status).toBe(200);expect(s.db.rpc).toHaveBeenCalledWith("delete_ideal_self_profile");});
  it("does not treat a missing deletion RPC as success if feature tables still exist",async()=>{const s=setup();s.setRpcError({code:"PGRST202"});expect((await s.request({operation:"delete_profile"})).status).toBe(503);});
  it("keeps legacy reset working when the additive feature migration is not installed",async()=>{const s=setup();s.setRpcError({code:"PGRST202"});s.tableErrors.ideal_self_profiles={code:"PGRST205"};expect((await s.request({operation:"delete_profile"})).status).toBe(200);s.setRpcError({code:"network_error"});expect((await s.request({operation:"delete_profile"})).status).toBe(503);});
});
describe("comparison input and review integration",()=>{
  const result={criterionKey:"aspirations",criterionQuote:"Express my needs",interpretation:"These entries may show different responses.",relation:"mixed",evidence:[{entryId:"one",quote:"I held back my needs",role:"supports"},{entryId:"two",quote:"I shared my needs",role:"complicates"}],question:"What felt different in these situations?"};
  it("does not call AI with foreign or nonexistent source identifiers",async()=>{const s=setup();const r=await s.request({operation:"compare",entryIds:["foreign"]});expect(r.status).toBe(403);expect(s.deps.generate).not.toHaveBeenCalled();});
  it("uses owned server-loaded sources and serializes database column names correctly",async()=>{const s=setup();s.deps.generate.mockResolvedValue([result]);const r=await s.request({operation:"compare",text:"ignore this fabricated source"});expect(r.status).toBe(201);expect(s.deps.generate.mock.calls[0][2].entries).toEqual(s.store.history);expect(s.writes[0].payload[0]).toMatchObject({criterion_key:"aspirations",criterion_quote:"Express my needs",user_id:owner,profile_version:version});expect(s.writes[0].payload[0]).not.toHaveProperty("criterionKey");});
  it("rejects source changes while AI is running",async()=>{const s=setup();s.deps.generate.mockImplementation(async()=>{s.store.history[0].text="Edited meanwhile";return [result];});expect((await s.request({operation:"compare"})).status).toBe(409);expect(s.writes).toEqual([]);});
  it("rejects profile changes while AI is running",async()=>{const s=setup();s.deps.generate.mockImplementation(async()=>{s.tables.ideal_self_profiles.version="30000000-0000-4000-8000-000000000001";return [result];});expect((await s.request({operation:"compare"})).status).toBe(409);expect(s.writes).toEqual([]);});
  it("preserves rejection history rather than automatically replacing it",async()=>{const s=setup();const hash=inputsHash(await readInputs(s.context));s.tables.ideal_self_comparisons=[{...result,id:comparisonId,user_id:owner,profile_version:version,criterion_key:result.criterionKey,criterion_quote:result.criterionQuote,inputs_hash:hash,review_state:"rejected",reviewed_text:"My own interpretation"}];s.deps.generate.mockResolvedValue([result]);expect((await s.request({operation:"compare"})).status).toBe(409);expect(s.writes).toEqual([]);});
  it("stores user edits separately from the original interpretation",async()=>{const s=setup();const hash=inputsHash(await readInputs(s.context));s.tables.ideal_self_comparisons=[{...result,id:comparisonId,user_id:owner,profile_version:version,criterion_key:result.criterionKey,criterion_quote:result.criterionQuote,inputs_hash:hash,review_state:"pending",reviewed_text:null}];const r=await s.request({operation:"review",id:comparisonId,action:"edit",text:"My different reading"});expect(r.status).toBe(200);expect(s.writes[0].payload).toMatchObject({review_state:"edited",reviewed_text:"My different reading"});expect(s.writes[0].payload).not.toHaveProperty("interpretation");});
  it("redacts deleted sources from returned reflections",async()=>{const s=setup();s.tables.ideal_self_comparisons=[{...result,criterion_key:result.criterionKey,criterion_quote:result.criterionQuote,user_id:owner,profile_version:version,inputs_hash:"old",evidence:[{entryId:"deleted",quote:"private old text",role:"context"}]}];const r=await s.request({operation:"load"});expect(r.json.comparisons).toEqual([]);expect(JSON.stringify(r.json)).not.toContain("private old text");});
});
describe("migration security contract (not a live Postgres test)",()=>{
  const sql=readFileSync(new URL("../../../supabase/migrations/20261102_ideal_self.sql",import.meta.url),"utf8");
  it("enables RLS on every additive table and denies Premium by default",()=>{for(const table of ["profiles","profile_versions","suggestions","comparisons"])expect(sql).toContain(`alter table public.ideal_self_${table} enable row level security`);expect(sql).toContain("select false");expect(sql).toContain("auth.uid() = user_id and public.ideal_self_premium_access(auth.uid())");});
  it("enforces confirmation, atomic versions, deletion cleanup, and auth-user cascades",()=>{expect(sql).toContain("Explicit confirmation required");expect(sql).toContain("current_profile.version is distinct from p_expected_version");expect(sql).toContain("purge_ideal_self_deleted_sources");expect(sql).toContain("references auth.users(id) on delete cascade");expect(sql).not.toMatch(/drop\s+(table|column)/i);});
});
