// ── Demo Mode data ────────────────────────────────────────────────────────────
// Every example belief/assumption/hypothesis/history entry that used to be
// scattered through App.tsx as separate fallback constants, unified into one
// object shaped exactly like the real on-device Store. That's the whole
// point: because this is Store-shaped, every screen just reads `store.x`
// and never has to know whether it's looking at this file or a real
// person's data — see src/app/dataProvider.ts.
//
// Kept 1:1 with the original wireframe content (same beliefs, same
// hypotheses, same evidence quotes, same investigate walkthroughs) — this
// file only reshapes it to fit the shared Store type, it doesn't invent or
// drop anything.

import type { Store } from "../app/types";

export const DEMO_STORE: Store = {
  beliefs: [
    { id: "demo-belief-0", domain: "전반", statement: "안전이 최우선이다", confidence: 82, evidenceCount: 34, evidenceQuotes: [] },
    { id: "demo-belief-1", domain: "커리어", statement: "노력하면 결국 인정받는다", confidence: 64, evidenceCount: 21, evidenceQuotes: [] },
    { id: "demo-belief-2", domain: "관계", statement: "혼자 하는 게 더 낫다", confidence: 57, evidenceCount: 18, evidenceQuotes: [] },
    { id: "demo-belief-3", domain: "일", statement: "완벽해야 시작할 수 있다", confidence: 71, evidenceCount: 26, evidenceQuotes: [] },
    { id: "demo-belief-4", domain: "가치관", statement: "돈보다 자유가 중요하다", confidence: 45, evidenceCount: 12, evidenceQuotes: [] },
  ],

  // Same trigger -> interpretation shape as real StoredAssumption, so the
  // demo actually demonstrates the belief/assumption distinction instead of
  // just looking like a second list of flat statements.
  assumptions: [
    { id: "demo-assumption-0", trigger: "불확실함이 나타날 때", interpretation: "기다리는 게 가장 안전한 선택이라고 자동으로 생각한다", domains: ["커리어", "관계", "투자"], count: 12 },
    { id: "demo-assumption-1", trigger: "누군가에게 먼저 다가가야 할 때", interpretation: "결국 손해를 볼 거라고 미리 판단한다", domains: ["관계", "협상"], count: 8 },
    { id: "demo-assumption-2", trigger: "새로운 걸 시작해야 할 때", interpretation: "아직 준비가 안 됐다며 미룬다", domains: ["일", "창업"], count: 15 },
    { id: "demo-assumption-3", trigger: "갈등이나 서운함을 느낄 때", interpretation: "드러내면 약점이 잡힌다고 생각해 감춘다", domains: ["관계", "직장"], count: 9 },
  ],

  // The same five links ScreenHome used to hand-wire for the 3D brain graph,
  // now with real notes so the Belief Map's "발견된 연결" section (which
  // used to only ever appear for real data) works identically in demo mode.
  connections: [
    { a: "demo-belief-0", b: "demo-belief-1", note: "두 신념 모두 '검증된 길을 따라야 안전하다'는 배경을 공유하는 것으로 보여요." },
    { a: "demo-belief-0", b: "demo-belief-2", note: "안전을 우선하는 태도가, 타인에게 기대는 위험을 피하려는 쪽으로도 이어지는 것 같아요." },
    { a: "demo-belief-0", b: "demo-belief-3", note: "확신이 설 때까지 기다리는 패턴이, 시작 자체를 미루는 무의식적 신념과 맞닿아 있어요." },
    { a: "demo-belief-0", b: "demo-belief-4", note: "말로는 자유를 중시한다고 하지만, 실제 선택은 안전 쪽으로 기우는 것으로 보여요." },
    { a: "demo-belief-1", b: "demo-belief-3", note: "노력했는데도 인정받지 못할까 봐, 완벽해질 때까지 시작을 미루는 것으로 보여요." },
  ],

  history: [
    { id: "demo-entry-0", date: "2026.07.28", text: "이직 제안이 왔는데 좀 더 지켜보고 싶다는 생각이 들었다...", duration: "4분 12초" },
    { id: "demo-entry-1", date: "2026.07.25", text: "발표 끝나고 계속 아쉬운 부분만 곱씹게 됐다...", duration: "2분 40초" },
    { id: "demo-entry-2", date: "2026.07.21", text: "요즘 혼자 결정하는 게 편한 건지, 그냥 익숙해서 그런 건지 헷갈린다...", duration: "6분 05초" },
  ],

  hypotheses: [
    {
      id: "demo-hyp-0",
      title: "불확실함이 나타날 때마다, 기다리는 것이 가장 안전한 선택이라고 자동으로 해석하는 경향이 있습니다.",
      // The closing line is the whole point of this screen, almost verbatim
      // from the product brief's own example — the AI never states a
      // verdict ("이건 당신에게 안 좋은 습관이에요"), it hands the
      // interpretation back.
      question: "이 패턴은 커리어, 관계, 투자에서 반복적으로 나타났어요. 이 무의식적 해석이 당신에게 도움이 되고 있다고 생각하세요, 아니면 당신을 제한하고 있다고 생각하세요?",
      confidence: 78,
      domains: ["커리어", "관계", "투자"],
      reaction: null,
      createdDate: "2026.07.02",
      // The investigate walkthrough below already names these two beliefs
      // as connected ("'완벽해야 시작할 수 있다'는 무의식적 신념과도
      // 연결돼 보여요") — wired here so "관련된 활성 뉴런" and "상충하는
      // 기록" have something real to show, not an empty section.
      relatedBeliefIds: ["demo-belief-0", "demo-belief-3"],
      evidence: [
        { date: "2026.07.02", quote: "이직 제안은 왔는데, 조금 더 지켜보고 싶어. 아직 확신이 안 서." },
        { date: "2026.06.14", quote: "그 사람한테 먼저 연락할까 하다가, 좀 더 기다려보기로 했어." },
        { date: "2026.05.28", quote: "지금 들어가기엔 너무 오른 것 같아서, 조정 오면 그때 사려고." },
      ],
      investigate: {
        origin: { date: "2025.11.19", quote: "일단 지금은 상황을 좀 더 보고 나서 정하는 게 맞는 것 같아." },
        originNote: "8개월 전, 이 표현이 처음 등장했어요. 그때는 한 번뿐이었지만, 지금은 세 영역에서 반복되고 있어요.",
        compareLabel1: "그때 말한 이유",
        compareSteps1: ["\"조금 더\"", "\"확신이 서면\""],
        compareLabel2: "8개월 후, 실제 결과",
        compareSteps2: ["결정 미룸", "기회 3건 지나감"],
        related: "이 '기다림' 패턴은 '완벽해야 시작할 수 있다'는 무의식적 신념과도 연결돼 보여요 — 확신이 서는 순간은, 아마 오지 않을지도 모릅니다.",
      },
    },
    {
      id: "demo-hyp-1",
      title: "성과를 인정받지 못하면, 노력 자체가 부족했다고 스스로를 탓하는 패턴이 있습니다.",
      question: "이 해석은 발표, 승진, 그리고 관계에서의 실망까지 — 결과가 안 좋을 때마다 똑같은 방식으로 나타났어요. 정말 매번 노력이 부족했던 걸까요, 아니면 이게 그냥 익숙한 설명일 뿐일까요?",
      confidence: 64,
      domains: ["커리어", "자아"],
      reaction: null,
      createdDate: "2026.06.30",
      relatedBeliefIds: ["demo-belief-1"],
      evidence: [
        { date: "2026.06.30", quote: "발표가 별로였나봐. 준비를 더 했어야 했는데." },
        { date: "2026.05.10", quote: "승진 안 된 거 보면, 내가 아직 부족한 게 맞는 것 같아." },
      ],
      investigate: {
        origin: { date: "2026.01.14", quote: "그때도 노력이 부족해서 그런 거였겠지, 뭐." },
        originNote: "올해 초부터, 원인을 외부보다 스스로에게서 먼저 찾는 표현이 5번 넘게 나타났어요.",
        compareLabel1: "실제로 통제할 수 있었던 것",
        compareSteps1: ["준비 시간", "발표 내용"],
        compareLabel2: "탓하고 있는 것",
        compareSteps2: ["능력 전체", "\"나는 부족해\""],
        related: "'노력하면 결국 인정받는다'는 무의식적 신념과 짝을 이뤄요 — 인정받지 못하면, 노력이 아니라 자격 자체를 의심하게 되는 것 같아요.",
      },
    },
    {
      id: "demo-hyp-2",
      title: "'자유를 중시한다'고 말하지만, 실제 선택은 안정성을 우선하는 방향으로 반복됩니다.",
      question: "말하는 가치와 실제 선택 사이에 이 간격이 세 번 연속 나타났어요. 자유가 정말 당신이 원하는 것이 맞나요, 아니면 그렇게 믿고 싶은 이야기에 가까울까요?",
      confidence: 52,
      domains: ["가치관", "결정"],
      reaction: null,
      createdDate: "2026.07.10",
      relatedBeliefIds: ["demo-belief-0", "demo-belief-4"],
      evidence: [
        { date: "2026.07.10", quote: "프리랜서 하고 싶다고 했었는데, 이번에도 정규직 제안을 골랐어." },
        { date: "2026.04.22", quote: "자유롭게 살고 싶다니까. 근데 이 안정적인 자리를 놓치기는 아깝잖아." },
      ],
      investigate: {
        origin: { date: "2025.09.02", quote: "언젠가는 자유롭게 일하고 싶어." },
        originNote: "10개월 전 '언젠가는'으로 시작된 바람이, 실제 갈림길에서는 매번 안정 쪽으로 이어졌어요.",
        compareLabel1: "말한 가치",
        compareSteps1: ["자유", "\"언젠가는\""],
        compareLabel2: "갈림길에서의 실제 선택",
        compareSteps2: ["정규직", "\"이번에도\""],
        related: "'안전이 최우선이다'는 무의식적 신념이 실제로는 '자유'보다 더 강하게 작동하고 있는 것으로 보여요.",
      },
    },
  ],

  aspiration: null,
  aspirationSetDate: null,
  // Shown only while no aspiration is set, explicitly framed in-copy as
  // examples ("아래는 그 예시예요") — real users see none of this once they
  // set an aspiration, and see no aspirationExamples at all since real Store
  // objects never populate this field.
  aspirationExamples: [
    {
      said: "안정보다 도전을 선택하는 사람이 되고 싶어.",
      saidDate: "2026.02.03",
      label: "도전을 선택하는 빈도",
      target: 100,
      actual: 34,
      note: "지난 6개월간 실제로 '더 위험한 선택'을 고른 순간은 34%뿐이었어요. 나머지는 안정적인 쪽을 택했습니다.",
    },
    {
      said: "내 감정을 더 솔직하게 표현하는 사람이 되고 싶어.",
      saidDate: "2026.03.18",
      label: "감정을 먼저 꺼낸 대화 비율",
      target: 100,
      actual: 41,
      note: "관계에서 갈등이 있었던 대화 중, 먼저 감정을 표현한 쪽은 41%였어요.",
    },
    {
      said: "완벽하지 않아도 일단 시작하는 사람이 되고 싶어.",
      saidDate: "2026.01.22",
      label: "\"준비되면 하겠다\"고 미룬 비율",
      target: 0,
      actual: 58,
      note: "새로운 시도를 언급한 대화의 58%가 결국 '조금 더 준비되면'으로 끝났어요.",
    },
  ],
  driftNotes: [],
  settings: { dailyReminder: true, newHypothesisAlert: true, weeklySummary: false },
  account: null,
  entryCount: 47,
};
