import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { emptyStore } from "../../app/types";
import { profileKeys, IdealSelfError, buildInputs, canonicalInputs, validateProfile, requireOwner, isOutdated, evidenceStillExists, reviewComparison, confirmSuggestion, type Availability, type Profile, type Inputs, type Comparison, type Suggestion, type SuggestionRecord, type ComparisonRecord } from "../../app/idealSelf/model";
import { generateIdealSelf } from "./ai";

export type AuthContext={userId:string; db:SupabaseClient};
export type IdealSelfEnv=Record<string,string|undefined>;
type Request={method?:string; authorization?:string; body:unknown};
type Dependencies={authenticate?:(token:string,env:IdealSelfEnv)=>Promise<AuthContext>; premium?:(context:AuthContext)=>Promise<Availability>; generate?:typeof generateIdealSelf};

/** Deliberately unavailable: Store.isPro and the mock checkout are not entitlement authorities.
 * Replace only when the application has a verified server-side subscription source.
 * The matching database policies also deny Premium access until then.
 */
export async function premiumAvailability(_context:AuthContext):Promise<Availability> { return "unavailable"; }

export async function authenticate(token:string,env:IdealSelfEnv):Promise<AuthContext> {
  const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL, key=env.SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY;
  if(!url||!key) throw new IdealSelfError("storage_unavailable","Account storage is not configured in this installation.",503);
  const db=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await db.auth.getUser(token);
  if(error||!data.user) throw new IdealSelfError("unauthorized","Your session has expired. Sign in again.",401);
  return {userId:data.user.id,db};
}
function databaseError(error:unknown):never {
  const code=(error as {code?:string})?.code;
  if(code==="40001") throw new IdealSelfError("conflict","The saved profile or source entries changed. Reload before saving again.",409);
  throw new IdealSelfError("storage_unavailable","Ideal Self could not access account storage. Your input has not been discarded.",503);
}
const uuid=(value:unknown):string=>{
  if(typeof value!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new IdealSelfError("invalid_id","A valid record identifier is required.");
  return value;
};
export async function loadProfile(context:AuthContext):Promise<Profile|null> {
  const {data,error}=await context.db.from("ideal_self_profiles").select("user_id,version,fields,updated_at").eq("user_id",context.userId).maybeSingle();
  if(error) databaseError(error);
  if(data) { requireOwner(context.userId,data); validateProfile(data.fields); }
  return data ? {...data,fields:validateProfile(data.fields)} as Profile : null;
}
export async function readInputs(context:AuthContext):Promise<Inputs> {
  const {data,error}=await context.db.from("user_stores").select("user_id,store_data").eq("user_id",context.userId).maybeSingle();
  if(error) databaseError(error);
  if(data) requireOwner(context.userId,data);
  const raw=data?.store_data??{};
  return buildInputs(context.userId,{...emptyStore(),history:Array.isArray(raw.history)?raw.history:[],beliefs:Array.isArray(raw.beliefs)?raw.beliefs:[],hypotheses:Array.isArray(raw.hypotheses)?raw.hypotheses:[]});
}
export const inputsHash=(inputs:Inputs)=>createHash("sha256").update(canonicalInputs(inputs)).digest("hex");
async function records(context:AuthContext,table:string):Promise<any[]> {
  const {data,error}=await context.db.from(table).select("*").eq("user_id",context.userId).order("created_at",{ascending:false}).limit(100);
  if(error) databaseError(error);
  return (data??[]).map(row=>{requireOwner(context.userId,row);return table==="ideal_self_comparisons"?{...row,criterionKey:row.criterion_key,criterionQuote:row.criterion_quote}:row;});
}
async function saveProfile(context:AuthContext,fields:unknown,expected:unknown,suggestion?:{id:string;state:"accepted"|"edited"}) {
  const {data,error}=await context.db.rpc("save_ideal_self_profile",{p_fields:validateProfile(fields),p_expected_version:expected===null?null:uuid(expected),p_suggestion_id:suggestion?.id??null,p_suggestion_state:suggestion?.state??null});
  if(error) databaseError(error);
  return data;
}
async function assertInputsCurrent(context:AuthContext,hash:string,version?:string) {
  if(inputsHash(await readInputs(context))!==hash || (version&&(await loadProfile(context))?.version!==version)) throw new IdealSelfError("outdated","The profile or source entries changed during analysis. Nothing was saved. Try again.",409);
}

export async function handleIdealSelf(request:Request,env:IdealSelfEnv,deps:Dependencies={}) {
  try {
    if(request.method!=="POST") return {status:405,json:{code:"method_not_allowed",error:"Method not allowed."}};
    const token=/^Bearer ([^\s]+)$/i.exec(request.authorization??"")?.[1];
    if(!token) throw new IdealSelfError("unauthorized","Sign in to use your Ideal Self profile.",401);
    // JWT validation happens before parsing any user-supplied record identifiers.
    const context=await (deps.authenticate??authenticate)(token,env);
    if(!request.body||typeof request.body!=="object"||Array.isArray(request.body)) throw new IdealSelfError("invalid_input","A request object is required.");
    const body=request.body as Record<string,unknown>, operation=body.operation;
    const allowed=["status","load","save_profile","delete_profile","suggest","confirm_suggestion","compare","review"];
    if(!allowed.includes(operation as string)) throw new IdealSelfError("invalid_operation","This operation is not supported.");
    const premium=await (deps.premium??premiumAvailability)(context);
    if(operation==="status") return {status:200,json:{premium,profileSaving:true}};
    if(operation==="save_profile") return {status:200,json:{profile:await saveProfile(context,body.fields,body.expectedVersion)}};
    if(operation==="delete_profile") {
      const {error}=await context.db.rpc("delete_ideal_self_profile");
      if(error?.code==="PGRST202") {
        const probe=await context.db.from("ideal_self_profiles").select("user_id").eq("user_id",context.userId).maybeSingle();
        if(!["PGRST205","42P01"].includes(probe.error?.code??"")) databaseError(error);
      } else if(error) databaseError(error);
      return {status:200,json:{deleted:true}};
    }
    const protectedOperation=operation!=="load";
    if(protectedOperation && premium!=="allowed") throw new IdealSelfError(premium==="unavailable"?"premium_authorization_unavailable":"premium_required",premium==="unavailable"?"Premium comparisons and AI suggestions are not available yet. Your confirmed profile can still be saved.":"A verified Premium subscription is required.",premium==="unavailable"?503:403);
    const profile=await loadProfile(context);
    if(operation==="load"&&premium!=="allowed") return {status:200,json:{profile,suggestions:[],comparisons:[],premium}};
    const inputs=await readInputs(context),hash=inputsHash(inputs);
    const [suggestions,comparisons]=await Promise.all([records(context,"ideal_self_suggestions"),records(context,"ideal_self_comparisons")]);
    const mark=(row:any)=>({...row,outdated:isOutdated(profile?.version??null,row,hash)||!evidenceStillExists(row.evidence,inputs)});
    if(operation==="load") return {status:200,json:{profile,premium,suggestions:suggestions.filter(r=>evidenceStillExists(r.evidence,inputs)).map(mark),comparisons:comparisons.filter(r=>evidenceStillExists(r.evidence,inputs)).map(mark),sources:inputs.entries.map(({id,date,text})=>({id,date,text}))}};
    if(operation==="confirm_suggestion") {
      const record=suggestions.find(r=>r.id===uuid(body.id));if(!record) throw new IdealSelfError("not_found","Suggestion not found.",404);
      const fields=confirmSuggestion(mark(record) as SuggestionRecord,context.userId,body.action,body.fields);
      if(fields) return {status:200,json:{profile:await saveProfile(context,fields,body.expectedVersion,{id:record.id,state:body.action==="edit"?"edited":"accepted"})}};
      const {error}=await context.db.from("ideal_self_suggestions").update({review_state:"rejected"}).eq("user_id",context.userId).eq("id",record.id);if(error) databaseError(error);
      return {status:200,json:{reviewed:true}};
    }
    if(operation==="review") {
      const record=comparisons.find(r=>r.id===uuid(body.id));if(!record) throw new IdealSelfError("not_found","Reflection not found.",404);
      const updated=reviewComparison(mark(record) as ComparisonRecord,context.userId,body.action,body.text);
      const {error}=await context.db.from("ideal_self_comparisons").update({review_state:updated.review_state,reviewed_text:updated.reviewed_text,reviewed_at:new Date().toISOString()}).eq("id",record.id).eq("user_id",context.userId);if(error) databaseError(error);
      return {status:200,json:{reviewed:true}};
    }
    if(operation==="compare"&&!profile) throw new IdealSelfError("profile_required","Confirm your Ideal Self profile before comparing thoughts.",409);
    // Selection is by owned IDs only; the client cannot supply replacement text or interpretations.
    const requested=body.entryIds;
    if(requested!==undefined&&(!Array.isArray(requested)||requested.some(id=>typeof id!=="string")||requested.length>24)) throw new IdealSelfError("invalid_input","Select at most 24 source entries.");
    const ids=new Set((requested as string[]|undefined)??inputs.entries.slice(0,12).map(e=>e.id));
    if([...ids].some(id=>!inputs.entries.some(e=>e.id===id))) throw new IdealSelfError("invalid_evidence","A selected source is not available in this account.",403);
    const selected={...inputs,entries:inputs.entries.filter(e=>ids.has(e.id)),interpretations:inputs.interpretations.filter(i=>i.entryIds.some(id=>ids.has(id)))};
    if(!selected.entries.length) throw new IdealSelfError("insufficient_evidence","Record and sync a thought before requesting a suggestion or comparison.",409);
    if(selected.entries.some(e=>e.text.length>20000)||selected.entries.reduce((sum,e)=>sum+e.text.length,0)>60000) throw new IdealSelfError("input_too_large","Choose shorter entries for this reflection.",413);
    const priorDecisions={suggestions:suggestions.filter(r=>r.review_state!=="pending").slice(0,10),comparisons:comparisons.filter(r=>r.review_state!=="pending").slice(0,10)};
    const generated=await (deps.generate??generateIdealSelf)(env.ANTHROPIC_API_KEY??"",operation as "suggest"|"compare",selected,profile?.fields??null,priorDecisions);
    await assertInputsCurrent(context,hash,operation==="compare"?profile!.version:undefined);
    if(operation==="suggest") {
      const suggestion=generated as Suggestion;
      if(suggestions.some(r=>r.review_state==="rejected"&&JSON.stringify(profileKeys.map(k=>String(r.fields[k]).trim().toLowerCase()))===JSON.stringify(profileKeys.map(k=>suggestion.fields[k].trim().toLowerCase())))) throw new IdealSelfError("rejected_suggestion","This suggestion was already rejected. Nothing was saved.",409);
      const {error}=await context.db.from("ideal_self_suggestions").insert({user_id:context.userId,...suggestion,inputs_hash:hash});if(error) databaseError(error);
    } else {
      const results=generated as Comparison[];
      if(results.some(c=>comparisons.some(r=>r.review_state==="rejected"&&[r.interpretation,r.reviewed_text].filter(Boolean).some(text=>text.trim().toLowerCase()===c.interpretation.trim().toLowerCase())))) throw new IdealSelfError("rejected_interpretation","A previously rejected interpretation was not saved again.",409);
      const {error}=await context.db.from("ideal_self_comparisons").insert(results.map(c=>({criterion_key:c.criterionKey,criterion_quote:c.criterionQuote,interpretation:c.interpretation,relation:c.relation,evidence:c.evidence,question:c.question,user_id:context.userId,profile_version:profile!.version,inputs_hash:hash})));if(error) databaseError(error);
    }
    return {status:201,json:{created:true}};
  } catch(error) {
    if(error instanceof IdealSelfError) return {status:error.status,json:{code:error.code,error:error.message}};
    // Neither upstream responses nor private journal/profile contents reach logs or errors.
    return {status:500,json:{code:"request_failed",error:"Ideal Self could not complete this request. Your input has not been discarded."}};
  }
}
