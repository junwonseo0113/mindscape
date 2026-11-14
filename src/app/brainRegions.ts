// ── Cognitive-region data shared by 2D screens and the 3D brain ─────────────
// Split out of NeuralBeliefGraph3D.tsx: everything here is plain data and
// pure functions, so App can import it eagerly while three.js and the
// brain-cloud generation stay in a lazily-loaded chunk.
import { type CognitiveRegion, COGNITIVE_REGIONS, hashString } from "./neuralBrainLayout";
import type { StoredEvidenceQuote } from "./types";

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
  // Which of the six app-defined cognitive regions this belief activates a
  // neuron in. Optional because the backend doesn't produce this yet —
  // see mapDomainToCognitiveRegion below for the fallback.
  region?: CognitiveRegion;
  // Optional — only used by BrainNodeMapScreen's node-detail panel
  // ("Moments that support this pattern"). Always present in practice (every real
  // StoredBelief carries its own quotes), optional here only so a caller
  // that genuinely doesn't have quotes yet isn't forced to fake an array.
  evidenceQuotes?: StoredEvidenceQuote[];
  // Emotional granularity (Feldman Barrett) — average distinct-emotion-label
  // count across this belief's last few supporting entries. Purely a
  // surface-geometry driver (see ActiveBeliefNode's facetDetail): more
  // distinct emotions reads as a visibly faceted surface, one flat feeling
  // reads as smooth. Never shown as a number anywhere.
  emotionGranularity?: number;
  // Rumination-possibility (Trapnell & Campbell) — see analysisFramework's
  // isLikelyRuminating. Purely a visual "still circling" cue (an orbiting
  // particle in the neuron's own color, never a warning color), never a
  // label — same non-diagnostic rule as everywhere else this signal appears.
  ruminationLikely?: boolean;
};

// Temporary mapping until the backend sends `region` directly: the app's
// real belief data only carries a freeform `domain` string, so this guesses
// a cognitive region from keywords and falls back to a stable hash so every
// domain still lands somewhere deterministic.
const DOMAIN_REGION_KEYWORDS: [RegExp, CognitiveRegion][] = [
  [/career|job|work|workplace|profession|occupation/i, "career"],
  [/relationship|love|family|friend|romance|dating/i, "relationships"],
  [/safe|security|stability|stable/i, "security"],
  [/self|identity|value/i, "identity"],
  [/creativ|art|imagin/i, "creativity"],
  [/curio|explore|learn|growth/i, "curiosity"],
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
export type NeuralBeliefConnection = { a: string; b: string; type?: "root" | "contradiction"; note: string };

// Real recency from a "YYYY.MM.DD" date (formatDateDots format), decaying
// smoothly rather than in visible steps — exponential with a ~3-week time
// constant, floored well above zero so an old-but-real belief still reads
// as present tissue, just quieter, never mistaken for background noise
// (the metaphor is dormancy/pruning-adjacent dimming, not deletion).
// Exported so History's star catalogue can compute the exact same
// vitality/dormancy signal the Brain Map itself uses, instead of a second,
// independently-tuned "recency" concept drifting out of sync with it.
export function recencyFromDate(dateStr?: string): number | null {
  if (!dateStr) return null;
  const parts = dateStr.split(".").map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const then = new Date(y, m - 1, d).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.max(0, (Date.now() - then) / (1000 * 60 * 60 * 24));
  return Math.max(0.15, Math.min(1, Math.exp(-days / 21)));
}

// ── Single source of truth for the six cognitive regions: their permanent
// activation color, display label, and a one-line description of what the
// category actually means — the legend and RegionBreakdown both read from
// this map — nothing hardcodes a region's color or meaning anywhere else.
export const REGION_CONFIG: Record<CognitiveRegion, { color: string; label: string; description: string }> = {
  identity: { color: "#8B7CFF", label: "Identity", description: "Who you think you are — beliefs about self-perception, self-worth, and values" },
  security: { color: "#4CAF7A", label: "Security", description: "The standards you use to stay safe in the face of risk and change" },
  career: { color: "#D9A441", label: "Career", description: "Beliefs you hold about work, achievement, and ability" },
  relationships: { color: "#E88AAE", label: "Relationships", description: "Recurring thoughts and attitudes in how you relate to other people" },
  curiosity: { color: "#69A7FF", label: "Curiosity", description: "Your attitude toward exploring and learning new things" },
  creativity: { color: "#F4A261", label: "Creativity", description: "Beliefs about how you imagine and express yourself" },
};

