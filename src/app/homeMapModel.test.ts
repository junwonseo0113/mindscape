import {describe,it,expect} from "vitest";
import {emptyStore,type StoredBelief} from "./types";
import {approvedHomeBeliefs,layoutHomeNodes,connectionCurve,clampMapScale,MAP_WIDTH,MAP_HEIGHT} from "./homeMapModel";
const beliefs:StoredBelief[]=["a","b","c"].map(id=>({id,domain:"Work",statement:`Actual statement ${id}`,confidence:70,evidenceCount:3,evidenceQuotes:[],userReaction:"accepted"}));
const edges=[{a:"a",b:"b",note:"Recorded connection"},{a:"b",b:"c",note:"Another recorded connection"}];
describe("Home map data and stable layout",()=>{
  it("includes only existing approval signals, never confidence alone",()=>{const store=emptyStore();store.beliefs=[...beliefs,{...beliefs[0],id:"pending",userReaction:null,confidence:99},{...beliefs[0],id:"rejected",userReaction:"rejected",discoveryReaction:"agree"}];expect(approvedHomeBeliefs(store).map(b=>b.id)).toEqual(["a","b","c"]);});
  it("does not invent nodes for an empty account",()=>expect(layoutHomeNodes([],[])).toEqual([]));
  it("keeps positions identical across rerenders and input order changes",()=>{expect(layoutHomeNodes([...beliefs].reverse(),[...edges].reverse())).toEqual(layoutHomeNodes(beliefs,edges));});
  it("keeps initial positions inside the map reading area",()=>{const nodes=layoutHomeNodes(beliefs,edges);for(const node of nodes){expect(node.x).toBeGreaterThan(20);expect(node.x).toBeLessThan(MAP_WIDTH-20);expect(node.y).toBeGreaterThan(20);expect(node.y).toBeLessThan(MAP_HEIGHT-20);}expect(new Set(nodes.map(n=>`${n.x}:${n.y}`)).size).toBe(beliefs.length);});
  it("uses actual connections for importance, without inventing proximity edges",()=>{const nodes=layoutHomeNodes(beliefs,[...edges,{a:"a",b:"nonexistent",note:"Unavailable"}]);expect(nodes.find(n=>n.id==="b")?.degree).toBe(2);expect(nodes.find(n=>n.id==="a")?.degree).toBe(1);});
  it("makes deterministic curved paths without moving endpoints",()=>{const nodes=layoutHomeNodes(beliefs,edges);const path=connectionCurve(nodes[0],nodes[1]);expect(path).toBe(connectionCurve(nodes[0],nodes[1]));expect(path).toContain(`M ${nodes[0].x} ${nodes[0].y} Q`);expect(path.endsWith(`${nodes[1].x} ${nodes[1].y}`)).toBe(true);});
  it("bounds pinch, wheel, and keyboard zoom",()=>{expect(clampMapScale(.01)).toBe(.65);expect(clampMapScale(100)).toBe(3.5);expect(clampMapScale(1)).toBe(1);});
});
