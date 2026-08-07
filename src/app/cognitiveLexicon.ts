// ── Feature 2 — 인지동사/인칭대명사 관찰 ─────────────────────────────────────
// Pennebaker's LIWC research: people who benefited most from expressive
// writing tended to show rising cognitive-verb use and shifting pronoun
// patterns across sessions. This file turns that into a *pure observation*
// — word counts and a same/increased/decreased trend, nothing diagnostic,
// nothing scored as good or bad. See LanguageObservation in types.ts and
// computeLanguageObservation below.
//
// No morphological analyzer here (none of this codebase's dependencies
// include one) — matching is deliberately simple substring search against
// hand-picked stems/inflected forms, same "simple and legible over
// sophisticated" philosophy as the rest of the analysis pipeline. That
// means real Korean irregular-conjugation and homograph gaps exist; see
// the comments on individual entries for the specific cases already found
// and worked around, and CAVEATS at the bottom for the ones deliberately
// left unresolved.
//
// Extend by adding entries to the arrays below — nothing else needs to
// change; computeLanguageObservation reads these lists directly.

// ── 인지동사 (cognitive verbs) ───────────────────────────────────────────────
// Each entry is a stem/fragment matched as a plain substring anywhere in
// the raw text. Irregular conjugations that change the stem's own letters
// get a second entry rather than a regex, so this stays a plain list
// anyone can extend without knowing regex.
export const COGNITIVE_VERB_STEMS: string[] = [
  "생각",     // 생각하다/생각했어/생각해보니/생각이 들어
  "깨닫",     // 깨닫다/깨닫게 (regular form)
  "깨달",     // 깨달았어/깨달음 — ㄷ 불규칙 활용이라 "깨닫"만으론 안 걸림, 별도 등록
  "느끼",     // 느끼다/느꼈어 — 아래 느끼하다 예외 처리 대상
  "느낌",     // 느낌이 들어/느낌적인 느낌 — 느끼다의 명사형 전환("느끼"→"느낌")이라 "느끼"에 안 걸림
  "믿",       // 믿다/믿었어/믿음
  "알게 되",  // 알게 됐어/알게 되니까
  "이해",     // 이해하다/이해가 돼
  "알아차",   // 알아차리다/알아차렸어 — "알아차리"로 등록하면 모음 축약형(알아차렸어, 리+었→렸)을 놓치므로 축약 전 지점까지만 짧게 등록
  "자각하",   // 자각했어/자각하게 됐어 — 앱 자체 UI 카피("알아차리게 도와드립니다")와 어휘를 맞춤
  "인식하",   // 인식했어/인식하게 됐어
];

// "느끼" 바로 뒤에 "하"류 활용형이 오면("느끼하-") "느끼다"(to feel)가 아니라
// "느끼하다"(음식/사람이 느끼하다=기름지다·느글거리다)일 확률이 매우 높음.
// "하"만으론 부족함 — "느끼했어"처럼 하+았이 "했"으로 축약되는 활용형은
// 다음 글자가 "하"가 아니라 "했"이라 놓침 (다른 어간들의 불규칙 활용과 같은
// 종류의 함정). "하"/"했"/"한"/"할"/"하고"/"하지"까지 등록해서 흔한 활용형은
// 커버 — 완전히 못 막는 건 인정하지만(형태소 분석 없이는 100% 불가), 이
// 정도면 가장 흔한 오탐은 거른다.
const FALSE_POSITIVE_GUARD: { stem: string; blockedIfFollowedBy: string[] }[] = [
  { stem: "느끼", blockedIfFollowedBy: ["하", "했", "한", "할", "하고", "하지"] },
];

// ── 인칭대명사 (personal pronouns) ───────────────────────────────────────────
// Bare single syllables ("나", "저", "내") are deliberately NOT used here —
// "나"/"저"/"내" are common syllables embedded in totally unrelated words
// (하나, 그러나, 나머지 / 저것, 저녁, 저기 / 내일, 내내, 국내...), so a plain
// substring match on them would wildly overcount. Matching only the
// particle-attached inflected forms below trades some recall (a bare "내
// 생각엔" with no case-marking is missed) for much better precision — an
// intentional, accepted trade for this app's "simple approximation" scope.
export const FIRST_PERSON_SINGULAR_FORMS: string[] = [
  "나는", "내가", "나의", "날", "나를", "나에게", "나한테",
  "저는", "제가", "저의", "제", "저를", "저에게",
];

export const COLLECTIVE_OR_OTHER_FORMS: string[] = [
  "우리", "그들", "사람들", "다들", "모두",
];

// CAVEATS (documented, not solved — see analysisFramework.ts's own
// disclaimer notice for how this app talks about its own limitations):
// - "느끼" still overcounts real "느끼하다" usages that aren't immediately
//   followed by "하" in the same breath (e.g. "느끼, 하 진짜 느끼했어" —
//   vanishingly rare in practice, not worth a heavier guard for).
// - "제" also means "the" in some formal/Sino-Korean compounds (제1장,
//   제한 등) — FIRST_PERSON_SINGULAR_FORMS still counts these. Left as-is:
//   restricting further would need to special-case a long tail of
//   compounds for a fairly rare false-positive.

function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

// Every occurrence found, tagged with the actual inflected snippet as it
// appeared in the text (stem + up to a few trailing characters, cut at the
// next space) — used to cite real expressions in the summary card copy
// instead of a fixed hardcoded example pair, since this app never shows
// invented example text as if it were the user's own words.
function findCognitiveVerbOccurrences(text: string): { stem: string; snippet: string }[] {
  const occurrences: { stem: string; snippet: string }[] = [];
  for (const stem of COGNITIVE_VERB_STEMS) {
    let index = text.indexOf(stem);
    while (index !== -1) {
      const guard = FALSE_POSITIVE_GUARD.find((g) => g.stem === stem);
      const rest = text.slice(index + stem.length);
      const isBlocked = !!guard && guard.blockedIfFollowedBy.some((suffix) => rest.startsWith(suffix));
      if (!isBlocked) {
        const tail = text.slice(index + stem.length, index + stem.length + 4).split(/\s/)[0];
        occurrences.push({ stem, snippet: stem + tail });
      }
      index = text.indexOf(stem, index + stem.length);
    }
  }
  return occurrences;
}

function countCognitiveVerbs(text: string): number {
  return findCognitiveVerbOccurrences(text).length;
}

// Up to `max` distinct expressions (one per matching stem, in order of
// first appearance) to cite verbatim in the session-summary card — e.g.
// ["생각해보니", "깨달았어"] — never a fixed/invented pair.
export function extractCognitiveVerbExamples(text: string, max = 2): string[] {
  const occurrences = findCognitiveVerbOccurrences(text);
  const seenStems = new Set<string>();
  const examples: string[] = [];
  for (const { stem, snippet } of occurrences) {
    if (seenStems.has(stem)) continue;
    seenStems.add(stem);
    examples.push(snippet);
    if (examples.length >= max) break;
  }
  return examples;
}

function countAnyOf(text: string, forms: string[]): number {
  return forms.reduce((sum, form) => sum + countOccurrences(text, form), 0);
}

// A rough word count (whitespace-split) — good enough to normalize a rate
// by, not meant as a real tokenizer. Korean doesn't space every word the
// way English does, but spoken/typed free-association text here is still
// space-delimited at the phrase level, which is all the rate calc needs.
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

// "지난 3회 평균 대비 증가/감소" — only ever compares against sessions that
// actually have a stored observation (older entries from before this
// feature existed won't), and returns null (no line shown) rather than a
// misleading comparison when there's nothing to compare against yet.
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

// "'나'라는 말을 많이/적게 쓰셨어요" — purely relative to this session's own
// other pronoun category, not to any external norm (there's no population
// baseline for what a "normal" amount is, and asserting one would be
// exactly the kind of quiet clinical claim this app avoids).
export type PronounLean = "firstPerson" | "collectiveOrOther" | "balanced" | null;

export function comparePronounLean(observation: import("./types").LanguageObservation): PronounLean {
  const { firstPersonSingularCount, collectiveOrOtherCount } = observation;
  if (firstPersonSingularCount === 0 && collectiveOrOtherCount === 0) return null;
  if (firstPersonSingularCount === collectiveOrOtherCount) return "balanced";
  return firstPersonSingularCount > collectiveOrOtherCount ? "firstPerson" : "collectiveOrOther";
}
