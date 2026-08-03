// Deterministic generator for an abstract, brain-shaped neural node cloud.
// The brain shape comes entirely from *where nodes are allowed to land* —
// a metaball-style union of a dozen overlapping 3D ellipsoid "lobes",
// relaxed into a more even fill — never from a mesh, texture, or the
// user's actual belief count. Every cortical/cerebellar lobe is a real
// bilateral pair straddling the z axis (left/right hemisphere), so the
// volume has genuine structure along all three axes and reads as a brain
// from any viewing angle — front, top, or side — not just from one profile
// with a flat extrusion behind it. That's what keeps it abstract up close
// (just dots and lines) while still reading as a brain silhouette from a
// normal viewing distance, at densities (800-1500 points) where a naive
// O(n²) neighbor search would be too slow to run even once.

export type Vec3 = [number, number, number];
export type BrainPoint = { position: Vec3; region: string };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// A stable 0..1 value derived only from a string id — used for per-node
// pulse/drift phase so animation looks organic without needing fresh
// randomness every frame, and without depending on array order.
export function stableUnit(seedStr: string) {
  const x = Math.sin(hashString(seedStr) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

type Blob = { cx: number; cy: number; cz: number; rx: number; ry: number; rz: number; name: string };

// A true 3D volume, not a flat silhouette extruded in z: every cortical
// lobe exists as a bilateral PAIR straddling the z axis (left/right
// hemisphere), plus a handful of midline structures gluing the two halves
// together. That's what makes the union read as a brain from the front
// and top — not just from the side — since each viewing angle now cuts
// through genuinely different, asymmetric lobe bulges instead of a single
// blob that only has silhouette detail in the x/y plane.
const HEMI = 0.44; // how far each paired lobe sits from the midline

const BLOBS: Blob[] = [
  // Bilateral cortical lobes (each mirrored at ±z).
  { name: "frontal", cx: 1.05, cy: 0.26, cz: HEMI, rx: 0.7, ry: 0.6, rz: 0.6 },
  { name: "frontal", cx: 1.05, cy: 0.26, cz: -HEMI, rx: 0.7, ry: 0.6, rz: 0.6 },
  { name: "parietal", cx: 0.12, cy: 0.58, cz: HEMI * 0.95, rx: 0.66, ry: 0.55, rz: 0.6 },
  { name: "parietal", cx: 0.12, cy: 0.58, cz: -HEMI * 0.95, rx: 0.66, ry: 0.55, rz: 0.6 },
  { name: "temporal", cx: 0.32, cy: -0.3, cz: HEMI * 1.18, rx: 0.72, ry: 0.46, rz: 0.65 },
  { name: "temporal", cx: 0.32, cy: -0.3, cz: -HEMI * 1.18, rx: 0.72, ry: 0.46, rz: 0.65 },
  { name: "occipital", cx: -0.86, cy: 0.14, cz: HEMI * 0.9, rx: 0.6, ry: 0.53, rz: 0.58 },
  { name: "occipital", cx: -0.86, cy: 0.14, cz: -HEMI * 0.9, rx: 0.6, ry: 0.53, rz: 0.58 },
  // Central connective mass — spans both hemispheres at a lower z-radius
  // so it fills the gap between the paired lobes without erasing the
  // midline groove between them near the top surface.
  { name: "core", cx: 0.05, cy: 0.28, cz: 0, rx: 1.1, ry: 0.8, rz: 0.48 },
  // Cerebellum: paired hemispheres plus a small midline vermis, same
  // bilateral logic as the cortex above, just smaller and lower/further
  // back.
  { name: "cerebellum", cx: -0.7, cy: -0.48, cz: 0.3, rx: 0.5, ry: 0.42, rz: 0.44 },
  { name: "cerebellum", cx: -0.7, cy: -0.48, cz: -0.3, rx: 0.5, ry: 0.42, rz: 0.44 },
  { name: "cerebellum", cx: -0.7, cy: -0.44, cz: 0, rx: 0.32, ry: 0.36, rz: 0.4 },
  // Stem: single narrow midline column.
  { name: "stem", cx: -0.15, cy: -0.78, cz: 0, rx: 0.25, ry: 0.42, rz: 0.25 },
];

const BRAIN_SCALE = 1.75;
// The lobe weights above sit slightly up-and-right of the origin; shifting
// by their approximate centroid before scaling keeps the finished cloud
// visually centered in the card instead of drifting toward one corner.
const CENTER_OFFSET: [number, number] = [0.15, 0.16];

const ISO_LEVEL = 0.42;
const BOUNDS = { x: 1.8, y: 1.45, z: 1.15 };

// A soft density dip along the midline, but only near the top/outer
// surface — this is what reads as the longitudinal fissure separating the
// two hemispheres when viewed from above, without ever cutting a hard
// seam through the whole volume.
function grooveSuppression(y: number, z: number) {
  const zFalloff = Math.exp(-(z * z) / (2 * 0.1 * 0.1));
  const yFalloff = Math.max(0, Math.min(1, (y + 0.05) / 0.35));
  return zFalloff * yFalloff;
}

// Distance-from-center falloff (normalized to the brain's own elongated
// proportions, not a plain sphere) — this is the main lever that makes the
// core read as almost solid while the outer shell thins out gradually.
// It only ever scales how likely an already-inside point is to be kept, so
// the iso-surface boundary/silhouette itself never moves; the *edge* of
// that boundary just gets softer.
const RADIAL_NORM = { x: 1.55, y: 1.15, z: 1.0 };
const RADIAL_SIGMA = 0.6;
function radialDensity(x: number, y: number, z: number) {
  const rx = (x - CENTER_OFFSET[0]) / RADIAL_NORM.x;
  const ry = (y - CENTER_OFFSET[1]) / RADIAL_NORM.y;
  const rz = z / RADIAL_NORM.z;
  const r2 = rx * rx + ry * ry + rz * rz;
  return Math.exp(-r2 / (2 * RADIAL_SIGMA * RADIAL_SIGMA));
}

function fieldAt(x: number, y: number, z: number): { value: number; blob: string } {
  let total = 0;
  let bestBlob = BLOBS[0].name;
  let bestTerm = -Infinity;
  for (const b of BLOBS) {
    const dx = (x - b.cx) / b.rx;
    const dy = (y - b.cy) / b.ry;
    const dz = (z - b.cz) / b.rz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 1) {
      const term = (1 - d2) * (1 - d2);
      total += term;
      if (term > bestTerm) {
        bestTerm = term;
        bestBlob = b.name;
      }
    }
  }
  return { value: total - grooveSuppression(y, z) * 0.32, blob: bestBlob };
}

// Rejection-samples a point inside the blob union. Two independent signals
// set the keep-chance: how far past the iso threshold the point sits
// (local — this is what fills in the seams *between* adjacent lobes so
// they blend instead of reading as separate clusters) and how far the
// point sits from the brain's overall center (global — a soft gaussian
// that makes the core read as almost solid while the outer shell thins
// out gradually, per lobe geometry never changes, only how densely each
// spot gets populated).
function sampleOne(rand: () => number): BrainPoint | null {
  const x = (rand() * 2 - 1) * BOUNDS.x;
  const y = (rand() * 2 - 1) * BOUNDS.y;
  const z = (rand() * 2 - 1) * BOUNDS.z;
  const { value, blob } = fieldAt(x, y, z);
  if (value <= ISO_LEVEL) return null;
  const depth = Math.min(1, (value - ISO_LEVEL) / 0.6);
  const depthKeep = 0.5 + 0.5 * depth;
  const centerKeep = 0.12 + 0.88 * radialDensity(x, y, z);
  const keepChance = depthKeep * centerKeep;
  if (rand() >= keepChance) return null;
  const position: Vec3 = [
    (x - CENTER_OFFSET[0]) * BRAIN_SCALE,
    (y - CENTER_OFFSET[1]) * BRAIN_SCALE,
    z * BRAIN_SCALE,
  ];
  return { position, region: blob };
}

function cellKey(x: number, y: number, z: number, cellSize: number) {
  return `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}:${Math.floor(z / cellSize)}`;
}

function buildGrid(positions: Vec3[], cellSize: number) {
  const grid = new Map<string, number[]>();
  positions.forEach((p, i) => {
    const key = cellKey(p[0], p[1], p[2], cellSize);
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  });
  return grid;
}

// A handful of short-range repulsion passes so the raw rejection-sampled
// cloud fills in as one continuous mass instead of leaving random gaps and
// clumps — each point is only ever pulled back inside the silhouette, so
// the brain outline itself never changes, just the local evenness of fill.
function relax(points: BrainPoint[], iterations: number, repelDist: number, strength: number): BrainPoint[] {
  let positions = points.map((p) => p.position.slice() as Vec3);
  const repelDist2 = repelDist * repelDist;

  for (let iter = 0; iter < iterations; iter += 1) {
    const grid = buildGrid(positions, repelDist);
    const forces: Vec3[] = positions.map(() => [0, 0, 0]);

    for (let i = 0; i < positions.length; i += 1) {
      const p = positions[i];
      const cx = Math.floor(p[0] / repelDist);
      const cy = Math.floor(p[1] / repelDist);
      const cz = Math.floor(p[2] / repelDist);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dz = -1; dz <= 1; dz += 1) {
            const bucket = grid.get(`${cx + dx}:${cy + dy}:${cz + dz}`);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j === i) continue;
              const q = positions[j];
              const ddx = p[0] - q[0];
              const ddy = p[1] - q[1];
              const ddz = p[2] - q[2];
              const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
              if (d2 > 0 && d2 < repelDist2) {
                const d = Math.sqrt(d2);
                const f = ((repelDist - d) / repelDist) * strength;
                forces[i][0] += (ddx / d) * f;
                forces[i][1] += (ddy / d) * f;
                forces[i][2] += (ddz / d) * f;
              }
            }
          }
        }
      }
    }

    positions = positions.map((p, i) => {
      const nx = p[0] + forces[i][0];
      const ny = p[1] + forces[i][1];
      const nz = p[2] + forces[i][2];
      const backX = nx / BRAIN_SCALE + CENTER_OFFSET[0];
      const backY = ny / BRAIN_SCALE + CENTER_OFFSET[1];
      const backZ = nz / BRAIN_SCALE;
      const { value } = fieldAt(backX, backY, backZ);
      if (value <= ISO_LEVEL) return p;
      return [nx, ny, nz] as Vec3;
    });
  }

  return points.map((p, i) => ({ ...p, position: positions[i] }));
}

export function generateBrainCloud(count: number, seed: number): BrainPoint[] {
  const rand = mulberry32(seed);
  const points: BrainPoint[] = [];
  let attempts = 0;
  const maxAttempts = count * 260;
  while (points.length < count && attempts < maxAttempts) {
    attempts += 1;
    const p = sampleOne(rand);
    if (p) points.push(p);
  }
  return relax(points, 4, 0.26, 0.06);
}

// Real beliefs never get their own layout — they promote a handful of
// already-placed background neurons (well-spaced, picked in generation
// order for determinism) into "active" status. This is what keeps a
// belief looking like part of the same tissue instead of a separate
// planet dropped on top of it.
export function pickPromotableIndices(points: BrainPoint[], count: number, minSpacing: number): number[] {
  const chosen: number[] = [];
  const minSpacing2 = minSpacing * minSpacing;
  for (let i = 0; i < points.length && chosen.length < count; i += 1) {
    const p = points[i].position;
    let ok = true;
    for (const ci of chosen) {
      const q = points[ci].position;
      const dx = p[0] - q[0];
      const dy = p[1] - q[1];
      const dz = p[2] - q[2];
      if (dx * dx + dy * dy + dz * dz < minSpacing2) {
        ok = false;
        break;
      }
    }
    if (ok) chosen.push(i);
  }
  return chosen;
}

// Deterministic id -> background-index assignment: the same belief always
// promotes the same neuron across renders and sessions (hash of its id,
// not array position), with linear probing so two ids never collide.
export function assignBeliefsToIndices<T extends { id: string }>(items: T[], slotIndices: number[]): Map<string, number> {
  const used = new Set<number>();
  const assignment = new Map<string, number>();
  if (slotIndices.length === 0) return assignment;
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const item of sorted) {
    let idx = hashString(item.id) % slotIndices.length;
    let tries = 0;
    while (used.has(idx) && tries < slotIndices.length) {
      idx = (idx + 1) % slotIndices.length;
      tries += 1;
    }
    used.add(idx);
    assignment.set(item.id, slotIndices[idx]);
  }
  return assignment;
}

// Spatial-grid neighbor search instead of an all-pairs scan — the only way
// "several hundred to a couple thousand" proximity edges stay cheap to
// compute once at load time when the cloud itself is 800-1500 points.
export function buildProximityEdges(points: Vec3[], k: number, maxDist: number): [number, number][] {
  const grid = buildGrid(points, maxDist);
  const maxDist2 = maxDist * maxDist;
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const cx = Math.floor(p[0] / maxDist);
    const cy = Math.floor(p[1] / maxDist);
    const cz = Math.floor(p[2] / maxDist);
    const candidates: { j: number; d2: number }[] = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const bucket = grid.get(`${cx + dx}:${cy + dy}:${cz + dz}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j === i) continue;
            const q = points[j];
            const ddx = p[0] - q[0];
            const ddy = p[1] - q[1];
            const ddz = p[2] - q[2];
            const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d2 <= maxDist2) candidates.push({ j, d2 });
          }
        }
      }
    }
    candidates.sort((a, b) => a.d2 - b.d2);
    for (const { j } of candidates.slice(0, k)) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push(i < j ? [i, j] : [j, i]);
    }
  }

  return bridgeDisconnectedGroups(points, edges);
}

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

// A k-nearest-neighbor graph over a lumpy, lobed volume almost never comes
// out as one connected mass on its own — a handful of local clusters (one
// per lobe, roughly) end up with no edge crossing the sparser saddle
// between them. Rather than loosening maxDist/k everywhere (which would
// make the *whole* mesh more visible, undoing the "barely there" edges
// elsewhere), this stitches only the minimum number of bridges needed:
// one shortest possible link per disconnected group, so every neuron ends
// up reachable through the same tissue with as few extra lines as
// possible.
function bridgeDisconnectedGroups(points: Vec3[], edges: [number, number][]): [number, number][] {
  const n = points.length;
  const uf = new UnionFind(n);
  edges.forEach(([i, j]) => uf.union(i, j));

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const r = uf.find(i);
    const bucket = groups.get(r);
    if (bucket) bucket.push(i);
    else groups.set(r, [i]);
  }
  const groupList = [...groups.values()].sort((a, b) => b.length - a.length);
  if (groupList.length <= 1) return edges;

  const bridged = [...edges];
  for (let g = 1; g < groupList.length; g += 1) {
    const members = groupList[g];
    let bestI = -1;
    let bestJ = -1;
    let bestD2 = Infinity;
    for (const i of members) {
      const p = points[i];
      const rootI = uf.find(i);
      for (let j = 0; j < n; j += 1) {
        if (uf.find(j) === rootI) continue;
        const q = points[j];
        const dx = p[0] - q[0];
        const dy = p[1] - q[1];
        const dz = p[2] - q[2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI >= 0) {
      bridged.push(bestI < bestJ ? [bestI, bestJ] : [bestJ, bestI]);
      uf.union(bestI, bestJ);
    }
  }
  return bridged;
}

// ── Cognitive regions — an app-defined overlay, not an anatomical claim.
// Six equal wedges swept around the vertical (y) axis, purely from each
// neuron's own (x, z) position, so every region is a stable, contiguous
// slice of the same generated volume. This never touches the generator
// above (BLOBS/relax/edges); it's just a classification of the positions
// it already produced.
export type CognitiveRegion = "identity" | "security" | "career" | "relationships" | "creativity" | "curiosity";

export const COGNITIVE_REGIONS: CognitiveRegion[] = [
  "identity",
  "security",
  "career",
  "relationships",
  "creativity",
  "curiosity",
];

export function cognitiveRegionForPosition(position: Vec3): CognitiveRegion {
  const [x, , z] = position;
  const angle = Math.atan2(z, x);
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
  const index = Math.floor((normalized / (Math.PI * 2)) * COGNITIVE_REGIONS.length) % COGNITIVE_REGIONS.length;
  return COGNITIVE_REGIONS[index];
}

// Runs the same well-spaced slot picker as pickPromotableIndices, once per
// cognitive region, so a belief can only ever promote a neuron that
// already sits inside its own region's wedge — "find inactive neurons
// belonging to that region" starts from a pool that's already
// region-pure, rather than filtering after the fact.
export function pickPromotableIndicesByRegion(
  points: BrainPoint[],
  regionOf: (index: number) => CognitiveRegion,
  countPerRegion: number,
  minSpacing: number
): Record<CognitiveRegion, number[]> {
  const byRegion = new Map<CognitiveRegion, { globalIndex: number; point: BrainPoint }[]>();
  COGNITIVE_REGIONS.forEach((r) => byRegion.set(r, []));
  points.forEach((p, i) => byRegion.get(regionOf(i))!.push({ globalIndex: i, point: p }));

  const result = {} as Record<CognitiveRegion, number[]>;
  for (const region of COGNITIVE_REGIONS) {
    const entries = byRegion.get(region)!;
    const localSlots = pickPromotableIndices(
      entries.map((e) => e.point),
      countPerRegion,
      minSpacing
    );
    result[region] = localSlots.map((localIdx) => entries[localIdx].globalIndex);
  }
  return result;
}
