// Deterministic generator for an abstract, brain-shaped neural node cloud.
// The brain shape comes entirely from *where nodes are allowed to land* —
// a hollow bilateral-hemisphere SHELL (two mirrored ellipsoid shells for
// left/right cortex, an ellipsoid shell for the cerebellum, a solid box for
// the stem), sampled by plain rejection sampling — never from a mesh,
// texture, or the user's actual belief count. This is a direct port of the
// reference Brain Node Map design's own `inBrainShell` test, kept
// byte-for-byte identical in its math so the point cloud's actual
// *formation* — not just its color — matches that reference from every
// viewing angle, not an approximation of it.

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

// Which structural part a shell-test hit belongs to — anatomical labeling
// only (used for nothing but a possible future tint-by-part), completely
// separate from the app's own six *cognitive* regions, which are computed
// purely from finished (x, z) position via cognitiveRegionForPosition below
// and never touch this.
type BrainShellPart = "cortex" | "cerebellum" | "stem";

// Byte-for-byte the reference file's own `inBrainShell` test: two mirrored
// ellipsoid SHELLS (0.5 < d < 1.0, i.e. hollow — points land on the surface
// band, not filled solid) for the left/right cortex with a midline gap cut
// out of the top, one ellipsoid shell for the cerebellum, and a solid box
// for the stem. Unlike the old metaball union, this never blends adjacent
// lobes into each other — it's exactly this test, nothing smoothed on top.
function classifyBrainShell(x: number, y: number, z: number): BrainShellPart | null {
  const a = 0.62, b = 0.78, c = 1.05;
  const hx = Math.abs(x) - 0.5;
  const nx = hx / a, ny = (y - 0.05) / b, nz = z / c;
  const d = nx * nx + ny * ny + nz * nz;
  const gap = Math.abs(x) < 0.07 && y > 0.1;
  const hemiShell = d > 0.5 && d < 1.0 && !gap && hx > -0.35;
  if (hemiShell) return "cortex";

  const cx = x, cy = y + 0.62, cz = z + 0.92;
  const cd = (cx * cx) / (0.42 * 0.42) + (cy * cy) / (0.34 * 0.34) + (cz * cz) / (0.4 * 0.4);
  if (cd > 0.5 && cd < 1.0) return "cerebellum";

  const stem = Math.abs(x) < 0.13 && y < -0.55 && y > -0.98 && Math.abs(z + 0.3) < 0.2;
  if (stem) return "stem";

  return null;
}

// Same bounding box and post-scale as the reference file's own generator
// loop — this is what actually fixes the cloud's proportions/silhouette to
// match, not just the shell test in isolation.
const SHELL_BOUNDS = { x: 1.3, y: 1.05, z: 1.35 };
const SHELL_SCALE = 1.15;

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

// Plain rejection sampling against the shell test — no relaxation/smoothing
// pass on top, matching the reference generator exactly (its own cloud is
// visibly a bit clumpy/uneven in places, e.g. the "constellation" look in
// the reference screenshots; that unevenness is the actual reference look,
// not a bug to smooth away).
export function generateBrainCloud(count: number, seed: number): BrainPoint[] {
  const rand = mulberry32(seed);
  const points: BrainPoint[] = [];
  let attempts = 0;
  const maxAttempts = count * 60;
  while (points.length < count && attempts < maxAttempts) {
    attempts += 1;
    const x = (rand() * 2 - 1) * SHELL_BOUNDS.x;
    const y = (rand() * 2 - 1) * SHELL_BOUNDS.y;
    const z = (rand() * 2 - 1) * SHELL_BOUNDS.z;
    const part = classifyBrainShell(x, y, z);
    if (!part) continue;
    points.push({
      position: [x * SHELL_SCALE, y * SHELL_SCALE, z * SHELL_SCALE],
      region: part,
    });
  }

  // Recenter on the cloud's own centroid. The shell test's cerebellum/stem
  // additions sit behind and below the two cortex hemispheres with nothing
  // mirroring them on the other side, which skews the raw point cloud's
  // centroid off the coordinate origin (measured: ~0.07-0.08 units off on
  // z, negligible on x/y). Every consumer (NeuralBeliefGraph3D,
  // BrainNodeMapScreen) orbits its camera around a fixed (0,0,0) target, so
  // that skew reads as the whole shape swinging off-center as the camera
  // auto-rotates, not just a static framing issue.
  let cx = 0, cy = 0, cz = 0;
  for (const p of points) {
    cx += p.position[0];
    cy += p.position[1];
    cz += p.position[2];
  }
  const n = points.length || 1;
  cx /= n;
  cy /= n;
  cz /= n;
  for (const p of points) {
    p.position[0] -= cx;
    p.position[1] -= cy;
    p.position[2] -= cz;
  }

  return points;
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
// slice of the same generated volume. This never touches the shell
// generator above; it's just a classification of the positions it already
// produced.
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
