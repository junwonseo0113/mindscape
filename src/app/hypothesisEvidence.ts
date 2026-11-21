import { StoredBelief, StoredEvidenceQuote, StoredHypothesis } from "./types";

// A hypothesis's evidence quotes come from one of two places: its own
// explicit `evidence` field if it has one, or — for real hypotheses, which
// don't — derived from the beliefs it's linked to via relatedBeliefIds.
export function evidenceForHypothesis(h: StoredHypothesis, beliefs: StoredBelief[]): (StoredEvidenceQuote & { domain?: string })[] {
  if (h.evidence && h.evidence.length > 0) return h.evidence;
  return h.relatedBeliefIds
    .map((id) => beliefs.find((b) => b.id === id))
    .filter((b): b is StoredBelief => !!b)
    .flatMap((b) => b.evidenceQuotes.map((q) => ({ ...q, domain: b.domain })))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);
}
