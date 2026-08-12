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

import { HypothesisStatus, PendingBeliefCandidate, Store, StoredBelief, StoredConnection, StoredHistoryEntry } from "./types";

export const DISCLAIMER_NOTICE =
  "This analysis is a self-reflection tool that draws on CBT and ACT concepts — it does not replace psychological diagnosis or treatment.";

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
  "All-or-nothing thinking",
  "Overgeneralization",
  "Catastrophizing",
  "Personalization",
  "Emotional reasoning",
  "Should statements",
  "Mental filtering",
  "Jumping to conclusions",
  "Discounting the positive",
] as const;

// Shown when a user taps a pattern tag — deliberately worded as "this is a
// common, nameable habit of thought" rather than "this is wrong, fix it."
// Reflect, don't correct: naming the pattern is the entire intervention;
// there's no prescription attached.
export const COGNITIVE_PATTERN_DESCRIPTIONS: Record<(typeof COGNITIVE_PATTERN_LABELS)[number], string> = {
  "All-or-nothing thinking": "A common habit of mind that sorts a situation into one of two extremes — words like \"always,\" \"never,\" \"completely.\"",
  "Overgeneralization": "A common habit of mind that stretches one or two instances into a broader rule — words like \"every time,\" \"everyone.\"",
  "Catastrophizing": "A common habit of mind that jumps straight to the worst possible outcome first.",
  "Personalization": "A common habit of mind that locates the cause of what happened entirely in yourself, even when other factors were also at play.",
  "Emotional reasoning": "A common habit of mind that treats a feeling as proof — \"it feels this way, so it must be true.\"",
  "Should statements": "A common habit of mind that holds yourself to a strict standard — words like \"must,\" \"have to.\"",
  "Mental filtering": "A common habit of mind that skips past what went well and stays fixed on the one part that didn't.",
  "Jumping to conclusions": "A common habit of mind that decides what someone's thinking, or how things will turn out, without enough to go on.",
  "Discounting the positive": "A common habit of mind that waves off something that went well as \"no big deal.\"",
};

// A balanced, standard CBT reframe of each named pattern (ported from a
// parallel session, odysseyof26's 8580f53) — most cognitive habits started
// as something adaptive, not just a flaw to correct. Always paired
// (benefit alongside caution), never a diagnosis, never presented as a
// unique insight about any one person — the same reframe every time that
// pattern is tagged, grounded in the pattern itself, not the user.
export const COGNITIVE_PATTERN_REFLECTIONS: Record<(typeof COGNITIVE_PATTERN_LABELS)[number], { benefit: string; caution: string }> = {
  "All-or-nothing thinking": { benefit: "Lets you judge things quickly and clearly.", caution: "Can miss the middle ground in a situation." },
  "Overgeneralization": { benefit: "The ability to spot a pattern quickly from one experience.", caution: "Can assume something will always repeat after just one instance." },
  "Catastrophizing": { benefit: "A kind of caution that prepares you for risk ahead of time.", caution: "Can make a situation feel worse than it actually is." },
  "Personalization": { benefit: "A responsible way of owning a situation.", caution: "Can take on blame that isn't actually yours." },
  "Emotional reasoning": { benefit: "The ability to respond honestly to how you feel.", caution: "Can turn a passing feeling into something you treat as fact." },
  "Should statements": { benefit: "Holding yourself to a high standard.", caution: "Can turn into self-criticism when you fall short of it." },
  "Mental filtering": { benefit: "A focus that doesn't miss important details.", caution: "Can pass over the positive parts without noticing." },
  "Jumping to conclusions": { benefit: "The ability to read a situation and decide quickly.", caution: "Can reach a conclusion without quite enough to go on." },
  "Discounting the positive": { benefit: "A humble way of looking at yourself.", caution: "Can keep you from acknowledging what you did well." },
};

// When no specific pattern is tagged — still a paired, honest reframe,
// just not tied to one named distortion.
export const GENERIC_PATTERN_REFLECTION = {
  benefit: "This response may be something that's protected you up to now.",
  caution: "It can sometimes crowd out other options, too.",
};

// Suggested ACT life-domain vocabulary for valueDirection.relatedValues —
// a starting point, not a closed list.
export const VALUE_DOMAIN_LABELS = [
  "Relationships", "Work/Career", "Health", "Growth/Learning", "Autonomy", "Security", "Leisure", "Community", "Self-expression",
] as const;

// Secondary, longitudinal-only, optional. Loose descriptive labels, not a
// clinical schema inventory — only ever attached to a belief that has
// already independently cleared MIN_SUPPORTING_ENTRIES_FOR_BELIEF.
export const SCHEMA_DOMAIN_LABELS = [
  "Deprivation/Abandonment", "Mistrust/Hurt", "Sensitivity to failure", "Subjugation/Compliance", "Unrelenting standards", "Isolation/Disconnection",
] as const;

// Neutral, hedged phrasing this framework's language should sound like —
// referenced by the prompt, not enforced at runtime (language quality
// isn't something code can check), but kept here as the single source of
// truth for tone.
export const HEDGE_PHRASES = [
  "this may be the case",
  "based on what's been recorded so far",
  "there isn't enough evidence yet",
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

// ── Rumination-possibility signal (gap-analysis note 4 / Trapnell &
// Campbell's reflection-vs-rumination distinction) ──────────────────────────
// Internal-only. This function's return value must never be surfaced as a
// label, score, or the word "반추"/"rumination" anywhere in the UI — per
// the note's own caution, that reads as a diagnostic instrument. The three
// signals it converges on are exactly the ones the note describes: the
// same belief's confidence keeps climbing across 3+ sessions, it hasn't
// picked up any new mutually-reinforcing (root) connection since that
// climb started, and the emotions recorded alongside its most recent
// supporting entries haven't diversified. Any single one of these is
// unremarkable on its own; only the combination is the specific pattern
// the self-absorption-paradox literature ties to reflection sliding into
// rumination (reflection reliably predicts rumination; the reverse is
// rare — so this leans toward flagging early rather than late).
export function isLikelyRuminating(belief: StoredBelief, allConnections: StoredConnection[], history: StoredHistoryEntry[]): boolean {
  const confHistory = belief.confidenceHistory ?? [];
  if (confHistory.length < 3) return false;
  const recent = confHistory.slice(-3);
  const neverDrops = recent.every((point, i) => i === 0 || point.value >= recent[i - 1].value);
  const actuallyRose = recent[recent.length - 1].value > recent[0].value;
  if (!neverDrops || !actuallyRose) return false;

  // "No new root connection" since the climb started — createdAt is only
  // ever stamped on connections realStore.ts actually just created (see
  // StoredConnection), so one predating this field simply won't match and
  // is correctly treated as "not recent."
  const sinceDate = recent[0].date;
  const gainedRootConnectionRecently = allConnections.some(
    (c) => (c.type ?? "root") === "root" && (c.a === belief.id || c.b === belief.id) && !!c.createdAt && c.createdAt >= sinceDate
  );
  if (gainedRootConnectionRecently) return false;

  // Emotion variety across this belief's most recent supporting entries —
  // flat or narrowing, not a single-entry snapshot (one entry alone can't
  // show a trend).
  const supportingEntries = (belief.supportingEntryIds ?? [])
    .map((id) => history.find((e) => e.id === id))
    .filter((e): e is StoredHistoryEntry => !!e)
    .slice(-3);
  const uniqueEmotionCounts = supportingEntries
    .map((e) => {
      const emotions = e.analysis?.observation.emotions;
      return emotions && emotions.length > 0 ? new Set(emotions.map((em) => em.label)).size : null;
    })
    .filter((n): n is number => n !== null);
  if (uniqueEmotionCounts.length < 2) return false;
  const flatOrNarrowing = uniqueEmotionCounts[uniqueEmotionCounts.length - 1] <= uniqueEmotionCounts[0];

  return flatOrNarrowing;
}
