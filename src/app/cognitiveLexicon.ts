// ── Feature 2 — cognitive-verb / pronoun observation ─────────────────────────
// Pennebaker's LIWC research: people who benefited most from expressive
// writing tended to show rising cognitive-verb use and shifting pronoun
// patterns across sessions. This file turns that into a *pure observation*
// — word counts and a same/increased/decreased trend, nothing diagnostic,
// nothing scored as good or bad. See LanguageObservation in types.ts and
// computeLanguageObservation below.
//
// No real tokenizer/POS-tagger here (none of this codebase's dependencies
// include one) — matching is deliberately simple: a lemma plus a small set
// of regular English inflections, checked at word boundaries. Same "simple
// and legible over sophisticated" philosophy as the rest of the analysis
// pipeline. English's regular morphology (mostly -s/-ed/-ing suffixes,
// rarely a stem change) makes this considerably more reliable than
// substring matching would be — see CAVEATS at the bottom for what's still
// deliberately left unhandled.
//
// Extend by adding entries to the arrays below — nothing else needs to
// change; computeLanguageObservation reads these lists directly.

// ── Cognitive verbs ──────────────────────────────────────────────────────────
// Each entry is a lemma plus a regex covering its common inflections,
// matched at word boundaries (\b) so it can't fire inside an unrelated
// longer word. `label` is what gets cited back to the user in the
// session-summary card, so it stays as the plain dictionary form.
export const COGNITIVE_VERB_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "think", regex: /\bthinks?\b|\bthinking\b|\bthought\b/i },
  { label: "feel", regex: /\bfeels?\b|\bfeeling\b|\bfelt\b/i },
  { label: "believe", regex: /\bbelieves?\b|\bbelieving\b|\bbelieved\b/i },
  { label: "realize", regex: /\brealiz(?:e|es|ed|ing)\b/i },
  { label: "understand", regex: /\bunderstands?\b|\bunderstanding\b|\bunderstood\b/i },
  { label: "notice", regex: /\bnotic(?:e|es|ed|ing)\b/i },
  { label: "recognize", regex: /\brecogniz(?:e|es|ed|ing)\b/i },
  { label: "know", regex: /\bknows?\b|\bknowing\b|\bknew\b/i },
  { label: "wonder", regex: /\bwonders?\b|\bwondering\b|\bwondered\b/i },
  { label: "assume", regex: /\bassumes?\b|\bassuming\b|\bassumed\b/i },
];

// ── Personal pronouns ────────────────────────────────────────────────────────
// All matched at word boundaries and case-insensitively except capital "I"
// (see below) — English pronouns don't carry Korean-style attached
// particles, so a plain word-boundary match is already precise; no
// substring-overcounting risk the way bare single syllables had in Korean.
export const FIRST_PERSON_SINGULAR_FORMS: string[] = ["I", "me", "my", "mine", "myself"];

export const COLLECTIVE_OR_OTHER_FORMS: string[] = [
  "we", "us", "our", "ours", "they", "them", "their", "people", "everyone", "everybody",
];

// CAVEATS (documented, not solved — see analysisFramework.ts's own
// disclaimer notice for how this app talks about its own limitations):
// - "realize"/"recognize" use US spelling (-ize) only; a British-spelling
//   "realise"/"recognise" entry would need to be added if that mattered
//   for this audience.
// - "know" also appears in set phrases ("you know," "let me know") that
//   aren't really self-reflective cognition — left uncorrected, the same
//   kind of accepted imprecision the Korean version had with "제" doubling
//   as "the" in formal compounds.
// - Matching is case-insensitive for every pronoun except "I", which is
//   matched case-sensitively — lowercase "i" alone is far too noisy (stray
//   typos, roman numerals) to safely count, while a properly-capitalized
//   "I" is reliably the pronoun in English.

function countWordBoundaryMatches(text: string, needle: string, caseSensitive = false): number {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, caseSensitive ? "g" : "gi");
  return (text.match(re) ?? []).length;
}

// Every occurrence found, tagged with the actual inflected word as it
// appeared in the text — used to cite real expressions in the summary card
// copy instead of a fixed hardcoded example pair, since this app never
// shows invented example text as if it were the user's own words.
function findCognitiveVerbOccurrences(text: string): { label: string; snippet: string }[] {
  const occurrences: { label: string; snippet: string }[] = [];
  for (const { label, regex } of COGNITIVE_VERB_PATTERNS) {
    const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      occurrences.push({ label, snippet: match[0] });
      if (match.index === re.lastIndex) re.lastIndex++; // guard against zero-width loops
    }
  }
  return occurrences;
}

function countCognitiveVerbs(text: string): number {
  return findCognitiveVerbOccurrences(text).length;
}

// Up to `max` distinct expressions (one per matching lemma, in order of
// first appearance) to cite verbatim in the session-summary card — e.g.
// ["thought", "realized"] — never a fixed/invented pair.
export function extractCognitiveVerbExamples(text: string, max = 2): string[] {
  const occurrences = findCognitiveVerbOccurrences(text);
  const seenLabels = new Set<string>();
  const examples: string[] = [];
  for (const { label, snippet } of occurrences) {
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);
    examples.push(snippet);
    if (examples.length >= max) break;
  }
  return examples;
}

function countAnyOf(text: string, forms: string[]): number {
  return forms.reduce((sum, form) => sum + countWordBoundaryMatches(text, form, form === "I"), 0);
}

// A rough word count (whitespace-split) — good enough to normalize a rate
// by, not meant as a real tokenizer.
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function computeLanguageObservation(text: string): import("./types").LanguageObservation {
  const wordCount = countWords(text);
  const cognitiveVerbCount = countCognitiveVerbs(text);
  const firstPersonSingularCount = countAnyOf(text, FIRST_PERSON_SINGULAR_FORMS);
  const collectiveOrOtherCount = countAnyOf(text, COLLECTIVE_OR_OTHER_FORMS);
  return {
    wordCount,
    cognitiveVerbCount,
    cognitiveVerbPerHundredWords: wordCount > 0 ? (cognitiveVerbCount / wordCount) * 100 : 0,
    firstPersonSingularCount,
    collectiveOrOtherCount,
  };
}

export type CognitiveVerbTrend = "increased" | "decreased" | "flat" | null;

// "up/down vs. the last 3 sessions' average" — only ever compares against
// sessions that actually have a stored observation (older entries from
// before this feature existed won't), and returns null (no line shown)
// rather than a misleading comparison when there's nothing to compare
// against yet.
export function compareCognitiveVerbTrend(
  current: import("./types").LanguageObservation,
  priorObservations: import("./types").LanguageObservation[]
): CognitiveVerbTrend {
  const recentPrior = priorObservations.slice(-3);
  if (recentPrior.length === 0) return null;
  const avgPrior = recentPrior.reduce((sum, o) => sum + o.cognitiveVerbPerHundredWords, 0) / recentPrior.length;
  // A small flat band around equal, so trivial noise (e.g. 4.9 vs 5.0)
  // doesn't get reported as a meaningful "increase."
  const delta = current.cognitiveVerbPerHundredWords - avgPrior;
  if (Math.abs(delta) < 0.5) return "flat";
  return delta > 0 ? "increased" : "decreased";
}

// "You used 'I' a lot / a little this time" — purely relative to this
// session's own other pronoun category, not to any external norm (there's
// no population baseline for what a "normal" amount is, and asserting one
// would be exactly the kind of quiet clinical claim this app avoids).
export type PronounLean = "firstPerson" | "collectiveOrOther" | "balanced" | null;

export function comparePronounLean(observation: import("./types").LanguageObservation): PronounLean {
  const { firstPersonSingularCount, collectiveOrOtherCount } = observation;
  if (firstPersonSingularCount === 0 && collectiveOrOtherCount === 0) return null;
  if (firstPersonSingularCount === collectiveOrOtherCount) return "balanced";
  return firstPersonSingularCount > collectiveOrOtherCount ? "firstPerson" : "collectiveOrOther";
}
