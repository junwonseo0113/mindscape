import React from "react";
import { motion, AnimatePresence } from "motion/react";

// ── Design tokens ─────────────────────────────────────────────────────────────
// A quiet, editorial palette — this app's job is to reveal patterns calmly,
// not to alarm or entertain. Warm paper background, plum as the single
// "insight" accent color (used only for AI-surfaced observations, nowhere
// else), so its appearance always means "the AI noticed something."
const ink = "#1C1B1F";
const inkSoft = "#403E45";
const mid = "#6E6B74";
const subtle = "#93909B";
const faint = "#C4C1C9";
const hair = "rgba(28,27,31,0.09)";
const surface = "#F4F1EC";
const page = "#FFFFFF";
const accent = "#5B4B8A";
const accentSoft = "#F0EDF8";
const tension = "#B5533C";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };
const sans = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

// ── Persisted belief store — the one place this app keeps real, accumulating
// state instead of curated demo data. Every analysis feeds the current store
// back to the model so it can tell "new belief" apart from "this again,
// reinforce it" instead of starting from zero each time (Model → Update).
const STORE_KEY = "mijeong.store.v1";

type StoredBelief = { domain: string; statement: string; confidence: number; evidenceCount: number };
type StoredAssumption = { trigger: string; interpretation: string; count: number };
type Store = { beliefs: StoredBelief[]; assumptions: StoredAssumption[]; entryCount: number };

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { beliefs: [], assumptions: [], entryCount: 0 };
    const parsed = JSON.parse(raw);
    return {
      beliefs: Array.isArray(parsed.beliefs) ? parsed.beliefs : [],
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
      entryCount: typeof parsed.entryCount === "number" ? parsed.entryCount : 0,
    };
  } catch {
    return { beliefs: [], assumptions: [], entryCount: 0 };
  }
}

function saveStore(store: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // private-mode / storage-full — non-fatal, just don't persist
  }
}

// ── Status bar ────────────────────────────────────────────────────────────────
function StatusBar() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 4px", flexShrink: 0 }}>
      <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: ink }}>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 16, height: 10, border: `1px solid ${ink}`, borderRadius: 2, position: "relative" }}>
          <div style={{ position: "absolute", inset: 1, right: 4, backgroundColor: ink, borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

// ── Bottom navigation ─────────────────────────────────────────────────────────
function BottomNav({ active, onSelect }: { active: string; onSelect?: (id: string) => void }) {
  const items = [
    { id: "home", label: "홈" },
    { id: "think", label: "말하기" },
    { id: "history", label: "기록" },
    { id: "profile", label: "프로필" },
  ];
  return (
    <div style={{ display: "flex", borderTop: `1px solid ${hair}`, backgroundColor: page, flexShrink: 0 }}>
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <motion.div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(item.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect?.(item.id); }}
            whileTap={{ opacity: 0.6 }}
            style={{ flex: 1, padding: "10px 0 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer" }}
          >
            <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: isActive ? accent : "transparent" }} />
            <span style={{ ...sans, fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? ink : subtle }}>{item.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => { if (!disabled && onClick && (e.key === "Enter" || e.key === " ")) onClick(); }}
      whileTap={disabled ? undefined : { scale: 0.98, opacity: 0.9 }}
      style={{
        ...sans, width: "100%", padding: "15px 0", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: disabled ? "#E4E1DC" : ink, color: disabled ? "#A8A5A0" : "#fff",
        borderRadius: 14, fontSize: 16, fontWeight: 600, cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </motion.div>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      whileTap={{ opacity: 0.6 }}
      style={{ ...sans, width: "100%", padding: "15px 0", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", color: mid, border: `1px solid ${hair}`, borderRadius: 14, fontSize: 15, fontWeight: 500, cursor: "pointer" }}
    >
      {children}
    </motion.div>
  );
}

// ── Confidence bar — the one recurring data visualization: always a real
// 0-100 number backing an AI hypothesis, never decorative. ───────────────────
function ConfidenceBar({ value }: { value: number }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: subtle, letterSpacing: "0.04em" }}>확신도</span>
        <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: accent }}>{value}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, backgroundColor: hair, marginTop: 6 }}>
        <div style={{ height: "100%", width: `${value}%`, backgroundColor: accent, borderRadius: 3 }} />
      </div>
    </div>
  );
}

// A pacing/breather card between dense content — a lesson carried over from
// an earlier project: don't staple a bridging question onto the bottom of a
// content card. Give it its own quiet screen instead. No chart, no stat, no
// decoration competes with it; deliberately visual-free by design, not a
// placeholder for a chart that's missing.
function ScreenPivot({ kicker, statement, counter, cta }: { kicker?: string; statement: React.ReactNode; counter?: string; cta?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ink }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 24px 14px", minHeight: 0 }}>
        <div style={{ flex: 1.4 }} />
        <div>
          {kicker && (
            <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: accent, letterSpacing: "0.04em", wordBreak: "keep-all" }}>{kicker}</div>
          )}
          <div style={{ ...serif, fontSize: 26, color: "#F4F1EC", lineHeight: 1.45, marginTop: kicker ? 14 : 0, wordBreak: "keep-all" }}>{statement}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div>
          {cta}
          {counter && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: cta ? 14 : 0 }}>
              <span style={{ ...mono, fontSize: 12, color: "#8A8590" }}>{counter}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared "current vs. actual" row grammar — arrow-connected steps kept at
// identical geometry across rows so alignment itself teaches the comparison,
// a hairline divider instead of a bordered card per row.
function AlignedRowCompare({ rows }: { rows: { label: string; steps: string[]; accent?: boolean }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((row, ri) => (
        <div key={row.label} style={{ paddingTop: ri === 0 ? 0 : 16, paddingBottom: ri < rows.length - 1 ? 16 : 0, borderBottom: ri < rows.length - 1 ? `1px solid ${hair}` : "none" }}>
          <div style={{ ...sans, fontSize: 10.5, fontWeight: 700, color: row.accent ? accent : mid, letterSpacing: "0.03em", marginBottom: 10 }}>{row.label}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {row.steps.map((step, i) => (
              <React.Fragment key={step}>
                <div style={{ ...sans, fontSize: 12, fontWeight: i % 2 === 1 ? 700 : 500, color: i % 2 === 1 ? (row.accent ? accent : ink) : mid, textAlign: "center", lineHeight: 1.3, wordBreak: "keep-all" }}>{step}</div>
                {i < row.steps.length - 1 && (<div style={{ ...sans, fontSize: 12, color: row.accent ? accent : faint, flexShrink: 0, padding: "0 4px" }}>→</div>)}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Screen 1 · Splash ─────────────────────────────────────────────────────────
function ScreenSplash({ onDone }: { onDone?: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(() => onDone?.(), 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", backgroundColor: ink, padding: 32 }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: "#8A8590", textAlign: "center", letterSpacing: "0.02em" }}>
          미정
        </div>
        <div style={{ ...serif, fontSize: 26, color: "#F4F1EC", textAlign: "center", marginTop: 18, lineHeight: 1.5, wordBreak: "keep-all" }}>
          당신의 생각에는<br />패턴이 있습니다.
        </div>
        <div style={{ ...sans, fontSize: 14, color: "#8A8590", textAlign: "center", marginTop: 14, lineHeight: 1.6, wordBreak: "keep-all" }}>
          안에서는 보이지 않을 뿐입니다.
        </div>
      </motion.div>
    </div>
  );
}

// ── Screen 2 · Auth ───────────────────────────────────────────────────────────
function ScreenAuth({ onDone }: { onDone?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: faint, textAlign: "center" }}>미정</div>
        <div style={{ ...serif, fontSize: 24, color: ink, textAlign: "center", marginTop: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>
          기록하는 앱이 아니라,<br />당신의 사고방식을 이해하는 도구
        </div>
      </div>
      <div style={{ padding: "0 28px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        <PrimaryBtn onClick={onDone}>시작하기</PrimaryBtn>
        <GhostBtn onClick={onDone}>둘러보기</GhostBtn>
      </div>
    </div>
  );
}

// ── Screen 3 · Onboarding (3 short beats) ────────────────────────────────────
const ONBOARDING_SLIDES = [
  {
    kicker: "정리하지 마세요",
    title: "생각나는 대로,\n그냥 말하세요.",
    body: "정돈된 문장도, 프롬프트도 필요 없습니다. 오늘 있었던 일, 갑자기 든 생각, 결정하지 못한 일 — 떠오르는 순서 그대로 말하면 됩니다.",
  },
  {
    kicker: "AI의 역할",
    title: "AI는 답을 주지 않습니다.\n패턴을 봅니다.",
    body: "매번 조언하는 대신, 수백 번의 대화에 걸쳐 당신이 반복하는 가정과 판단 습관을 조용히 관찰합니다.",
  },
  {
    kicker: "시간이 지나면",
    title: "당신도 몰랐던\n당신의 패턴이 보입니다.",
    body: "\"불확실할 때는 기다리는 게 안전하다\" — 이 가정이 커리어에서도, 관계에서도, 투자에서도 반복됐다는 걸, 안에서는 알아채기 어렵습니다.",
  },
];

function ScreenOnboarding({ onDone }: { onDone?: () => void }) {
  const [i, setI] = React.useState(0);
  const slide = ONBOARDING_SLIDES[i];
  const isLast = i === ONBOARDING_SLIDES.length - 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ display: "flex", gap: 6, padding: "20px 28px 0" }}>
        {ONBOARDING_SLIDES.map((_, idx) => (
          <div key={idx} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: idx <= i ? ink : hair }} />
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: accent, letterSpacing: "0.06em" }}>{slide.kicker}</div>
        <div style={{ ...serif, fontSize: 28, color: ink, marginTop: 14, lineHeight: 1.4, whiteSpace: "pre-line", wordBreak: "keep-all" }}>
          {slide.title}
        </div>
        <div style={{ ...sans, fontSize: 15, color: mid, marginTop: 18, lineHeight: 1.65, wordBreak: "keep-all" }}>
          {slide.body}
        </div>
      </div>
      <div style={{ padding: "0 28px 40px" }}>
        <PrimaryBtn onClick={() => (isLast ? onDone?.() : setI((v) => v + 1))}>
          {isLast ? "시작하기" : "다음"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── Shared example data — the same evidence backs Home's teasers, each
// artifact screen, and the hypothesis detail, so the wireframe reads as one
// consistent model of one person, not four disconnected mockups. ────────────
const BELIEFS = [
  { label: "안전이 최우선이다", domain: "전반", evidenceCount: 34, strength: 82 },
  { label: "노력하면 결국 인정받는다", domain: "커리어", evidenceCount: 21, strength: 64 },
  { label: "혼자 하는 게 더 낫다", domain: "관계", evidenceCount: 18, strength: 57 },
  { label: "완벽해야 시작할 수 있다", domain: "일", evidenceCount: 26, strength: 71 },
  { label: "돈보다 자유가 중요하다", domain: "가치관", evidenceCount: 12, strength: 45 },
];

const ASSUMPTIONS = [
  { label: "불확실하면 기다리는 게 안전하다", domains: ["커리어", "관계", "투자"], count: 12 },
  { label: "먼저 나서면 결국 손해를 본다", domains: ["관계", "협상"], count: 8 },
  { label: "완벽히 준비된 후에만 움직여야 한다", domains: ["일", "창업"], count: 15 },
  { label: "내 감정을 드러내면 약점이 된다", domains: ["관계", "직장"], count: 9 },
];

const HYPOTHESES = [
  {
    title: "불확실함이 나타날 때마다, 기다리는 것이 가장 안전한 선택이라고 가정하는 경향이 있습니다.",
    // The closing line is the whole point of this screen, almost verbatim
    // from the product brief's own example — the AI never states a verdict
    // ("이건 당신에게 안 좋은 습관이에요"), it hands the interpretation back.
    question: "이 패턴은 커리어, 관계, 투자에서 반복적으로 나타났어요. 이 가정이 당신에게 도움이 되고 있다고 생각하세요, 아니면 당신을 제한하고 있다고 생각하세요?",
    confidence: 78,
    domains: ["커리어", "관계", "투자"],
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
      related: "이 '기다림' 패턴은 '완벽해야 시작할 수 있다'는 신념과도 연결돼 보여요 — 확신이 서는 순간은, 아마 오지 않을지도 모릅니다.",
    },
  },
  {
    title: "성과를 인정받지 못하면, 노력 자체가 부족했다고 스스로를 탓하는 패턴이 있습니다.",
    question: "이 해석은 발표, 승진, 그리고 관계에서의 실망까지 — 결과가 안 좋을 때마다 똑같은 방식으로 나타났어요. 정말 매번 노력이 부족했던 걸까요, 아니면 이게 그냥 익숙한 설명일 뿐일까요?",
    confidence: 64,
    domains: ["커리어", "자아"],
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
      related: "'노력하면 결국 인정받는다'는 신념과 짝을 이뤄요 — 인정받지 못하면, 노력이 아니라 자격 자체를 의심하게 되는 것 같아요.",
    },
  },
  {
    title: "'자유를 중시한다'고 말하지만, 실제 선택은 안정성을 우선하는 방향으로 반복됩니다.",
    question: "말하는 가치와 실제 선택 사이에 이 간격이 세 번 연속 나타났어요. 자유가 정말 당신이 원하는 것이 맞나요, 아니면 그렇게 믿고 싶은 이야기에 가까울까요?",
    confidence: 52,
    domains: ["가치관", "결정"],
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
      related: "'안전이 최우선이다'는 신념이 실제로는 '자유'보다 더 강하게 작동하고 있는 것으로 보여요.",
    },
  },
];

// ── Screen 4 · Home ───────────────────────────────────────────────────────────
function ArtifactTile({ label, teaser, badge, onClick }: { label: string; teaser: string; badge?: string; onClick?: () => void }) {
  return (
    <motion.div
      role="button" tabIndex={0} onClick={onClick} whileTap={{ scale: 0.98, opacity: 0.9 }}
      style={{ padding: 16, borderRadius: 16, border: `1px solid ${hair}`, backgroundColor: surface, cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: ink }}>{label}</span>
        {badge && <span style={{ ...sans, fontSize: 10, fontWeight: 700, color: accent, backgroundColor: accentSoft, padding: "2px 7px", borderRadius: 999 }}>{badge}</span>}
      </div>
      <div style={{ ...sans, fontSize: 12, color: mid, marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all" }}>{teaser}</div>
    </motion.div>
  );
}

function ScreenHome({ onNavSelect, onStartThink, onOpenArtifact }: { onNavSelect?: (id: string) => void; onStartThink?: () => void; onOpenArtifact?: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 22px 24px" }}>
        <div style={{ ...sans, fontSize: 13, color: subtle }}>2026년 8월 2일</div>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 6, lineHeight: 1.35, wordBreak: "keep-all" }}>
          오늘은 어떤 생각이<br />스쳐 지나갔나요?
        </div>

        <div style={{ marginTop: 20 }}>
          <motion.div
            role="button" tabIndex={0} onClick={onStartThink} whileTap={{ scale: 0.98, opacity: 0.92 }}
            style={{ padding: "20px 18px", borderRadius: 18, backgroundColor: ink, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#33313A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#fff" }} />
            </div>
            <div>
              <div style={{ ...sans, fontSize: 15, fontWeight: 600, color: "#fff" }}>생각 말하기</div>
              <div style={{ ...sans, fontSize: 12, color: "#A8A5A0", marginTop: 2 }}>정리하지 않아도 괜찮아요</div>
            </div>
          </motion.div>
        </div>

        <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>지금까지 관찰된 것들</span>
          <span style={{ ...mono, fontSize: 11, color: faint }}>대화 47회</span>
        </div>
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <ArtifactTile label="신념 지도" teaser="핵심 신념 5가지가 드러났어요." onClick={() => onOpenArtifact?.("beliefs")} />
          <ArtifactTile label="반복되는 가정" teaser="4가지 자동 해석 패턴" onClick={() => onOpenArtifact?.("assumptions")} />
          <ArtifactTile label="사고의 변화" teaser="6개월 전과 비교해보세요" onClick={() => onOpenArtifact?.("drift")} />
          <ArtifactTile label="AI의 가설" badge="NEW" teaser="확인이 필요한 가설 3개" onClick={() => onOpenArtifact?.("hypotheses")} />
        </div>

        <div style={{ marginTop: 28 }}>
          <span style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>최근 생각</span>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { date: "07.28", text: "이직 제안이 왔는데 좀 더 지켜보고 싶다는 생각이 들었다." },
              { date: "07.25", text: "발표 끝나고 계속 아쉬운 부분만 곱씹게 됐다." },
            ].map((item) => (
              <div key={item.date} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${hair}` }}>
                <span style={{ ...mono, fontSize: 11, color: faint, flexShrink: 0, marginTop: 2 }}>{item.date}</span>
                <span style={{ ...sans, fontSize: 13, color: inkSoft, lineHeight: 1.5, wordBreak: "keep-all" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav active="home" onSelect={onNavSelect} />
    </div>
  );
}

// ── Screen 5 · Think (record) ─────────────────────────────────────────────────
function ScreenThink({ onDone, onBack }: { onDone?: (text: string) => void; onBack?: () => void }) {
  const [recording, setRecording] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const [textMode, setTextMode] = React.useState(false);
  const [text, setText] = React.useState("");
  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ink }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: "#8A8590", cursor: "pointer" }}>
          ✕ 그만하기
        </motion.span>
        {!recording && (
          <motion.span role="button" tabIndex={0} onClick={() => setTextMode((v) => !v)} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: accent, cursor: "pointer" }}>
            {textMode ? "음성으로 하기" : "글로 쓰기"}
          </motion.span>
        )}
      </div>

      {textMode ? (
        <>
          <div style={{ flex: 1, minHeight: 0, padding: "20px 24px 0", display: "flex" }}>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="오늘 있었던 일, 갑자기 든 생각, 아직 결정하지 못한 것 — 무엇이든 편하게 적어보세요."
              style={{
                ...serif, flex: 1, width: "100%", resize: "none", border: "none", outline: "none",
                backgroundColor: "transparent", color: "#F4F1EC", fontSize: 19, lineHeight: 1.7,
                wordBreak: "keep-all",
              }}
            />
          </div>
          <div style={{ padding: "0 24px 40px" }}>
            <PrimaryBtn disabled={!text.trim()} onClick={() => onDone?.(text.trim())}>다음</PrimaryBtn>
          </div>
        </>
      ) : (
        <>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px" }}>
            {!recording ? (
              <>
                <div style={{ ...serif, fontSize: 22, color: "#F4F1EC", textAlign: "center", lineHeight: 1.6, wordBreak: "keep-all" }}>
                  편하게 말하세요.<br />정리하려 하지 않아도 됩니다.
                </div>
                <div style={{ ...sans, fontSize: 13, color: "#8A8590", textAlign: "center", marginTop: 14, lineHeight: 1.6, wordBreak: "keep-all" }}>
                  오늘 있었던 일, 갑자기 든 생각,<br />아직 결정하지 못한 것 — 무엇이든.
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 3, height: 40 }}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [8, 24 + (i % 5) * 4, 8] }}
                      transition={{ duration: 0.9 + (i % 4) * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.04 }}
                      style={{ width: 3, borderRadius: 2, backgroundColor: accent }}
                    />
                  ))}
                </div>
                <div style={{ ...mono, fontSize: 15, color: "#8A8590", marginTop: 22 }}>{mm}:{ss}</div>
              </>
            )}
          </div>
          <div style={{ padding: "0 32px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <motion.div
              role="button" tabIndex={0}
              onClick={() => (recording ? onDone?.("") : setRecording(true))}
              whileTap={{ scale: 0.94 }}
              style={{
                width: 76, height: 76, borderRadius: "50%",
                backgroundColor: recording ? tension : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              {recording ? (
                <div style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: "#fff" }} />
              ) : (
                <div style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: ink }} />
              )}
            </motion.div>
            <span style={{ ...sans, fontSize: 13, color: "#8A8590" }}>{recording ? "탭하면 마칩니다" : "탭해서 시작하세요"}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Screen 6 · Processing ─────────────────────────────────────────────────────
// When real typed text is present, this screen actually calls the analysis
// endpoint (server-side LLM call) instead of just running a fixed timer —
// the timer stays as pacing for the still-unimplemented voice/STT path.
function ScreenProcessing({ text, priorBeliefs, priorAssumptions, onDone, onError }: { text?: string; priorBeliefs?: StoredBelief[]; priorAssumptions?: StoredAssumption[]; onDone?: (result: any | null) => void; onError?: (message: string) => void }) {
  const STEPS = ["듣고 있습니다", "기존 대화들과 연결하는 중", "패턴을 다시 확인하는 중"];
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (text) return;
    if (step >= STEPS.length - 1) {
      const t = setTimeout(() => onDone?.(null), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [text, step]);

  React.useEffect(() => {
    if (!text) return;
    let cancelled = false;
    const stepTimer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);
    fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, priorBeliefs, priorAssumptions }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "분석에 실패했습니다.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        clearInterval(stepTimer);
        setStep(STEPS.length - 1);
        setTimeout(() => { if (!cancelled) onDone?.(data); }, 500);
      })
      .catch((err) => {
        if (cancelled) return;
        clearInterval(stepTimer);
        onError?.(err instanceof Error ? err.message : "분석에 실패했습니다.");
      });
    return () => { cancelled = true; clearInterval(stepTimer); };
  }, [text]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", backgroundColor: ink, padding: 32 }}>
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: 56, height: 56, borderRadius: "50%", border: `1.5px solid ${accent}` }}
      />
      <div style={{ ...sans, fontSize: 14, color: "#C7C2CE", marginTop: 26 }}>{STEPS[step]}</div>
    </div>
  );
}

// ── Screen 7 · Think complete ─────────────────────────────────────────────────
function ScreenThinkComplete({ analysis, error, onDone }: { analysis?: any; error?: string; onDone?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: error || analysis ? "flex-start" : "center", padding: analysis ? "44px 28px 24px" : "0 28px" }}>
        {error ? (
          <>
            <div style={{ ...serif, fontSize: 21, color: ink, lineHeight: 1.5, wordBreak: "keep-all" }}>
              분석하지 못했어요.
            </div>
            <div style={{ ...sans, fontSize: 13.5, color: tension, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
              {error}
            </div>
          </>
        ) : analysis ? (
          <>
            <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.04em" }}>방금 남긴 생각에서</div>
            <div style={{ ...serif, fontSize: 21, color: ink, marginTop: 10, lineHeight: 1.5, wordBreak: "keep-all" }}>잘 들었습니다.</div>

            {analysis.changeNote && (
              <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: accent, marginTop: 14, lineHeight: 1.6, wordBreak: "keep-all" }}>
                {analysis.changeNote}
              </div>
            )}

            {Array.isArray(analysis.beliefs) && analysis.beliefs.length > 0 && (
              <div style={{ marginTop: 26 }}>
                <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>지금까지 쌓인 신념</div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {analysis.beliefs.map((b: any, i: number) => (
                    <div key={i} style={{ padding: 14, borderRadius: 12, backgroundColor: surface }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: mid }}>{b.domain}</span>
                        {typeof b.evidenceCount === "number" && <span style={{ ...mono, fontSize: 11, color: faint }}>근거 {b.evidenceCount}건</span>}
                      </div>
                      <div style={{ ...serif, fontSize: 15, color: ink, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>{b.statement}</div>
                      {typeof b.confidence === "number" && <div style={{ marginTop: 10 }}><ConfidenceBar value={b.confidence} /></div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(analysis.assumptions) && analysis.assumptions.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>반복되는 가정</div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {analysis.assumptions.map((a: any, i: number) => (
                    <div key={i} style={{ ...sans, fontSize: 13, color: inkSoft, lineHeight: 1.6, wordBreak: "keep-all" }}>
                      <span style={{ color: subtle }}>{a.trigger}</span> → {a.interpretation}
                      {typeof a.count === "number" && <span style={{ ...mono, fontSize: 11, color: faint }}> · {a.count}회</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.reflection && (
              <div style={{ marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: accentSoft, borderLeft: `2px solid ${accent}` }}>
                <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: ink, lineHeight: 1.65, wordBreak: "keep-all" }}>{analysis.reflection}</div>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ ...serif, fontSize: 22, color: ink, lineHeight: 1.5, wordBreak: "keep-all" }}>
              잘 들었습니다.
            </div>
            <div style={{ ...sans, fontSize: 14, color: mid, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
              오늘 이야기도 기록에 더해졌어요. 판단하거나 정리하지 않습니다 — 그냥 조용히 쌓아둡니다.
            </div>
            <div style={{ marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: accentSoft, borderLeft: `2px solid ${accent}` }}>
              <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.04em" }}>가볍게 눈에 띈 것</div>
              <div style={{ ...serif, fontSize: 15, color: ink, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>
                "좀 더 지켜보고 싶다"는 표현, 최근 몇 번 더 나왔었어요.
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <PrimaryBtn onClick={onDone}>홈으로</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Screen 8 · Belief Map ─────────────────────────────────────────────────────
// Radius encodes real evidence count, not a hand-picked size — r ∝ √value so
// circle AREA (which is what the eye actually compares) reads proportionally
// correct, the same lesson as an earlier project's GDP bubble chart. Domain
// tags stay inside the circle (short enough to fit at any radius); the full
// belief sentence lives in the list below, same split BRICS used (chart
// carries magnitude, list carries the actual claim).
const BELIEF_BUBBLES = BELIEFS.map((b, i) => {
  const maxValue = Math.max(...BELIEFS.map((x) => x.evidenceCount));
  const maxR = 58;
  const minR = 30;
  const r = minR + (maxR - minR) * Math.sqrt(b.evidenceCount / maxValue);
  const positions = [
    { x: 150, y: 108 },
    { x: 244, y: 188 },
    { x: 68, y: 184 },
    { x: 236, y: 66 },
    { x: 72, y: 70 },
  ];
  return { ...b, r, ...positions[i % positions.length] };
});

function BeliefBubbleChart() {
  return (
    <svg viewBox="6 6 288 248" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {BELIEF_BUBBLES.map((b, i) => (
        <circle key={b.label} cx={b.x} cy={b.y} r={b.r} fill={i === 0 ? accent : accentSoft} stroke={accent} strokeOpacity={i === 0 ? 0 : 0.35} strokeWidth={1.2} />
      ))}
      {BELIEF_BUBBLES.map((b, i) => (
        <React.Fragment key={`${b.label}-text`}>
          <text x={b.x} y={b.y - 3} textAnchor="middle" dominantBaseline="central" style={{ ...sans, fontSize: Math.max(b.r * 0.24, 9), fontWeight: 700, fill: i === 0 ? "#fff" : ink }}>{b.domain}</text>
          <text x={b.x} y={b.y + Math.max(b.r * 0.3, 12)} textAnchor="middle" dominantBaseline="central" style={{ ...mono, fontSize: Math.max(b.r * 0.16, 7.5), fontWeight: 600, fill: i === 0 ? "rgba(255,255,255,0.8)" : mid }}>{b.evidenceCount}건</text>
        </React.Fragment>
      ))}
    </svg>
  );
}

function ScreenBeliefMap({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>신념 지도</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6, lineHeight: 1.5 }}>당신의 결정을 이끄는 것으로 보이는 믿음들이에요. 원의 크기는 실제 근거 건수를 나타내요.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <BeliefBubbleChart />
        <div style={{ marginTop: 8 }}>
          {BELIEFS.map((b) => (
            <div key={b.label} style={{ padding: "16px 0", borderBottom: `1px solid ${hair}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: subtle, letterSpacing: "0.04em" }}>{b.domain}</span>
                <span style={{ ...mono, fontSize: 11, color: faint }}>근거 {b.evidenceCount}건</span>
              </div>
              <div style={{ ...serif, fontSize: 18, color: ink, marginTop: 8, lineHeight: 1.4, wordBreak: "keep-all" }}>{b.label}</div>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: hair, marginTop: 10 }}>
                <div style={{ height: "100%", width: `${b.strength}%`, borderRadius: 2, backgroundColor: accent }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Screen 9 · Recurring Assumptions ──────────────────────────────────────────
function ScreenAssumptions({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>반복되는 가정</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6, lineHeight: 1.5 }}>여러 상황에서 자동으로 튀어나오는 해석들이에요.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {ASSUMPTIONS.map((a, i) => (
          <div key={a.label} style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: i < ASSUMPTIONS.length - 1 ? `1px solid ${hair}` : "none" }}>
            <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: accent, lineHeight: 1.3, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</div>
            <div>
              <div style={{ ...serif, fontSize: 17, color: ink, lineHeight: 1.4, wordBreak: "keep-all" }}>{a.label}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {a.domains.map((d) => (
                  <span key={d} style={{ ...sans, fontSize: 11, color: mid, backgroundColor: surface, padding: "3px 9px", borderRadius: 999 }}>{d}</span>
                ))}
              </div>
              <div style={{ ...sans, fontSize: 11, color: faint, marginTop: 8 }}>{a.count}번의 대화에서 발견</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Screen 10 · Identity Drift ────────────────────────────────────────────────
// Identity Drift isn't a before/after mood chart — it's a gap between a
// stated aspiration and the pattern actually observed since. The quote is
// something the person said about who they wanted to become; the bar below
// it is how close recent behavior actually tracks that, not a vague mood
// score. This is the one screen most tied to the mission line "당신은 의식
// 적으로 되고 싶은 사람이 될 수 있도록 돕는다" — it has to show the gap
// plainly, not soften it into a neutral-sounding statistic.
const ASPIRATIONS = [
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
];

function ScreenDrift({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>사고의 변화</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
          되고 싶다고 말했던 사람과, 최근 실제 패턴 사이의 거리예요.
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px" }}>
        {ASPIRATIONS.map((a) => {
          const gap = Math.abs(a.target - a.actual);
          return (
            <div key={a.said} style={{ marginBottom: 26, paddingBottom: 26, borderBottom: `1px solid ${hair}` }}>
              <div style={{ ...mono, fontSize: 11, color: faint }}>{a.saidDate}, 당신이 한 말</div>
              <div style={{ ...serif, fontSize: 16, fontStyle: "italic", color: inkSoft, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
                "{a.said}"
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{ ...sans, fontSize: 12, color: mid }}>{a.label}</span>
                  <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: tension }}>{gap}%p 차이</span>
                </div>
                <div style={{ position: "relative", height: 8, borderRadius: 4, backgroundColor: hair, marginTop: 8 }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(a.target, a.actual)}%`, width: `${gap}%`, backgroundColor: "rgba(181,83,60,0.18)" }} />
                  <div style={{ position: "absolute", top: -3, height: 14, width: 2, backgroundColor: faint, left: `${a.target}%` }} />
                  <div style={{ position: "absolute", top: -3, height: 14, width: 3, borderRadius: 2, backgroundColor: accent, left: `${a.actual}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ ...sans, fontSize: 10, color: faint }}>목표 {a.target}%</span>
                  <span style={{ ...sans, fontSize: 10, color: accent }}>실제 {a.actual}%</span>
                </div>
              </div>

              <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 12, lineHeight: 1.55, wordBreak: "keep-all" }}>{a.note}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Screen 11 · Active Hypotheses ─────────────────────────────────────────────
function ScreenHypotheses({ onBack, onOpen }: { onBack?: () => void; onOpen?: (i: number) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>AI의 가설</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6, lineHeight: 1.5 }}>확실하지 않습니다. 동의/반박하며 함께 다듬어가요.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {HYPOTHESES.map((h, i) => (
          <motion.div
            key={h.title} role="button" tabIndex={0} onClick={() => onOpen?.(i)} whileTap={{ scale: 0.99, opacity: 0.9 }}
            style={{ padding: "18px 0", borderBottom: i < HYPOTHESES.length - 1 ? `1px solid ${hair}` : "none", cursor: "pointer" }}
          >
            <div style={{ ...serif, fontSize: 16, color: ink, lineHeight: 1.5, wordBreak: "keep-all" }}>{h.title}</div>
            <div style={{ marginTop: 12 }}>
              <ConfidenceBar value={h.confidence} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {h.domains.map((d) => (
                <span key={d} style={{ ...sans, fontSize: 11, color: mid, backgroundColor: surface, padding: "3px 9px", borderRadius: 999 }}>{d}</span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Screen 12 · Hypothesis detail ─────────────────────────────────────────────
function ScreenHypothesisDetail({ index, onBack, onInvestigate }: { index: number; onBack?: () => void; onInvestigate?: () => void }) {
  const h = HYPOTHESES[index] ?? HYPOTHESES[0];
  const [reaction, setReaction] = React.useState<null | "agree" | "disagree">(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.04em" }}>AI의 가설</div>
        <div style={{ ...serif, fontSize: 21, color: ink, marginTop: 10, lineHeight: 1.5, wordBreak: "keep-all" }}>{h.title}</div>
        <div style={{ marginTop: 18 }}><ConfidenceBar value={h.confidence} /></div>
        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          {h.domains.map((d) => (<span key={d} style={{ ...sans, fontSize: 11, color: mid, backgroundColor: surface, padding: "3px 9px", borderRadius: 999 }}>{d}</span>))}
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>근거가 된 대화들</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {h.evidence.map((e) => (
              <div key={e.date} style={{ padding: 14, borderRadius: 12, backgroundColor: surface }}>
                <div style={{ ...mono, fontSize: 11, color: faint }}>{e.date}</div>
                <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: inkSoft, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{e.quote}"</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: accentSoft, borderLeft: `2px solid ${accent}` }}>
          <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: ink, lineHeight: 1.65, wordBreak: "keep-all" }}>{h.question}</div>
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em", marginBottom: 12 }}>이 가설, 어떻게 생각하세요?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <motion.div
              role="button" tabIndex={0} onClick={() => setReaction("agree")} whileTap={{ scale: 0.97 }}
              style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, border: `1px solid ${reaction === "agree" ? ink : hair}`, backgroundColor: reaction === "agree" ? ink : "transparent", cursor: "pointer" }}
            >
              <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: reaction === "agree" ? "#fff" : ink }}>동의해요</span>
            </motion.div>
            <motion.div
              role="button" tabIndex={0} onClick={() => setReaction("disagree")} whileTap={{ scale: 0.97 }}
              style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, border: `1px solid ${reaction === "disagree" ? tension : hair}`, backgroundColor: reaction === "disagree" ? tension : "transparent", cursor: "pointer" }}
            >
              <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: reaction === "disagree" ? "#fff" : ink }}>아닌 것 같아요</span>
            </motion.div>
          </div>
          <div style={{ marginTop: 10 }}>
            {h.investigate && <GhostBtn onClick={onInvestigate}>더 깊이 알아보기</GhostBtn>}
          </div>
          {reaction && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ ...sans, fontSize: 12, color: subtle, marginTop: 12, textAlign: "center" }}>
              {reaction === "agree" ? "기록했어요. 이 가설의 확신도가 조금 더 높아집니다." : "기록했어요. 다음 대화에서 다시 살펴볼게요."}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Screen 12.5 · Investigate (deep dive into one hypothesis) ────────────────
// A short guided walk through the evidence trail: where the pattern first
// appeared, what changed between then and now, and how it connects to other
// patterns already surfaced — closing on the same reflective question grammar
// as the hypothesis card itself, not a new one.
function ScreenInvestigate({ index, onBack }: { index: number; onBack?: () => void }) {
  const h = HYPOTHESES[index] ?? HYPOTHESES[0];
  const inv = h.investigate;
  const [step, setStep] = React.useState(0);
  const steps = 4;
  if (!inv) return null;

  let body: React.ReactNode;
  if (step === 0) {
    body = (
      <ScreenPivot
        kicker="더 깊이 알아보기"
        statement={<>이 패턴이 처음<br />어디서 시작됐는지<br />같이 찾아볼게요.</>}
        cta={<PrimaryBtn onClick={() => setStep(1)}>시작</PrimaryBtn>}
      />
    );
  } else if (step === 1) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "52px 22px 90px" }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.04em" }}>가장 처음 등장한 순간</div>
          <div style={{ marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: surface }}>
            <div style={{ ...mono, fontSize: 11, color: faint }}>{inv.origin.date}</div>
            <div style={{ ...serif, fontSize: 16, fontStyle: "italic", color: inkSoft, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>"{inv.origin.quote}"</div>
          </div>
          <div style={{ ...sans, fontSize: 13.5, color: mid, marginTop: 18, lineHeight: 1.75, wordBreak: "keep-all" }}>{inv.originNote}</div>
        </div>
      </div>
    );
  } else if (step === 2) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "52px 22px 90px" }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.04em" }}>그때와 지금, 나란히 놓아보면</div>
          <div style={{ marginTop: 18 }}>
            <AlignedRowCompare
              rows={[
                { label: inv.compareLabel1, steps: inv.compareSteps1 },
                { label: inv.compareLabel2, steps: inv.compareSteps2, accent: true },
              ]}
            />
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <ScreenPivot
        kicker="다른 패턴과의 연결"
        statement={inv.related}
        cta={<PrimaryBtn onClick={onBack}>가설로 돌아가기</PrimaryBtn>}
      />
    );
  }

  const onDark = step === 0 || step === steps - 1;
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px 0", zIndex: 2 }}>
        <motion.span role="button" tabIndex={0} onClick={step === 0 ? onBack : () => setStep(step - 1)} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: onDark ? "#C9C6CF" : subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <span style={{ ...mono, fontSize: 11, color: onDark ? "#8A8590" : faint }}>{step + 1} / {steps}</span>
      </div>
      <div style={{ height: "100%" }}>{body}</div>
      {step > 0 && step < steps - 1 && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 22px 24px" }}>
          <PrimaryBtn onClick={() => setStep(step + 1)}>다음</PrimaryBtn>
        </div>
      )}
    </div>
  );
}

// ── Screen 13 · History ───────────────────────────────────────────────────────
const HISTORY_LOG = [
  { date: "2026.07.28", duration: "4분 12초", excerpt: "이직 제안이 왔는데 좀 더 지켜보고 싶다는 생각이 들었다..." },
  { date: "2026.07.25", duration: "2분 40초", excerpt: "발표 끝나고 계속 아쉬운 부분만 곱씹게 됐다..." },
  { date: "2026.07.21", duration: "6분 05초", excerpt: "요즘 혼자 결정하는 게 편한 건지, 그냥 익숙해서 그런 건지 헷갈린다..." },
];
function ScreenHistory({ onNavSelect }: { onNavSelect?: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <div style={{ ...serif, fontSize: 26, color: ink }}>기록</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6 }}>지금까지 나눈 생각들이에요.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {HISTORY_LOG.map((h) => (
          <div key={h.date} style={{ padding: "16px 0", borderBottom: `1px solid ${hair}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...mono, fontSize: 12, color: faint }}>{h.date}</span>
              <span style={{ ...mono, fontSize: 11, color: faint }}>{h.duration}</span>
            </div>
            <div style={{ ...sans, fontSize: 14, color: inkSoft, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>{h.excerpt}</div>
          </div>
        ))}
      </div>
      <BottomNav active="history" onSelect={onNavSelect} />
    </div>
  );
}

// ── Screen 14 · Profile ────────────────────────────────────────────────────────
function ScreenProfile({ onNavSelect }: { onNavSelect?: (id: string) => void }) {
  const rows = ["알림", "데이터와 개인정보", "도움말", "로그아웃"];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px 22px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: surface }} />
          <div style={{ ...serif, fontSize: 20, color: ink, marginTop: 12 }}>익명의 관찰자</div>
          <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4 }}>2026년 5월부터 함께하는 중 · 대화 47회</div>
        </div>
        <div style={{ marginTop: 28 }}>
          {rows.map((r, i) => (
            <div key={r} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 0", borderBottom: i < rows.length - 1 ? `1px solid ${hair}` : "none" }}>
              <span style={{ ...sans, fontSize: 15, color: r === "로그아웃" ? tension : inkSoft }}>{r}</span>
              <span style={{ ...sans, fontSize: 14, color: faint }}>›</span>
            </div>
          ))}
        </div>
      </div>
      <BottomNav active="profile" onSelect={onNavSelect} />
    </div>
  );
}

// ── App shell ──────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = React.useState("splash");
  const [hypothesisIndex, setHypothesisIndex] = React.useState(0);
  const [thinkText, setThinkText] = React.useState("");
  const [analysis, setAnalysis] = React.useState<any>(null);
  const [analysisError, setAnalysisError] = React.useState("");
  const [store, setStore] = React.useState<Store>(() => loadStore());

  const goToTab = (id: string) => setScreen(id);

  let content: React.ReactNode = null;
  switch (screen) {
    case "splash": content = <ScreenSplash onDone={() => setScreen("auth")} />; break;
    case "auth": content = <ScreenAuth onDone={() => setScreen("onboarding")} />; break;
    case "onboarding": content = <ScreenOnboarding onDone={() => setScreen("home")} />; break;
    case "home": content = <ScreenHome onNavSelect={goToTab} onStartThink={() => setScreen("think")} onOpenArtifact={(id) => setScreen(id)} />; break;
    case "think": content = <ScreenThink onBack={() => setScreen("home")} onDone={(text) => { setThinkText(text); setAnalysis(null); setAnalysisError(""); setScreen("processing"); }} />; break;
    case "processing": content = (
      <ScreenProcessing
        text={thinkText}
        priorBeliefs={store.beliefs}
        priorAssumptions={store.assumptions}
        onDone={(result) => {
          if (result) {
            const next: Store = {
              beliefs: Array.isArray(result.beliefs) ? result.beliefs : store.beliefs,
              assumptions: Array.isArray(result.assumptions) ? result.assumptions : store.assumptions,
              entryCount: store.entryCount + 1,
            };
            setStore(next);
            saveStore(next);
          }
          setAnalysis(result);
          setScreen("thinkComplete");
        }}
        onError={(msg) => { setAnalysisError(msg); setScreen("thinkComplete"); }}
      />
    ); break;
    case "thinkComplete": content = <ScreenThinkComplete analysis={analysis} error={analysisError} onDone={() => setScreen("home")} />; break;
    case "beliefs": content = <ScreenBeliefMap onBack={() => setScreen("home")} />; break;
    case "assumptions": content = <ScreenAssumptions onBack={() => setScreen("home")} />; break;
    case "drift": content = <ScreenDrift onBack={() => setScreen("home")} />; break;
    case "hypotheses": content = <ScreenHypotheses onBack={() => setScreen("home")} onOpen={(i) => { setHypothesisIndex(i); setScreen("hypothesisDetail"); }} />; break;
    case "hypothesisDetail": content = <ScreenHypothesisDetail index={hypothesisIndex} onBack={() => setScreen("hypotheses")} onInvestigate={() => setScreen("investigate")} />; break;
    case "investigate": content = <ScreenInvestigate index={hypothesisIndex} onBack={() => setScreen("hypothesisDetail")} />; break;
    case "history": content = <ScreenHistory onNavSelect={goToTab} />; break;
    case "profile": content = <ScreenProfile onNavSelect={goToTab} />; break;
    default: content = <ScreenHome onNavSelect={goToTab} onStartThink={() => setScreen("think")} onOpenArtifact={(id) => setScreen(id)} />;
  }

  const showStatusBar = !["splash"].includes(screen);
  const isDark = ["splash", "think", "processing"].includes(screen);

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "#EDEAE4", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: 393, height: 852, borderRadius: 40, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", backgroundColor: isDark ? ink : page, display: "flex", flexDirection: "column" }}>
        {showStatusBar && <StatusBar />}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
