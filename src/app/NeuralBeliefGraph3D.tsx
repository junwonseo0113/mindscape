import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  CognitiveRegion,
  COGNITIVE_REGIONS,
  Vec3,
  assignBeliefsToIndices,
  buildProximityEdges,
  cognitiveRegionForPosition,
  generateBrainCloud,
  hashString,
  pickPromotableIndicesByRegion,
  stableUnit,
} from "./neuralBrainLayout";

export type NeuralBeliefNode = {
  id: string;
  domain: string;
  statement: string;
  confidence: number;
  evidenceCount: number;
  // Optional 0..1 "how recent" signal — falls back to a stable per-id
  // pseudo value when the caller doesn't have one yet.
  recency?: number;
  // "YYYY.MM.DD" (formatDateDots) — when `recency` isn't explicitly given,
  // this drives real growth/dormancy (see recencyFromDate) instead of the
  // stable pseudo-random fallback. Demo beliefs mostly don't set this, so
  // they keep the old pseudo-recency look; real beliefs always do (every
  // mergeAnalysisIntoStore update stamps it).
  lastUpdatedAt?: string;
  // Whether this belief's own supporting entries carry a full situation→
  // thought→emotion→action chain (see FunctionalLoopDiagram in App.tsx) —
  // drives whether the selected-node card offers the "재생" self-loop
  // animation at all.
  hasLoop?: boolean;
  // Which of the six app-defined cognitive regions this belief activates a
  // neuron in. Optional because the backend doesn't produce this yet —
  // see mapDomainToCognitiveRegion below for the fallback.
  region?: CognitiveRegion;
};

// Temporary mapping until the backend sends `region` directly: the app's
// real belief data only carries a freeform (often Korean) `domain` string,
// so this guesses a cognitive region from keywords and falls back to a
// stable hash so every domain still lands somewhere deterministic.
const DOMAIN_REGION_KEYWORDS: [RegExp, CognitiveRegion][] = [
  [/career|job|work|직장|커리어|일|업무|진로/i, "career"],
  [/relationship|love|family|friend|관계|사랑|우정|가족|연애/i, "relationships"],
  [/safe|security|stability|안전|안정/i, "security"],
  [/self|identity|value|자아|정체성|가치관/i, "identity"],
  [/creativ|art|imagin|창의|예술|상상/i, "creativity"],
  [/curio|explore|learn|호기심|탐구|학습|배움/i, "curiosity"],
];

function mapDomainToCognitiveRegion(domain: string): CognitiveRegion {
  for (const [pattern, region] of DOMAIN_REGION_KEYWORDS) {
    if (pattern.test(domain)) return region;
  }
  return COGNITIVE_REGIONS[hashString(domain) % COGNITIVE_REGIONS.length];
}

// Exported so pages outside the canvas (the Analysis tab's region
// breakdown) can classify the same belief into the same cognitive region
// without duplicating this lookup — it's pure and needs no 3D state.
export function resolveRegion(belief: NeuralBeliefNode): CognitiveRegion {
  return belief.region ?? mapDomainToCognitiveRegion(belief.domain);
}

// `type` mirrors StoredConnection's — "root" (mutually-reinforcing, the
// default/undefined case) reads as a calm static line always;
// "contradiction" gets the dashed/flickering "tension line" treatment,
// but only while structureMode is on (see BrainScene) — in the calm
// default view every connection looks the same.
export type NeuralBeliefConnection = { a: string; b: string; type?: "root" | "contradiction" };

// Real recency from a "YYYY.MM.DD" date (formatDateDots format), decaying
// smoothly rather than in visible steps — exponential with a ~3-week time
// constant, floored well above zero so an old-but-real belief still reads
// as present tissue, just quieter, never mistaken for background noise
// (the metaphor is dormancy/pruning-adjacent dimming, not deletion).
function recencyFromDate(dateStr?: string): number | null {
  if (!dateStr) return null;
  const parts = dateStr.split(".").map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const then = new Date(y, m - 1, d).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.max(0, (Date.now() - then) / (1000 * 60 * 60 * 24));
  return Math.max(0.15, Math.min(1, Math.exp(-days / 21)));
}

// ── Permanent neural structure — generated once at module load, not from
// props, and never regenerated on refresh (same seed every time). Real
// beliefs promote a handful of these background neurons into "active"
// status; they never get their own separate layout, so the mass reads as
// one continuous tissue whether there are 2 beliefs or 80. ─────────────────
const IS_SMALL_SCREEN = typeof window !== "undefined" && window.innerWidth < 480;
const BRAIN_SEED = 1729;

// Pulled back down from an even denser pass — that version stopped local
// gaps from appearing, but on a phone-sized card it read as visually heavy
// enough to bury the handful of neurons that actually matter (the ones a
// real belief activated). The bridging pass in buildProximityEdges still
// guarantees full connectivity at this density, so the silhouette holds.
const BACKGROUND_COUNT = IS_SMALL_SCREEN ? 1300 : 2000;
const BACKGROUND = generateBrainCloud(BACKGROUND_COUNT, BRAIN_SEED);
const BACKGROUND_POSITIONS: Vec3[] = BACKGROUND.map((p) => p.position);

// Local, short-range links only, and fewer of them per neuron than before —
// this is what keeps the silhouette coming from neuron density rather than
// from a visible web of lines.
const BACKGROUND_EDGES = buildProximityEdges(BACKGROUND_POSITIONS, 2, 0.5);
const BACKGROUND_EDGE_POSITIONS = (() => {
  const arr = new Float32Array(BACKGROUND_EDGES.length * 2 * 3);
  BACKGROUND_EDGES.forEach(([i, j], idx) => {
    arr.set(BACKGROUND_POSITIONS[i], idx * 6);
    arr.set(BACKGROUND_POSITIONS[j], idx * 6 + 3);
  });
  return arr;
})();
const BACKGROUND_ADJACENCY: Map<number, number[]> = (() => {
  const map = new Map<number, number[]>();
  BACKGROUND_EDGES.forEach(([i, j]) => {
    if (!map.has(i)) map.set(i, []);
    if (!map.has(j)) map.set(j, []);
    map.get(i)!.push(j);
    map.get(j)!.push(i);
  });
  return map;
})();

// A well-spaced subset of the same cloud, one pool per cognitive region —
// a belief can only ever promote a neuron that already lives inside its
// own region's wedge, never a separate point set.
const PROMOTABLE_BY_REGION = pickPromotableIndicesByRegion(
  BACKGROUND,
  (i) => cognitiveRegionForPosition(BACKGROUND_POSITIONS[i]),
  IS_SMALL_SCREEN ? 26 : 32,
  0.34
);

// The brain starts entirely dormant: every neuron is a near-black,
// low-emissive gray until a belief permanently activates it. Only the
// faintest regional variation distinguishes anatomical lobes from each
// other — activation color (warm gold) is reserved entirely for neurons a
// belief has actually claimed.
const REGION_TINT: Record<string, THREE.Color> = {
  core: new THREE.Color("#242229"),
  frontal: new THREE.Color("#27242C"),
  parietal: new THREE.Color("#232128"),
  temporal: new THREE.Color("#201E25"),
  occipital: new THREE.Color("#252229"),
  cerebellum: new THREE.Color("#1E1C22"),
  stem: new THREE.Color("#1B1A1F"),
};
const DEFAULT_TINT = REGION_TINT.core;
const DIM_TINT = new THREE.Color("#131217");
const BRIGHT_TINT = new THREE.Color("#3C342A");

// ── Single source of truth for the six cognitive regions: their permanent
// activation color, Korean display label, and a one-line description of
// what the category actually means — the legend and RegionBreakdown both
// read from this map — nothing hardcodes a region's color or meaning
// anywhere else.
export const REGION_CONFIG: Record<CognitiveRegion, { color: string; label: string; description: string }> = {
  identity: { color: "#8B7CFF", label: "정체성", description: "내가 누구라고 생각하는지 — 자기 인식, 자존감, 가치관에 관한 믿음" },
  security: { color: "#4CAF7A", label: "안정", description: "위험과 변화 앞에서 안전을 지키려는 판단 기준" },
  career: { color: "#D9A441", label: "커리어", description: "일, 성취, 능력에 대해 갖고 있는 믿음" },
  relationships: { color: "#E88AAE", label: "관계", description: "다른 사람과의 관계에서 반복되는 생각과 태도" },
  curiosity: { color: "#69A7FF", label: "호기심", description: "새로운 것을 탐구하고 배우는 것에 대한 태도" },
  creativity: { color: "#F4A261", label: "창의성", description: "상상하고 표현하는 방식에 대한 믿음" },
};

// Reserved exclusively for the "this one is selected" indicator (a thin
// halo on the node itself, plus the matching highlighted edges/lines) —
// never a region's own permanent color, so selecting a neuron never hides
// which region it belongs to.
const SELECTION_GOLD = "#E8C874";

// Precomputed per-neuron animation seeds — phase/speed/amplitude are all
// derived once from a stable hash, so the drift/breathing loop below only
// has to evaluate a couple of sines per neuron per frame.
type NeuronMotion = { phase: number; speed: number; driftAmp: number; baseScale: number; phaseY: number; phaseZ: number };
const BACKGROUND_MOTION: NeuronMotion[] = BACKGROUND_POSITIONS.map((_, i) => ({
  phase: stableUnit(`bg-${i}-phase`) * Math.PI * 2,
  speed: 0.1 + stableUnit(`bg-${i}-speed`) * 0.08,
  driftAmp: 0.018 + stableUnit(`bg-${i}-drift`) * 0.016,
  baseScale: 0.019 + stableUnit(`bg-${i}-scale`) * 0.014,
  phaseY: stableUnit(`bg-${i}-py`) * Math.PI * 2,
  phaseZ: stableUnit(`bg-${i}-pz`) * Math.PI * 2,
}));

const FOG_COLOR = "#EEEAF8";

// A ripple never touches more than a handful of already-adjacent
// background neurons (their existing tissue-edge neighbors — see
// BACKGROUND_ADJACENCY), never a growing radius, and it's brief enough to
// read as "a signal passed through here," not an animation. Spacing
// between consecutive ripple starts is what keeps a burst of several new
// beliefs from all pulsing across the brain at once.
const RIPPLE_DURATION_MS = 420;
const RIPPLE_STAGGER_MS = 160;
const RIPPLE_NEIGHBOR_CAP = 5;

// Same "inside the focus radius / not" paint used by the focus-driven
// effect below, factored out so the ripple pass can restore a neuron to
// exactly the color it's *supposed* to have right now once its pulse
// ends, instead of stomping back to a plain default.
function computeRestingColor(i: number, focusPosition: Vec3 | null, focusRadius: number, baseColors: THREE.Color[]): THREE.Color {
  const base = baseColors[i];
  if (!focusPosition) return base;
  const p = BACKGROUND_POSITIONS[i];
  const dx = p[0] - focusPosition[0];
  const dy = p[1] - focusPosition[1];
  const dz = p[2] - focusPosition[2];
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return d < focusRadius ? base.clone().lerp(BRIGHT_TINT, 0.6) : base.clone().lerp(DIM_TINT, 0.45);
}

// Which beliefs have already played their one-shot activation flash, for
// the lifetime of this page load — module-level (not component state) so
// navigating away from and back to this screen doesn't replay the flash
// for beliefs that already settled into their steady glow earlier in the
// session. Only beliefs that are genuinely new since the module loaded
// ever get added here.
const ANIMATED_BELIEF_IDS = new Set<string>();

type ActiveNode = NeuralBeliefNode & {
  position: Vec3;
  radius: number;
  color: string;
  region: CognitiveRegion;
  isCore: boolean;
  strength: number;
  bgIndex: number;
  // 0..1, real (from lastUpdatedAt) when available, else the old stable
  // pseudo-value — never lets a belief's *evidence-based* strength/isCore
  // classification be affected, only how vividly it's currently rendered.
  vitality: number;
};

// A little per-neuron richness jitter on top of the region's own color —
// activated neurons still read as individual, not a flat stamped-out hue.
function regionTone(region: CognitiveRegion, seed: string) {
  const jitter = 0.9 + stableUnit(`${seed}-tone`) * 0.2;
  return new THREE.Color(REGION_CONFIG[region].color).multiplyScalar(jitter).getStyle();
}

// Activation step, run once per render from the current belief list:
// (1) group beliefs by their cognitive region, (2) within each region,
// find/claim an inactive neuron from that region's own slot pool, (3) that
// slot becomes permanently associated with the belief's id (deterministic
// hashing means the same belief always re-claims the same neuron — see
// assignBeliefsToIndices), so nothing already lit ever goes dark again.
function buildActiveNodes(beliefs: NeuralBeliefNode[]): ActiveNode[] {
  if (beliefs.length === 0) return [];

  const beliefsByRegion = new Map<CognitiveRegion, NeuralBeliefNode[]>();
  beliefs.forEach((b) => {
    const region = resolveRegion(b);
    const bucket = beliefsByRegion.get(region);
    if (bucket) bucket.push(b);
    else beliefsByRegion.set(region, [b]);
  });

  const bgIndexById = new Map<string, number>();
  beliefsByRegion.forEach((regionBeliefs, region) => {
    const slots = PROMOTABLE_BY_REGION[region] ?? [];
    const regionAssignment = assignBeliefsToIndices(regionBeliefs, slots);
    regionAssignment.forEach((idx, id) => bgIndexById.set(id, idx));
  });

  const maxEvidence = Math.max(1, ...beliefs.map((b) => b.evidenceCount || 1));
  const evidenceCounts = [...beliefs].map((b) => b.evidenceCount || 0).sort((a, b) => b - a);
  const coreCutoffIdx = Math.max(0, Math.ceil(beliefs.length * 0.25) - 1);
  const coreThreshold = evidenceCounts[Math.min(coreCutoffIdx, evidenceCounts.length - 1)] ?? 0;

  return beliefs.map((belief) => {
    const region = resolveRegion(belief);
    const bgIndex = bgIndexById.get(belief.id) ?? PROMOTABLE_BY_REGION[region]?.[0] ?? 0;
    const position = BACKGROUND_POSITIONS[bgIndex] ?? [0, 0, 0];
    const evidenceRatio = Math.sqrt((belief.evidenceCount || 1) / maxEvidence);
    const strength = evidenceRatio * 0.7 + ((belief.confidence ?? 50) / 100) * 0.3;
    const isCore = beliefs.length > 3 && (belief.evidenceCount || 0) > 0 && (belief.evidenceCount || 0) >= coreThreshold;
    // A bit bigger than before (still a promoted neuron, not a planet
    // dropped on top of the structure) — with the background field
    // lightened, the previous size read as barely distinguishable from
    // the surrounding dormant tissue at a glance.
    const radius = (isCore ? 0.064 : 0.05) + 0.02 * strength;
    const vitality = belief.recency ?? recencyFromDate(belief.lastUpdatedAt) ?? stableUnit(`${belief.id}-recency`);
    return {
      ...belief,
      position,
      radius,
      color: regionTone(region, belief.id),
      region,
      isCore,
      strength,
      bgIndex,
      vitality,
    };
  });
}

// ── Background neuron field — one InstancedMesh, matrices rewritten every
// frame for the slow drift/breathing (cheap: a few thousand scalar sines,
// no per-neuron React component), colors only touched when focus changes
// or a ripple is passing through a handful of them.
function BrainField({
  focusPosition,
  focusRadius,
  justActivatedBgIndices,
}: {
  focusPosition: Vec3 | null;
  focusRadius: number;
  justActivatedBgIndices: number[];
}) {
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.46, depthWrite: false, vertexColors: true, fog: true }),
    []
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // A little per-neuron brightness jitter (not just the region hue) reads
  // as gentle organic variation across the tissue instead of a flat,
  // uniform field of identical dots.
  const baseColors = useMemo(
    () =>
      BACKGROUND.map((p, i) => {
        const tint = (REGION_TINT[p.region] ?? DEFAULT_TINT).clone();
        const jitter = 0.82 + stableUnit(`bg-${i}-bright`) * 0.36;
        return tint.multiplyScalar(jitter);
      }),
    []
  );
  const frameSkip = IS_SMALL_SCREEN ? 2 : 1;
  const frameCounter = useRef(0);

  // A newly-activated belief enqueues a ripple for its own local neighbors
  // (via BACKGROUND_ADJACENCY — an existing tissue edge, never a growing
  // radius); the queue is drained one at a time with a short stagger, so a
  // burst of several new beliefs plays as a rolling sequence instead of
  // every affected neuron pulsing across the brain at once.
  const pendingQueueRef = useRef<number[]>([]);
  const queuedOrActiveRef = useRef<Set<number>>(new Set());
  const activeRipplesRef = useRef<Map<number, { neighbors: number[]; start: number }>>(new Map());
  const lastRippleStartRef = useRef(0);

  useEffect(() => {
    justActivatedBgIndices.forEach((bgIndex) => {
      if (queuedOrActiveRef.current.has(bgIndex)) return;
      queuedOrActiveRef.current.add(bgIndex);
      pendingQueueRef.current.push(bgIndex);
    });
  }, [justActivatedBgIndices]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    BACKGROUND_POSITIONS.forEach((_, i) => mesh.setColorAt(i, baseColors[i]));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [baseColors]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < BACKGROUND_POSITIONS.length; i += 1) {
      mesh.setColorAt(i, computeRestingColor(i, focusPosition, focusRadius, baseColors));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [focusPosition, focusRadius, baseColors]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    frameCounter.current += 1;
    const t = clock.elapsedTime;

    if (frameCounter.current % frameSkip === 0) {
      for (let i = 0; i < BACKGROUND_POSITIONS.length; i += 1) {
        const pos = BACKGROUND_POSITIONS[i];
        const m = BACKGROUND_MOTION[i];
        const breathe = 1 + Math.sin(t * m.speed * 1.6 + m.phase) * 0.22;
        dummy.position.set(
          pos[0] + Math.sin(t * m.speed + m.phase) * m.driftAmp,
          pos[1] + Math.sin(t * m.speed + m.phaseY) * m.driftAmp,
          pos[2] + Math.sin(t * m.speed + m.phaseZ) * m.driftAmp
        );
        dummy.scale.setScalar(m.baseScale * breathe);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Drain one ripple job at a time, spaced out — this is the "queue
    // instead of overlapping aggressively" behavior for a burst of new
    // beliefs.
    const now = performance.now();
    if (pendingQueueRef.current.length > 0 && now - lastRippleStartRef.current > RIPPLE_STAGGER_MS) {
      const bgIndex = pendingQueueRef.current.shift()!;
      const neighbors = (BACKGROUND_ADJACENCY.get(bgIndex) ?? []).slice(0, RIPPLE_NEIGHBOR_CAP);
      if (neighbors.length > 0) {
        activeRipplesRef.current.set(bgIndex, { neighbors, start: now });
      } else {
        queuedOrActiveRef.current.delete(bgIndex);
      }
      lastRippleStartRef.current = now;
    }

    if (activeRipplesRef.current.size > 0) {
      let touched = false;
      activeRipplesRef.current.forEach((ripple, bgIndex) => {
        const elapsed = now - ripple.start;
        if (elapsed >= RIPPLE_DURATION_MS) {
          ripple.neighbors.forEach((ni) => mesh.setColorAt(ni, computeRestingColor(ni, focusPosition, focusRadius, baseColors)));
          activeRipplesRef.current.delete(bgIndex);
          queuedOrActiveRef.current.delete(bgIndex);
          touched = true;
          return;
        }
        // A single smooth rise-and-fall (never a loop, never expanding) —
        // one subtle pulse per neighbor, done within RIPPLE_DURATION_MS.
        const intensity = Math.sin(Math.PI * (elapsed / RIPPLE_DURATION_MS));
        ripple.neighbors.forEach((ni) => {
          const resting = computeRestingColor(ni, focusPosition, focusRadius, baseColors);
          mesh.setColorAt(ni, resting.clone().lerp(BRIGHT_TINT, intensity * 0.6));

          const pos = BACKGROUND_POSITIONS[ni];
          const m = BACKGROUND_MOTION[ni];
          const breathe = 1 + Math.sin(t * m.speed * 1.6 + m.phase) * 0.22;
          dummy.position.set(
            pos[0] + Math.sin(t * m.speed + m.phase) * m.driftAmp,
            pos[1] + Math.sin(t * m.speed + m.phaseY) * m.driftAmp,
            pos[2] + Math.sin(t * m.speed + m.phaseZ) * m.driftAmp
          );
          dummy.scale.setScalar(m.baseScale * breathe * (1 + intensity * 0.5));
          dummy.updateMatrix();
          mesh.setMatrixAt(ni, dummy.matrix);
        });
        touched = true;
      });
      if (touched) {
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, BACKGROUND_POSITIONS.length]} frustumCulled={false} />;
}

// Two more static, much fainter copies of the same cloud sitting behind
// the crisp dots — a cheap stand-in for bloom. The dot itself stays tiny
// (never enlarged), but a soft inner glow and a wider, fainter outer haze
// around every one of them is what makes densely-packed neurons visually
// melt into one continuous, organic mass instead of reading as separate
// specks, especially where many overlap near the core.
function BrainFieldGlowLayer({ scale, opacity, color }: { scale: number; opacity: number; color: string }) {
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: true }),
    [color, opacity]
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    BACKGROUND_POSITIONS.forEach((pos, i) => {
      const s = BACKGROUND_MOTION[i].baseScale * scale;
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy, scale]);

  return <instancedMesh ref={meshRef} args={[geometry, material, BACKGROUND_POSITIONS.length]} frustumCulled={false} />;
}

// The full tissue mesh, default-invisible: almost every neuron connects to
// a couple of near neighbors, but at this opacity it reads as haze, not
// wiring — exactly what keeps the piece from looking like a network
// diagram.
function BrainEdges() {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(BACKGROUND_EDGE_POSITIONS, 3));
    return geo;
  }, []);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#3A3742" transparent opacity={0.022} depthWrite={false} fog />
    </lineSegments>
  );
}

// Only the edges touching the focused neuron get rebuilt and shown bright
// — a tiny, cheap buffer instead of ever lighting up the whole mesh.
function HighlightEdges({ focusBgIndex }: { focusBgIndex: number | null }) {
  const geometry = useMemo(() => {
    if (focusBgIndex == null) return null;
    const neighbors = BACKGROUND_ADJACENCY.get(focusBgIndex) ?? [];
    if (neighbors.length === 0) return null;
    const arr = new Float32Array(neighbors.length * 2 * 3);
    neighbors.forEach((j, idx) => {
      arr.set(BACKGROUND_POSITIONS[focusBgIndex], idx * 6);
      arr.set(BACKGROUND_POSITIONS[j], idx * 6 + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [focusBgIndex]);

  if (!geometry) return null;
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={SELECTION_GOLD} transparent opacity={0.55} depthWrite={false} fog />
    </lineSegments>
  );
}

// Reused every frame inside TensionLine instead of allocating a THREE.Color
// per connection per frame.
const tmpColor = new THREE.Color();

// Level 5 (contradiction detection) — a dashed line whose dash pattern
// visibly creeps ("marching ants," reads as a taut, vibrating thread) and
// which flickers briefly toward a warm red spark on a slow cycle. Only
// rendered at all while structureMode is on — see BeliefConnectionLines —
// so the default calm view never distinguishes a contradiction from an
// ordinary connection.
function TensionLine({ a, b, baseColor }: { a: Vec3; b: Vec3; baseColor: string }) {
  const lineRef = useRef<any>(null);
  useFrame(({ clock }, delta) => {
    const mat = lineRef.current?.material;
    if (!mat) return;
    if (typeof mat.dashOffset === "number") mat.dashOffset -= delta * 0.6;
    const spark = Math.max(0, Math.sin(clock.elapsedTime * 2.2)) ** 6;
    mat.opacity = 0.26 + spark * 0.5;
    tmpColor.set(baseColor).lerp(new THREE.Color("#D9694F"), spark * 0.75);
    mat.color.copy(tmpColor);
  });
  return (
    <Line
      ref={lineRef}
      points={[a, b]}
      color={baseColor}
      dashed
      dashSize={0.045}
      gapSize={0.045}
      transparent
      opacity={0.3}
      lineWidth={1}
    />
  );
}

function BeliefConnectionLines({
  nodes,
  connections,
  focusId,
  structureMode,
}: {
  nodes: ActiveNode[];
  connections: NeuralBeliefConnection[];
  focusId: string | null;
  structureMode: boolean;
}) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  return (
    <>
      {connections.map((c, i) => {
        const a = byId.get(c.a);
        const b = byId.get(c.b);
        if (!a || !b) return null;
        const focused = focusId === a.id || focusId === b.id;
        if (structureMode && c.type === "contradiction") {
          return <TensionLine key={`${c.a}-${c.b}-${i}`} a={a.position} b={b.position} baseColor={focused ? SELECTION_GOLD : "#8A6A5C"} />;
        }
        const avgStrength = (a.strength + b.strength) / 2;
        return (
          <Line
            key={`${c.a}-${c.b}-${i}`}
            points={[a.position, b.position]}
            color={focused ? SELECTION_GOLD : "#4A4038"}
            transparent
            opacity={focused ? 0.7 : 0.035 + 0.04 * avgStrength}
            lineWidth={focused ? 1.5 : 0.6}
          />
        );
      })}
    </>
  );
}

// Level 2 (functional analysis) — a small ring orbited by one glowing
// particle, drawn around a single belief's own node. This is deliberately
// a self-loop, not a line between two different beliefs: the situation→
// thought→emotion→action cycle FunctionalLoopDiagram (App.tsx) shows is
// one belief reinforcing itself, not a causal claim between two distinct
// beliefs — so the 3D echo of it has to be a loop *on* that node, not an
// edge to another one. Only ever mounted for LOOP_PLAY_DURATION_MS after
// the info card's "재생" button is pressed (see NeuralBeliefGraph3D) —
// never idle, never automatic.
const LOOP_RING_SEGMENTS = 40;
function LoopRing({ position, radius, color }: { position: Vec3; radius: number; color: string }) {
  const particleRef = useRef<THREE.Mesh>(null);
  const ringRadius = radius * 3.4;
  const ringPoints = useMemo<Vec3[]>(() => {
    const pts: Vec3[] = [];
    for (let i = 0; i <= LOOP_RING_SEGMENTS; i += 1) {
      const a = (i / LOOP_RING_SEGMENTS) * Math.PI * 2;
      pts.push([Math.cos(a) * ringRadius, Math.sin(a) * ringRadius, 0]);
    }
    return pts;
  }, [ringRadius]);

  useFrame(({ clock }) => {
    if (!particleRef.current) return;
    const t = clock.elapsedTime * 1.7;
    particleRef.current.position.set(Math.cos(t) * ringRadius, Math.sin(t) * ringRadius, 0);
  });

  return (
    <group position={position}>
      <Line points={ringPoints} color={color} transparent opacity={0.4} lineWidth={1} />
      <mesh ref={particleRef}>
        <sphereGeometry args={[radius * 0.5, 10, 10]} />
        <meshBasicMaterial color={SELECTION_GOLD} transparent opacity={0.95} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Level 3 (belief network) — a soft, low-opacity sphere spanning a
// cluster's nodes, standing in for the "translucent haze" the design asks
// for: reusing the scene's existing additive-glow-layer look (see
// BrainFieldGlowLayer) rather than introducing a new visual language, so
// it reads as "a denser patch of the same tissue," not a foreign overlay.
// Only rendered while structureMode is on.
function ClusterHaze({ nodes }: { nodes: ActiveNode[] }) {
  const ref = useRef<THREE.Mesh>(null);
  const { center, radius } = useMemo(() => {
    const c: Vec3 = [0, 0, 0];
    nodes.forEach((n) => {
      c[0] += n.position[0];
      c[1] += n.position[1];
      c[2] += n.position[2];
    });
    c[0] /= nodes.length;
    c[1] /= nodes.length;
    c[2] /= nodes.length;
    const maxDist = Math.max(
      ...nodes.map((n) => Math.hypot(n.position[0] - c[0], n.position[1] - c[1], n.position[2] - c[2]))
    );
    return { center: c, radius: maxDist + 0.24 };
  }, [nodes]);

  useFrame(({ clock }) => {
    const mat = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (!mat) return;
    mat.opacity = 0.05 + Math.sin(clock.elapsedTime * 0.35) * 0.015;
  });

  if (nodes.length === 0) return null;
  return (
    <mesh ref={ref} position={center}>
      <sphereGeometry args={[radius, 20, 20]} />
      <meshBasicMaterial color={nodes[0].color} transparent opacity={0.055} depthWrite={false} fog />
    </mesh>
  );
}

// How long the one-shot "just activated" flash plays before settling into
// the permanent steady glow — finishes within 0.8s, and it only ever
// plays once per belief (see ANIMATED_BELIEF_IDS below), never loops.
const ACTIVATION_FLASH_SECONDS = 0.75;

function ActiveBeliefNode({
  node,
  isSelected,
  isFocused,
  isDimmed,
  justActivatedAt,
  onSelect,
  onHoverChange,
}: {
  node: ActiveNode;
  isSelected: boolean;
  isFocused: boolean;
  isDimmed: boolean;
  justActivatedAt: number | null;
  onSelect: () => void;
  onHoverChange: (hovering: boolean) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const springScale = useRef(1);
  const vitalitySmooth = useRef(node.vitality);
  const baseColorObj = useMemo(() => new THREE.Color(node.color), [node.color]);
  const blendedColor = useMemo(() => new THREE.Color(node.color), [node.color]);
  const phase = useMemo(() => stableUnit(`${node.id}-phase`) * Math.PI * 2, [node.id]);
  const recency = node.vitality;
  const pulseSpeed = 0.5 + recency * 1.2;

  const opacity = isSelected ? 1 : isDimmed ? 0.38 : 0.95;
  // Reinforcement reads continuously off `strength` (evidence + confidence)
  // rather than a single isCore step — every extra bit of evidence nudges
  // brightness/glow/size up a little, never in a big jump.
  const baseEmissive = (0.78 + 0.55 * node.strength + (node.isCore ? 0.14 : 0)) * (isDimmed ? 0.45 : 1);
  const baseGlowOpacity = (0.07 + 0.07 * node.strength + (node.isCore ? 0.03 : 0)) * (isDimmed ? 0.3 : 1);
  // The permanent region-colored bloom stays put; this separate halo is
  // the only thing that ever turns gold, and only while selected/focused —
  // the selection indicator, never the region indicator.
  const haloTargetOpacity = isSelected ? 0.4 : isFocused ? 0.2 : 0;

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    // Growth/dormancy (Level 4): vitality (real recency when the caller
    // provides lastUpdatedAt, else the old stable pseudo-value) eases in
    // slowly — over seconds, not the sub-second springs above — since it
    // represents weeks of real time, not something that should visibly
    // "snap" if a belief's data updates while this view happens to be open.
    vitalitySmooth.current += (node.vitality - vitalitySmooth.current) * Math.min(1, delta * 0.6);
    const vitalityScale = 0.55 + 0.45 * vitalitySmooth.current;

    // One shared phase drives scale, emissive brightness, and glow together
    // so every activated (region-colored) neuron reads as a clear, cohesive
    // pulse — not just a faint size wobble. Background/dormant neurons never
    // run this at all; they're a separate instanced field.
    const wave = Math.sin(clock.elapsedTime * pulseSpeed + phase);
    const pulse = 1 + wave * (0.14 + recency * 0.1);
    const emissivePulse = 1 + wave * (0.35 + recency * 0.2);
    const target = isSelected ? 1.5 : isFocused ? 1.22 : 1;
    springScale.current += (target - springScale.current) * Math.min(1, delta * 7);

    // A short, sharply-decaying spike — not a loop — riding on top of the
    // steady-state scale/glow for the first fraction of a second after a
    // belief first claims this neuron.
    let flash = 0;
    if (justActivatedAt != null) {
      const t = (performance.now() - justActivatedAt) / 1000 / ACTIVATION_FLASH_SECONDS;
      if (t >= 0 && t < 1) flash = Math.exp(-t * 6.5) * (1 - t);
    }

    ref.current.scale.setScalar(pulse * springScale.current * vitalityScale * (1 + flash * 1.6));
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = baseEmissive * emissivePulse * (0.5 + 0.5 * vitalitySmooth.current) * (1 + flash * 2.4);
    // A long-dormant belief's color itself dulls toward the tissue's dim
    // tone, not just its brightness — that's what makes it read as
    // "settling back into the background" rather than just "a smaller
    // bright dot."
    blendedColor.copy(baseColorObj).lerp(DIM_TINT, (1 - vitalitySmooth.current) * 0.5);
    mat.color.copy(blendedColor);
    mat.emissive.copy(blendedColor);

    if (glowRef.current) {
      const glowMat = glowRef.current.material as THREE.MeshBasicMaterial;
      glowMat.opacity = baseGlowOpacity * emissivePulse * (0.4 + 0.6 * vitalitySmooth.current) + flash * 0.5;
      glowRef.current.scale.setScalar(1.55 * pulse * vitalityScale * (1 + flash * 0.9));
    }

    if (haloRef.current) {
      const haloMat = haloRef.current.material as THREE.MeshBasicMaterial;
      haloMat.opacity += (haloTargetOpacity - haloMat.opacity) * Math.min(1, delta * 8);
      haloRef.current.scale.setScalar(1.95);
    }
  });

  return (
    <group position={node.position}>
      <mesh
        ref={ref}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHoverChange(true);
        }}
        onPointerOut={() => onHoverChange(false)}
      >
        <sphereGeometry args={[node.radius, 16, 16]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={baseEmissive}
          roughness={0.3}
          metalness={0.04}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Thin gold selection halo — a separate shell so the region color
          underneath is never overwritten, only outlined. */}
      <mesh ref={haloRef} scale={1.95}>
        <sphereGeometry args={[node.radius, 12, 12]} />
        <meshBasicMaterial color={SELECTION_GOLD} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={glowRef} scale={1.55}>
        <sphereGeometry args={[node.radius, 12, 12]} />
        <meshBasicMaterial color={node.color} transparent opacity={baseGlowOpacity} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BrainScene({
  activeNodes,
  connections,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  controlsRef,
  isInteracting,
  onInteractStart,
  onInteractEnd,
  justActivatedById,
  justActivatedBgIndices,
  structureMode,
  clusters,
  loopPlayingId,
}: {
  activeNodes: ActiveNode[];
  connections: NeuralBeliefConnection[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  controlsRef: React.MutableRefObject<any>;
  isInteracting: boolean;
  onInteractStart: () => void;
  onInteractEnd: () => void;
  justActivatedById: Map<string, number>;
  justActivatedBgIndices: number[];
  structureMode: boolean;
  clusters: string[][];
  loopPlayingId: string | null;
}) {
  // Hover still drives the visual highlight (dim/glow/edges) — that's a
  // harmless, purely cosmetic reaction to the cursor. The camera itself
  // used to recenter on hover too, which is what made a node feel like it
  // "flinched away" the moment the cursor got close: moving the orbit
  // target shifts everything on screen, including the point you were
  // about to click. Only an actual selection (click) may now move the
  // camera; hovering only ever changes color/glow.
  const focusId = hoveredId ?? selectedId;
  const focusNode = focusId ? activeNodes.find((n) => n.id === focusId) ?? null : null;
  const cameraFocusNode = selectedId ? activeNodes.find((n) => n.id === selectedId) ?? null : null;

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    connections.forEach((c) => {
      if (!map.has(c.a)) map.set(c.a, new Set());
      if (!map.has(c.b)) map.set(c.b, new Set());
      map.get(c.a)!.add(c.b);
      map.get(c.b)!.add(c.a);
    });
    return map;
  }, [connections]);

  // Re-centers the orbit target on the *selected* belief only (never on
  // hover) — a gentle "ease toward it" that only ever kicks in on a
  // deliberate click, and never fights the user's own drag/zoom.
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const desired = cameraFocusNode ? new THREE.Vector3(...cameraFocusNode.position) : new THREE.Vector3(0, 0, 0);
    const damp = 1 - Math.pow(0.0025, delta);
    controls.target.lerp(desired, damp);
  });

  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, 6.5, 11.8]} />
      <ambientLight intensity={1.3} />
      <pointLight position={[4, 5, 6]} intensity={16} color="#E8DEFF" />
      <pointLight position={[-5, -3, -4]} intensity={7} color="#DCE8FF" />

      {!IS_SMALL_SCREEN && (
        <>
          <BrainFieldGlowLayer scale={4.4} opacity={0.018} color="#1C1A1F" />
          <BrainFieldGlowLayer scale={2.1} opacity={0.045} color="#221F26" />
        </>
      )}
      <BrainField focusPosition={focusNode?.position ?? null} focusRadius={0.7} justActivatedBgIndices={justActivatedBgIndices} />
      <BrainEdges />
      <HighlightEdges focusBgIndex={focusNode?.bgIndex ?? null} />
      <BeliefConnectionLines nodes={activeNodes} connections={connections} focusId={focusId} structureMode={structureMode} />

      {/* Level 3 — cluster haze, structure-mode only. */}
      {structureMode &&
        clusters.map((clusterIds, ci) => {
          const clusterNodes = clusterIds.map((id) => activeNodes.find((n) => n.id === id)).filter((n): n is ActiveNode => !!n);
          return clusterNodes.length >= 3 ? <ClusterHaze key={ci} nodes={clusterNodes} /> : null;
        })}

      {activeNodes.map((node) => (
        <ActiveBeliefNode
          key={node.id}
          node={node}
          isSelected={selectedId === node.id}
          isFocused={focusId === node.id}
          isDimmed={!!focusId && focusId !== node.id && !adjacency.get(focusId)?.has(node.id)}
          justActivatedAt={justActivatedById.get(node.id) ?? null}
          onSelect={() => onSelect(selectedId === node.id ? null : node.id)}
          onHoverChange={(hovering) => onHover(hovering ? node.id : null)}
        />
      ))}

      {/* Level 2 — self-loop flowing light, only while a play has been requested. */}
      {structureMode && loopPlayingId && (() => {
        const loopNode = activeNodes.find((n) => n.id === loopPlayingId);
        return loopNode ? <LoopRing position={loopNode.position} radius={loopNode.radius} color={loopNode.color} /> : null;
      })()}

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={2.6}
        maxDistance={12.5}
        autoRotate={!selectedId && !isInteracting}
        autoRotateSpeed={0.16}
        dampingFactor={0.07}
        enableDamping
        onStart={onInteractStart}
        onEnd={onInteractEnd}
      />
    </>
  );
}

// How long a Level-2 self-loop play lasts once requested — long enough to
// watch the particle go around a couple of times, short enough that it
// clearly reads as "a moment you asked to see," not a new ambient loop.
const LOOP_PLAY_DURATION_MS = 4200;

export default function NeuralBeliefGraph3D({
  beliefs,
  connections,
  clusters = [],
  height = 360,
}: {
  beliefs: NeuralBeliefNode[];
  connections: NeuralBeliefConnection[];
  // Level 3 belief-network clusters (3+ mutually-reinforcing belief ids) —
  // see analysisFramework's findBeliefClusters. Purely additive: omitting
  // it just means no cluster haze, never an error.
  clusters?: string[][];
  height?: number;
}) {
  const activeNodes = useMemo(() => buildActiveNodes(beliefs), [beliefs]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<CognitiveRegion | null>(null);
  // Everything gated behind this (cluster haze, tension lines, the loop
  // play button) is real structure the data already supports — just kept
  // off by default so the first impression stays the calm "quiet tissue"
  // read the piece is built around, not a data-dense diagram.
  const [structureMode, setStructureMode] = useState(false);
  const [loopPlayingId, setLoopPlayingId] = useState<string | null>(null);
  const controlsRef = useRef<any>(null);
  const selectedNode = selectedId ? activeNodes.find((n) => n.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!loopPlayingId) return;
    const t = setTimeout(() => setLoopPlayingId(null), LOOP_PLAY_DURATION_MS);
    return () => clearTimeout(t);
  }, [loopPlayingId]);

  // Cluster membership + contradiction partner for whichever node is
  // selected — cheap to recompute per selection, no need to precompute
  // for every node up front.
  const selectedCluster = useMemo(() => {
    if (!selectedNode) return null;
    return clusters.find((c) => c.includes(selectedNode.id)) ?? null;
  }, [selectedNode, clusters]);
  const selectedContradiction = useMemo(() => {
    if (!selectedNode) return null;
    const link = connections.find((c) => c.type === "contradiction" && (c.a === selectedNode.id || c.b === selectedNode.id));
    if (!link) return null;
    const partnerId = link.a === selectedNode.id ? link.b : link.a;
    return activeNodes.find((n) => n.id === partnerId) ?? null;
  }, [selectedNode, connections, activeNodes]);

  // Claims each newly-seen belief's flash exactly once (mutating the
  // module-level set is what makes that permanent for this page load),
  // computed synchronously during render so the very first frame the new
  // neuron appears already carries its activation timestamp.
  const justActivatedById = useMemo(() => {
    const map = new Map<string, number>();
    const now = performance.now();
    activeNodes.forEach((node) => {
      if (!ANIMATED_BELIEF_IDS.has(node.id)) {
        ANIMATED_BELIEF_IDS.add(node.id);
        map.set(node.id, now);
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodes]);

  // The subset of activeNodes that just claimed a neuron for the first
  // time, reduced to their bgIndex — this is what tells BrainField which
  // handful of local background neighbors should ripple.
  const justActivatedBgIndices = useMemo(
    () => activeNodes.filter((n) => justActivatedById.has(n.id)).map((n) => n.bgIndex),
    [activeNodes, justActivatedById]
  );


  const resetView = () => {
    setSelectedId(null);
    setHoveredId(null);
    setSelectedRegion(null);
    setLoopPlayingId(null);
    controlsRef.current?.reset?.();
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: 26,
        overflow: "hidden",
        background: "radial-gradient(circle at 50% 45%, rgba(237,232,252,0.96) 0%, rgba(249,247,252,0.98) 52%, #FFFFFF 100%)",
        border: "1px solid rgba(91,75,138,0.08)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 18px 50px rgba(76,58,122,0.08)",
      }}
    >
      <Canvas
        dpr={IS_SMALL_SCREEN ? [1, 1.3] : [1, 1.75]}
        camera={{ position: [0, 0, 7.2], fov: 44 }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => setSelectedId(null)}
      >
        <BrainScene
          activeNodes={activeNodes}
          connections={connections}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={(id) => { setSelectedId(id); if (id) setSelectedRegion(null); }}
          onHover={setHoveredId}
          controlsRef={controlsRef}
          isInteracting={isInteracting}
          onInteractStart={() => setIsInteracting(true)}
          onInteractEnd={() => setIsInteracting(false)}
          justActivatedById={justActivatedById}
          justActivatedBgIndices={justActivatedBgIndices}
          structureMode={structureMode}
          clusters={clusters}
          loopPlayingId={loopPlayingId}
        />
      </Canvas>

      <div
        style={{
          position: "absolute",
          left: 14,
          top: 13,
          fontFamily: "Inter, sans-serif",
          fontSize: 10.5,
          color: "#93909B",
          letterSpacing: "0.02em",
          pointerEvents: "none",
        }}
      >
        드래그해서 회전 · 스크롤해서 확대
      </div>

      <div style={{ position: "absolute", right: 14, top: 11, display: "flex", gap: 6 }}>
        <button
          onClick={() => setStructureMode((v) => !v)}
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 10.5,
            fontWeight: 600,
            color: structureMode ? "#fff" : "#6E6B74",
            background: structureMode ? "#5B4B8A" : "rgba(255,255,255,0.7)",
            border: `1px solid ${structureMode ? "#5B4B8A" : "rgba(91,75,138,0.14)"}`,
            borderRadius: 999,
            padding: "5px 10px",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
          }}
        >
          구조 보기
        </button>
        <button
          onClick={resetView}
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 10.5,
            fontWeight: 600,
            color: "#6E6B74",
            background: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(91,75,138,0.14)",
            borderRadius: 999,
            padding: "5px 10px",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
          }}
        >
          초기화
        </button>
      </div>

      {selectedNode && (
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 14,
            padding: "13px 14px",
            borderRadius: 16,
            background: "rgba(255,255,255,0.88)",
            border: "1px solid rgba(91,75,138,0.12)",
            boxShadow: "0 12px 28px rgba(50,37,92,0.11)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10.5, fontWeight: 700, color: selectedNode.color }}>{selectedNode.domain}</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10.5, color: "#93909B" }}>
              {selectedNode.evidenceCount}건 · {selectedNode.confidence}%
            </span>
          </div>
          <div style={{ marginTop: 6, fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 17, lineHeight: 1.35, color: "#1C1B1F", wordBreak: "keep-all" }}>
            {selectedNode.statement}
          </div>

          {structureMode && selectedCluster && selectedCluster.length >= 3 && (
            <div style={{ marginTop: 8, fontFamily: "Inter, sans-serif", fontSize: 11.5, color: "#5B4B8A", lineHeight: 1.5, wordBreak: "keep-all" }}>
              다른 신념 {selectedCluster.length - 1}개와 함께 서로를 지지하고 있어요.
            </div>
          )}

          {structureMode && selectedContradiction && (
            <div style={{ marginTop: 8, fontFamily: "Inter, sans-serif", fontSize: 11.5, color: "#B5533C", lineHeight: 1.5, wordBreak: "keep-all" }}>
              "{selectedContradiction.statement}"와 긴장 관계에 있어요 — 어느 쪽이 맞는지는 정하지 않아요.
            </div>
          )}

          {structureMode && selectedNode.hasLoop && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#6E6B74", lineHeight: 1.4, wordBreak: "keep-all" }}>
                이 흐름이 반복되고 있어요
              </span>
              <button
                onClick={() => setLoopPlayingId(loopPlayingId === selectedNode.id ? null : selectedNode.id)}
                style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10.5, fontWeight: 700,
                  color: loopPlayingId === selectedNode.id ? "#fff" : "#5B4B8A",
                  background: loopPlayingId === selectedNode.id ? "#5B4B8A" : "rgba(91,75,138,0.1)",
                  border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", flexShrink: 0,
                }}
              >
                {loopPlayingId === selectedNode.id ? "재생 중 ⟳" : "재생 ▶"}
              </button>
            </div>
          )}
        </div>
      )}

      {!selectedNode && selectedRegion && (
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 46,
            padding: "12px 14px",
            borderRadius: 16,
            background: "rgba(255,255,255,0.9)",
            border: `1px solid ${REGION_CONFIG[selectedRegion].color}33`,
            boxShadow: "0 12px 28px rgba(50,37,92,0.11)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: REGION_CONFIG[selectedRegion].color, flexShrink: 0 }} />
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11.5, fontWeight: 700, color: REGION_CONFIG[selectedRegion].color }}>
              {REGION_CONFIG[selectedRegion].label}
            </span>
          </div>
          <div style={{ marginTop: 5, fontFamily: "Inter, sans-serif", fontSize: 12, lineHeight: 1.5, color: "#403E45", wordBreak: "keep-all" }}>
            {REGION_CONFIG[selectedRegion].description}
          </div>
        </div>
      )}

      {!selectedNode && (
        <div
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 12,
            display: "flex",
            justifyContent: "center",
            flexWrap: "nowrap",
            gap: 5,
          }}
        >
          {COGNITIVE_REGIONS.map((region) => {
            const active = selectedRegion === region;
            return (
              <div
                key={region}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRegion(active ? null : region)}
                style={{
                  display: "flex", alignItems: "center", gap: 3, flexShrink: 0, cursor: "pointer",
                  padding: "3px 6px", borderRadius: 999,
                  backgroundColor: active ? `${REGION_CONFIG[region].color}22` : "transparent",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: REGION_CONFIG[region].color, flexShrink: 0 }} />
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: active ? 700 : 500, color: active ? REGION_CONFIG[region].color : "#847F8C", whiteSpace: "nowrap" }}>
                  {REGION_CONFIG[region].label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
