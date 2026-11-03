import StellarNode from './StellarNode';
import React from "react";
import {SlidersHorizontal,Plus,Minus,Scan} from "lucide-react";
import BrainNodeMapScreen,{type HomeBrainProjection,type HomeBrainControls} from "./BrainNodeMapScreen";
import type {StoredBelief,StoredConnection} from "./types";
import {connectionCurve} from "./homeMapModel";

type Props={beliefs:StoredBelief[];connections:StoredConnection[];selectedId:string|null;onSelect:(id:string)=>void;onOpenMind:()=>void;onOpenFullMap:()=>void};

export default function HomeThoughtMap({beliefs,connections,selectedId,onSelect,onOpenMind,onOpenFullMap}:Props) {
  const host=React.useRef<HTMLDivElement>(null);
  const overlay=React.useRef<SVGSVGElement>(null);
  const buttons=React.useRef(new Map<string,HTMLButtonElement>());
  const paths=React.useRef(new Map<number,SVGPathElement>());
  const controls=React.useRef<HomeBrainControls|null>(null);
  const current=React.useRef({beliefs,connections});current.current={beliefs,connections};
  const [focusId,setFocusId]=React.useState<string|null>(null);
  React.useEffect(()=>{controls.current?.focus(selectedId);},[selectedId]);
  const sorted=[...beliefs].sort((a,b)=>connections.filter(c=>c.a===b.id||c.b===b.id).length-connections.filter(c=>c.a===a.id||c.b===a.id).length||a.id.localeCompare(b.id));
  const highlight=selectedId??sorted[0]?.id;
  const sceneKey=beliefs.map(b=>b.id).sort().join("|");
  const project=React.useCallback((nodes:HomeBrainProjection[],width:number,height:number,count:number)=>{
    if(host.current){host.current.dataset.tissuePoints=String(count);host.current.dataset.renderer="full-brain-map";}
    overlay.current?.setAttribute("viewBox",`0 0 ${width} ${height}`);
    const positions=new Map(nodes.map(node=>[node.id,node]));
    nodes.forEach(node=>{
      const button=buttons.current.get(node.id);if(!button)return;
      button.style.transform=`translate(${node.x-22}px,${node.y-22}px)`;button.style.visibility=node.visible?"visible":"hidden";
      const label=button.querySelector<HTMLElement>(".home-brain-label");
      if(label){label.style.left=node.x>width/2?"auto":"34px";label.style.right=node.x>width/2?"34px":"auto";label.style.textAlign=node.x>width/2?"right":"left";label.style.maxWidth=`${Math.max(70,Math.min(180,node.x>width/2?node.x-35:width-node.x-35))}px`;}
    });
    current.current.connections.forEach((connection,index)=>{
      const path=paths.current.get(index),a=positions.get(connection.a),b=positions.get(connection.b);if(!path||!a||!b)return;
      path.style.visibility=a.visible&&b.visible?"visible":"hidden";
      path.setAttribute("d",connectionCurve({...a,degree:0,important:false},{...b,degree:0,important:false}));
    });
  },[]);
  return <div className="home-full-brain" data-node-focused={selectedId?"true":"false"} ref={host}>
    <BrainNodeMapScreen key={sceneKey} beliefs={beliefs} connections={connections} homePresentation onHomeSelect={onSelect} onHomeProject={project} onHomeControls={value=>{controls.current=value;}}/>
    <svg ref={overlay} className="home-brain-connections" aria-hidden="true">{connections.map((connection,index)=><path key={`${connection.a}:${connection.b}:${index}`} ref={node=>{if(node)paths.current.set(index,node);else paths.current.delete(index);}} className={`observatory-connection${connection.a===highlight||connection.b===highlight?" is-related":""}`} fill="none" strokeWidth={connection.a===highlight||connection.b===highlight?1.25:.65} strokeDasharray={connection.type==="contradiction"?"4 4":undefined}/>)}</svg>
    <div className="home-brain-information-nodes">{sorted.map((belief,index)=>{
      const active=belief.id===highlight,label=belief.thoughtLabel?.replace(/ thought$/i,"")||belief.statement;
      return <button key={belief.id} ref={node=>{if(node)buttons.current.set(belief.id,node);else buttons.current.delete(belief.id);}} className={`home-brain-information-node${active?" is-selected":""}`} data-node-id={belief.id} tabIndex={(focusId??sorted[0]?.id)===belief.id?0:-1} onFocus={()=>setFocusId(belief.id)} aria-label={`Open interpretation: ${belief.thoughtLabel||belief.statement}`} aria-pressed={active} onClick={()=>onSelect(belief.id)} onKeyDown={e=>{
        if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();e.stopPropagation();const next=sorted[(index+(["ArrowRight","ArrowDown"].includes(e.key)?1:-1)+sorted.length)%sorted.length];setFocusId(next.id);buttons.current.get(next.id)?.focus();}
      }}><StellarNode color={active?"#ffc16a":"#ffe2b2"} size={active?57:40}/>{(active||index<3)&&<span className="home-brain-label">{label}</span>}</button>;
    })}</div>
    <details className="observatory-map-tools"><summary aria-label="Map controls and more destinations"><SlidersHorizontal size={17}/></summary><div><div className="observatory-zoom"><button aria-label="Zoom in" onClick={()=>controls.current?.zoom(1.2)}><Plus size={18}/></button><button aria-label="Zoom out" onClick={()=>controls.current?.zoom(1/1.2)}><Minus size={18}/></button><button aria-label="Fit map" onClick={()=>controls.current?.reset()}><Scan size={18}/></button></div><button onClick={onOpenMind}>Open Mind overview</button><button onClick={onOpenFullMap}>Open full Brain Map</button></div></details>
  </div>;
}
