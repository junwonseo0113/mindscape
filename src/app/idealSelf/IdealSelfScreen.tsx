import React from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../supabaseClient";
import { idealSelfRequest, loadIdealSelf, IdealSelfRequestError, type SaveProfileResponse } from "./client";
import { editorReducer, newEditor } from "./editor";
import { profileKeys, validateProfile, type ProfileKey, type IdealSelfSnapshot, type ComparisonRecord } from "./model";
import "./ideal-self.css";

const labels:Record<ProfileKey,string>={qualities:"Qualities I want to nurture",values:"What matters to me",aspirations:"Who I want to become",avoid:"Characteristics I want to move away from"};
const hints:Record<ProfileKey,string>={qualities:"Describe qualities in your own words.",values:"Name values or priorities that feel important to you.",aspirations:"Write about the person you hope to become.",avoid:"Describe patterns you would like to respond to differently."};
const relationLabels={alignment:"Possible alignment",tension:"Possible tension",mixed:"Mixed evidence",insufficient_evidence:"Insufficient evidence"};
type Props={onBack:()=>void;onSignIn:()=>void;onOpenEntry:(id:string)=>void;isDemoMode:boolean;onOpenPremium?:()=>void};

export default function IdealSelfScreen({onBack,onSignIn,onOpenEntry,isDemoMode,onOpenPremium}:Props) {
  const [editor,dispatch]=React.useReducer(editorReducer,undefined,newEditor);
  const [snapshot,setSnapshot]=React.useState<IdealSelfSnapshot|null>(null);
  const [auth,setAuth]=React.useState<"checking"|"guest"|"signed_in"|"unconfigured">("checking");
  const [loading,setLoading]=React.useState(true),[ready,setReady]=React.useState(false);
  const [editing,setEditing]=React.useState(false),[notice,setNotice]=React.useState("");
  const [busy,setBusy]=React.useState(false),[deleteArmed,setDeleteArmed]=React.useState(false);
  const [refreshNeeded,setRefreshNeeded]=React.useState(false);
  const [suggestionId,setSuggestionId]=React.useState<string|null>(null);
  const generation=React.useRef(0);
  const dirty=React.useRef(false);
  const load=React.useCallback(async()=>{
    const current=generation.current;setLoading(true);setNotice("");
    try {const next=await loadIdealSelf();if(current!==generation.current)return;setSnapshot(next);dispatch({type:"loaded",profile:next.profile,preserveDraft:dirty.current});setReady(true);setRefreshNeeded(false);return true;}
    catch(error){if(current===generation.current)dispatch({type:"failed",message:(error as Error).message});return false;}
    finally {if(current===generation.current)setLoading(false);}
  },[]);
  React.useEffect(()=>{
    let disposed=false;let priorUser:string|null|undefined;
    async function sessionChanged(userId:string|null){
      if(disposed||priorUser===userId)return;priorUser=userId;generation.current++;dirty.current=false;dispatch({type:"reset"});setSnapshot(null);setReady(false);setBusy(false);setDeleteArmed(false);setRefreshNeeded(false);setEditing(false);setSuggestionId(null);setNotice("");
      if(!userId){setAuth("guest");setLoading(false);return;}setAuth("signed_in");await load();
    }
    if(isDemoMode||!supabase){setAuth(isDemoMode?"guest":"unconfigured");setLoading(false);return ()=>{generation.current++;};}
    void supabase.auth.getSession().then(({data,error})=>{if(error&&!disposed){setLoading(false);setAuth("guest");dispatch({type:"failed",message:"Could not verify your session. Sign in again."});return;}void sessionChanged(data.session?.user.id??null);}).catch(()=>{if(!disposed){setLoading(false);setAuth("guest");dispatch({type:"failed",message:"Could not verify your session. Your draft is still here."});}});
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{void sessionChanged(session?.user.id??null);});
    return ()=>{disposed=true;generation.current++;data.subscription.unsubscribe();};
  },[isDemoMode,load]);
  const premium=ready&&snapshot?.premium==="allowed";
  const canSave=auth==="signed_in"&&ready&&!isDemoMode;
  const acting=busy||editor.saving;
  async function action(body:Record<string,unknown>,success:string) {
    const current=generation.current;setBusy(true);setNotice("");
    try {await idealSelfRequest(body);if(current!==generation.current)return;if(body.operation==="delete_profile"||(body.operation==="confirm_suggestion"&&body.action==="accept")){dirty.current=false;dispatch({type:"reset"});setEditing(false);setSuggestionId(null);}const refreshed=await load();if(refreshed)setNotice(success);}
    catch(error){if(current===generation.current){dispatch({type:"failed",message:(error as Error).message});if(error instanceof IdealSelfRequestError&&error.status===409)setRefreshNeeded(true);}}
    finally {if(current===generation.current)setBusy(false);}
  }
  async function save(event:React.FormEvent){
    event.preventDefault();if(!canSave||acting)return;
    try {validateProfile(editor.draft);}catch(error){dispatch({type:"failed",message:(error as Error).message});return;}
    const current=generation.current;dispatch({type:"saving"});setNotice("");
    try {
      const body=suggestionId?{operation:"confirm_suggestion",id:suggestionId,action:"edit",fields:editor.draft,expectedVersion:editor.profile?.version??null}:{operation:"save_profile",fields:editor.draft,expectedVersion:editor.profile?.version??null};
      const result=await idealSelfRequest<SaveProfileResponse>(body);if(current!==generation.current)return;
      dirty.current=false;dispatch({type:"saved",profile:result.profile});setSnapshot(prev=>prev?{...prev,profile:result.profile,comparisons:prev.comparisons.map(c=>({...c,outdated:true}))}:prev);setEditing(false);setSuggestionId(null);setNotice("Your confirmed Ideal Self profile was saved."+(snapshot?.comparisons.length?" Earlier comparisons need a fresh review.":""));
    } catch(error){if(current===generation.current){dispatch({type:"failed",message:(error as Error).message});if(error instanceof IdealSelfRequestError&&error.status===409)setRefreshNeeded(true);}}
  }
  return <div className="ideal-self-screen">
    <header><button className="ideal-self-back" onClick={onBack}><ArrowLeft size={17}/>Back</button><h1>Ideal Self</h1><p>A direction you choose, not a measure of your worth.</p></header>
    <div className="ideal-self-content">
      {loading&&<p role="status">Loading your account profile…</p>}
      {auth!=="checking"&&auth!=="signed_in"&&<div className="ideal-self-panel"><p>{isDemoMode?"Ideal Self is separate from example data. Leave Demo Mode and sign in to save your own profile.":auth==="unconfigured"?"Account storage is not configured in this installation. You can explore the form, but your draft cannot be saved yet.":"Sign in to save a private Ideal Self profile to your account."}</p><p className="ideal-self-note">Unsaved text stays in this view only. It is separate from your journal.</p>{auth==="guest"&&!isDemoMode&&<button onClick={onSignIn}>Sign in</button>}</div>}
      {editor.error&&<div role="alert" className="ideal-self-error"><p>{editor.error}</p>{auth==="signed_in"&&(!ready||refreshNeeded)&&<button disabled={loading||acting} onClick={()=>void load()}>{refreshNeeded?"Reload saved version and keep my draft":"Retry loading"}</button>}</div>}
      {notice&&<p role="status" className="ideal-self-success">{notice}</p>}
      {editor.profile&&!editing?<section className="ideal-self-panel" aria-labelledby="ideal-profile-title"><h2 id="ideal-profile-title">Your confirmed profile</h2>{profileKeys.filter(key=>editor.profile!.fields[key]).map(key=><div className="ideal-self-field-view" key={key}><h3>{labels[key]}</h3><p>{editor.profile!.fields[key]}</p></div>)}<button disabled={acting} onClick={()=>{setEditing(true);setNotice("");}}>Edit profile</button></section>:<form onSubmit={save}>
        <h2>{suggestionId?"Edit the proposed aspiration":"Your words, your direction"}</h2><p className="ideal-self-note">Fill in whatever feels useful. One field is enough, and you can change it later.</p>
        {suggestionId&&editor.profile&&<p className="ideal-self-note">Saving confirms these words as a new version of your profile. Your previous confirmed version is retained.</p>}
        {profileKeys.map(key=><label key={key} className="ideal-self-field"><span>{labels[key]}</span><textarea maxLength={4000} rows={3} placeholder={hints[key]} value={editor.draft[key]} disabled={loading||acting} onChange={e=>{dirty.current=true;dispatch({type:"change",key,value:e.target.value});}}/></label>)}
        <button className="ideal-self-primary" disabled={!canSave||loading||acting} type="submit">{editor.saving?"Saving…":"Save confirmed profile"}</button>
        {editor.profile&&<button type="button" disabled={acting} onClick={()=>{dirty.current=false;dispatch({type:"loaded",profile:editor.profile});setEditing(false);setSuggestionId(null);}}>Cancel editing</button>}
      </form>}
      <section className="ideal-self-panel" aria-labelledby="ideal-comparison-title"><div className="ideal-self-section-title"><h2 id="ideal-comparison-title">Reflect against your thoughts</h2><span>Premium</span></div><p>Consider recorded thoughts alongside your confirmed aspirations. An uncomfortable thought is not an action or an endorsement.</p>
        {!premium&&<p className="ideal-self-note">{snapshot?.premium==="premium_required"?"A verified Premium subscription is required for comparisons.":"Comparisons and AI suggestions are not available yet. Your confirmed profile can still be saved when account storage is connected."}</p>}
        {snapshot?.premium==="premium_required"&&onOpenPremium&&<button onClick={onOpenPremium}>View subscription options</button>}
        <div className="ideal-self-actions"><button disabled={!premium||acting||!editor.profile} onClick={()=>void action({operation:"compare"},"New reflections are ready to review.")}>{busy?"Working…":"Compare recorded thoughts"}</button><button disabled={!premium||acting} onClick={()=>void action({operation:"suggest"},"A possible aspiration is ready for your review.")}>Suggest aspirations from entries</button>{premium&&<button disabled={acting||loading} onClick={()=>void load()}>Refresh saved reflections</button>}</div>
        <p className="ideal-self-note">Suggestions never become comparison criteria until you explicitly confirm or edit them. No background analysis or notifications are used.</p>
      </section>
      {snapshot?.suggestions.filter(s=>s.review_state==="pending").map(s=><section className="ideal-self-panel" key={s.id}><h2>AI-proposed aspiration</h2><p className="ideal-self-note">Not part of your confirmed profile. Confirming will save a new profile version; it will not happen automatically.{s.outdated?" Sources have changed; request a fresh suggestion.":""}</p>{profileKeys.filter(k=>s.fields[k]).map(k=><div key={k}><h3>{labels[k]}</h3><p>{s.fields[k]}</p></div>)}<p>{s.explanation}</p>{s.evidence.map((e,i)=><blockquote key={i}><p>{e.quote}</p><button onClick={()=>onOpenEntry(e.entryId)}>Read original entry{snapshot.sources?.find(source=>source.id===e.entryId)?.date?` ? ${snapshot.sources.find(source=>source.id===e.entryId)!.date}`:""}</button></blockquote>)}<div className="ideal-self-actions"><button disabled={acting||s.outdated} onClick={()=>void action({operation:"confirm_suggestion",id:s.id,action:"accept",expectedVersion:editor.profile?.version??null},"Aspiration confirmed as your new profile.")}>Confirm aspiration</button><button disabled={acting||s.outdated} onClick={()=>{dirty.current=true;dispatch({type:"suggestion",fields:s.fields});setSuggestionId(s.id);setEditing(true);}}>Edit before confirming</button><button disabled={acting||s.outdated} onClick={()=>void action({operation:"confirm_suggestion",id:s.id,action:"reject"},"Suggestion rejected. Your confirmed profile is unchanged.")}>Reject suggestion</button></div></section>)}
      {snapshot?.comparisons.map(c=><ComparisonCard key={c.id} record={c} busy={acting} onOpenEntry={onOpenEntry} dates={Object.fromEntries((snapshot.sources??[]).map(e=>[e.id,e.date]))} onReview={(review,text)=>void action({operation:"review",id:c.id,action:review,text},"Your review was saved.")}/>)}
      {editor.profile&&<section className="ideal-self-delete"><button disabled={acting} onClick={()=>{if(!deleteArmed){setDeleteArmed(true);return;}void action({operation:"delete_profile"},"Your Ideal Self profile, versions, suggestions, and comparisons were deleted.");setDeleteArmed(false);}}>{deleteArmed?"Confirm delete Ideal Self profile":"Delete Ideal Self profile"}</button>{deleteArmed&&<><p className="ideal-self-note">This removes the dedicated profile and its reflections. Your ordinary journal entries are kept.</p><button onClick={()=>setDeleteArmed(false)}>Keep profile</button></>}</section>}
    </div>
  </div>;
}

function ComparisonCard({record,busy,onOpenEntry,onReview,dates}:{record:ComparisonRecord;busy:boolean;onOpenEntry:(id:string)=>void;onReview:(action:string,text?:string)=>void;dates:Record<string,string>}) {
  const [editing,setEditing]=React.useState(false),[text,setText]=React.useState(record.reviewed_text??record.interpretation);
  return <section className="ideal-self-panel"><div className="ideal-self-section-title"><h2>{relationLabels[record.relation]}</h2><span>{record.outdated?"Outdated":record.review_state}</span></div><h3>Aspiration being considered</h3><p>{record.criterionQuote}</p><p>{record.reviewed_text??record.interpretation}</p>{record.reviewed_text&&<details><summary>Original tentative interpretation</summary><p>{record.interpretation}</p></details>}{record.outdated&&<p className="ideal-self-note">The profile or source material changed. Request a fresh comparison before reviewing this one.</p>}{record.evidence.map((e,i)=><blockquote key={i}><p>{e.quote}</p><button onClick={()=>onOpenEntry(e.entryId)}>Read entry · {dates[e.entryId]??"Original source"}</button></blockquote>)}<p>{record.question}</p>{record.relation==="tension"&&!record.outdated&&record.review_state==="pending"&&<p className="ideal-self-note">You chose this aspiration. Does the possible connection with these entries fit your experience?</p>}
    <p className="ideal-self-note">Accepting means this fits your experience, not that it has been objectively verified.</p>
    {editing&&<label className="ideal-self-field"><span>Your interpretation</span><textarea value={text} maxLength={1800} onChange={e=>setText(e.target.value)}/><button disabled={busy||!text.trim()||record.outdated} onClick={()=>onReview("edit",text)}>Save my interpretation</button></label>}
    <div className="ideal-self-actions"><button disabled={busy||record.outdated} onClick={()=>onReview("accept")}>Fits my experience</button><button disabled={busy||record.outdated} onClick={()=>setEditing(v=>!v)}>Edit interpretation</button><button disabled={busy||record.outdated} onClick={()=>onReview("reject")}>Doesn't fit</button></div>
  </section>;
}
