// ── Crisis safety net ─────────────────────────────────────────────────────────
// This app's core promise is "observe, don't judge" — no keyword scanning, no
// silent flagging, nothing read into what someone says beyond what they
// actually said. This file is the one deliberate exception, and it has to be
// treated as one: a free-speech app where people are explicitly invited to
// say whatever's on their mind, unfiltered, will surface real crisis
// language sometimes. Detecting that and routing to real help isn't
// optional — see ScreenCrisisSupport in App.tsx and the "think" case's
// onDone in the App shell, which checks this before anything else (before
// the isPro branch, before /api/analyze, before saving even reaches the
// belief/hypothesis pipeline).
//
// Deliberately client-side and keyword-based, not an LLM call:
//   - It has to work even if the network is down or the API key is missing —
//     the one thing this app cannot do is stay silent because a request failed.
//   - It has to be fast — this fires before the "processing" screen even
//     appears, not after a round trip.
//   - It has to be auditable — a fixed list you can read top to bottom is a
//     safety mechanism you can actually verify, unlike a model's judgment
//     call. False positives here cost nothing worse than seeing a resource
//     screen unnecessarily; false negatives are the failure mode that
//     actually matters, so this list is deliberately biased toward
//     over-triggering. It is not a clinical instrument and doesn't claim to
//     assess risk level — it only ever asks "did crisis language show up,"
//     never "how serious is this."
//
// Matched at word boundaries, same approach as cognitiveLexicon.ts's
// COGNITIVE_VERB_PATTERNS — a short list of phrases, not sentence-level NLP.
// This will miss indirect or coded language a trained human would catch;
// it is a floor, not a substitute for actually reading what someone wrote.
const CRISIS_PATTERNS: RegExp[] = [
  // Suicidal ideation / intent
  /\bkill(?:ing)? myself\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bend(?:ing)? my (?:own )?life\b/i,
  /\bend it all\b/i,
  /\btake my (?:own )?life\b/i,
  /\bwant(?:ed)? to die\b/i,
  /\bwish(?:ed|ing)? I(?:'d| had| was| were)? (?:dead|dying)\b/i,
  /\b(?:don'?t|do not) want to (?:be alive|live anymore|exist anymore)\b/i,
  /\bno reason to (?:live|go on)\b/i,
  /\bno point in living\b/i,
  /\bbetter off dead\b/i,
  /\beveryone(?:'s| is| would be) better off without me\b/i,
  /\bplan(?:ning)? to kill myself\b/i,
  /\bgoing to kill myself\b/i,
  // Self-harm
  /\bhurt(?:ing)? myself\b/i,
  /\bharm(?:ing)? myself\b/i,
  /\bself[- ]harm(?:ing)?\b/i,
  /\bcut(?:ting)? myself\b/i,
  /\boverdos(?:e|ing) on\b/i,
];

// The one thing this function is allowed to answer — never a severity score,
// never a category breakdown surfaced to the user or sent anywhere. Keeping
// the return type this narrow is deliberate: there's no legitimate use for
// anything richer than "show the resource screen or don't."
export function detectCrisisSignal(text: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}
