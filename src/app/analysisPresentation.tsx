import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import './analysis-presentation.css';

export type AnalysisTarget = {kind:'hypothesis';index:number;text:string}|{kind:'belief';id:string;text:string};
export function analysisTargetKey(target:AnalysisTarget|null):string|null {
  return target?target.kind==='belief'?`belief:${target.id}`:`hyp:${target.index}`:null;
}
export type AnalysisVisit = {
  pinned:AnalysisTarget|null;target:AnalysisTarget|null;overviewScroll:number;carouselScroll:number;
  detailScroll:Record<string,number>;disclosures:Record<string,boolean>;
};

export function AnalysisDisclosure({title,state,name,children}:{title:string;state:Record<string,boolean>;name:string;children:React.ReactNode}) {
  const [open,setOpen]=useState(state[name]??false);
  return <details className="analysis-disclosure" open={open} onToggle={event=>{const next=event.currentTarget.open;state[name]=next;setOpen(next);}}><summary>{title}</summary><div className="analysis-disclosure-body">{children}</div></details>;
}

export function AnalysisCarousel({children,visit}:{children:React.ReactNode;visit:AnalysisVisit}) {
  const rail=useRef<HTMLDivElement>(null),id=useId();
  const [position,setPosition]=useState({previous:false,next:false,overflow:false});
  useLayoutEffect(()=>{
    const element=rail.current;if(!element)return;
    element.scrollLeft=visit.carouselScroll;
    const update=()=>{visit.carouselScroll=element.scrollLeft;setPosition({previous:element.scrollLeft>2,next:element.scrollLeft+element.clientWidth<element.scrollWidth-2,overflow:element.scrollWidth>element.clientWidth+2});};
    update();const observer=new ResizeObserver(update);observer.observe(element);element.addEventListener('scroll',update,{passive:true});
    return()=>{observer.disconnect();element.removeEventListener('scroll',update);};
  },[visit]);
  const move=(direction:number)=>{const element=rail.current;if(element)element.scrollBy({left:direction*244,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  return <section className="analysis-further" aria-labelledby={`${id}-title`}>
    <div className="analysis-section-header"><h2 id={`${id}-title`}>Further insights</h2><div className="analysis-carousel-controls"><button type="button" aria-label="Previous insights" aria-controls={id} disabled={!position.previous} onClick={()=>move(-1)}>←</button><button type="button" aria-label="Next insights" aria-controls={id} disabled={!position.next} onClick={()=>move(1)}>→</button></div></div>
    <p className="analysis-scroll-cue" aria-hidden={!position.overflow} style={{visibility:position.overflow?'visible':'hidden'}}>More insights to explore — swipe or use the arrows.</p>
    <div className="analysis-carousel" id={id} ref={rail} role="region" aria-label="Further insights" tabIndex={0}>{children}</div>
  </section>;
}
