// ── The app's default psychological analysis framework ──────────────────────
// This is the rules engine behind every thought entry's analysis: an
// evidence-informed self-reflection aid, not therapy, diagnosis, or clinical
// assessment. Grounded in:
//   - CBT: situation → automatic thought → possible cognitive pattern
//   - ACT: values direction (moving toward vs. away from what matters)
//   - Schema Therapy: used ONLY as an optional, secondary label on a
//     recurring pattern that has already cleared the evidence bar below —
//     never assigned from a single entry, never framed as a diagnosis.
//
// The hard rules live here as actual code, not just prompt instructions, so
// they hold regardless of what any single model call happens to produce:
//   - a candidate pattern only becomes a visible, recurring belief once
//     MIN_SUPPORTING_ENTRIES_FOR_BELIEF semantically similar entries
//     support it (see PendingBeliefCandidate in types.ts) — one entry is
//     never enough;
//   - status is always recomputed from actual supporting/contradictory
//     entry counts, never taken as-is from a model's guess;
//   - confidence never reaches 100 (a hypothesis is never "confirmed fact")
//     and never drops to 0 (uncertainty is always acknowledged);
//   - a rejected belief is excluded from future matching context (see
//     matchableBeliefContext) — new similar entries can't silently keep
//     reinforcing something the user said wasn't accurate; only an
//     independently-accumulated new candidate (its own fresh 3 entries)
//     can re-establish the pattern.

import { HypothesisStatus, PendingBeliefCandidate, Store, StoredBelief, StoredConnection } from "./types";

export const DISCLAIMER_NOTICE =
  "이 분석은 CBT와 ACT의 개념을 참고한 자기성찰 도구이며, 심리 진단이나 치료를 대체하지 않습니다.";

// One entry is an observation. Two is a coincidence worth watching. Three
// is the minimum this framework treats as an actual recurring pattern.
export const MIN_SUPPORTING_ENTRIES_FOR_BELIEF = 3;

const MIN_CONFIDENCE = 5;
const MAX_CONFIDENCE = 92;

// Closed-ish vocabulary so cognitive-pattern labels stay consistent and
// genuinely CBT-grounded instead of free-form editorializing. Not
// exhaustive — the model may still describe a pattern in its own words in
// reasoningSummary, but the tags themselves should come from here.
export const COGNITIVE_PATTERN_LABELS = [
  "흑백사고", // all-or-nothing thinking
  "과잉일반화", // overgeneralization
  "재앙화", // catastrophizing
  "개인화", // personalization
  "감정적 추론", // emotional reasoning
  "당위적 사고", // "should" statements
  "정신적 여과", // mental filtering
  "성급한 결론", // jumping to conclusions
  "긍정 축소", // discounting the positive
] as const;

// Shown when a user taps a pattern tag — deliberately worded as "this is a
// common, nameable habit of thought" rather than "this is wrong, fix it."
// Reflect, don't correct: naming the pattern is the entire intervention;
// there's no prescription attached.
export const COGNITIVE_PATTERN_DESCRIPTIONS: Record<(typeof COGNITIVE_PATTERN_LABELS)[number], string> = {
  "흑백사고": "'항상', '전혀', '완전히' 같은 표현처럼, 상황을 두 극단으로만 나눠서 보는 흔한 사고 습관이에요.",
  "과잉일반화": "한두 번 있었던 일을 '매번', '누구나 다' 같은 표현으로 넓혀서 보는 흔한 사고 습관이에요.",
  "재앙화": "일어날 수 있는 가장 나쁜 결과부터 먼저 떠올리는 흔한 사고 습관이에요.",
  "개인화": "함께 작용한 다른 원인들이 있는데도, 일어난 일의 원인을 자기 자신에게서만 찾는 흔한 사고 습관이에요.",
  "감정적 추론": "'이렇게 느껴지니까 분명 사실일 거야'처럼, 감정을 근거 삼아 결론을 내리는 흔한 사고 습관이에요.",
  "당위적 사고": "'반드시', '~해야 한다' 같은 표현처럼, 스스로에게 엄격한 기준을 강제하는 흔한 사고 습관이에요.",
  "정신적 여과": "잘된 부분은 지나치고 아쉬웠던 한 부분에만 계속 머무르는 흔한 사고 습관이에요.",
  "성급한 결론": "충분한 근거 없이, 상대의 생각이나 앞으로의 결과를 미리 단정하는 흔한 사고 습관이에요.",
  "긍정 축소": "잘한 일이나 좋은 결과를 '별거 아니었다'며 깎아내리는 흔한 사고 습관이에요.",
};

// Suggested ACT life-domain vocabulary for valueDirection.relatedValues —
// a starting point, not a closed list.
export const VALUE_DOMAIN_LABELS = [
  "관계", "일/커리어", "건강", "성장/배움", "자율성", "안정감", "여가", "공동체", "자기표현",
] as const;

// Secondary, longitudinal-only, optional. Loose descriptive labels, not a
// clinical schema inventory — only ever attached to a belief that has
// already independently cleared MIN_SUPPORTING_ENTRIES_FOR_BELIEF.
export const SCHEMA_DOMAIN_LABELS = [
  "결핍/유기", "불신/상처", "실패에 대한 예민함", "복종/맞춤", "엄격한 기준", "고립/단절",
] as const;

// Neutral, hedged phrasing this framework's language should sound like —
// referenced by the prompt, not enforced at runtime (language quality
// isn't something code can check), but kept here as the single source of
// truth for tone.
export const HEDGE_PHRASES = [
  "이런 가능성이 있습니다",
  "현재 기록에서는",
  "아직 근거가 충분하지 않습니다",
] as const;

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return MIN_CONFIDENCE;
  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, Math.round(value)));
}

// Status is always derived from actual evidence counts — never trusted
// as-is from a model response — so "insufficient_data until 3 entries"
// holds no matter what any single call returns.
export function deriveStatus(supportingCount: number, contradictoryCount: number): HypothesisStatus {
  const total = supportingCount + contradictoryCount;
  if (total < MIN_SUPPORTING_ENTRIES_FOR_BELIEF) return "insufficient_data";
  if (contradictoryCount > 0 && contradictoryCount >= supportingCount) return "conflicted";
  if (supportingCount >= 5 && contradictoryCount === 0) return "supported";
  return "emerging";
}

// Confidence moves incrementally, never jumps to certainty. Contradictions
// are weighted to hurt more than a single support helps — evidence that
// conflicts should visibly cost confidence, per the framework's rules,
// rather than being averaged away.
export function nextConfidence(prevConfidence: number, relation: "supports" | "contradicts", directness: number): number {
  const d = Math.max(0, Math.min(1, Number.isFinite(directness) ? directness : 0.4));
  if (relation === "supports") {
    return clampConfidence(prevConfidence + 4 + d * 10);
  }
  return clampConfidence(prevConfidence - (8 + d * 14));
}

// A freshly-promoted belief's starting confidence, based on how directly
// its founding entries showed the pattern (explicit statement vs. a weak
// behavioral inference) — still modest even at its most direct, since
// three entries is the minimum bar, not overwhelming evidence.
export function initialConfidenceOnPromotion(avgDirectness: number): number {
  const d = Math.max(0, Math.min(1, Number.isFinite(avgDirectness) ? avgDirectness : 0.4));
  return clampConfidence(30 + d * 35);
}

// The context sent to the model for matching a new entry against
// already-known patterns — deliberately excludes any belief the user
// rejected, so a rejected pattern has no way to keep absorbing new
// "supporting" entries. If the same pattern is real, it has to
// independently earn its own fresh MIN_SUPPORTING_ENTRIES_FOR_BELIEF.
export function matchableCandidates(store: Store): {
  beliefs: Pick<StoredBelief, "id" | "domain" | "statement" | "confidence">[];
  pending: Pick<PendingBeliefCandidate, "id" | "domain" | "statement">[];
} {
  return {
    beliefs: store.beliefs
      .filter((b) => b.userReaction !== "rejected")
      .map((b) => ({ id: b.id, domain: b.domain, statement: b.statement, confidence: b.confidence })),
    pending: (store.pendingBeliefCandidates ?? []).map((p) => ({ id: p.id, domain: p.domain, statement: p.statement })),
  };
}

// ── Belief network mapping (Level 3) ─────────────────────────────────────────
// A core belief is rarely alone — usually several mutually-reinforcing
// beliefs prop each other up. This finds the connected components among
// "root" (mutually-reinforcing) connections only — "contradiction"-type
// connections represent tension, not reinforcement, so they're excluded
// here (see findContradictionPairs below for those). Only components with
// 3+ members are returned: a pair is just "a connection," already shown
// elsewhere — a genuine *network* is what's structurally new to point out.
export function findBeliefClusters(beliefs: StoredBelief[], connections: StoredConnection[]): string[][] {
  const validIds = new Set(beliefs.filter((b) => b.userReaction !== "rejected").map((b) => b.id));
  const adjacency = new Map<string, Set<string>>();
  connections
    .filter((c) => (c.type ?? "root") === "root" && validIds.has(c.a) && validIds.has(c.b))
    .forEach((c) => {
      if (!adjacency.has(c.a)) adjacency.set(c.a, new Set());
      if (!adjacency.has(c.b)) adjacency.set(c.b, new Set());
      adjacency.get(c.a)!.add(c.b);
      adjacency.get(c.b)!.add(c.a);
    });

  const seen = new Set<string>();
  const clusters: string[][] = [];
  for (const start of adjacency.keys()) {
    if (seen.has(start)) continue;
    const component: string[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const id = queue.shift()!;
      component.push(id);
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (component.length >= 3) clusters.push(component);
  }
  return clusters;
}

// ── Contradiction pairs (Level 5) ────────────────────────────────────────────
// Just the "contradiction"-type connections, paired with their actual
// belief objects — presented side-by-side, without judgment, elsewhere in
// the UI (motivational interviewing's "discrepancy" technique: naming the
// tension is the entire intervention, no resolution offered).
export function findContradictionPairs(beliefs: StoredBelief[], connections: StoredConnection[]): { a: StoredBelief; b: StoredBelief; note: string }[] {
  const byId = new Map(beliefs.filter((b) => b.userReaction !== "rejected").map((b) => [b.id, b]));
  return connections
    .filter((c) => c.type === "contradiction")
    .map((c) => {
      const a = byId.get(c.a);
      const b = byId.get(c.b);
      return a && b ? { a, b, note: c.note } : null;
    })
    .filter((x): x is { a: StoredBelief; b: StoredBelief; note: string } => !!x);
}
