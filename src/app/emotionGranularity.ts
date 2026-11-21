import { StoredBelief, StoredHistoryEntry } from "./types";

// ── Screen 6.5 · Session summary (Feature 2) ─────────────────────────────────
// Shown once, right after a successful analysis, before landing on the
// Analysis tab — a quiet "here's what was just observed about how you
// talked" beat, purely descriptive (see cognitiveLexicon.ts). Feature 3
// will add an AI-written recap paragraph above this same card later; this
// screen already reads entry.sessionSummary so nothing else needs to
// change when that lands.
// Feature: emotional granularity (Note 2) — how many *distinct* emotion
// labels this session's analysis surfaced, compared to the last 3
// sessions' average. A raw unique-label count, not the "unique / total"
// ratio the note describes: within a single entry the model's own
// emotions list essentially never repeats a label, so that ratio would
// trivially read ~1.0 on every entry and say nothing — comparing the
// count itself across sessions is what this data can actually show.
// Never surfaced as a number anywhere in the UI — emotional-granularity
// scores are associated with clinical instruments in the literature (see
// the gap-analysis doc's BPD caution), so this only ever becomes a plain
// observational sentence, same rule as the cognitive-verb trend above.
export function countUniqueEmotions(entry: StoredHistoryEntry): number | null {
  const emotions = entry.analysis?.observation.emotions;
  if (!emotions || emotions.length === 0) return null;
  return new Set(emotions.map((e) => e.label)).size;
}

// Same underlying signal as countUniqueEmotions/buildEmotionVarietyLine
// above, averaged over one belief's last few supporting entries instead of
// compared session-to-session. Unlike that line, this never becomes text —
// it only ever drives the 3D neuron's surface geometry (see
// NeuralBeliefGraph3D's facetDetail), so the "never surface a number"
// caution above doesn't apply the same way: nothing here is labeled,
// scored, or shown as a figure, just a texture a viewer can't put a value on.
export function beliefEmotionGranularity(belief: StoredBelief, history: StoredHistoryEntry[]): number | undefined {
  const counts = (belief.supportingEntryIds ?? [])
    .map((id) => history.find((e) => e.id === id))
    .filter((e): e is StoredHistoryEntry => !!e)
    .slice(-3)
    .map((e) => countUniqueEmotions(e))
    .filter((n): n is number => n !== null);
  if (counts.length === 0) return undefined;
  return counts.reduce((sum, n) => sum + n, 0) / counts.length;
}
