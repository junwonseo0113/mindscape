import {describe,it,expect} from "vitest";
import {emptyStore} from "../types";
import {blankProfile,validateProfile,buildInputs,canonicalInputs,validateEvidence,validateComparisons,validateSuggestion,confirmSuggestion,reviewComparison,isOutdated,evidenceStillExists,type Inputs,type ComparisonRecord,type SuggestionRecord} from "./model";
import {editorReducer,newEditor} from "./editor";

const fields={...blankProfile(),aspirations:"Express my needs more openly"};
const inputs:Inputs={userId:"owner",entries:[{id:"one",date:"2026.10.01",text:"I held back what I needed in the meeting."},{id:"two",date:"2026.10.02",text:"I told my friend I needed some quiet time."}],interpretations:[]};
const evidence=[{entryId:"one",quote:"I held back what I needed",role:"supports" as const},{entryId:"two",quote:"I told my friend I needed some quiet time.",role:"complicates" as const}];
const reflection={criterionKey:"aspirations" as const,criterionQuote:"Express my needs",interpretation:"These entries may reflect different ways of expressing needs.",relation:"mixed" as const,evidence,question:"What felt different between these situations?"};
const record:ComparisonRecord={...reflection,id:"comparison",user_id:"owner",profile_version:"version-1",inputs_hash:"hash",review_state:"pending",reviewed_text:null};
const suggestion:SuggestionRecord={id:"suggestion",user_id:"owner",fields,explanation:"One possible direction to consider.",evidence,inputs_hash:"hash",review_state:"pending"};

describe("flexible confirmed profile",()=>{
  it("accepts one freely written field without a questionnaire",()=>expect(validateProfile(fields)).toEqual(fields));
  it.each([{},blankProfile(),{...fields,score:90},{...fields,aspirations:"x".repeat(4001)}])("rejects missing, empty, scored, or excessive input",value=>expect(()=>validateProfile(value)).toThrow());
});
describe("ownership and source truth",()=>{
  it("accepts exact excerpts from owned entries",()=>expect(validateEvidence(evidence,inputs)).toEqual(evidence));
  it.each([[{...evidence[0],entryId:"another-user-entry"}],[{...evidence[0],quote:"Words that never appeared"}],[{...evidence[0],date:"invented"}],[evidence[0],evidence[0]]].map(value=>({value})))("rejects foreign, invented, structurally invalid, or duplicate evidence",({value})=>expect(()=>validateEvidence(value,inputs)).toThrow());
  it("recognizes deleted and edited source text",()=>{expect(evidenceStillExists(evidence,inputs)).toBe(true);expect(evidenceStillExists(evidence,{...inputs,entries:inputs.entries.slice(1)})).toBe(false);expect(evidenceStillExists(evidence,{...inputs,entries:inputs.entries.map(e=>({...e,text:"Edited"}))})).toBe(false);});
  it("uses only explicitly reviewed interpretations, never client confidence",()=>{
    const store=emptyStore();store.history=[{id:"one",date:"2026.10.01",text:"A thought"}];
    store.beliefs=["accepted","pending","rejected"].map((id,index)=>({id,domain:"Work",statement:id,confidence:99,evidenceCount:9,evidenceQuotes:[],supportingEntryIds:["one"],userReaction:index===0?"accepted":index===2?"rejected":null}));
    expect(buildInputs("owner",store).interpretations.map(i=>i.id)).toEqual(["accepted"]);
    expect(()=>buildInputs("",store)).toThrow();
  });
  it("rejects duplicate source identities",()=>{const store=emptyStore();store.history=[{id:"one",date:"today",text:"a"},{id:"one",date:"today",text:"b"}];expect(()=>buildInputs("owner",store)).toThrow();});
});
describe("tentative comparisons",()=>{
  it("allows mixed evidence tied to a confirmed criterion",()=>expect(validateComparisons({comparisons:[reflection]},fields,inputs)).toEqual([reflection]));
  it("does not turn one negative thought into a recurring tension",()=>expect(()=>validateComparisons({comparisons:[{...reflection,relation:"tension",evidence:[evidence[0]]}]},fields,inputs)).toThrow());
  it("allows explicit insufficient evidence without invented excerpts",()=>expect(validateComparisons({comparisons:[{...reflection,relation:"insufficient_evidence",evidence:[]}]},fields,inputs)[0].relation).toBe("insufficient_evidence"));
  it("requires both sides for mixed evidence",()=>expect(()=>validateComparisons({comparisons:[{...reflection,evidence:evidence.map(e=>({...e,role:"supports"}))}]},fields,inputs)).toThrow());
  it("rejects unconfirmed criteria and personality scores",()=>{expect(()=>validateComparisons({comparisons:[{...reflection,criterionQuote:"Be more successful"}]},fields,inputs)).toThrow();expect(()=>validateComparisons({comparisons:[{...reflection,alignmentPercentage:80}]},fields,inputs)).toThrow();});
  it.each(["You are 80% aligned.","You have a personality disorder.","This makes you a worse person."])("rejects scored or judgmental model prose",interpretation=>expect(()=>validateComparisons({comparisons:[{...reflection,interpretation}]},fields,inputs)).toThrow());
});
describe("suggestions require explicit confirmation",()=>{
  it("validates suggestions but does not confirm them",()=>{const parsed=validateSuggestion({fields,explanation:"Consider this possibility.",evidence},inputs);expect(parsed.fields).toEqual(fields);expect(suggestion.review_state).toBe("pending");});
  it("requires an explicit action",()=>expect(()=>confirmSuggestion(suggestion,"owner",undefined)).toThrow());
  it("accepts, edits, or rejects without mutating the proposed record",()=>{expect(confirmSuggestion(suggestion,"owner","accept")).toEqual(fields);const edit={...fields,values:"Care"};expect(confirmSuggestion(suggestion,"owner","edit",edit)).toEqual(edit);expect(confirmSuggestion(suggestion,"owner","reject")).toBeNull();expect(suggestion.review_state).toBe("pending");});
  it("rejects another user's suggestion, stale sources, and repeat confirmation",()=>{expect(()=>confirmSuggestion(suggestion,"other","accept")).toThrow();expect(()=>confirmSuggestion({...suggestion,outdated:true},"owner","accept")).toThrow();expect(()=>confirmSuggestion({...suggestion,review_state:"rejected"},"owner","accept")).toThrow();});
});
describe("user review and versions",()=>{
  it("acceptance records fit, not verification, and preserves the original",()=>{const next=reviewComparison(record,"owner","accept");expect(next.review_state).toBe("accepted");expect(next.interpretation).toBe(record.interpretation);expect(record.review_state).toBe("pending");});
  it("retains edits and rejection decisions",()=>{const edited=reviewComparison(record,"owner","edit","I see the context differently.");const rejected=reviewComparison(edited,"owner","reject");expect(rejected.review_state).toBe("rejected");expect(rejected.reviewed_text).toBe("I see the context differently.");expect(rejected.interpretation).toBe(record.interpretation);});
  it("prevents review of other users' or outdated reflections",()=>{expect(()=>reviewComparison(record,"other","accept")).toThrow();expect(()=>reviewComparison({...record,outdated:true},"owner","accept")).toThrow();});
  it("marks comparisons outdated when profile or journal/reviewed inputs change",()=>{expect(isOutdated("version-2",record,"hash")).toBe(true);expect(isOutdated("version-1",record,"new-hash")).toBe(true);expect(isOutdated("version-1",record,"hash")).toBe(false);expect(canonicalInputs({...inputs,entries:inputs.entries.slice(1)})).not.toBe(canonicalInputs(inputs));});
});
describe("draft resilience",()=>{
  it("preserves a user's unsaved input after a failed save",()=>{const draft=editorReducer(newEditor(),{type:"change",key:"values",value:"My unsaved words"});const failed=editorReducer(editorReducer(draft,{type:"saving"}),{type:"failed",message:"Offline"});expect(failed.draft.values).toBe("My unsaved words");expect(failed.saving).toBe(false);expect(failed.profile).toBeNull();});
  it("does not discard a dirty draft after retrying a load",()=>{const state=editorReducer(newEditor(),{type:"change",key:"qualities",value:"Keep these words"});expect(editorReducer(state,{type:"loaded",profile:null,preserveDraft:true}).draft.qualities).toBe("Keep these words");});
  it("clears sensitive state on account change or explicit deletion",()=>expect(editorReducer({...newEditor(),draft:fields},{type:"reset"})).toEqual(newEditor()));
});
