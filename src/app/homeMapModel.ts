import { stableUnit } from "./neuralBrainLayout";
import type { Store, StoredBelief, StoredConnection } from "./types";

export const MAP_WIDTH=360;
export const MAP_HEIGHT=510;
export type HomeMapNode={id:string;x:number;y:number;degree:number;important:boolean};

export function approvedHomeBeliefs(store:Store):StoredBelief[] {
  return store.beliefs.filter(b=>b.userReaction!=="rejected"&&(b.userReaction==="accepted"||b.discoveryReaction==="agree"));
}
/** Same stable ID-seeded generator used by the existing Brain Map, projected into a 2D reading space.
 * No ambient tissue, synthetic beliefs, or inferred connections are added to this presentation.
 */
export function layoutHomeNodes(beliefs:StoredBelief[],connections:StoredConnection[]):HomeMapNode[] {
  const ids=new Set(beliefs.map(b=>b.id));
  const degree=new Map(beliefs.map(b=>[b.id,0]));
  connections.forEach(c=>{if(ids.has(c.a)&&ids.has(c.b)){degree.set(c.a,(degree.get(c.a)??0)+1);degree.set(c.b,(degree.get(c.b)??0)+1);}});
  const ordered=[...beliefs].sort((a,b)=>(degree.get(b.id)??0)-(degree.get(a.id)??0)||a.id.localeCompare(b.id));
  const placed:HomeMapNode[]=[];
  ordered.forEach((belief,index)=>{
    let best={x:MAP_WIDTH*.57,y:MAP_HEIGHT*.49},bestDistance=-1;
    if(index>0) for(let candidate=0;candidate<80;candidate++) {
      const point={x:32+stableUnit(`${belief.id}-home-x-${candidate}`)*(MAP_WIDTH-64),y:30+stableUnit(`${belief.id}-home-y-${candidate}`)*(MAP_HEIGHT-60)};
      const distance=Math.min(...placed.map(p=>(p.x-point.x)**2+(p.y-point.y)**2));
      if(distance>bestDistance){best=point;bestDistance=distance;}
    }
    placed.push({id:belief.id,...best,degree:degree.get(belief.id)??0,important:index<3});
  });
  return placed;
}
export function connectionCurve(a:HomeMapNode,b:HomeMapNode):string {
  const key=[a.id,b.id].sort().join(":");
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
  const bow=(stableUnit(key+"-curve")-.5)*Math.min(length*.8,140);
  return `M ${a.x} ${a.y} Q ${(a.x+b.x)/2-dy/length*bow} ${(a.y+b.y)/2+dx/length*bow} ${b.x} ${b.y}`;
}
export function shortNodeLabel(belief:StoredBelief,node:HomeMapNode):string {
  const label=belief.thoughtLabel?.replace(/ thought$/i,"")||belief.statement;
  const room=node.x>MAP_WIDTH/2?node.x-25:MAP_WIDTH-node.x-25;
  const limit=Math.max(10,Math.min(26,Math.floor(room/7.2)));
  return label.length>limit?label.slice(0,limit-1).trimEnd()+"…":label;
}
export const clampMapScale=(value:number)=>Number.isNaN(value)?1:Math.min(3.5,Math.max(.65,value));
