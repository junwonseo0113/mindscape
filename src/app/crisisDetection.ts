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

  // ── Korean ──
  // Korean has no word boundaries in the \b sense and spacing is loose
  // ("죽고 싶어", "죽고싶다", "죽고만 싶다"), so these match stems with
  // optional spaces. Same bias as above: over-trigger rather than miss.
  // Suicidal ideation / intent
  /죽\s*고\s*(?:만\s*)?싶/,
  /죽어\s*(?:버리|버릴|버렸)/,
  /자살/,
  /극단적\s*(?:인\s*)?선택/,
  /목숨\s*(?:을|도)?\s*끊/,
  /스스로\s*(?:목숨|생을)/,
  /(?:삶|생|인생|목숨)\s*(?:을|를)?\s*(?:끝내|끝낼|마감|포기)/,
  /모든\s*(?:걸|것을)\s*끝내/,
  /(?:사라지|없어지|없어져\s*버리)\s*고\s*싶/,
  /살\s*고\s*싶\s*지\s*(?:않|않아|않다)/,
  /살기\s*(?:가\s*)?싫/,
  /(?:살|살아갈|살아야\s*할|살아\s*있을)\s*이유\s*(?:가|도)?\s*없/,
  /사는\s*(?:게|것이|것도)\s*(?:의미\s*(?:가\s*)?없|무슨\s*의미)/,
  /살아서\s*뭐\s*(?:해|하)/,
  /태어나지\s*(?:말았어야|않았으면|말았으면)/,
  /(?:차라리\s*)?죽는\s*(?:게|것이|편이)\s*(?:나아|낫)/,
  /(?:나|내가|제가)\s*없(?:으면|는\s*게|어지면)\s*(?:다들|모두|다\s*편|더\s*나|낫)/,
  /유서/,
  /(?:뛰어\s*내리|투신)/,
  /목\s*(?:을\s*)?매/,
  // Self-harm
  /자해/,
  /손목\s*(?:을)?\s*(?:긋|그어|그었)/,
  /(?:나|자신|내\s*몸)\s*(?:을|를|에)?\s*(?:해치|다치게|상처\s*(?:를|내))/,
  /(?:약|수면제)\s*(?:을|를)?\s*(?:한꺼번에|왕창|모아|잔뜩)/,
  /과다\s*복용/,
];

// The one thing this function is allowed to answer — never a severity score,
// never a category breakdown surfaced to the user or sent anywhere. Keeping
// the return type this narrow is deliberate: there's no legitimate use for
// anything richer than "show the resource screen or don't."
export function detectCrisisSignal(text: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}
