import { resolveRegion } from "./brainRegions";
import { CognitiveRegion } from "./neuralBrainLayout";
import { Store } from "./types";
import { evidenceForHypothesis } from "./hypothesisEvidence";

// The one thing Today's Discovery can point at — either the freshest unreacted AI
// hypothesis (index into store.hypotheses) or, when there's no hypothesis
// yet, the strongest recurring belief (id into store.beliefs). Computed once
// here and reused by both Home (which only ever reads `.text`) and the
// Analysis tab (which renders the full body for whichever kind it is) —
// so the two places can never disagree about what "today's discovery" is.
export type DiscoveryTarget = { kind: "hypothesis"; index: number; text: string } | { kind: "belief"; id: string; text: string };

export function computeDiscovery(store: Store): DiscoveryTarget | null {
  const freshHypothesisIndex = store.hypotheses.findIndex((h) => h.reaction === null);
  if (freshHypothesisIndex >= 0) {
    return { kind: "hypothesis", index: freshHypothesisIndex, text: store.hypotheses[freshHypothesisIndex].title };
  }
  const topBelief = [...store.beliefs]
    .filter((b) => b.userReaction !== "rejected")
    .sort((a, b) => (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? "") || b.confidence - a.confidence)[0];
  return topBelief ? { kind: "belief", id: topBelief.id, text: topBelief.discoveryInterpretationOverride ?? topBelief.statement } : null;
}

// Re-derives a pinned DiscoveryTarget's display text from the live store
// (title/statement may have changed under a reinterpretation loop) without
// letting the identity itself drift — see ScreenAnalysis's `pinnedDiscovery`.
// Used so a discovery doesn't get silently swapped out mid-conversation the
// instant its reaction flips away from null (e.g. once reinterpretation is
// exhausted), which computeDiscovery's fresh-lookup alone would do.
export function resolveDiscoveryTarget(store: Store, pinned: DiscoveryTarget): DiscoveryTarget | null {
  if (pinned.kind === "hypothesis") {
    const h = store.hypotheses[pinned.index];
    return h ? { kind: "hypothesis", index: pinned.index, text: h.title } : null;
  }
  const b = store.beliefs.find((x) => x.id === pinned.id);
  return b ? { kind: "belief", id: pinned.id, text: b.discoveryInterpretationOverride ?? b.statement } : null;
}

// One entry in the Analysis tab's "Recent Insights" list — everything
// that could have been "Today's Discovery" (see computeDiscovery) but
// isn't, so the list is real history, never invented copy. Both
// hypotheses and beliefs collapse into this one shape so the list can
// render them identically and open either back into ScreenDiscoveryAnalysis's
// Examine view via `target`.
export type RecentInsightItem = {
  key: string;
  target: DiscoveryTarget;
  title: string;
  // The same short "defusion" noun-phrase Today's Discovery's own headline
  // uses when present (StoredBelief/StoredHypothesis.thoughtLabel, e.g.
  // "Perfectionism thought") — a genuine, already-generated semantic label,
  // distinct from `title`'s full sentence. Optional because not every
  // belief/hypothesis has one yet; InsightCard falls back to `title` as its
  // primary label when it's absent, same as Today's Discovery's own logic.
  thoughtLabel?: string;
  region: CognitiveRegion;
  date: string; // "YYYY.MM.DD" (formatDateDots), possibly "" if unknown
  thoughtCount: number;
  confidence: number;
};

export function buildRecentInsights(store: Store, pinned: DiscoveryTarget | null): RecentInsightItem[] {
  const items: RecentInsightItem[] = [];

  store.hypotheses.forEach((h, index) => {
    if (pinned?.kind === "hypothesis" && pinned.index === index) return;
    const domain = h.domains[0] ?? "identity";
    items.push({
      key: `hyp:${index}`,
      target: { kind: "hypothesis", index, text: h.title },
      // The full sentence, same as what Today's Discovery itself would show
      // for this target.
      title: h.title,
      thoughtLabel: h.thoughtLabel,
      region: resolveRegion({ domain } as any),
      date: h.createdDate ?? "",
      thoughtCount: evidenceForHypothesis(h, store.beliefs).length,
      confidence: h.confidence,
    });
  });

  // A belief already folded into a hypothesis's own related set is that
  // hypothesis's supporting evidence, not a separate insight of its own —
  // skipping it here is what keeps this list from doubling up on the same
  // underlying pattern.
  const beliefIdsInHypotheses = new Set(store.hypotheses.flatMap((h) => h.relatedBeliefIds));
  store.beliefs.forEach((b) => {
    if (b.userReaction === "rejected") return;
    if (beliefIdsInHypotheses.has(b.id)) return;
    if (pinned?.kind === "belief" && pinned.id === b.id) return;
    items.push({
      key: `belief:${b.id}`,
      target: { kind: "belief", id: b.id, text: b.discoveryInterpretationOverride ?? b.statement },
      title: b.discoveryInterpretationOverride ?? b.statement,
      thoughtLabel: b.thoughtLabel,
      region: resolveRegion(b),
      date: b.lastUpdatedAt ?? "",
      thoughtCount: b.evidenceQuotes.length,
      confidence: b.confidence,
    });
  });

  return items.sort((x, y) => {
    const dx = x.date || "0000.00.00";
    const dy = y.date || "0000.00.00";
    return dx < dy ? 1 : dx > dy ? -1 : 0;
  });
}
