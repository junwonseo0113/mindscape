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

// ── Persisted belief graph — the one place this app keeps real, accumulating
// state instead of curated demo data. Every analysis feeds the current graph
// back to the model so it can tell "new belief" apart from "this again,
// reinforce it" (Model → Update), and — the network part — explicitly link
// beliefs that share a root cause, so the graph gets richer (and analysis
// has more to reason from) the longer someone uses the app.
const STORE_KEY = "mijeong.store.v6";

type StoredEvidenceQuote = { date: string; quote: string };
type StoredBelief = { id: string; domain: string; statement: string; confidence: number; evidenceCount: number; evidenceQuotes: StoredEvidenceQuote[] };
type StoredAssumption = { id: string; trigger: string; interpretation: string; count: number };
type StoredConnection = { a: string; b: string; note: string };
type StoredHistoryEntry = { date: string; text: string };
type StoredHypothesis = { id: string; title: string; confidence: number; domains: string[]; reaction: "agree" | "disagree" | null; createdDate: string; relatedBeliefIds: string[] };
type StoredDriftNote = { date: string; note: string };
type StoredSettings = { dailyReminder: boolean; newHypothesisAlert: boolean; weeklySummary: boolean };
// Local-only mock account — there's no backend, so this is just a gate on
// top of the one on-device dataset (see 데이터와 개인정보), not real auth.
// Password is compared in plaintext client-side; that's fine for a
// prototype where the only "attacker" is someone with your own browser.
type StoredAccount = { name: string; email: string; password: string };
type Store = {
  beliefs: StoredBelief[];
  assumptions: StoredAssumption[];
  connections: StoredConnection[];
  history: StoredHistoryEntry[];
  hypotheses: StoredHypothesis[];
  aspiration: string | null;
  aspirationSetDate: string | null;
  driftNotes: StoredDriftNote[];
  settings: StoredSettings;
  account: StoredAccount | null;
  entryCount: number;
};

function formatDateDots(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function defaultSettings(): StoredSettings {
  return { dailyReminder: true, newHypothesisAlert: true, weeklySummary: false };
}

function emptyStore(): Store {
  return { beliefs: [], assumptions: [], connections: [], history: [], hypotheses: [], aspiration: null, aspirationSetDate: null, driftNotes: [], settings: defaultSettings(), account: null, entryCount: 0 };
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return {
      beliefs: Array.isArray(parsed.beliefs) ? parsed.beliefs : [],
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      hypotheses: Array.isArray(parsed.hypotheses) ? parsed.hypotheses : [],
      aspiration: typeof parsed.aspiration === "string" ? parsed.aspiration : null,
      aspirationSetDate: typeof parsed.aspirationSetDate === "string" ? parsed.aspirationSetDate : null,
      driftNotes: Array.isArray(parsed.driftNotes) ? parsed.driftNotes : [],
      settings: parsed.settings && typeof parsed.settings === "object" ? { ...defaultSettings(), ...parsed.settings } : defaultSettings(),
      account: parsed.account && typeof parsed.account === "object" ? parsed.account : null,
      entryCount: typeof parsed.entryCount === "number" ? parsed.entryCount : 0,
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // private-mode / storage-full — non-fatal, just don't persist
  }
}

// The model matches beliefs/connections by content (statement text), not by
// id — it has no reliable way to keep bookkeeping ids consistent across
// calls. Identity/id assignment happens here instead: exact (domain,
// statement) match reuses the prior id (so a bubble/node keeps its identity
// as it strengthens); anything unmatched is a genuinely new node.
function mergeAnalysisIntoStore(prev: Store, result: any, rawText: string): Store {
  const today = formatDateDots(new Date());

  const beliefKey = (b: { domain: string; statement: string }) => `${b.domain}::${b.statement}`;
  const prevBeliefByKey = new Map(prev.beliefs.map((b) => [beliefKey(b), b]));
  const rawBeliefs: any[] = Array.isArray(result?.beliefs) ? result.beliefs : prev.beliefs;
  const beliefs: StoredBelief[] = rawBeliefs.map((b, i) => {
    const prevMatch = prevBeliefByKey.get(beliefKey(b));
    const priorQuotes = prevMatch?.evidenceQuotes ?? [];
    const newQuote = typeof b.quote === "string" && b.quote.trim() ? b.quote.trim() : null;
    const evidenceQuotes = newQuote ? [...priorQuotes, { date: today, quote: newQuote }].slice(-4) : priorQuotes;
    return {
      id: prevMatch?.id ?? `belief-${Date.now()}-${i}`,
      domain: b.domain,
      statement: b.statement,
      confidence: typeof b.confidence === "number" ? b.confidence : prevMatch?.confidence ?? 50,
      evidenceCount: typeof b.evidenceCount === "number" ? b.evidenceCount : prevMatch?.evidenceCount ?? 1,
      evidenceQuotes,
    };
  });

  const assumptionKey = (a: { trigger: string; interpretation: string }) => `${a.trigger}::${a.interpretation}`;
  const prevAssumptionByKey = new Map(prev.assumptions.map((a) => [assumptionKey(a), a]));
  const rawAssumptions: any[] = Array.isArray(result?.assumptions) ? result.assumptions : prev.assumptions;
  const assumptions: StoredAssumption[] = rawAssumptions.map((a, i) => {
    const prevMatch = prevAssumptionByKey.get(assumptionKey(a));
    return {
      id: prevMatch?.id ?? `assumption-${Date.now()}-${i}`,
      trigger: a.trigger,
      interpretation: a.interpretation,
      count: typeof a.count === "number" ? a.count : prevMatch?.count ?? 1,
    };
  });

  const idByStatement = new Map(beliefs.map((b) => [b.statement, b.id]));
  const rawConnections: any[] = Array.isArray(result?.connections) ? result.connections : [];
  const newConnections: StoredConnection[] = rawConnections
    .map((c) => ({ a: idByStatement.get(c.aStatement) ?? "", b: idByStatement.get(c.bStatement) ?? "", note: c.note ?? "" }))
    .filter((c) => c.a && c.b && c.a !== c.b);

  const stillValidIds = new Set(beliefs.map((b) => b.id));
  const carriedOver = prev.connections.filter((c) => stillValidIds.has(c.a) && stillValidIds.has(c.b));
  const seenPairs = new Set(carriedOver.map((c) => [c.a, c.b].sort().join("::")));
  const connections = [...carriedOver];
  for (const c of newConnections) {
    const pairKey = [c.a, c.b].sort().join("::");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    connections.push(c);
  }

  const history: StoredHistoryEntry[] = [...prev.history, { date: today, text: rawText }].slice(-50);

  // A metaInsight only ever appears once the belief network is big enough
  // to support one (see the server prompt) — treat each as a real,
  // reactable hypothesis instead of a demo one, same shape so both screens
  // can render either without a special case.
  let hypotheses = prev.hypotheses;
  if (typeof result?.metaInsight === "string" && result.metaInsight.trim()) {
    const alreadyHave = prev.hypotheses.some((h) => h.title === result.metaInsight.trim());
    if (!alreadyHave) {
      const relatedStatements: string[] = Array.isArray(result?.metaInsightBeliefStatements) ? result.metaInsightBeliefStatements : [];
      const relatedBeliefIds = relatedStatements
        .map((s) => beliefs.find((b) => b.statement === s)?.id)
        .filter((id): id is string => !!id);
      const domains = Array.isArray(result?.metaInsightDomains) && result.metaInsightDomains.length > 0
        ? result.metaInsightDomains
        : relatedBeliefIds.length > 0
          ? [...new Set(relatedBeliefIds.map((id) => beliefs.find((b) => b.id === id)!.domain))]
          : [...new Set(beliefs.map((b) => b.domain))].slice(0, 3);
      hypotheses = [
        {
          id: `hyp-${Date.now()}`,
          title: result.metaInsight.trim(),
          confidence: typeof result?.metaInsightConfidence === "number" ? result.metaInsightConfidence : 60,
          domains,
          reaction: null,
          createdDate: today,
          relatedBeliefIds,
        },
        ...prev.hypotheses,
      ].slice(0, 8);
    }
  }

  const driftNotes: StoredDriftNote[] = typeof result?.driftNote === "string" && result.driftNote.trim()
    ? [...prev.driftNotes, { date: today, note: result.driftNote.trim() }].slice(-20)
    : prev.driftNotes;

  return {
    beliefs,
    assumptions,
    connections,
    history,
    hypotheses,
    aspiration: prev.aspiration,
    aspirationSetDate: prev.aspirationSetDate,
    driftNotes,
    settings: prev.settings,
    account: prev.account,
    entryCount: prev.entryCount + 1,
  };
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
// ── Linku — the app's mascot. A quiet, faceless little companion whose one
// visual trick is a small constellation on it — antenna filaments ending
// in glowing dots, and (in "connecting" pose) the same three-dot triangle
// as the app's own "연결한다" icon, lit up on its chest. Used only where
// the moment is actually about connecting/observing (splash, processing) —
// not stamped on every screen.
function Linku({ pose = "idle", size = 120, dark = false, rich = false }: { pose?: "idle" | "connecting"; size?: number; dark?: boolean; rich?: boolean }) {
  const stroke = dark ? "#8A8590" : ink;
  const body = dark ? "#F4F1EC" : "#fff";
  const eye = dark ? "#403E45" : ink;
  return (
    <svg width={size} height={size * 1.3} viewBox="-14 -22 128 140" style={{ overflow: "visible" }}>
      <line x1="50" y1="18" x2="36" y2="-10" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <motion.circle
        cx="36" cy="-10" r="3.2" fill={accent}
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.15, 0.9] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "36px -10px" }}
      />
      {rich && (
        <>
          <path d="M 52 20 Q 66 8 74 -6" fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <motion.circle
            cx="74" cy="-6" r="2.3" fill={accent}
            animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            style={{ transformOrigin: "74px -6px" }}
          />
          <path d="M 46 20 Q 30 14 22 -2" fill="none" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.7" />
          <motion.circle
            cx="22" cy="-2" r="1.8" fill={accent}
            animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 2.7, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
            style={{ transformOrigin: "22px -2px" }}
          />
        </>
      )}
      <ellipse cx="38" cy="108" rx="9" ry="5" fill={body} stroke={stroke} strokeWidth="1.5" />
      <ellipse cx="62" cy="108" rx="9" ry="5" fill={body} stroke={stroke} strokeWidth="1.5" />
      <ellipse cx="18" cy="72" rx="7" ry="12" fill={body} stroke={stroke} strokeWidth="1.5" />
      <ellipse cx="82" cy="72" rx="7" ry="12" fill={body} stroke={stroke} strokeWidth="1.5" />
      <ellipse cx="50" cy="78" rx="27" ry="30" fill={body} stroke={stroke} strokeWidth="1.5" />
      <circle cx="50" cy="34" r="30" fill={body} stroke={stroke} strokeWidth="1.5" />
      <ellipse cx="40" cy="34" rx="2.2" ry="4" fill={eye} />
      <ellipse cx="60" cy="34" rx="2.2" ry="4" fill={eye} />
      {pose === "connecting" && (
        <>
          {[["44,74", "58,84"], ["58,84", "48,68"], ["48,68", "44,74"]].map(([a, b], i) => {
            const [x1, y1] = a.split(",").map(Number);
            const [x2, y2] = b.split(",").map(Number);
            return (
              <motion.line
                key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="1"
                animate={{ opacity: [0.2, 0.7, 0.2] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
              />
            );
          })}
          {[[44, 74, 2], [58, 84, 2.6], [48, 68, 1.8]].map(([cx, cy, r], i) => (
            <motion.circle
              key={i} cx={cx} cy={cy} r={r} fill={accent}
              animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.25 }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
          ))}
        </>
      )}
    </svg>
  );
}

function ScreenSplash({ onDone }: { onDone?: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(() => onDone?.(), 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", backgroundColor: ink, padding: 32 }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Linku dark rich size={92} />
        <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: "#8A8590", textAlign: "center", letterSpacing: "0.02em", marginTop: 18 }}>
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
function ScreenAuth({ onEmailStart, onGuest }: { onEmailStart?: () => void; onGuest?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: faint, textAlign: "center" }}>미정</div>
        <div style={{ ...serif, fontSize: 24, color: ink, textAlign: "center", marginTop: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>
          기록하는 앱이 아니라,<br />당신의 사고방식을 이해하는 도구
        </div>
      </div>
      <div style={{ padding: "0 28px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        <PrimaryBtn onClick={onEmailStart}>이메일로 계속하기</PrimaryBtn>
        <GhostBtn onClick={onGuest}>게스트로 둘러보기</GhostBtn>
      </div>
    </div>
  );
}

function TextField({ label, type = "text", value, onChange, placeholder, error }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...sans, width: "100%", padding: "13px 14px", borderRadius: 12, boxSizing: "border-box",
          border: `1px solid ${error ? tension : hair}`, fontSize: 15, color: ink,
          backgroundColor: surface, outline: "none",
        }}
      />
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A local-only mock login: there's no server, so "logging in" just checks
// against the single account stored on this device (see StoredAccount).
// It's here so the flow feels real, not to imply real multi-user auth.
function ScreenLogin({ account, onBack, onGoSignup, onLogin }: { account: StoredAccount | null; onBack?: () => void; onGoSignup?: () => void; onLogin?: () => void }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = () => {
    if (loading) return;
    setError("");
    if (!email.trim() || !password) { setError("이메일과 비밀번호를 모두 입력해주세요."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("이메일 형식이 올바르지 않아요."); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (!account) { setError("등록된 계정이 없어요. 회원가입을 먼저 해주세요."); return; }
      if (account.email.toLowerCase() !== email.trim().toLowerCase() || account.password !== password) {
        setError("이메일 또는 비밀번호가 올바르지 않아요.");
        return;
      }
      onLogin?.();
    }, 500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 0", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 28px 24px" }}>
        <div style={{ ...serif, fontSize: 24, color: ink, lineHeight: 1.4 }}>다시 만나서 반가워요</div>
        <div style={{ marginTop: 24 }}>
          <TextField label="이메일" type="email" value={email} onChange={setEmail} placeholder="you@example.com" error={!!error} />
          <TextField label="비밀번호" type="password" value={password} onChange={setPassword} placeholder="••••••••" error={!!error} />
        </div>
        {error && <div style={{ ...sans, fontSize: 12.5, color: tension, marginTop: 2, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>{error}</div>}
        <PrimaryBtn onClick={submit} disabled={loading}>{loading ? "확인하는 중…" : "로그인"}</PrimaryBtn>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span style={{ ...sans, fontSize: 13, color: mid }}>계정이 없으신가요? </span>
          <motion.span role="button" tabIndex={0} onClick={onGoSignup} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: accent, fontWeight: 600, cursor: "pointer" }}>회원가입</motion.span>
        </div>
      </div>
    </div>
  );
}

function ScreenSignup({ onBack, onGoLogin, onSignup }: { onBack?: () => void; onGoLogin?: () => void; onSignup?: (account: StoredAccount) => void }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = () => {
    if (loading) return;
    setError("");
    if (!name.trim()) { setError("이름을 입력해주세요."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("이메일 형식이 올바르지 않아요."); return; }
    if (password.length < 6) { setError("비밀번호는 6자 이상이어야 해요."); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSignup?.({ name: name.trim(), email: email.trim(), password });
    }, 500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 0", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 28px 24px" }}>
        <div style={{ ...serif, fontSize: 24, color: ink, lineHeight: 1.4 }}>계정을 만들어요</div>
        <div style={{ ...sans, fontSize: 12.5, color: subtle, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>
          이 기기에만 저장돼요. 다른 서버로 전송되지 않아요.
        </div>
        <div style={{ marginTop: 20 }}>
          <TextField label="이름" value={name} onChange={setName} placeholder="어떻게 불러드릴까요?" error={!!error} />
          <TextField label="이메일" type="email" value={email} onChange={setEmail} placeholder="you@example.com" error={!!error} />
          <TextField label="비밀번호" type="password" value={password} onChange={setPassword} placeholder="6자 이상" error={!!error} />
        </div>
        {error && <div style={{ ...sans, fontSize: 12.5, color: tension, marginTop: 2, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>{error}</div>}
        <PrimaryBtn onClick={submit} disabled={loading}>{loading ? "만드는 중…" : "가입하기"}</PrimaryBtn>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span style={{ ...sans, fontSize: 13, color: mid }}>이미 계정이 있으신가요? </span>
          <motion.span role="button" tabIndex={0} onClick={onGoLogin} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: accent, fontWeight: 600, cursor: "pointer" }}>로그인</motion.span>
        </div>
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
    body: "매번 조언하는 대신, 수백 번의 대화에 걸쳐 당신이 반복하는 무의식적 해석과 판단 습관을 조용히 관찰합니다.",
  },
  {
    kicker: "시간이 지나면",
    title: "당신도 몰랐던\n당신의 패턴이 보입니다.",
    body: "\"불확실할 때는 기다리는 게 안전하다\" — 이 무의식적 해석이 커리어에서도, 관계에서도, 투자에서도 반복됐다는 걸, 안에서는 알아채기 어렵습니다.",
  },
];

// The onboarding sequence's last beat is a real question, not another
// slide: what kind of person do you want to become. It's optional (typing
// nothing just means "skip"), but asking it here — right when someone
// commits to using the app — is what actually seeds Identity Drift instead
// of leaving it undiscoverable inside Profile settings.
function ScreenOnboarding({ initialAspiration, onDone }: { initialAspiration?: string | null; onDone?: (aspiration: string | null) => void }) {
  const totalSteps = ONBOARDING_SLIDES.length + 1;
  const [i, setI] = React.useState(0);
  const [aspiration, setAspiration] = React.useState(initialAspiration ?? "");
  const isAspirationStep = i === ONBOARDING_SLIDES.length;
  const isLast = i === totalSteps - 1;
  const slide = !isAspirationStep ? ONBOARDING_SLIDES[i] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ display: "flex", gap: 6, padding: "20px 28px 0", flexShrink: 0 }}>
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div key={idx} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: idx <= i ? ink : hair }} />
        ))}
      </div>
      {!isAspirationStep ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: accent, letterSpacing: "0.06em" }}>{slide!.kicker}</div>
          <div style={{ ...serif, fontSize: 28, color: ink, marginTop: 14, lineHeight: 1.4, whiteSpace: "pre-line", wordBreak: "keep-all" }}>
            {slide!.title}
          </div>
          <div style={{ ...sans, fontSize: 15, color: mid, marginTop: 18, lineHeight: 1.65, wordBreak: "keep-all" }}>
            {slide!.body}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 28px" }}>
          <div style={{ flexShrink: 0, paddingTop: 8 }}>
            <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: accent, letterSpacing: "0.06em" }}>마지막으로</div>
            <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 14, lineHeight: 1.4, wordBreak: "keep-all" }}>
              당신은 어떤 사람이<br />되고 싶나요?
            </div>
            <div style={{ ...sans, fontSize: 13.5, color: mid, marginTop: 12, lineHeight: 1.6, wordBreak: "keep-all" }}>
              선택이에요. 적어두면, 앞으로 남기는 생각들과 이 말 사이의 거리를 계속 보여드릴게요.
            </div>
          </div>
          <textarea
            autoFocus
            value={aspiration}
            onChange={(e) => setAspiration(e.target.value)}
            placeholder="예: 안정보다 도전을 선택하는 사람이 되고 싶어."
            style={{
              ...serif, flex: 1, width: "100%", resize: "none", border: "none", outline: "none",
              backgroundColor: "transparent", color: ink, fontSize: 18, lineHeight: 1.7,
              wordBreak: "keep-all", marginTop: 18, minHeight: 0,
            }}
          />
        </div>
      )}
      <div style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <PrimaryBtn onClick={() => (isLast ? onDone?.(aspiration.trim() || null) : setI((v) => v + 1))}>
          {isLast ? (aspiration.trim() ? "저장하고 시작하기" : "건너뛰고 시작하기") : "다음"}
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

// Same trigger -> interpretation shape as StoredAssumption, so the demo
// actually demonstrates the belief/assumption distinction instead of just
// looking like a second list of flat statements.
const ASSUMPTIONS = [
  { trigger: "불확실함이 나타날 때", interpretation: "기다리는 게 가장 안전한 선택이라고 자동으로 생각한다", domains: ["커리어", "관계", "투자"], count: 12 },
  { trigger: "누군가에게 먼저 다가가야 할 때", interpretation: "결국 손해를 볼 거라고 미리 판단한다", domains: ["관계", "협상"], count: 8 },
  { trigger: "새로운 걸 시작해야 할 때", interpretation: "아직 준비가 안 됐다며 미룬다", domains: ["일", "창업"], count: 15 },
  { trigger: "갈등이나 서운함을 느낄 때", interpretation: "드러내면 약점이 잡힌다고 생각해 감춘다", domains: ["관계", "직장"], count: 9 },
];

const HYPOTHESES = [
  {
    title: "불확실함이 나타날 때마다, 기다리는 것이 가장 안전한 선택이라고 자동으로 해석하는 경향이 있습니다.",
    // The closing line is the whole point of this screen, almost verbatim
    // from the product brief's own example — the AI never states a verdict
    // ("이건 당신에게 안 좋은 습관이에요"), it hands the interpretation back.
    question: "이 패턴은 커리어, 관계, 투자에서 반복적으로 나타났어요. 이 무의식적 해석이 당신에게 도움이 되고 있다고 생각하세요, 아니면 당신을 제한하고 있다고 생각하세요?",
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
      related: "이 '기다림' 패턴은 '완벽해야 시작할 수 있다'는 무의식적 신념과도 연결돼 보여요 — 확신이 서는 순간은, 아마 오지 않을지도 모릅니다.",
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
      related: "'노력하면 결국 인정받는다'는 무의식적 신념과 짝을 이뤄요 — 인정받지 못하면, 노력이 아니라 자격 자체를 의심하게 되는 것 같아요.",
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
      related: "'안전이 최우선이다'는 무의식적 신념이 실제로는 '자유'보다 더 강하게 작동하고 있는 것으로 보여요.",
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

function ScreenHome({ onNavSelect, onStartThink, onOpenArtifact, store }: { onNavSelect?: (id: string) => void; onStartThink?: () => void; onOpenArtifact?: (id: string) => void; store?: Store }) {
  const live = !!store && store.entryCount > 0;
  const recent = live
    ? [...store!.history].reverse().slice(0, 4).map((h) => ({ date: h.date.slice(5), text: h.text }))
    : [
        { date: "07.28", text: "이직 제안이 왔는데 좀 더 지켜보고 싶다는 생각이 들었다." },
        { date: "07.25", text: "발표 끝나고 계속 아쉬운 부분만 곱씹게 됐다." },
      ];
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
          <span style={{ ...mono, fontSize: 11, color: faint }}>대화 {live ? store!.entryCount : 47}회</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <ArtifactTile
            label="무의식적 패턴"
            teaser={live
              ? `스스로 의식하지 못한 채 반복되는 것 — 무의식적 신념 ${store!.beliefs.length}가지, 반복되는 해석 ${store!.assumptions.length}가지가 드러났어요.`
              : "스스로 의식하지 못한 채 반복되는 것 — 무의식적 신념 5가지와 반복되는 해석을 함께 보여드려요."}
            onClick={() => onOpenArtifact?.("beliefs")}
          />
          <ArtifactTile
            label="목표와의 거리"
            teaser="되고 싶다고 말한 모습과, 실제 말과 행동에서 반복되는 패턴 사이의 거리예요."
            onClick={() => onOpenArtifact?.("drift")}
          />
          <ArtifactTile
            label="AI의 가설"
            badge={live && store!.hypotheses.some((h) => h.reaction === null) ? "NEW" : undefined}
            teaser={live
              ? `여러 무의식적 신념을 가로지르는 상위 이론 ${store!.hypotheses.length}개 — 동의/반박하며 함께 다듬어요.`
              : "여러 무의식적 신념을 가로지르는 AI의 이론이에요 — 동의/반박하며 함께 다듬어요."}
            onClick={() => onOpenArtifact?.("hypotheses")}
          />
        </div>

        <div style={{ marginTop: 28 }}>
          <span style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>최근 생각</span>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {recent.length === 0 ? (
              <div style={{ ...sans, fontSize: 13, color: faint, padding: "12px 0" }}>아직 남긴 생각이 없어요.</div>
            ) : (
              recent.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${hair}` }}>
                  <span style={{ ...mono, fontSize: 11, color: faint, flexShrink: 0, marginTop: 2 }}>{item.date}</span>
                  <span style={{ ...sans, fontSize: 13, color: inkSoft, lineHeight: 1.5, wordBreak: "keep-all" }}>{item.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <BottomNav active="home" onSelect={onNavSelect} />
    </div>
  );
}

// ── Screen 5 · Think (record) ─────────────────────────────────────────────────
// The browser's own speech recognizer — no extra API key, but Chrome/Edge/
// Safari only (no Firefox), and audio goes through the browser vendor's
// servers to come back as text. Good enough to make voice input real for a
// minimal version instead of the decorative waveform-only mock it used to be.
function getSpeechRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// Rotates through the "what to talk about" hint instead of always showing
// the same line — one of these nudges toward identity/aspiration ("누구가
// 되고 싶은지") without a separate dedicated goal-setting flow. Whichever
// one shows just seeds what people talk about; it's not a form field.
const THINK_PROMPTS = [
  "오늘 있었던 일, 갑자기 든 생각, 아직 결정하지 못한 것 — 무엇이든.",
  "당신이 되고 싶은 사람은 어떤 모습인가요? 그런 이야기도 좋아요.",
  "요즘 자꾸 미루고 있는 일이 있다면, 왜 그런지 편하게 말해보세요.",
  "최근에 후회했던 선택이 있다면, 그때 무슨 생각이었나요?",
  "지금 가장 확신이 서지 않는 게 뭔가요?",
  "예전의 나와 지금의 나, 뭐가 달라졌다고 느끼나요?",
];

function ScreenThink({ onDone, onBack }: { onDone?: (text: string) => void; onBack?: () => void }) {
  const [recording, setRecording] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const [textMode, setTextMode] = React.useState(false);
  const [text, setText] = React.useState("");
  const [promptHint] = React.useState(() => THINK_PROMPTS[Math.floor(Math.random() * THINK_PROMPTS.length)]);
  const [transcript, setTranscript] = React.useState("");
  const [interim, setInterim] = React.useState("");
  const voiceSupportedRef = React.useRef(!!getSpeechRecognitionCtor());
  const recognitionRef = React.useRef<any>(null);
  const manualStopRef = React.useRef(false);

  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  React.useEffect(() => () => { manualStopRef.current = true; recognitionRef.current?.stop?.(); }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const startRecording = () => {
    setTranscript("");
    setInterim("");
    setSeconds(0);
    const SR = getSpeechRecognitionCtor();
    if (SR) {
      manualStopRef.current = false;
      const recognition = new SR();
      recognition.lang = "ko-KR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (e: any) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalChunk += r[0].transcript;
          else interimChunk += r[0].transcript;
        }
        if (finalChunk) setTranscript((t) => (t ? t + " " : "") + finalChunk.trim());
        setInterim(interimChunk);
      };
      recognition.onerror = (e: any) => {
        // Fatal errors (mic denied, no mic, offline): stop retrying instead
        // of looping start/stop forever. "no-speech" is not fatal — it just
        // means a silent gap, so let onend's restart handle that one.
        if (["not-allowed", "audio-capture", "network", "service-not-allowed"].includes(e?.error)) {
          manualStopRef.current = true;
        }
      };
      recognition.onend = () => {
        if (!manualStopRef.current) {
          try { recognition.start(); } catch { /* already stopped for good */ }
        }
      };
      recognitionRef.current = recognition;
      try { recognition.start(); } catch { /* ignore */ }
    }
    setRecording(true);
  };

  const stopRecording = () => {
    manualStopRef.current = true;
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setRecording(false);
    const finalText = (transcript + (interim ? " " + interim : "")).trim();
    setInterim("");
    onDone?.(finalText);
  };

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
              placeholder={`${promptHint} 편하게 적어보세요.`}
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
                  {promptHint}
                </div>
                {!voiceSupportedRef.current && (
                  <div style={{ ...sans, fontSize: 12, color: tension, textAlign: "center", marginTop: 18, lineHeight: 1.6, wordBreak: "keep-all" }}>
                    이 브라우저는 음성 인식을 지원하지 않아요. "글로 쓰기"를 이용해주세요.
                  </div>
                )}
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
                {voiceSupportedRef.current && (
                  <div style={{ ...serif, fontSize: 16, color: "#D9D6DE", textAlign: "center", marginTop: 24, lineHeight: 1.65, wordBreak: "keep-all", minHeight: 50 }}>
                    {(transcript + (interim ? " " + interim : "")).trim() || "듣고 있어요…"}
                  </div>
                )}
              </>
            )}
          </div>
          <div style={{ padding: "0 32px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <motion.div
              role="button" tabIndex={0}
              onClick={() => (recording ? stopRecording() : startRecording())}
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
function ScreenProcessing({ text, priorBeliefs, priorAssumptions, priorConnections, aspiration, onDone, onError }: { text?: string; priorBeliefs?: Pick<StoredBelief, "domain" | "statement" | "confidence" | "evidenceCount">[]; priorAssumptions?: StoredAssumption[]; priorConnections?: { aStatement: string; bStatement: string; note: string }[]; aspiration?: string | null; onDone?: (result: any | null) => void; onError?: (message: string) => void }) {
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
      body: JSON.stringify({ text, priorBeliefs, priorAssumptions, priorConnections, aspiration }),
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
      <Linku dark size={110} pose={step === 1 ? "connecting" : "idle"} />
      <div style={{ ...sans, fontSize: 14, color: "#C7C2CE", marginTop: 22 }}>{STEPS[step]}</div>
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
                <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>지금까지 쌓인 무의식적 신념</div>
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
                <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>반복되는 무의식적 해석</div>
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

            {Array.isArray(analysis.connections) && analysis.connections.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>발견된 연결</div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {analysis.connections.map((c: any, i: number) => (
                    <div key={i} style={{ padding: "12px 14px", borderRadius: 12, backgroundColor: accentSoft }}>
                      <ConnectionSpark aLabel={c.aLabel} bLabel={c.bLabel} />
                      <div style={{ ...sans, fontSize: 13, color: inkSoft, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>{c.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.metaInsight && (
              <div style={{ marginTop: 22 }}>
                <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.04em" }}>패턴이 쌓이면서 보이는 것</div>
                <div style={{ marginTop: 8, padding: 16, borderRadius: 14, backgroundColor: ink }}>
                  <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: "#F4F1EC", lineHeight: 1.65, wordBreak: "keep-all" }}>{analysis.metaInsight}</div>
                </div>
              </div>
            )}

            {analysis.driftNote && (
              <div style={{ marginTop: 22 }}>
                <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>되고 싶은 모습과의 거리</div>
                <div style={{ marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: surface }}>
                  <div style={{ ...sans, fontSize: 13, color: inkSoft, lineHeight: 1.6, wordBreak: "keep-all" }}>{analysis.driftNote}</div>
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

// A tiny standalone "synapse forming" diagram — two nodes, a line drawing
// itself in, then a pulse that keeps traveling between them. Used wherever
// a freshly-found connection between two beliefs needs to feel like it's
// actually being wired together, not just printed as text.
function ConnectionSpark({ aLabel, bLabel }: { aLabel: string; bLabel: string }) {
  const w = 240, h = 48, r = 17;
  const ax = r + 6, ay = h / 2;
  const bx = w - r - 6, by = h / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: h, display: "block", overflow: "visible" }}>
      <motion.line
        x1={ax} y1={ay} x2={bx} y2={by}
        stroke={accent} strokeWidth={1.6}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.5 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
      <motion.circle
        r={3} fill={accent}
        initial={{ opacity: 0, cx: ax, cy: ay }}
        animate={{ opacity: [0, 1, 1, 0], cx: [ax, ax, bx, bx], cy: [ay, ay, by, by] }}
        transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.9, delay: 0.8, ease: "easeInOut", times: [0, 0.08, 0.92, 1] }}
      />
      <motion.circle
        cx={ax} cy={ay} r={r} fill={accentSoft} stroke={accent} strokeOpacity={0.5} strokeWidth={1.2}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.4, ease: "backOut" }}
        style={{ transformOrigin: `${ax}px ${ay}px` }}
      />
      <motion.circle
        cx={bx} cy={by} r={r} fill={accentSoft} stroke={accent} strokeOpacity={0.5} strokeWidth={1.2}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.4, delay: 0.15, ease: "backOut" }}
        style={{ transformOrigin: `${bx}px ${by}px` }}
      />
      <text x={ax} y={ay} textAnchor="middle" dominantBaseline="central" style={{ ...sans, fontSize: 8.5, fontWeight: 700, fill: ink }}>{aLabel}</text>
      <text x={bx} y={by} textAnchor="middle" dominantBaseline="central" style={{ ...sans, fontSize: 8.5, fontWeight: 700, fill: ink }}>{bLabel}</text>
    </svg>
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

// Generic layout for a live, arbitrary-length belief graph (the demo chart
// above uses 5 hand-placed positions; real data grows one node at a time,
// so this needs a rule instead of fixed coordinates). Radius still encodes
// evidenceCount via sqrt — same "area, not radius, is what the eye compares"
// rule as the demo chart.
function layoutBeliefNodes(items: { evidenceCount: number }[]) {
  const cx = 150, cy = 132;
  const maxV = Math.max(1, ...items.map((it) => it.evidenceCount || 1));
  const maxR = 50, minR = 26;
  const sizeOf = (v: number) => minR + (maxR - minR) * Math.sqrt((v || 1) / maxV);
  if (items.length === 1) return [{ x: cx, y: cy, r: sizeOf(items[0].evidenceCount) }];
  const ringR = items.length <= 3 ? 68 : items.length <= 5 ? 92 : 108;
  return items.map((it, i) => {
    const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * ringR, y: cy + Math.sin(angle) * ringR, r: sizeOf(it.evidenceCount) };
  });
}

// The "brain network" view: same bubbles, plus lines wherever the model
// found two beliefs share a root cause. Lines render first so bubbles sit
// on top of them.
// Synapses, not just lines: each connection draws itself in on mount, then a
// small pulse keeps traveling along it — a standing "signal" between the two
// beliefs it links, instead of a static diagram.
function BeliefNetworkChart({ beliefs, connections }: { beliefs: StoredBelief[]; connections: StoredConnection[] }) {
  const positioned = layoutBeliefNodes(beliefs).map((pos, i) => ({ ...beliefs[i], ...pos }));
  const byId = new Map(positioned.map((b) => [b.id, b]));
  return (
    <svg viewBox="6 6 288 248" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {connections.map((c, i) => {
        const a = byId.get(c.a);
        const b = byId.get(c.b);
        if (!a || !b) return null;
        return (
          <React.Fragment key={i}>
            <motion.line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={accent} strokeWidth={1.4}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.4 }}
              transition={{ duration: 0.9, delay: 0.15 * i, ease: "easeOut" }}
            />
            <motion.circle
              r={2.6} fill={accent}
              initial={{ opacity: 0, cx: a.x, cy: a.y }}
              animate={{ opacity: [0, 1, 1, 0], cx: [a.x, a.x, b.x, b.x], cy: [a.y, a.y, b.y, b.y] }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.1, delay: 1 + 0.15 * i, ease: "easeInOut", times: [0, 0.08, 0.92, 1] }}
            />
          </React.Fragment>
        );
      })}
      {positioned.map((b) => (
        <circle key={b.id} cx={b.x} cy={b.y} r={b.r} fill={accentSoft} stroke={accent} strokeOpacity={0.4} strokeWidth={1.2} />
      ))}
      {positioned.map((b) => (
        <React.Fragment key={`${b.id}-text`}>
          <text x={b.x} y={b.y - 3} textAnchor="middle" dominantBaseline="central" style={{ ...sans, fontSize: Math.max(b.r * 0.24, 9), fontWeight: 700, fill: ink }}>{b.domain}</text>
          <text x={b.x} y={b.y + Math.max(b.r * 0.3, 12)} textAnchor="middle" dominantBaseline="central" style={{ ...mono, fontSize: Math.max(b.r * 0.16, 7.5), fontWeight: 600, fill: mid }}>{b.evidenceCount}건</text>
        </React.Fragment>
      ))}
    </svg>
  );
}

// Belief Map and Recurring Assumptions used to be two separate screens, but
// a belief ("안전이 최우선이다") and an assumption ("불확실할 때 → 기다리는
//게 안전하다") are the same kind of thing at different specificity — one
// screen now, sectioned, instead of two nearly-redundant ones.
function ScreenBeliefMap({ onBack, store }: { onBack?: () => void; store?: Store }) {
  const live = !!store && store.beliefs.length > 0;
  const liveAssumptions = !!store && store.assumptions.length > 0;
  const assumptionItems = liveAssumptions ? store!.assumptions : ASSUMPTIONS;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>무의식적 패턴</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
          {live ? "당신이 스스로 안다고 생각하지 못한 채, 실제 말과 행동에서 반복적으로 드러난 것들이에요." : "당신의 결정을 실제로 이끄는 것으로 보이지만, 스스로는 미처 의식하지 못하고 있을 수 있는 것들이에요."}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {live ? <BeliefNetworkChart beliefs={store!.beliefs} connections={store!.connections} /> : <BeliefBubbleChart />}

        <div style={{ marginTop: 20 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>핵심 무의식적 신념</div>
          <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            "이렇게 믿는다"고 스스로 말하는 게 아니라, 상황과 관계없이 실제 선택과 말에서 반복적으로 드러나는 배경이에요. 원의 크기·막대 길이는 실제 근거 건수예요.
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          {(live ? store!.beliefs : BELIEFS).map((b: any) => (
            <div key={live ? b.id : b.label} style={{ padding: "16px 0", borderBottom: `1px solid ${hair}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: subtle, letterSpacing: "0.04em" }}>{b.domain}</span>
                <span style={{ ...mono, fontSize: 11, color: faint }}>근거 {b.evidenceCount}건</span>
              </div>
              <div style={{ ...serif, fontSize: 18, color: ink, marginTop: 8, lineHeight: 1.4, wordBreak: "keep-all" }}>{live ? b.statement : b.label}</div>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: hair, marginTop: 10 }}>
                <div style={{ height: "100%", width: `${live ? b.confidence : b.strength}%`, borderRadius: 2, backgroundColor: accent }} />
              </div>
              {live && b.evidenceQuotes?.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...b.evidenceQuotes].reverse().slice(0, 2).map((q: StoredEvidenceQuote, qi: number) => (
                    <div key={qi} style={{ ...sans, fontSize: 12, color: subtle, lineHeight: 1.5, wordBreak: "keep-all" }}>
                      <span style={{ ...mono, fontSize: 10.5, color: faint }}>{q.date}</span> · "{q.quote}"
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: accentSoft, borderLeft: `2px solid ${accent}` }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.04em" }}>무의식적 신념과 해석, 뭐가 다른가요</div>
          <div style={{ ...sans, fontSize: 12.5, color: inkSoft, marginTop: 8, lineHeight: 1.65, wordBreak: "keep-all" }}>
            무의식적 신념은 스스로 자각하지 못한 채 늘 배경에서 작동하는 것이고, 무의식적 해석은 그게 특정 순간(트리거)마다 실제 말과 행동으로 튀어나오는 구체적인 반응이에요. 무의식적 신념은 "왜 그런지"이고, 무의식적 해석은 "그게 실제로 벌어지는 순간"인 셈이에요. 예를 들어 위의 "{live ? store!.beliefs[0]?.statement ?? "완벽해야 시작할 수 있다" : "완벽해야 시작할 수 있다"}"는 무의식적 신념이, 아래처럼 "새로운 걸 시작해야 할 때 → 아직 준비가 안 됐다며 미룬다"는 무의식적 해석으로 매번 구체적인 행동에 나타나는 식이에요.
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>반복되는 무의식적 해석</div>
          <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            "이런 상황에서 → 이렇게 자동으로 해석하고 행동한다"는 순간들이에요. 무의식적 신념보다 더 구체적이고, 실제로 관찰되는 트리거가 있어요.
          </div>
          <div style={{ marginTop: 12 }}>
            {assumptionItems.map((a: any, i: number) => (
              <div key={liveAssumptions ? a.id : a.trigger} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: i < assumptionItems.length - 1 ? `1px solid ${hair}` : "none" }}>
                <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: accent, lineHeight: 1.3, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: subtle }}>{a.trigger}</span>
                    <span style={{ ...serif, fontSize: 16, color: ink, lineHeight: 1.4, wordBreak: "keep-all" }}>→ {a.interpretation}</span>
                  </div>
                  {!liveAssumptions && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {a.domains.map((d: string) => (
                        <span key={d} style={{ ...sans, fontSize: 11, color: mid, backgroundColor: surface, padding: "3px 9px", borderRadius: 999 }}>{d}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ ...sans, fontSize: 11, color: faint, marginTop: 8 }}>{a.count}번의 대화에서 발견</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {live && store!.connections.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>발견된 연결</div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {store!.connections.map((c, i) => {
                const from = store!.beliefs.find((b) => b.id === c.a);
                const to = store!.beliefs.find((b) => b.id === c.b);
                if (!from || !to) return null;
                return (
                  <div key={i} style={{ padding: "12px 14px", borderRadius: 12, backgroundColor: accentSoft }}>
                    <ConnectionSpark aLabel={from.domain} bLabel={to.domain} />
                    <div style={{ ...sans, fontSize: 13, color: inkSoft, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>{c.note}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

function ScreenDrift({ onBack, store, onSetupAspiration }: { onBack?: () => void; store?: Store; onSetupAspiration?: () => void }) {
  const hasAspiration = !!store?.aspiration;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>목표와의 거리</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
          되고 싶다고 말했던 사람과, 최근 실제 패턴 사이의 거리예요.
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px" }}>
        {hasAspiration ? (
          <>
            <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${hair}` }}>
              <div style={{ ...mono, fontSize: 11, color: faint }}>{store!.aspirationSetDate}, 당신이 한 말</div>
              <div style={{ ...serif, fontSize: 17, fontStyle: "italic", color: inkSoft, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>
                "{store!.aspiration}"
              </div>
              <motion.span role="button" tabIndex={0} onClick={onSetupAspiration} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 12, color: accent, cursor: "pointer", display: "inline-block", marginTop: 10 }}>
                다시 설정하기
              </motion.span>
            </div>
            {store!.driftNotes.length === 0 ? (
              <div style={{ ...sans, fontSize: 13.5, color: mid, lineHeight: 1.7, wordBreak: "keep-all" }}>
                아직 비교할 만큼 기록이 쌓이지 않았어요. 생각을 몇 번 더 남기면, 실제 패턴과 이 말 사이의 거리를 보여드릴게요.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[...store!.driftNotes].reverse().map((d, i) => (
                  <div key={i} style={{ padding: 16, borderRadius: 14, backgroundColor: surface }}>
                    <div style={{ ...mono, fontSize: 11, color: faint }}>{d.date}</div>
                    <div style={{ ...sans, fontSize: 14, color: inkSoft, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>{d.note}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div
              role="button" tabIndex={0} onClick={onSetupAspiration}
              style={{ padding: 16, borderRadius: 14, backgroundColor: accentSoft, borderLeft: `2px solid ${accent}`, marginBottom: 24, cursor: "pointer" }}
            >
              <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: accent }}>당신이 되고 싶은 모습을 알려주세요</div>
              <div style={{ ...sans, fontSize: 12.5, color: inkSoft, marginTop: 6, lineHeight: 1.6, wordBreak: "keep-all" }}>
                한 문장만 남겨주시면, 실제로 쌓인 기록과 그 말 사이의 거리를 계속 보여드릴게요. (아래는 그 예시예요.)
              </div>
            </div>
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
          </>
        )}
      </div>
    </div>
  );
}

// ── Screen 10.5 · Aspiration setup ────────────────────────────────────────────
function ScreenAspirationSetup({ initialValue, onBack, onSave }: { initialValue?: string | null; onBack?: () => void; onSave?: (value: string) => void }) {
  const [value, setValue] = React.useState(initialValue ?? "");
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 24, color: ink, marginTop: 10, lineHeight: 1.4, wordBreak: "keep-all" }}>당신은 어떤 사람이 되고 싶나요?</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all" }}>
          앞으로 남기는 생각들과 이 말을 계속 비교해드릴게요.
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "8px 22px 0", display: "flex" }}>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="예: 안정보다 도전을 선택하는 사람이 되고 싶어."
          style={{
            ...serif, flex: 1, width: "100%", resize: "none", border: "none", outline: "none",
            backgroundColor: "transparent", color: ink, fontSize: 19, lineHeight: 1.7,
            wordBreak: "keep-all",
          }}
        />
      </div>
      <div style={{ padding: "0 22px 32px", flexShrink: 0 }}>
        <PrimaryBtn disabled={!value.trim()} onClick={() => onSave?.(value.trim())}>저장</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Screen 11 · Active Hypotheses ─────────────────────────────────────────────
function hypothesesLive(store?: Store) {
  return !!store && store.hypotheses.length > 0;
}

function ScreenHypotheses({ onBack, onOpen, store }: { onBack?: () => void; onOpen?: (i: number) => void; store?: Store }) {
  const live = hypothesesLive(store);
  const items = live ? store!.hypotheses : HYPOTHESES;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>AI의 가설</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6, lineHeight: 1.5 }}>확실하지 않습니다. 동의/반박하며 함께 다듬어가요.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {items.map((h: any, i: number) => (
          <motion.div
            key={live ? h.id : h.title} role="button" tabIndex={0} onClick={() => onOpen?.(i)} whileTap={{ scale: 0.99, opacity: 0.9 }}
            style={{ padding: "18px 0", borderBottom: i < items.length - 1 ? `1px solid ${hair}` : "none", cursor: "pointer" }}
          >
            <div style={{ ...serif, fontSize: 16, color: ink, lineHeight: 1.5, wordBreak: "keep-all" }}>{h.title}</div>
            <div style={{ marginTop: 12 }}>
              <ConfidenceBar value={h.confidence} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {h.domains.map((d: string) => (
                <span key={d} style={{ ...sans, fontSize: 11, color: mid, backgroundColor: surface, padding: "3px 9px", borderRadius: 999 }}>{d}</span>
              ))}
            </div>
            {live && h.reaction && (
              <div style={{ ...sans, fontSize: 11, color: h.reaction === "agree" ? accent : tension, marginTop: 8 }}>
                {h.reaction === "agree" ? "동의함" : "아니라고 답함"}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Screen 12 · Hypothesis detail ─────────────────────────────────────────────
function ScreenHypothesisDetail({ index, onBack, onInvestigate, onReact, store }: { index: number; onBack?: () => void; onInvestigate?: () => void; onReact?: (reaction: "agree" | "disagree") => void; store?: Store }) {
  const live = hypothesesLive(store);
  const h: any = live ? (store!.hypotheses[index] ?? store!.hypotheses[0]) : (HYPOTHESES[index] ?? HYPOTHESES[0]);
  const [localReaction, setLocalReaction] = React.useState<null | "agree" | "disagree">(null);
  const reaction = live ? h.reaction : localReaction;
  const setReaction = (r: "agree" | "disagree") => {
    if (live) onReact?.(r);
    else setLocalReaction(r);
  };
  const question = live ? "이 통찰이 지금 당신에게 도움이 되고 있나요, 아니면 제한하고 있나요?" : h.question;
  const liveEvidence = live && Array.isArray(h.relatedBeliefIds)
    ? h.relatedBeliefIds
        .map((id: string) => store!.beliefs.find((b) => b.id === id))
        .filter((b: StoredBelief | undefined): b is StoredBelief => !!b)
        .flatMap((b: StoredBelief) => b.evidenceQuotes.map((q) => ({ ...q, domain: b.domain })))
        .sort((a: StoredEvidenceQuote, b: StoredEvidenceQuote) => (a.date < b.date ? 1 : -1))
        .slice(0, 5)
    : [];
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
          {h.domains.map((d: string) => (<span key={d} style={{ ...sans, fontSize: 11, color: mid, backgroundColor: surface, padding: "3px 9px", borderRadius: 999 }}>{d}</span>))}
        </div>

        {!live && (
          <div style={{ marginTop: 26 }}>
            <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>근거가 된 대화들</div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              {h.evidence.map((e: any) => (
                <div key={e.date} style={{ padding: 14, borderRadius: 12, backgroundColor: surface }}>
                  <div style={{ ...mono, fontSize: 11, color: faint }}>{e.date}</div>
                  <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: inkSoft, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{e.quote}"</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {live && liveEvidence.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>근거가 된 대화들</div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              {liveEvidence.map((e: StoredEvidenceQuote & { domain: string }, i: number) => (
                <div key={i} style={{ padding: 14, borderRadius: 12, backgroundColor: surface }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ ...mono, fontSize: 11, color: faint }}>{e.date}</span>
                    <span style={{ ...sans, fontSize: 10, color: mid, backgroundColor: accentSoft, padding: "2px 8px", borderRadius: 999 }}>{e.domain}</span>
                  </div>
                  <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: inkSoft, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{e.quote}"</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: accentSoft, borderLeft: `2px solid ${accent}` }}>
          <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: ink, lineHeight: 1.65, wordBreak: "keep-all" }}>{question}</div>
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
function ScreenHistory({ onNavSelect, store, onOpenEntry }: { onNavSelect?: (id: string) => void; store?: Store; onOpenEntry?: (index: number) => void }) {
  const live = !!store && store.history.length > 0;
  const items = live ? [...store!.history].reverse() : HISTORY_LOG;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <div style={{ ...serif, fontSize: 26, color: ink }}>기록</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6 }}>지금까지 나눈 생각들이에요.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {items.map((h: any, i: number) => (
          <motion.div
            key={live ? `${h.date}-${i}` : h.date} role="button" tabIndex={0} onClick={() => onOpenEntry?.(i)} whileTap={{ opacity: 0.6 }}
            style={{ padding: "16px 0", borderBottom: `1px solid ${hair}`, cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...mono, fontSize: 12, color: faint }}>{h.date}</span>
              {!live && <span style={{ ...mono, fontSize: 11, color: faint }}>{h.duration}</span>}
            </div>
            <div style={{ ...sans, fontSize: 14, color: inkSoft, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>{live ? h.text : h.excerpt}</div>
          </motion.div>
        ))}
      </div>
      <BottomNav active="history" onSelect={onNavSelect} />
    </div>
  );
}

// ── Screen 13.5 · History entry detail ────────────────────────────────────────
function ScreenHistoryDetail({ index, store, onBack }: { index: number; store?: Store; onBack?: () => void }) {
  const live = !!store && store.history.length > 0;
  const items = live ? [...store!.history].reverse() : HISTORY_LOG;
  const entry: any = items[index] ?? items[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ ...mono, fontSize: 12, color: faint }}>{entry.date}</span>
          {!live && <span style={{ ...mono, fontSize: 11, color: faint }}>{entry.duration}</span>}
        </div>
        <div style={{ ...serif, fontSize: 19, color: ink, marginTop: 16, lineHeight: 1.7, wordBreak: "keep-all" }}>
          {live ? entry.text : entry.excerpt}
        </div>
      </div>
    </div>
  );
}

// ── Screen 14 · Profile ────────────────────────────────────────────────────────
function ScreenProfile({ onNavSelect, store, onOpenSettings }: { onNavSelect?: (id: string) => void; store?: Store; onOpenSettings?: (screen: "notifications" | "dataPrivacy" | "help") => void }) {
  const live = !!store && store.entryCount > 0;
  const rows: { label: string; onClick?: () => void }[] = [
    { label: "알림", onClick: () => onOpenSettings?.("notifications") },
    { label: "데이터와 개인정보", onClick: () => onOpenSettings?.("dataPrivacy") },
    { label: "도움말", onClick: () => onOpenSettings?.("help") },
    { label: "로그아웃", onClick: onNavSelect ? () => onNavSelect("auth") : undefined },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px 22px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: surface }} />
          <div style={{ ...serif, fontSize: 20, color: ink, marginTop: 12 }}>{store?.account?.name || "익명의 관찰자"}</div>
          <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4 }}>
            {store?.account?.email ? `${store.account.email} · ` : ""}대화 {live ? store!.entryCount : 47}회
          </div>
        </div>
        <div style={{ marginTop: 28 }}>
          {rows.map((r, i) => (
            <motion.div
              key={r.label} role="button" tabIndex={0} onClick={r.onClick} whileTap={{ opacity: 0.6 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 0", borderBottom: i < rows.length - 1 ? `1px solid ${hair}` : "none", cursor: "pointer" }}
            >
              <span style={{ ...sans, fontSize: 15, color: r.label === "로그아웃" ? tension : inkSoft }}>{r.label}</span>
              <span style={{ ...sans, fontSize: 14, color: faint }}>›</span>
            </motion.div>
          ))}
        </div>
      </div>
      <BottomNav active="profile" onSelect={onNavSelect} />
    </div>
  );
}

// ── Screen 14.1 · Notification settings ───────────────────────────────────────
function SettingsToggle({ label, note, value, onChange }: { label: string; note?: string; value: boolean; onChange?: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 0", borderBottom: `1px solid ${hair}` }}>
      <div style={{ paddingRight: 16 }}>
        <div style={{ ...sans, fontSize: 15, color: ink }}>{label}</div>
        {note && <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 3, lineHeight: 1.5, wordBreak: "keep-all" }}>{note}</div>}
      </div>
      <motion.div
        role="button" tabIndex={0} onClick={() => onChange?.(!value)} whileTap={{ scale: 0.95 }}
        style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: value ? accent : hair, flexShrink: 0, padding: 3, cursor: "pointer", display: "flex", justifyContent: value ? "flex-end" : "flex-start" }}
      >
        <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff" }} />
      </motion.div>
    </div>
  );
}

function ScreenNotificationSettings({ settings, onBack, onChange }: { settings: StoredSettings; onBack?: () => void; onChange?: (settings: StoredSettings) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>알림</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <SettingsToggle
          label="매일 리마인더"
          note="하루에 한 번, 오늘 있었던 생각을 남겨보라고 알려드려요."
          value={settings.dailyReminder}
          onChange={(v) => onChange?.({ ...settings, dailyReminder: v })}
        />
        <SettingsToggle
          label="새 가설 알림"
          note="AI가 새로운 패턴을 발견했을 때 알려드려요."
          value={settings.newHypothesisAlert}
          onChange={(v) => onChange?.({ ...settings, newHypothesisAlert: v })}
        />
        <SettingsToggle
          label="주간 요약"
          note="일주일간 쌓인 무의식적 신념과 변화를 한 번에 정리해드려요."
          value={settings.weeklySummary}
          onChange={(v) => onChange?.({ ...settings, weeklySummary: v })}
        />
      </div>
    </div>
  );
}

// ── Screen 14.2 · Data & privacy ───────────────────────────────────────────────
function ScreenDataPrivacy({ store, onBack, onResetData }: { store?: Store; onBack?: () => void; onResetData?: () => void }) {
  const [armed, setArmed] = React.useState(false);
  const s = store;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>데이터와 개인정보</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <div style={{ ...sans, fontSize: 13.5, color: mid, lineHeight: 1.75, wordBreak: "keep-all" }}>
          이 앱은 별도 서버에 계정을 만들지 않아요. 무의식적 신념·해석, 대화 기록은 전부 이 기기의 브라우저 안에만 저장됩니다. "생각 말하기"로 남긴 텍스트는 분석하는 순간에만 Claude(Anthropic)로 전송되고, 그 외에는 어디로도 나가지 않아요.
        </div>

        <div style={{ marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: surface }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>이 기기에 저장된 데이터</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["무의식적 신념", s?.beliefs.length ?? 0],
              ["반복되는 무의식적 해석", s?.assumptions.length ?? 0],
              ["무의식적 신념 사이의 연결", s?.connections.length ?? 0],
              ["대화 기록", s?.history.length ?? 0],
              ["AI의 가설", s?.hypotheses.length ?? 0],
            ].map(([label, count]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ ...sans, fontSize: 13, color: inkSoft }}>{label}</span>
                <span style={{ ...mono, fontSize: 13, color: mid }}>{count}개</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <div
            role="button" tabIndex={0}
            onClick={() => (armed ? onResetData?.() : setArmed(true))}
            style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${armed ? tension : hair}`, backgroundColor: armed ? "rgba(181,83,60,0.08)" : "transparent", cursor: "pointer" }}
          >
            <span style={{ ...sans, fontSize: 14, fontWeight: 600, color: tension }}>
              {armed ? "정말요? 다시 누르면 완전히 삭제돼요" : "내 데이터 모두 삭제"}
            </span>
          </div>
          {armed && (
            <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 8, lineHeight: 1.5 }}>
              이 기기에 저장된 무의식적 신념·해석, 대화 기록, 목표 설정이 모두 사라져요. 되돌릴 수 없어요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Screen 14.3 · Help ─────────────────────────────────────────────────────────
const HELP_ITEMS = [
  { q: "이 앱은 무엇을 하나요?", a: "지난 일을 기록하는 일기장이 아니에요. 시간이 지날수록 당신이 왜 그렇게 생각하고 행동하는지 — 스스로도 의식하지 못한 채 실제 말과 행동에서 반복되는 무의식적 신념·해석 — 을 조용히 비춰주는 도구예요." },
  { q: "'생각 말하기'는 어떻게 쓰나요?", a: "정리하지 마세요. 오늘 있었던 일, 갑자기 든 생각, 아직 결정 못한 것 — 떠오르는 순서 그대로 말하거나 적으면 돼요. 음성은 브라우저 내장 인식을, 텍스트는 직접 타이핑을 지원해요." },
  { q: "무의식적 패턴은 뭔가요?", a: "당신도 미처 의식하지 못한 채 실제 결정을 이끄는 것으로 보이는 무의식적 신념을, 근거가 쌓일수록 커지는 원으로 보여줘요. 그 아래엔 '반복되는 무의식적 해석'이 있어요 — 특정 상황마다 자동으로 튀어나오는 해석이에요. 원 사이의 선은 서로 같은 뿌리에서 나온 것으로 보이는 무의식적 신념들의 연결이에요." },
  { q: "AI의 가설은 무의식적 신념과 뭐가 다른가요?", a: "무의식적 신념은 '실제 말과 행동에서 반복적으로 드러나는 것' 그 자체고, 가설은 여러 무의식적 신념/연결을 가로질러 AI가 내놓는 상위 이론이에요 (예: '이 패턴이 커리어와 관계 모두에서 같은 방식으로 나타나요'). 확정된 사실이 아니라 동의/반박하며 함께 다듬어가는 해석이에요." },
  { q: "목표와의 거리는 어떻게 계산되나요?", a: "당신이 되고 싶다고 말한 모습과, 실제로 쌓인 무의식적 신념·해석 사이의 구체적인 간극을 AI가 짚어드려요. 목표는 이 화면에서 직접 설정해요." },
];

function ScreenHelp({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>도움말</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
          당신의 마음에는 패턴이 있습니다. 안에서는 보이지 않을 뿐입니다.
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px" }}>
        {HELP_ITEMS.map((h, i) => (
          <div key={h.q} style={{ padding: "16px 0", borderBottom: i < HELP_ITEMS.length - 1 ? `1px solid ${hair}` : "none" }}>
            <div style={{ ...serif, fontSize: 16, color: ink, lineHeight: 1.4, wordBreak: "keep-all" }}>{h.q}</div>
            <div style={{ ...sans, fontSize: 13.5, color: mid, marginTop: 8, lineHeight: 1.65, wordBreak: "keep-all" }}>{h.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── App shell ──────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = React.useState("splash");
  const [hypothesisIndex, setHypothesisIndex] = React.useState(0);
  const [historyEntryIndex, setHistoryEntryIndex] = React.useState(0);
  const [thinkText, setThinkText] = React.useState("");
  const [analysis, setAnalysis] = React.useState<any>(null);
  const [analysisError, setAnalysisError] = React.useState("");
  const [store, setStore] = React.useState<Store>(() => loadStore());

  const goToTab = (id: string) => setScreen(id);

  let content: React.ReactNode = null;
  switch (screen) {
    case "splash": content = <ScreenSplash onDone={() => setScreen("auth")} />; break;
    case "auth": content = <ScreenAuth onEmailStart={() => setScreen(store.account ? "login" : "signup")} onGuest={() => setScreen("onboarding")} />; break;
    case "login": content = (
      <ScreenLogin
        account={store.account}
        onBack={() => setScreen("auth")}
        onGoSignup={() => setScreen("signup")}
        onLogin={() => setScreen("home")}
      />
    ); break;
    case "signup": content = (
      <ScreenSignup
        onBack={() => setScreen("auth")}
        onGoLogin={() => setScreen("login")}
        onSignup={(account) => {
          const next: Store = { ...store, account };
          setStore(next);
          saveStore(next);
          setScreen("onboarding");
        }}
      />
    ); break;
    case "onboarding": content = (
      <ScreenOnboarding
        initialAspiration={store.aspiration}
        onDone={(aspiration) => {
          if (aspiration && aspiration !== store.aspiration) {
            const next: Store = { ...store, aspiration, aspirationSetDate: formatDateDots(new Date()) };
            setStore(next);
            saveStore(next);
          }
          setScreen("home");
        }}
      />
    ); break;
    case "home": content = <ScreenHome onNavSelect={goToTab} onStartThink={() => setScreen("think")} onOpenArtifact={(id) => setScreen(id)} store={store} />; break;
    case "think": content = <ScreenThink onBack={() => setScreen("home")} onDone={(text) => { setThinkText(text); setAnalysis(null); setAnalysisError(""); setScreen("processing"); }} />; break;
    case "processing": content = (
      <ScreenProcessing
        text={thinkText}
        priorBeliefs={store.beliefs.map(({ domain, statement, confidence, evidenceCount }) => ({ domain, statement, confidence, evidenceCount }))}
        priorAssumptions={store.assumptions}
        priorConnections={store.connections.map((c) => ({
          aStatement: store.beliefs.find((b) => b.id === c.a)?.statement ?? "",
          bStatement: store.beliefs.find((b) => b.id === c.b)?.statement ?? "",
          note: c.note,
        }))}
        aspiration={store.aspiration}
        onDone={(result) => {
          if (result) {
            const merged = mergeAnalysisIntoStore(store, result, thinkText);
            setStore(merged);
            saveStore(merged);
            setAnalysis({
              beliefs: merged.beliefs,
              assumptions: merged.assumptions,
              connections: merged.connections.map((c) => ({
                aLabel: merged.beliefs.find((b) => b.id === c.a)?.domain ?? "?",
                bLabel: merged.beliefs.find((b) => b.id === c.b)?.domain ?? "?",
                note: c.note,
              })),
              reflection: result.reflection,
              changeNote: result.changeNote,
              metaInsight: result.metaInsight,
              driftNote: result.driftNote,
            });
          } else {
            setAnalysis(null);
          }
          setScreen("thinkComplete");
        }}
        onError={(msg) => { setAnalysisError(msg); setScreen("thinkComplete"); }}
      />
    ); break;
    case "thinkComplete": content = <ScreenThinkComplete analysis={analysis} error={analysisError} onDone={() => setScreen("home")} />; break;
    case "beliefs": content = <ScreenBeliefMap onBack={() => setScreen("home")} store={store} />; break;
    case "assumptions": content = <ScreenBeliefMap onBack={() => setScreen("home")} store={store} />; break;
    case "drift": content = <ScreenDrift onBack={() => setScreen("home")} store={store} onSetupAspiration={() => setScreen("aspirationSetup")} />; break;
    case "aspirationSetup": content = (
      <ScreenAspirationSetup
        initialValue={store.aspiration}
        onBack={() => setScreen("drift")}
        onSave={(value) => {
          const next: Store = { ...store, aspiration: value, aspirationSetDate: formatDateDots(new Date()) };
          setStore(next);
          saveStore(next);
          setScreen("drift");
        }}
      />
    ); break;
    case "hypotheses": content = <ScreenHypotheses onBack={() => setScreen("home")} store={store} onOpen={(i) => { setHypothesisIndex(i); setScreen("hypothesisDetail"); }} />; break;
    case "hypothesisDetail": content = (
      <ScreenHypothesisDetail
        index={hypothesisIndex}
        store={store}
        onBack={() => setScreen("hypotheses")}
        onInvestigate={() => setScreen("investigate")}
        onReact={(r) => {
          const next: Store = {
            ...store,
            hypotheses: store.hypotheses.map((h, i) => (i === hypothesisIndex ? { ...h, reaction: r } : h)),
          };
          setStore(next);
          saveStore(next);
        }}
      />
    ); break;
    case "investigate": content = <ScreenInvestigate index={hypothesisIndex} onBack={() => setScreen("hypothesisDetail")} />; break;
    case "history": content = (
      <ScreenHistory
        onNavSelect={goToTab}
        store={store}
        onOpenEntry={(i) => { setHistoryEntryIndex(i); setScreen("historyDetail"); }}
      />
    ); break;
    case "historyDetail": content = <ScreenHistoryDetail index={historyEntryIndex} store={store} onBack={() => setScreen("history")} />; break;
    case "profile": content = (
      <ScreenProfile
        onNavSelect={goToTab}
        store={store}
        onOpenSettings={(s) => setScreen(s === "notifications" ? "notifications" : s === "dataPrivacy" ? "dataPrivacy" : "help")}
      />
    ); break;
    case "notifications": content = (
      <ScreenNotificationSettings
        settings={store.settings}
        onBack={() => setScreen("profile")}
        onChange={(settings) => { const next: Store = { ...store, settings }; setStore(next); saveStore(next); }}
      />
    ); break;
    case "dataPrivacy": content = (
      <ScreenDataPrivacy
        store={store}
        onBack={() => setScreen("profile")}
        onResetData={() => {
          const next = emptyStore();
          setStore(next);
          saveStore(next);
          setScreen("profile");
        }}
      />
    ); break;
    case "help": content = <ScreenHelp onBack={() => setScreen("profile")} />; break;
    default: content = <ScreenHome onNavSelect={goToTab} onStartThink={() => setScreen("think")} onOpenArtifact={(id) => setScreen(id)} store={store} />;
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
