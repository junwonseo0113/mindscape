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
  "생각이 잘 안 잡혀도 괜찮아요. 떠오르는 대로 아무거나 적어보세요.",
  "정리하지 않아도 괜찮아요. 지금 떠오르는 말부터 시작해보세요.",
  "여기서 멈추셔도 괜찮고, 조금 더 이어가셔도 괜찮아요.",
];

const GRANULARITY_PROMPTS = [
  "그 감정, 조금 더 구체적인 말로 표현하면 뭐가 어울릴까요?",
  "그때 느낀 걸 조금만 더 풀어서 적어봐도 좋아요.",
];

const BACKCHANNEL_PROMPTS = [
  "편하게 이어가셔도 돼요.",
  "듣고 있어요. 천천히 이어가세요.",
];

// Deliberately small and coarse — this only has to catch "an emotion word
// showed up," not classify which one. computeLanguageObservation's cognitive
// verbs are a different signal (self-directed thinking, not feeling), so
// this stays its own short list rather than reusing that one.
const EMOTION_KEYWORDS = [
  "불안", "슬프", "화나", "짜증", "답답", "외로", "무섭", "두렵", "서운",
  "부끄럽", "죄책", "자책", "우울", "힘들", "지치", "억울", "질투", "허무", "막막",
];

function pickFrom(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function pickInputGuidance(currentText: string): string {
  const trimmed = currentText.trim();
  if (!trimmed) return pickFrom(OPEN_ENDED_PROMPTS);
  if (trimmed.length < 40 && EMOTION_KEYWORDS.some((k) => trimmed.includes(k))) {
    return pickFrom(GRANULARITY_PROMPTS);
  }
  if (trimmed.length < 15) return pickFrom(OPEN_ENDED_PROMPTS);
  return pickFrom(BACKCHANNEL_PROMPTS);
}
