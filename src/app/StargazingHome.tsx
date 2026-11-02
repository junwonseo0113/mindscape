import React from "react";
import {ArrowRight,PenLine,Mic,X,House,Orbit,ChartNoAxesColumn,BookOpen} from "lucide-react";
import {DEMO_STORE} from "../demo/demoData";
import type {Store,StoredBelief,StoredEvidenceQuote} from "./types";
import type {CognitiveRegion} from "./neuralBrainLayout";
import {approvedHomeBeliefs} from "./homeMapModel";
// Retain the existing shared navigation CSS for other screens; new styles are Home-scoped.
import "./stargazing-home.css";
import "./home-observatory.css";
import nebula from "../assets/home-nebula.png";

export type HomeReviewTarget={kind:"hypothesis";index:number;text:string}|{kind:"belief";id:string;text:string};
export type HomeProps={store:Store;isDemoMode?:boolean;mapAccessAllowed?:boolean;onNavSelect?:(id:string)=>void;onStartThink?:(mode?:"text"|"voice")=>void;onReviewInterpretation?:(target:HomeReviewTarget)=>void;onOpenBrainMap?:(region?:CognitiveRegion,beliefId?:string)=>void;onOpenEntry?:(id:string)=>void};
const ThoughtMap=React.lazy(()=>import("./HomeThoughtMap"));
type Source=StoredEvidenceQuote&{entryId?:string};
function sourcesFor(belief:StoredBelief,store:Store):Source[] {
  if(belief.evidenceQuotes.length)return belief.evidenceQuotes.map(quote=>{
    const entry=store.history.find(e=>e.date===quote.date&&e.text.includes(quote.quote))??store.history.find(e=>(belief.supportingEntryIds??[]).includes(e.id)&&e.text.includes(quote.quote));
    return {...quote,entryId:entry?.id};
  });
  return (belief.supportingEntryIds??[]).flatMap(id=>{const entry=store.history.find(e=>e.id===id);return entry?[{entryId:entry.id,date:entry.date,quote:entry.text}]:[];});
}

class HomeMapBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div className="observatory-message" role="alert"><h2>Your map could not open.</h2><p>Recording and your other screens are still available.</p><button onClick={()=>window.location.reload()}>Reload map</button></div>:this.props.children;}
}

export default function StargazingHome({store,isDemoMode=false,mapAccessAllowed=false,onNavSelect,onStartThink,onReviewInterpretation,onOpenBrainMap,onOpenEntry}:HomeProps) {
  const [preview,setPreview]=React.useState(false),[selectedId,setSelectedId]=React.useState<string|null>(null),[sheetOpen,setSheetOpen]=React.useState(false);
  const [hidden,setHidden]=React.useState(()=>document.hidden);
  const closeRef=React.useRef<HTMLButtonElement>(null);
  const example=preview||isDemoMode;
  const mapStore=preview?DEMO_STORE:store;
  const beliefs=preview?DEMO_STORE.beliefs:mapAccessAllowed?(isDemoMode?store.beliefs.filter(b=>b.userReaction!=="rejected"):approvedHomeBeliefs(store)):[];
  const ids=new Set(beliefs.map(b=>b.id));
  const connections=mapStore.connections.filter(c=>ids.has(c.a)&&ids.has(c.b));
  const selected=beliefs.find(b=>b.id===selectedId);
  const sources=selected?sourcesFor(selected,mapStore):[];
  const linked=selected?connections.filter(c=>c.a===selected.id||c.b===selected.id).map(c=>({connection:c,belief:beliefs.find(b=>b.id===(c.a===selected.id?c.b:c.a))!})):[];
  const pendingTargets:HomeReviewTarget[]=[...store.hypotheses.flatMap((h,index)=>h.reaction==null?[{kind:"hypothesis" as const,index,text:h.title}]:[]),...store.beliefs.flatMap(b=>b.userReaction==null&&b.discoveryReaction==null?[{kind:"belief" as const,id:b.id,text:b.discoveryInterpretationOverride||b.statement}]:[])];
  React.useEffect(()=>{const changed=()=>setHidden(document.hidden);document.addEventListener("visibilitychange",changed);return()=>document.removeEventListener("visibilitychange",changed);},[]);
  React.useEffect(()=>{if(sheetOpen)closeRef.current?.focus();},[sheetOpen,selectedId]);
  function closeSheet(){setSheetOpen(false);setSelectedId(null);requestAnimationFrame(()=>{if(selectedId)document.querySelector<SVGGElement>(`[data-node-id="${CSS.escape(selectedId)}"]`)?.focus();});}
  React.useEffect(()=>{if(!sheetOpen)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();closeSheet();}};document.addEventListener("keydown",escape);return()=>document.removeEventListener("keydown",escape);},[sheetOpen,selectedId]);
  function select(id:string){if(sheetOpen&&selectedId===id){closeSheet();return;}setSelectedId(id);setSheetOpen(true);}
  function stopPreview(){setPreview(false);setSelectedId(null);setSheetOpen(false);}
  const canShowMap=mapAccessAllowed||preview;
  return <main className="observatory-home" data-has-discoveries={mapAccessAllowed&&pendingTargets.length>0?"true":"false"} data-page-hidden={hidden?"true":"false"} aria-label="Mindscape Home">
    <div className="observatory-nebula" aria-hidden="true"><img src={nebula} alt="" onError={e=>{e.currentTarget.style.display="none";}}/></div>
    <header className="observatory-header"><div><h1>Mindscape</h1><p>Your mind, connected</p></div><button className="observatory-profile" aria-label="Open profile" onClick={()=>onNavSelect?.("profile")}>{store.account?.name?.slice(0,1)||"M"}</button></header>
    {example&&<div className="observatory-preview-label"><span>{preview?"Example map preview · not your thoughts":"Demo Mode · example data"}</span>{preview&&<button onClick={stopPreview}>Exit preview</button>}</div>}
    <section className="observatory-map-stage" data-tutorial="brain-card" aria-label="Your Brain Map">
      {canShowMap?<HomeMapBoundary><React.Suspense fallback={<div className="observatory-message" role="status"><p>Opening your map…</p></div>}><ThoughtMap beliefs={beliefs} connections={connections} selectedId={selectedId} onSelect={select} onOpenMind={()=>onNavSelect?.("analysis")} onOpenFullMap={()=>onOpenBrainMap?.()}/></React.Suspense>{beliefs.length===0&&<div className="observatory-structure-empty"><p>Brain structure / no approved interpretations yet.</p><button onClick={()=>{setPreview(true);setSelectedId(null);}}>Preview example information nodes<ArrowRight size={13}/></button></div>}</HomeMapBoundary>:<div className="observatory-message">
        <h2>{mapAccessAllowed?"Your map begins with a thought.":"Your personal map, with Premium."}</h2>
        <p>{mapAccessAllowed?(pendingTargets.length?"Review your discoveries. Only interpretations you approve become part of this map.":"Record what is on your mind. The interpretations you approve will find a place here."):"Recording and your journal are always available. Open the existing map access screen to explore your options."}</p>
        {!mapAccessAllowed&&<button onClick={()=>onOpenBrainMap?.()}>View map access<ArrowRight size={15}/></button>}
        <button className="observatory-preview-button" onClick={()=>{setPreview(true);setSelectedId(null);}}>Preview an example map<ArrowRight size={14}/></button>
        <button className="observatory-mind-link" onClick={()=>onNavSelect?.("analysis")}>Open Mind overview</button>
      </div>}
    </section>
    <div className="observatory-recording">
      {mapAccessAllowed&&pendingTargets.length>0&&<button className="observatory-discoveries" onClick={()=>onReviewInterpretation?onReviewInterpretation(pendingTargets[0]):onNavSelect?.("discoveryAnalysis")}>{pendingTargets.length} {pendingTargets.length===1?"discovery":"discoveries"} to review<ArrowRight size={19}/></button>}
      <div className="observatory-recording-row" data-tutorial="think-card"><button className="observatory-record" onClick={()=>onStartThink?.("text")}><PenLine size={23}/><span>Record a thought</span></button><button className="observatory-microphone" aria-label="Record with your voice" onClick={()=>onStartThink?.("voice")}><Mic size={25}/></button></div>
    </div>
    <nav className="observatory-navigation" aria-label="Main navigation">{[{id:"home",label:"Home",Icon:House},{id:"analysis",label:"Mind",Icon:Orbit},{id:"discoveryAnalysis",label:"Analysis",Icon:ChartNoAxesColumn},{id:"history",label:"Journal",Icon:BookOpen}].map(({id,label,Icon})=><button key={id} aria-current={id==="home"?"page":undefined} data-tutorial={`nav-${id}`} onClick={()=>onNavSelect?.(id)}><Icon size={23} strokeWidth={1.5}/><span>{label}</span></button>)}</nav>
    {sheetOpen&&selected&&<section className="observatory-detail" role="dialog" aria-modal="false" aria-labelledby="observatory-detail-title">
      <div className="observatory-sheet-handle" aria-hidden="true"/><div className="observatory-detail-header"><span>{example?"Example interpretation":"Approved interpretation"}</span><button ref={closeRef} aria-label="Close interpretation" onClick={closeSheet}><X size={20}/></button></div>
      <h2 id="observatory-detail-title">{selected.thoughtLabel||selected.statement}</h2>{selected.thoughtLabel&&<p className="observatory-statement">{selected.statement}</p>}
      <p className="observatory-detail-note">{example?"Existing example data. This is not part of your personal map.":"An interpretation you reviewed, not a fixed fact about you."}</p>
      <h3>Supporting entries</h3>{sources.length?sources.map((source,index)=><blockquote key={index}><p>{source.quote}</p>{source.entryId&&!preview?<button onClick={()=>{setSheetOpen(false);onOpenEntry?.(source.entryId!);}}>Read original entry · {source.date}<ArrowRight size={14}/></button>:<span>{source.date}{preview?" · example source":" · original entry unavailable"}</span>}</blockquote>):<p className="observatory-detail-note">No source excerpts are saved for this interpretation yet.</p>}
      {linked.length>0&&<><h3>Connected thoughts</h3>{linked.map(({belief,connection},index)=><div className="observatory-related" key={`${belief.id}-${index}`}><button onClick={()=>select(belief.id)}>{belief.thoughtLabel||belief.statement}<ArrowRight size={15}/></button>{connection.note&&<p>{connection.note}</p>}{connection.type==="contradiction"&&<span>Possible tension</span>}</div>)}</>}
      {!preview&&<div className="observatory-detail-actions"><button onClick={()=>onReviewInterpretation?.({kind:"belief",id:selected.id,text:selected.statement})}>View in Analysis<ArrowRight size={15}/></button><button onClick={()=>onOpenBrainMap?.(undefined,selected.id)}>Open full Brain Map<ArrowRight size={15}/></button></div>}
    </section>}
  </main>;
}
