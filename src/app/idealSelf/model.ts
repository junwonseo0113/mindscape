import type { Store } from "../types";

export const profileKeys = ["qualities", "values", "aspirations", "avoid"] as const;
export type ProfileKey = typeof profileKeys[number];
export type ProfileFields = Record<ProfileKey, string>;
export const blankProfile = (): ProfileFields => ({qualities:"", values:"", aspirations:"", avoid:""});
export type Profile = { user_id:string; version:string; fields:ProfileFields; updated_at:string };
export type EntrySource = {id:string; date:string; text:string};
export type ReviewedSource = {id:string; text:string; entryIds:string[]};
export type Inputs = {userId:string; entries:EntrySource[]; interpretations:ReviewedSource[]};
export type Evidence = {entryId:string; quote:string; role:"supports"|"complicates"|"context"};
export type ReviewState = "pending"|"accepted"|"edited"|"rejected";
export type Comparison = {
  criterionKey:ProfileKey; criterionQuote:string; interpretation:string;
  relation:"alignment"|"tension"|"mixed"|"insufficient_evidence";
  evidence:Evidence[]; question:string;
};
export type ComparisonRecord = Comparison & {id:string; user_id:string; profile_version:string; inputs_hash:string; review_state:ReviewState; reviewed_text:string|null; outdated?:boolean};
export type Suggestion = {fields:ProfileFields; explanation:string; evidence:Evidence[]};
export type SuggestionRecord = Suggestion & {id:string; user_id:string; inputs_hash:string; review_state:ReviewState; outdated?:boolean};
export type Availability = "unavailable"|"premium_required"|"allowed";
export type IdealSelfSnapshot = {profile:Profile|null; comparisons:ComparisonRecord[]; suggestions:SuggestionRecord[]; premium:Availability; sources?:EntrySource[]};

export class IdealSelfError extends Error {
  constructor(public code:string, message:string, public status=400) { super(message); }
}
const invalid = (message:string):never => {throw new IdealSelfError("invalid_input",message);};
function object(value:unknown, keys:readonly string[]):Record<string,unknown> {
  if(!value || typeof value!=="object" || Array.isArray(value)) return invalid("An object is required.");
  if(Object.keys(value).some(k=>!keys.includes(k))) return invalid("Unexpected fields were supplied.");
  return value as Record<string,unknown>;
}
function text(value:unknown,max:number,allowEmpty=false):string {
  if(typeof value!=="string" || value.length>max || (!allowEmpty&&!value.trim())) return invalid("Text is missing or exceeds its allowed length.");
  return value.trim();
}
function tentativeText(value:unknown,max:number):string {
  const result=text(value,max);
  if(/\b\d+(?:\.\d+)?\s*%|\b(?:personality|alignment|worthiness)\s+score\b|\byou (?:have|are|suffer from)\s+(?:a |an )?(?:personality disorder|bipolar|depression|autism|adhd|ptsd|narcissis\w*)\b|person you hate|\b(?:better|worse) person\b/i.test(result)) return invalid("AI reflections cannot diagnose or rate a person's worth or alignment.");
  return result;
}
export function validateProfile(value:unknown):ProfileFields {
  const raw=object(value,profileKeys);
  const fields=Object.fromEntries(profileKeys.map(k=>[k,text(raw[k],4000,true)])) as ProfileFields;
  if(!profileKeys.some(k=>fields[k])) return invalid("Write at least one quality, value, aspiration, or characteristic to avoid.");
  return fields;
}
export function requireOwner(userId:string, row:{user_id:string}) {
  if(!userId || row.user_id!==userId) throw new IdealSelfError("forbidden","This record is not available.",403);
}

/** Only server-fetched store data may be passed here, never request-supplied journal text. */
export function buildInputs(userId:string, store:Store):Inputs {
  if(!userId) throw new IdealSelfError("unauthorized","Sign in to continue.",401);
  const entries=store.history.map(e=>({id:e.id,date:e.date,text:e.text}));
  if(new Set(entries.map(e=>e.id)).size!==entries.length || entries.some(e=>!e.id||typeof e.text!=="string"||typeof e.date!=="string")) return invalid("Source entries are not valid.");
  const entryIds=new Set(entries.map(e=>e.id));
  const approved=store.beliefs.filter(b=>b.userReaction!=="rejected" && (b.userReaction==="accepted"||b.discoveryReaction==="agree"));
  const interpretations:ReviewedSource[]=approved.map(b=>({id:b.id,text:b.discoveryReaction==="agree"?(b.discoveryInterpretationOverride||b.statement):b.statement,entryIds:(b.supportingEntryIds??[]).filter(id=>entryIds.has(id))}));
  store.hypotheses.filter(h=>h.reaction==="agree").forEach(h=>interpretations.push({id:h.id,text:h.title,entryIds:[...new Set(h.relatedBeliefIds.flatMap(id=>approved.find(b=>b.id===id)?.supportingEntryIds??[]))].filter(id=>entryIds.has(id))}));
  return {userId,entries,interpretations};
}
/** Stable ordering lets the server hash input versions without storing a second journal copy. */
export function canonicalInputs(inputs:Inputs):string {
  return JSON.stringify({userId:inputs.userId,entries:[...inputs.entries].sort((a,b)=>a.id.localeCompare(b.id)),interpretations:[...inputs.interpretations].map(i=>({...i,entryIds:[...i.entryIds].sort()})).sort((a,b)=>a.id.localeCompare(b.id))});
}
export function validateEvidence(value:unknown, inputs:Inputs):Evidence[] {
  if(!Array.isArray(value)||value.length>12) return invalid("Evidence must be a list of at most 12 excerpts.");
  const seen=new Set<string>();
  return value.map(item=>{
    const raw=object(item,["entryId","quote","role"]);
    const entryId=text(raw.entryId,160), quote=text(raw.quote,1800);
    const entry=inputs.entries.find(e=>e.id===entryId);
    if(!entry || !entry.text.includes(quote)) return invalid("An evidence excerpt does not match an owned source entry.");
    if(!["supports","complicates","context"].includes(raw.role as string)) return invalid("Evidence role is not valid.");
    if(seen.has(entryId+"\n"+quote)) return invalid("Evidence excerpts must not be duplicated.");
    seen.add(entryId+"\n"+quote);
    return {entryId,quote,role:raw.role as Evidence["role"]};
  });
}
export function validateSuggestion(value:unknown,inputs:Inputs):Suggestion {
  const raw=object(value,["fields","explanation","evidence"]);
  const evidence=validateEvidence(raw.evidence,inputs);
  if(!evidence.length) return invalid("An AI suggestion needs source evidence.");
  return {fields:validateProfile(raw.fields),explanation:tentativeText(raw.explanation,1200),evidence};
}
export function validateComparisons(value:unknown,profile:ProfileFields,inputs:Inputs):Comparison[] {
  const raw=object(value,["comparisons"]);
  if(!Array.isArray(raw.comparisons)||raw.comparisons.length<1||raw.comparisons.length>6) return invalid("Return between one and six reflections.");
  return raw.comparisons.map(item=>{
    const row=object(item,["criterionKey","criterionQuote","interpretation","relation","evidence","question"]);
    if(!profileKeys.includes(row.criterionKey as ProfileKey)) return invalid("The aspiration reference is not valid.");
    const criterionKey=row.criterionKey as ProfileKey,criterionQuote=text(row.criterionQuote,1000);
    if(!profile[criterionKey].includes(criterionQuote)) return invalid("The aspiration excerpt must match the confirmed profile.");
    const relations=["alignment","tension","mixed","insufficient_evidence"];
    if(!relations.includes(row.relation as string)) return invalid("The reflection type is not valid.");
    const relation=row.relation as Comparison["relation"], evidence=validateEvidence(row.evidence,inputs);
    if(relation!=="insufficient_evidence"&&new Set(evidence.map(e=>e.entryId)).size<2) return invalid("One thought cannot establish a recurring alignment or tension.");
    if(relation==="mixed"&&(!evidence.some(e=>e.role==="supports")||!evidence.some(e=>e.role==="complicates"))) return invalid("Mixed evidence needs both support and complication.");
    const question=tentativeText(row.question,500);
    if(!question.endsWith("?")) return invalid("A reflection must include a question.");
    return {criterionKey,criterionQuote,interpretation:tentativeText(row.interpretation,1800),relation,evidence,question};
  });
}
export function reviewComparison(record:ComparisonRecord,userId:string,action:unknown,editedText?:unknown):ComparisonRecord {
  requireOwner(userId,record);
  if(record.outdated) throw new IdealSelfError("outdated","Refresh this reflection before reviewing it.",409);
  if(!["accept","edit","reject"].includes(action as string)) return invalid("Choose accept, edit, or reject.");
  return {...record,review_state:action==="accept"?"accepted":action==="edit"?"edited":"rejected",reviewed_text:action==="edit"?text(editedText,1800):record.reviewed_text};
}
export function confirmSuggestion(record:SuggestionRecord,userId:string,action:unknown,editedFields?:unknown):ProfileFields|null {
  requireOwner(userId,record);
  if(record.outdated) throw new IdealSelfError("outdated","This suggestion uses older source material.",409);
  if(record.review_state!=="pending") throw new IdealSelfError("already_reviewed","This suggestion has already been reviewed.",409);
  if(action==="reject") return null;
  if(action==="accept") return validateProfile(record.fields);
  if(action==="edit") return validateProfile(editedFields);
  return invalid("A suggestion must be explicitly accepted, edited, or rejected.");
}
export function isOutdated(profileVersion:string|null,record:{profile_version?:string;inputs_hash:string},currentHash:string):boolean {
  return (!!record.profile_version&&record.profile_version!==profileVersion)||record.inputs_hash!==currentHash;
}
export function evidenceStillExists(evidence:Evidence[],inputs:Inputs):boolean {
  return evidence.every(e=>inputs.entries.some(source=>source.id===e.entryId&&source.text.includes(e.quote)));
}
