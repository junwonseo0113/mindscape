// INPUT-role silence guidance (gap-analysis roadmap, note 1/2/6 — the
// "unified system prompt" spec's INPUT half). During ScreenThink, a few
// seconds of no new input (no typing, no new speech) fades in one short,
// low-pressure line — never a question that demands an answer, never
// phrased as the app noticing the person went quiet. It's a doorway back
// in, not a nudge to perform. Same "observe, don't judge" principle as
// every other piece of copy in this app.
//
// Three banks, picked by how much is on the page/said so far:
// - open-ended: nothing (or almost nothing) written yet — permission to
//   start anywhere, including stopping.
// - granularity (Feldman Barrett): an emotion word is already there but
//   nothing else — an invitation to get more specific, not a demand to.
// - backchannel: there's already real content — just a quiet "still here,
//   take your time," the text equivalent of a listener's "mm-hmm."

const OPEN_ENDED_PROMPTS = [
  "It's okay if nothing's coming together yet. Just write down whatever comes to mind.",
  "You don't have to organize it. Start with whatever word comes first.",
  "It's fine to stop here, and it's fine to keep going a little more.",
];

const GRANULARITY_PROMPTS = [
  "If you put that feeling into a more specific word, what would fit?",
  "It might help to unpack what you felt in that moment a little more.",
];

const BACKCHANNEL_PROMPTS = [
  "Take your time, whenever you're ready.",
  "Still here. Keep going at your own pace.",
];

// Deliberately small and coarse — this only has to catch "an emotion word
// showed up," not classify which one. computeLanguageObservation's cognitive
// verbs are a different signal (self-directed thinking, not feeling), so
// this stays its own short list rather than reusing that one. Matched at
// word boundaries so short entries like "mad" or "low" don't fire inside
// unrelated longer words.
const EMOTION_KEYWORDS = [
  "anxious", "anxiety", "sad", "sadness", "angry", "mad", "irritated",
  "frustrated", "frustrating", "lonely", "scared", "afraid", "fear",
  "hurt", "ashamed", "shame", "embarrassed", "guilty", "guilt",
  "depressed", "down", "tired", "exhausted", "unfair", "jealous",
  "envious", "empty", "numb", "overwhelmed", "stuck", "hopeless",
];

const EMOTION_KEYWORD_REGEX = new RegExp(
  `\\b(${EMOTION_KEYWORDS.join("|")})\\b`,
  "i"
);

function pickFrom(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function pickInputGuidance(currentText: string): string {
  const trimmed = currentText.trim();
  if (!trimmed) return pickFrom(OPEN_ENDED_PROMPTS);
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 6 && EMOTION_KEYWORD_REGEX.test(trimmed)) {
    return pickFrom(GRANULARITY_PROMPTS);
  }
  if (wordCount <= 2) return pickFrom(OPEN_ENDED_PROMPTS);
  return pickFrom(BACKCHANNEL_PROMPTS);
}
