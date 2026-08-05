import React from "react";
import { motion, AnimatePresence } from "motion/react";
import NeuralBeliefGraph3D, { REGION_CONFIG, resolveRegion } from "./NeuralBeliefGraph3D";
import { CognitiveRegion, COGNITIVE_REGIONS } from "./neuralBrainLayout";
import {
  Store,
  StoredAccount,
  StoredAssumption,
  StoredBelief,
  StoredConnection,
  StoredEvidenceQuote,
  StoredHistoryEntry,
  StoredHypothesis,
  StoredSettings,
  emptyStore,
  formatDateDots,
} from "./types";
import { mergeAnalysisIntoStore } from "./realStore";
import { useAppData } from "./dataProvider";
import { COGNITIVE_PATTERN_DESCRIPTIONS, COGNITIVE_PATTERN_REFLECTIONS, DISCLAIMER_NOTICE, GENERIC_PATTERN_REFLECTION, findBeliefClusters, findContradictionPairs, matchableCandidates } from "./analysisFramework";

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
const tensionSoft = "rgba(181,83,60,0.08)";
// Apple-style "grouped list" elevation for cards sitting on the surface-tinted
// Analysis screen — a soft two-layer shadow instead of a border, so cards
// read as raised without needing a harder edge.
const cardShadow = "0 1px 2px rgba(28,27,31,0.05), 0 6px 18px rgba(28,27,31,0.045)";

// ── Dark theme — Home, Analysis, History, Profile, per the imported
// design spec (claude.ai/design project "Design spec for analysis page":
// 홈/분석/기록/프로필 화면.dc.html). Every other screen (온보딩, 로그인,
// 생각 말하기, etc.) still uses the light palette above — those weren't
// part of this import.
const dkBg = "#0a0716";
const dkCard = "#14101f";
const dkCardBorder = "rgba(150,120,255,0.10)";
const dkCardShadow = "0 8px 24px rgba(0,0,0,0.35)";
const dkHeading = "#F2EEFA";
const dkBody = "#8b83a3";
const dkBodyLight = "#E8E3F5";
const dkAccent = "#7B5CF0";
const dkAccentLight = "#B39CFF";
const dkAccentSoft = "rgba(123,92,240,0.14)";
const dkAccentTag = "rgba(123,92,240,0.22)";
const dkAccentTagText = "#D6C8FF";
const dkTrack = "#241c38";
const dkWarn = "#D98A4A";
const dkWarnSoft = "rgba(224,138,74,0.14)";
const dkWarnTag = "rgba(224,138,74,0.22)";
const dkWarnTagText = "#F0B78A";
const dkWarnLabel = "#B5652E";
const dkDivider = "rgba(150,120,255,0.14)";
// 기록/프로필 only — a faint scattered-star texture behind the flat dark
// background, straight from those two files' <style> block.
const dkStarfield: React.CSSProperties = {
  backgroundColor: dkBg,
  backgroundImage: [
    "radial-gradient(1.4px 1.4px at 12% 18%, rgba(255,255,255,.55), transparent 60%)",
    "radial-gradient(1px 1px at 32% 68%, rgba(255,255,255,.35), transparent 60%)",
    "radial-gradient(1.6px 1.6px at 55% 12%, rgba(200,180,255,.5), transparent 60%)",
    "radial-gradient(1px 1px at 72% 45%, rgba(255,255,255,.4), transparent 60%)",
    "radial-gradient(1.3px 1.3px at 88% 78%, rgba(180,150,255,.45), transparent 60%)",
    "radial-gradient(1px 1px at 8% 82%, rgba(255,255,255,.3), transparent 60%)",
    "radial-gradient(1.2px 1.2px at 95% 22%, rgba(255,255,255,.4), transparent 60%)",
  ].join(","),
  backgroundSize: "420px 420px",
  backgroundRepeat: "repeat",
};

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };
const sans = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

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

// Same parallel-session port as NavIcon below — a small waveform glyph for
// Home's "생각 말하기" button, replacing the plain dot with something that
// actually reads as "speak/record."
function WaveformIcon({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M4 10v4" />
        <path d="M8 7v10" />
        <path d="M12 4v16" />
        <path d="M16 7v10" />
        <path d="M20 10v4" />
      </g>
    </svg>
  );
}

// Real line icons for the bottom nav, ported from the friend's parallel
// session (odysseyof26's 8580f53) — a clear upgrade over the earlier
// colored-square/dot placeholders, with no functional conflict, so it's
// merged in on its own rather than picking one whole branch over the other.
function NavIcon({ id, color, size = 23 }: { id: string; color: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "home") {
    return (
      <svg {...common}>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
      </svg>
    );
  }
  if (id === "analysis") {
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="2.1" />
        <circle cx="17.5" cy="6" r="2.1" />
        <circle cx="12" cy="18.5" r="2.1" />
        <path d="M8.6 8.6 10.3 16.3M15.6 7.6 13.7 16.5M8.9 6.3l6.6-0.4" />
      </svg>
    );
  }
  if (id === "history") {
    return (
      <svg {...common}>
        <path d="M12 5.2c-1.5-1-3.6-1.5-5.5-1.2-.7.1-1.2.7-1.2 1.4v11.4c0 .9.8 1.5 1.6 1.4 1.8-.3 3.8.1 5.1 1 1.3-.9 3.3-1.3 5.1-1 .9.1 1.6-.5 1.6-1.4V5.4c0-.7-.5-1.3-1.2-1.4-1.9-.3-4 .2-5.5 1.2Z" />
        <path d="M12 5.2v12.6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="8.3" r="3.3" />
      <path d="M5.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6" />
    </svg>
  );
}

// ── Bottom navigation ─────────────────────────────────────────────────────────
// `dark` matches the imported design spec's nav (blurred near-black bar) —
// only Home/Analysis pass it; every other screen keeps the light bar. Both
// variants share the ported NavIcon set and the animated sliding selection
// pill (also from the friend's parallel session) instead of each having
// their own placeholder indicator.
function BottomNav({ active, onSelect, dark }: { active: string; onSelect?: (id: string) => void; dark?: boolean }) {
  const items = [
    { id: "home", label: "홈" },
    { id: "analysis", label: "마인드" },
    { id: "history", label: "기록" },
    { id: "profile", label: "프로필" },
  ];
  const activeColor = dark ? dkAccentLight : "#6B6EF6";
  const inactiveColor = dark ? "#726A8A" : "#8B8A92";
  const pillColor = dark ? "rgba(123,92,240,0.16)" : "#F0EEFF";
  return (
    <div
      style={{
        position: dark ? "sticky" : "static",
        bottom: dark ? 0 : undefined,
        display: "flex",
        borderTop: `1px solid ${dark ? dkDivider : hair}`,
        backgroundColor: dark ? "rgba(10,7,22,0.85)" : "rgba(255,255,255,0.82)",
        backdropFilter: "blur(12px)",
        padding: "8px 10px",
        flexShrink: 0,
      }}
    >
      {items.map((item) => {
        const isActive = active === item.id;
        const color = isActive ? activeColor : inactiveColor;
        return (
          <motion.div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(item.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect?.(item.id); }}
            whileTap={{ opacity: 0.7 }}
            style={{ flex: 1, position: "relative", display: "flex", justifyContent: "center", padding: "2px 4px", cursor: "pointer" }}
          >
            {isActive && (
              <motion.div
                layoutId={`navSelectedPill-${dark ? "dark" : "light"}`}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: "absolute", inset: "0 6px", borderRadius: 18, backgroundColor: pillColor, zIndex: 0 }}
              />
            )}
            <div style={{ position: "relative", zIndex: 1, minWidth: 44, minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <NavIcon id={item.id} color={color} />
              <span style={{ ...sans, fontSize: 10.5, fontWeight: isActive ? 600 : 400, color }}>{item.label}</span>
            </div>
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
function ConfidenceBar({ value, dark }: { value: number; dark?: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: dark ? dkBody : subtle, letterSpacing: "0.04em" }}>확신도</span>
        <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: dark ? dkAccent : accent }}>{value}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, backgroundColor: dark ? dkTrack : hair, marginTop: 6 }}>
        <div style={{ height: "100%", width: `${value}%`, backgroundColor: dark ? dkAccent : accent, borderRadius: 3 }} />
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
// ── Mindy (마인디) — the app's mascot. A quiet little companion defined by
// two things: the antenna (it's always listening) and the cape (it's
// always quietly working in the background). Same soft body language
// everywhere it appears — round head, dot eyes, no mouth by default — so
// it reads as one consistent character whether it's greeting someone at
// Splash or holding the "brain" steady while an entry is being analyzed.
// `dark` swaps its palette for dark (ink) backgrounds; left default for
// warm/cream/white ones — always call it with whichever matches the
// screen it's placed on, never mix.
function Mindy({
  pose = "idle",
  size = 120,
  dark = false,
  holding = false,
  expression = "neutral",
}: {
  pose?: "idle" | "connecting";
  size?: number;
  dark?: boolean;
  holding?: boolean;
  expression?: "neutral" | "happy" | "curious";
}) {
  const stroke = dark ? "#8A8590" : ink;
  const body = dark ? "#F4F1EC" : "#fff";
  const eye = dark ? "#403E45" : ink;
  const cape = dark ? "#463A63" : "#332A4D";
  return (
    <svg width={size} height={size * 1.3} viewBox="-14 -22 128 140" style={{ overflow: "visible" }}>
      <line x1="50" y1="18" x2="50" y2="-10" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <motion.circle
        cx="50" cy="-10" r="3.6" fill={accent}
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.2, 0.9] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "50px -10px" }}
      />

      {/* Cape — drawn behind the body so it just peeks out at the shoulders
          and below the feet, its one signature accessory. */}
      <path
        d="M 24 58 Q 6 96 16 128 Q 50 116 84 128 Q 94 96 76 58 Q 50 70 24 58 Z"
        fill={cape}
        stroke={dark ? "#5F517F" : "none"}
        strokeWidth={dark ? 1 : 0}
        opacity={dark ? 0.95 : 0.92}
      />

      <ellipse cx="38" cy="108" rx="9" ry="5" fill={body} stroke={stroke} strokeWidth="1.5" />
      <ellipse cx="62" cy="108" rx="9" ry="5" fill={body} stroke={stroke} strokeWidth="1.5" />
      <ellipse cx="18" cy="72" rx="7" ry="12" fill={body} stroke={stroke} strokeWidth="1.5" />
      <ellipse cx="82" cy="72" rx="7" ry="12" fill={body} stroke={stroke} strokeWidth="1.5" />
      <ellipse cx="50" cy="78" rx="27" ry="30" fill={body} stroke={stroke} strokeWidth="1.5" />
      <circle cx="50" cy="34" r="30" fill={body} stroke={stroke} strokeWidth="1.5" />

      {expression === "happy" ? (
        <>
          <path d="M 36 33 Q 40 28 44 33" fill="none" stroke={eye} strokeWidth="2" strokeLinecap="round" />
          <path d="M 56 33 Q 60 28 64 33" fill="none" stroke={eye} strokeWidth="2" strokeLinecap="round" />
          <path d="M 45 44 Q 50 48 55 44" fill="none" stroke={eye} strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : expression === "curious" ? (
        <>
          <ellipse cx="40" cy="35" rx="2.2" ry="4" fill={eye} />
          <ellipse cx="60" cy="32" rx="2.2" ry="4" fill={eye} />
        </>
      ) : (
        <>
          <ellipse cx="40" cy="34" rx="2.2" ry="4" fill={eye} />
          <ellipse cx="60" cy="34" rx="2.2" ry="4" fill={eye} />
        </>
      )}

      {/* Holding pose — a small glowing "brain" cradled at chest height,
          used while an entry is actively being analyzed. */}
      {holding && (
        <>
          <motion.circle
            cx="50" cy="76" r="11" fill={accent} opacity={0.18}
            animate={{ scale: [0.9, 1.15, 0.9] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "50px 76px" }}
          />
          <motion.circle
            cx="50" cy="76" r="5.5" fill={accent}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

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
        <Mindy dark size={92} />
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


// ── Screen 4 · Home ───────────────────────────────────────────────────────────
// Dark theme (see dk* tokens) — exclusively used by ScreenAnalysis, which
// is fully dark per the imported design spec, so this restyles in place
// rather than taking a `dark` prop.
function ArtifactTile({ label, teaser, badge, onClick }: { label: string; teaser: string; badge?: string; onClick?: () => void }) {
  return (
    <motion.div
      role="button" tabIndex={0} onClick={onClick} whileTap={{ scale: 0.98, opacity: 0.9 }}
      style={{ flex: 1, padding: "18px 16px", borderRadius: 20, backgroundColor: dkCard, border: `1px solid ${dkCardBorder}`, boxShadow: dkCardShadow, cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 13.5, fontWeight: 600, color: dkHeading }}>{label}</span>
        {badge && <span style={{ ...sans, fontSize: 10, fontWeight: 700, color: dkAccentLight, backgroundColor: dkAccentSoft, padding: "2px 7px", borderRadius: 999 }}>{badge}</span>}
      </div>
      <div style={{ ...sans, fontSize: 12, color: dkBody, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>{teaser}</div>
    </motion.div>
  );
}

// The one thing 오늘의 발견 can point at — either the freshest unreacted AI
// hypothesis (index into store.hypotheses) or, when there's no hypothesis
// yet, the strongest recurring belief (id into store.beliefs). Computed once
// here and reused by both Home (which only ever reads `.text`) and the
// Analysis tab (which renders the full body for whichever kind it is) —
// so the two places can never disagree about what "today's discovery" is.
type DiscoveryTarget = { kind: "hypothesis"; index: number; text: string } | { kind: "belief"; id: string; text: string };

function computeDiscovery(store: Store): DiscoveryTarget | null {
  const freshHypothesisIndex = store.hypotheses.findIndex((h) => h.reaction === null);
  if (freshHypothesisIndex >= 0) {
    return { kind: "hypothesis", index: freshHypothesisIndex, text: store.hypotheses[freshHypothesisIndex].title };
  }
  const topBelief = [...store.beliefs]
    .filter((b) => b.userReaction !== "rejected")
    .sort((a, b) => (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? "") || b.confidence - a.confidence)[0];
  return topBelief ? { kind: "belief", id: topBelief.id, text: topBelief.discoveryInterpretationOverride ?? topBelief.statement } : null;
}

// Re-derives a pinned DiscoveryTarget's display text from the live store
// (title/statement may have changed under a reinterpretation loop) without
// letting the identity itself drift — see ScreenAnalysis's `pinnedDiscovery`.
// Used so a discovery doesn't get silently swapped out mid-conversation the
// instant its reaction flips away from null (e.g. once reinterpretation is
// exhausted), which computeDiscovery's fresh-lookup alone would do.
function resolveDiscoveryTarget(store: Store, pinned: DiscoveryTarget): DiscoveryTarget | null {
  if (pinned.kind === "hypothesis") {
    const h = store.hypotheses[pinned.index];
    return h ? { kind: "hypothesis", index: pinned.index, text: h.title } : null;
  }
  const b = store.beliefs.find((x) => x.id === pinned.id);
  return b ? { kind: "belief", id: pinned.id, text: b.discoveryInterpretationOverride ?? b.statement } : null;
}

// ── Screen 4 · Home ────────────────────────────────────────────────────────────
// Single responsibility: capture and today's highlight. Everything that
// used to live below the fold here — recent thoughts, 무의식적 패턴, 목표와의
// 거리 — now belongs to History or Analysis; duplicating any of it here
// would give it two homes, which is exactly what this reorg is meant to
// remove. See ScreenAnalysis for where all of that moved.
//
// Dark theme, ported directly from the claude.ai/design spec (홈 화면.dc.html)
// — see the dk* tokens near the top of the file. The 3D brain's own card
// styling is left untouched (that component wasn't part of this import).
function ScreenHome({ onNavSelect, onStartThink, store }: { onNavSelect?: (id: string) => void; onStartThink?: () => void; store: Store }) {
  const brainClusters = React.useMemo(() => findBeliefClusters(store.beliefs, store.connections), [store.beliefs, store.connections]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 20px 24px" }}>
        {/* ── Hero: date, headline, brain, 생각 말하기 — nothing else. This is
            the whole first impression: "my thoughts become this brain." ── */}
        <div style={{ ...mono, fontSize: 12, color: "#7A7290" }}>{formatDateDots(new Date())}</div>
        <div style={{ ...serif, fontSize: 32, fontWeight: 400, lineHeight: 1.28, color: dkHeading, marginTop: 14, wordBreak: "keep-all" }}>
          오늘은 어떤 생각이<br />스쳐 지나갔나요?
        </div>

        <div style={{ marginTop: 28 }}>
          <NeuralBeliefGraph3D beliefs={store.beliefs} connections={store.connections} clusters={brainClusters} height={336} />
        </div>

        <div style={{ marginTop: 16 }}>
          <motion.div
            role="button" tabIndex={0} onClick={onStartThink} whileTap={{ scale: 0.98, opacity: 0.92 }}
            style={{ display: "flex", alignItems: "center", gap: 14, backgroundColor: dkCard, border: `1px solid ${dkCardBorder}`, borderRadius: 20, padding: "16px 18px", cursor: "pointer", boxShadow: dkCardShadow }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#2A2144", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <WaveformIcon color={dkAccentLight} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ ...sans, fontSize: 15, fontWeight: 700, color: dkHeading }}>생각 말하기</span>
              <span style={{ ...sans, fontSize: 12, color: "#8E85A6" }}>정리하지 않아도 괜찮아요</span>
            </div>
          </motion.div>
        </div>
      </div>
      <BottomNav active="home" onSelect={onNavSelect} dark />
    </div>
  );
}

// Per-region count of active beliefs, using the exact same region
// classification the 3D brain itself uses (resolveRegion, exported from
// NeuralBeliefGraph3D) — so this list can never disagree with what the
// brain above it is actually showing.
function RegionBreakdown({ beliefs }: { beliefs: StoredBelief[] }) {
  const counts = new Map<CognitiveRegion, number>();
  COGNITIVE_REGIONS.forEach((r) => counts.set(r, 0));
  beliefs.forEach((b) => counts.set(resolveRegion(b), (counts.get(resolveRegion(b)) ?? 0) + 1));
  const total = beliefs.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {COGNITIVE_REGIONS.map((region) => {
        const count = counts.get(region) ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={region} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: REGION_CONFIG[region].color, flexShrink: 0 }} />
            <span style={{ ...sans, fontSize: 13.5, color: dkBodyLight, flex: 1 }}>{REGION_CONFIG[region].label}</span>
            <span style={{ ...mono, fontSize: 12, color: dkBody }}>{count}개</span>
            <span style={{ ...mono, fontSize: 12, color: dkAccent, width: 36, textAlign: "right" }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// Every recorded entry's emotions, averaged by label across however many
// times each has shown up, ranked strongest first — the only distribution
// this can honestly show, since intensity is a per-entry 0–100 rating, not
// a running total. Entries without analysis yet (real data still catching
// up, or an entry that predates this field) are simply skipped.
function EmotionDistribution({ history }: { history: StoredHistoryEntry[] }) {
  const totals = new Map<string, { sum: number; count: number }>();
  history.forEach((entry) => {
    entry.analysis?.observation.emotions.forEach((em) => {
      const cur = totals.get(em.label) ?? { sum: 0, count: 0 };
      cur.sum += em.intensity;
      cur.count += 1;
      totals.set(em.label, cur);
    });
  });
  const rows = Array.from(totals.entries())
    .map(([label, { sum, count }]) => ({ label, avg: Math.round(sum / count), count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6);

  if (rows.length === 0) {
    return <div style={{ ...sans, fontSize: 13, color: dkBody }}>아직 감정 데이터가 없어요. 생각을 몇 번 남기면 여기에 나타나요.</div>;
  }

  const maxAvg = rows[0].avg || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ ...sans, fontSize: 13, color: dkBodyLight }}>{r.label}</span>
            <span style={{ ...mono, fontSize: 11.5, color: dkBody }}>{r.avg} · {r.count}회</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, backgroundColor: dkTrack, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(r.avg / maxAvg) * 100}%`, borderRadius: 4, backgroundColor: dkAccent }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// A reserved, clearly-labeled slot for an analysis module that doesn't
// exist yet — honest about what it is instead of shipping a fake chart
// with no real data behind it.
function ComingSoonRow({ label, last }: { label: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 2px", borderBottom: last ? "none" : `1px solid ${dkDivider}` }}>
      <span style={{ ...sans, fontSize: 13.5, color: "#5C5474" }}>{label}</span>
      <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: "#746C90", backgroundColor: "#201933", padding: "3px 9px", borderRadius: 999 }}>곧 추가돼요</span>
    </div>
  );
}

// The one shared agree/disagree control — used compactly in the hero (a
// quick read, available before the user has even scrolled) and again in
// the Reflection section further down (where disagreeing also asks what
// specifically didn't land). Both touchpoints read/write the exact same
// reaction, so they can never contradict each other about what the user
// actually said.
function ReactionButtons({ reaction, onReact, disabled, dark }: { reaction: "agree" | "disagree" | null | undefined; onReact?: (r: "agree" | "disagree") => void; disabled?: boolean; dark?: boolean }) {
  if (dark) {
    return (
      <div style={{ display: "flex", gap: 10, opacity: disabled ? 0.55 : 1 }}>
        <motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, backgroundColor: dkAccent, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 14, fontWeight: 600, color: "#fff" }}>동의해요</span>
        </motion.div>
        <motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, border: `1px solid ${dkCardBorder}`, backgroundColor: dkTrack, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 14, fontWeight: 600, color: dkBodyLight }}>아닌 것 같아요</span>
        </motion.div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 10, opacity: disabled ? 0.55 : 1 }}>
      <motion.div
        role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} whileTap={disabled ? undefined : { scale: 0.97 }}
        style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, border: `1px solid ${reaction === "agree" ? ink : hair}`, backgroundColor: reaction === "agree" ? ink : "transparent", cursor: disabled ? "default" : "pointer" }}
      >
        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: reaction === "agree" ? "#fff" : ink }}>동의해요</span>
      </motion.div>
      <motion.div
        role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} whileTap={disabled ? undefined : { scale: 0.97 }}
        style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, border: `1px solid ${reaction === "disagree" ? tension : hair}`, backgroundColor: reaction === "disagree" ? tension : "transparent", cursor: disabled ? "default" : "pointer" }}
      >
        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: reaction === "disagree" ? "#fff" : ink }}>아닌 것 같아요</span>
      </motion.div>
    </div>
  );
}

// The single interactive agree/disagree point for a discovery (the hero
// above just shows a static preview — see ScreenAnalysis). Disagreeing
// doesn't just record a reason anymore: it asks the model for a genuinely
// different reading of the same evidence and swaps the discovery's text
// in place, looping until the user agrees or the model has nothing more to
// offer (reinterpreting/exhausted, driven by rejectedStatements/
// rejectedTitles — see analysisFramework's /api/reinterpret).
function DiscoveryReflection({
  reaction,
  reinterpreting,
  exhausted,
  onReact,
}: {
  reaction: "agree" | "disagree" | null | undefined;
  reinterpreting?: boolean;
  exhausted?: boolean;
  onReact?: (r: "agree" | "disagree") => void;
}) {
  // Once a discovery is settled — agreed with, or reinterpretation
  // exhausted — there's nothing left to press, so the buttons themselves
  // go away instead of sitting there disabled. Only the still-open states
  // (fresh, or a reinterpretation in flight that might still land on
  // something to react to) keep showing them.
  const settled = reaction === "agree" || exhausted;
  return (
    <div>
      <p style={{ ...sans, fontSize: 15, color: dkBodyLight, margin: "0 0 6px", lineHeight: 1.5 }}>이 관찰이 지금 당신의 경험과 맞아떨어지나요?</p>
      {/* Observer-self framing (ACT: self-as-context) — agree/disagree here
          isn't a verdict on whether the thought is true, just whether this
          reading of it matches what was actually noticed. */}
      <p style={{ ...serif, fontStyle: "italic", fontSize: 13.5, color: "#948CB0", margin: "0 0 16px", lineHeight: 1.5, wordBreak: "keep-all" }}>
        이 생각을 믿을지 말지를 정하는 자리가 아니에요. 그저 지금의 나와 맞는지 살펴보는 거예요.
      </p>
      {reinterpreting && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0" }}>
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: dkAccent }}
          />
          <span style={{ ...sans, fontSize: 13, color: dkBody }}>다시 생각해보는 중이에요...</span>
        </div>
      )}
      {!settled && !reinterpreting && <ReactionButtons reaction={reaction} onReact={onReact} dark />}
      {settled && exhausted && (
        <p style={{ ...sans, fontSize: 13, color: dkBody, margin: "0 0 12px" }}>더 이상 새로운 해석을 만들어낼 수 없어요. 다음에 다시 살펴볼게요.</p>
      )}
      {settled && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: dkAccent, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✓</span>
          <span style={{ ...sans, fontSize: 13.5, color: dkBodyLight }}>{exhausted ? "지금은 여기까지 살펴봤어요." : "이 관찰을 받아들였어요."}</span>
        </div>
      )}
    </div>
  );
}

// A vertical "watch it develop" chain — origin, current understanding,
// and (when there's a real recorded one) an outcome — instead of a
// side-by-side then/now comparison. Only ever built from points that
// trace back to something actually recorded; never a fabricated midpoint.
function EvolutionTimeline({ points }: { points: { label: string; text: string; accent?: boolean }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {points.map((p, i) => {
        const hasNext = i < points.length - 1;
        return (
          <div key={i} style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14, flexShrink: 0 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: p.accent ? dkAccent : "#3A3350", flexShrink: 0, marginTop: 3 }} />
              {hasNext && <div style={{ width: 2, flex: 1, backgroundColor: dkDivider, minHeight: 28 }} />}
            </div>
            <div style={{ paddingBottom: 20 }}>
              <div style={{ ...mono, fontSize: 10.5, color: dkBody, marginBottom: 3 }}>{p.label}</div>
              <p style={{ ...serif, fontStyle: "italic", fontSize: 14.5, color: dkBodyLight, margin: 0, lineHeight: 1.4, wordBreak: "keep-all" }}>{p.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// A single evidence card — the extracted quote itself carries an accent
// left-border to read as "the relevant sentence," since the data model
// only ever stores the already-extracted quote, not a separate full
// original entry to highlight a sentence within.
function EvidenceQuoteCard({ date, quote, domain }: { date: string; quote: string; domain?: string }) {
  return (
    <div style={{ backgroundColor: dkAccentSoft, borderLeft: `3px solid ${dkAccent}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ ...mono, fontSize: 11, color: dkBody }}>{date}</span>
        {domain && <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: dkAccentTagText, backgroundColor: dkAccentTag, padding: "2px 8px", borderRadius: 999 }}>{domain}</span>}
      </div>
      <p style={{ ...serif, fontStyle: "italic", fontSize: 15, color: dkBodyLight, margin: 0, lineHeight: 1.45, wordBreak: "keep-all" }}>"{quote}"</p>
    </div>
  );
}

// The Analysis tab's one layout primitive — a raised white card on the
// screen's surface-tinted background (see ScreenAnalysis), Apple grouped-
// list style: elevation instead of a border does the work a thin `hair`
// divider used to (and couldn't, since surface-on-page is barely visible).
// Every section from "why" onward is one of these, so the page reads as
// distinct, scannable groups rather than one continuous flow of text.
function SectionCard({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: dkCard, border: `1px solid ${dkCardBorder}`, borderRadius: 20, padding: "22px 20px", boxShadow: dkCardShadow }}>
      {title && <div style={{ ...serif, fontSize: 19, color: dkHeading, marginBottom: subtitle ? 4 : 18 }}>{title}</div>}
      {subtitle && <div style={{ ...sans, fontSize: 12.5, color: dkBody, marginBottom: 16, lineHeight: 1.5, wordBreak: "keep-all" }}>{subtitle}</div>}
      {children}
    </div>
  );
}

// ── Screen 4.5 · Analysis ─────────────────────────────────────────────────────
// A guided conversation, not a report: the page answers exactly one
// question — "why did the AI reach this conclusion?" — and unfolds it in
// order, each section building on the last: Discovery → Evidence →
// Evolution → Brain → Reflection → Explore More. No AI interpretation
// lives anywhere else in the app now — this tab is its one home.
function ScreenAnalysis({
  onNavSelect,
  store,
  onOpenArtifact,
  onAgreeHypothesis,
  onDisagreeHypothesis,
  onInvestigateHypothesis,
  onAgreeBeliefDiscovery,
  onDisagreeBeliefDiscovery,
  reinterpretingKey,
}: {
  onNavSelect?: (id: string) => void;
  store: Store;
  onOpenArtifact?: (id: string) => void;
  onAgreeHypothesis?: (index: number) => void;
  onDisagreeHypothesis?: (index: number) => void;
  onInvestigateHypothesis?: (index: number) => void;
  onAgreeBeliefDiscovery?: (beliefId: string) => void;
  onDisagreeBeliefDiscovery?: (beliefId: string) => void;
  reinterpretingKey?: string | null;
}) {
  // Pinned once per visit to this screen so the discovery being discussed
  // never gets silently swapped out mid-conversation — see
  // resolveDiscoveryTarget.
  const [pinnedDiscovery] = React.useState<DiscoveryTarget | null>(() => computeDiscovery(store));
  const discovery = pinnedDiscovery ? resolveDiscoveryTarget(store, pinnedDiscovery) : null;
  const hasBeliefs = store.beliefs.length > 0;
  const hIndex = discovery?.kind === "hypothesis" ? discovery.index : null;
  const h = hIndex !== null ? store.hypotheses[hIndex] : null;
  const b = discovery?.kind === "belief" ? store.beliefs.find((x) => x.id === discovery.id) ?? null : null;

  // SECTION 4's "관련 활성 뉴런" — literally the beliefs related to *this*
  // discovery, not the whole brain (Home already shows that). A hypothesis
  // names its own relatedBeliefIds; a belief-kind discovery's "related"
  // set is itself plus anything connected to it. Falls back to the full
  // brain only if that set somehow comes up empty, so the card is never
  // just a blank field.
  const relatedBeliefIds = React.useMemo(() => {
    if (h) return new Set(h.relatedBeliefIds);
    if (b) {
      const linked = store.connections.filter((c) => c.a === b.id || c.b === b.id).map((c) => (c.a === b.id ? c.b : c.a));
      return new Set([b.id, ...linked]);
    }
    return new Set<string>();
  }, [h, b, store.connections]);
  const relatedBrainBeliefs = React.useMemo(() => {
    const filtered = store.beliefs.filter((belief) => relatedBeliefIds.has(belief.id));
    return filtered.length > 0 ? filtered : store.beliefs;
  }, [store.beliefs, relatedBeliefIds]);
  const relatedBrainConnections = React.useMemo(() => {
    if (relatedBeliefIds.size === 0) return store.connections;
    return store.connections.filter((c) => relatedBeliefIds.has(c.a) && relatedBeliefIds.has(c.b));
  }, [store.connections, relatedBeliefIds]);
  const relatedBrainClusters = React.useMemo(
    () => findBeliefClusters(relatedBrainBeliefs, relatedBrainConnections),
    [relatedBrainBeliefs, relatedBrainConnections]
  );

  // SECTION 2 — the strongest (most recent) three, shown chronologically.
  const rawEvidence: (StoredEvidenceQuote & { domain?: string })[] = h ? evidenceForHypothesis(h, store.beliefs) : b ? b.evidenceQuotes : [];
  const evidence = [...rawEvidence]
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .slice(0, 3)
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));

  // SECTION 2, secondary — still part of "why": honest about conflicting signal.
  const contradictoryEntries: { belief: StoredBelief; entry: StoredHistoryEntry }[] = h
    ? h.relatedBeliefIds
        .map((id) => store.beliefs.find((x) => x.id === id))
        .filter((x): x is StoredBelief => !!x)
        .flatMap((belief) => (belief.contradictoryEntryIds ?? []).map((id) => ({ belief, entry: store.history.find((e) => e.id === id) })))
        .filter((x): x is { belief: StoredBelief; entry: StoredHistoryEntry } => !!x.entry)
    : b
      ? (b.contradictoryEntryIds ?? [])
          .map((id) => store.history.find((e) => e.id === id))
          .filter((e): e is StoredHistoryEntry => !!e)
          .map((entry) => ({ belief: b, entry }))
      : [];

  // SECTION 3 — a real timeline: origin → today → outcome for a hypothesis
  // with an investigate trail; earliest → latest evidence for a belief.
  // Never invents a midpoint that isn't actually in the data.
  const evolutionPoints: { label: string; text: string; accent?: boolean }[] = h?.investigate
    ? [
        { label: h.investigate.origin.date, text: h.investigate.origin.quote },
        { label: "오늘", text: evidence[evidence.length - 1]?.quote ?? h.title },
        { label: h.investigate.compareLabel2, text: h.investigate.compareSteps2.join(" · "), accent: true },
      ]
    : b && b.evidenceQuotes.length >= 2
      ? (() => {
          const quotes = [...b.evidenceQuotes].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
          return [
            { label: quotes[0].date, text: quotes[0].quote },
            { label: quotes[quotes.length - 1].date, text: quotes[quotes.length - 1].quote, accent: true },
          ];
        })()
      : [];

  const reaction = h ? h.reaction : b ? b.discoveryReaction ?? null : null;
  const exhausted = h ? !!h.exhausted : b ? !!b.discoveryExhausted : false;
  const thisKey = hIndex !== null ? `hyp:${hIndex}` : b ? `belief:${b.id}` : null;
  const reinterpreting = !!thisKey && reinterpretingKey === thisKey;
  const handleReact = (r: "agree" | "disagree") => {
    if (r === "agree") {
      if (hIndex !== null) onAgreeHypothesis?.(hIndex);
      else if (b) onAgreeBeliefDiscovery?.(b.id);
    } else {
      if (hIndex !== null) onDisagreeHypothesis?.(hIndex);
      else if (b) onDisagreeBeliefDiscovery?.(b.id);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 24px" }}>
        <div style={{ padding: "8px 4px 20px" }}>
          <div style={{ ...serif, fontSize: 34, fontWeight: 400, color: dkHeading, marginBottom: 6 }}>마인드</div>
          <div style={{ ...sans, fontSize: 13, color: dkBody }}>AI가 지금까지 당신에 대해 알아낸 것들이에요 — 오늘 하루가 아니라, 쌓여온 시간 전체예요.</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* ── SECTION 1 · HERO — title, discovery, confidence. Nothing else. ── */}
          <SectionCard>
            {discovery ? (
              <>
                <div style={{ ...sans, fontSize: 11, fontWeight: 700, color: dkAccent, letterSpacing: "0.04em", marginBottom: 10 }}>오늘의 발견</div>
                {(h?.thoughtLabel || b?.thoughtLabel) && (
                  <p style={{ ...serif, fontStyle: "italic", fontSize: 16, color: "#9B8FC7", margin: "0 0 8px" }}>
                    '{h?.thoughtLabel || b?.thoughtLabel}' 생각이 또 나타났어요
                  </p>
                )}
                <p style={{ ...serif, fontSize: 24, lineHeight: 1.4, color: dkHeading, margin: "0 0 18px", wordBreak: "keep-all" }}>{discovery.text}</p>
                <div style={{ height: 1, backgroundColor: dkDivider, margin: "0 0 14px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ ...sans, fontSize: 12, fontWeight: 500, color: dkBody }}>확신도</span>
                  <span style={{ ...mono, fontSize: 13, fontWeight: 500, color: dkAccent }}>{h ? h.confidence : b?.confidence ?? 0}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, backgroundColor: dkTrack, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${h ? h.confidence : b?.confidence ?? 0}%`, borderRadius: 3, backgroundColor: dkAccent }} />
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 10px 8px", gap: 14 }}>
                <svg width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="44" fill="rgba(123,92,240,.16)" />
                  <circle cx="34" cy="44" r="5" fill={dkAccent} />
                  <circle cx="62" cy="44" r="5" fill={dkAccent} />
                  <path d="M36 60 Q48 68 60 60" stroke={dkAccent} strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
                <p style={{ ...sans, fontSize: 14, color: dkBody, lineHeight: 1.6, margin: 0, maxWidth: 260 }}>아직 발견된 것이 없어요. 생각을 몇 번 남기면 여기에 나타나요.</p>
              </div>
            )}
          </SectionCard>

          {discovery && (
            <>
              {/* ── SECTION 2 · WHY — only the strongest supporting evidence, chronological. ── */}
              <SectionCard title="왜 이런 해석이 나왔나요?" subtitle="당신이 실제로 이렇게 말한 부분들이에요.">
                {evidence.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {evidence.map((e, i) => (
                      <EvidenceQuoteCard key={i} date={e.date} quote={e.quote} domain={e.domain} />
                    ))}
                  </div>
                ) : (
                  <div style={{ ...sans, fontSize: 13, color: dkBody }}>아직 근거로 남길 만한 기록이 없어요.</div>
                )}

                {contradictoryEntries.length > 0 && (
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${dkDivider}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 13 }}>⚠</span>
                      <span style={{ ...sans, fontSize: 12.5, fontWeight: 600, color: dkWarnLabel }}>다른 방향의 기록도 있어요</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {contradictoryEntries.map(({ belief, entry }, i) => (
                        <div key={i} style={{ backgroundColor: dkWarnSoft, borderLeft: `3px solid ${dkWarn}`, borderRadius: 8, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ ...mono, fontSize: 11, color: dkBody }}>{entry.date}</span>
                            <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: dkWarnTagText, backgroundColor: dkWarnTag, padding: "2px 8px", borderRadius: 999 }}>{belief.domain}</span>
                          </div>
                          <p style={{ ...serif, fontStyle: "italic", fontSize: 15, color: dkBodyLight, margin: 0, lineHeight: 1.45, wordBreak: "keep-all" }}>"{entry.text}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* ── SECTION 3 · BELIEF EVOLUTION — watch the pattern develop over time. ── */}
              {evolutionPoints.length > 0 && (
                <SectionCard title="신념의 변화">
                  <EvolutionTimeline points={evolutionPoints} />
                </SectionCard>
              )}

              {/* ── SECTION 4 · RELATED NEURAL ACTIVITY — supporting evidence, not decoration, so it lives here, not at the top. ── */}
              <SectionCard title="관련 활성 뉴런">
                <NeuralBeliefGraph3D beliefs={relatedBrainBeliefs} connections={relatedBrainConnections} clusters={relatedBrainClusters} height={280} />
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${dkDivider}` }}>
                  <RegionBreakdown beliefs={relatedBrainBeliefs} />
                </div>
              </SectionCard>

              {/* ── SECTION 5 · USER REFLECTION — the considered version of the hero's quick react. ── */}
              <SectionCard>
                <DiscoveryReflection
                  reaction={reaction}
                  reinterpreting={reinterpreting}
                  exhausted={exhausted}
                  onReact={handleReact}
                />
                {h?.investigate && hIndex !== null && (
                  <motion.div
                    role="button" tabIndex={0} onClick={() => onInvestigateHypothesis?.(hIndex)} whileTap={{ opacity: 0.6 }}
                    style={{ marginTop: 14, width: "100%", boxSizing: "border-box", textAlign: "center", background: "transparent", border: "1.5px solid rgba(123,92,240,.35)", color: dkAccentLight, borderRadius: 12, padding: 12, ...sans, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
                  >
                    더 깊이 알아보기
                  </motion.div>
                )}
              </SectionCard>
            </>
          )}

          {/* ── SECTION 6 · EXPLORE MORE — secondary analysis, each its own independent page. ── */}
          <div style={{ ...sans, fontSize: 12, fontWeight: 700, color: dkBody, letterSpacing: "0.03em", padding: "6px 4px 2px" }}>더 깊이 보기</div>
          <div style={{ display: "flex", gap: 12 }}>
            <ArtifactTile
              label="무의식적 패턴"
              teaser={hasBeliefs ? "당신의 신념 지도를 살펴보세요" : "아직 드러난 패턴이 없어요."}
              onClick={() => onOpenArtifact?.("beliefs")}
            />
            <ArtifactTile
              label="목표와의 거리"
              teaser="지금의 나와 원하는 나 사이"
              onClick={() => onOpenArtifact?.("drift")}
            />
          </div>

          <SectionCard title="감정 분포" subtitle="기록된 감정들의 평균 강도예요.">
            <EmotionDistribution history={store.history} />
          </SectionCard>

          <SectionCard>
            <ComingSoonRow label="가치 변화" />
            <ComingSoonRow label="사고 패턴 (CBT)" last />
          </SectionCard>
        </div>
      </div>
      <BottomNav active="analysis" onSelect={onNavSelect} dark />
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

// A small pool of open reflective questions — one is picked at random each
// time this screen opens, instead of a single fixed prompt. Purely a
// client-side placeholder for now ("do not hardcode any example question"
// as the long-term goal): later this pool should come from the backend so
// it can adapt to what someone's actually been thinking about, but picking
// randomly + never repeating the immediately-prior one is what keeps it
// from feeling like a static form label in the meantime.
const THINK_PROMPTS = [
  "오늘 가장 오래 남았던 생각은 무엇인가요?",
  "계속 머릿속을 맴도는 생각이 있나요?",
  "오늘 가장 신경 쓰인 일은 무엇이었나요?",
  "오늘 스스로에게 가장 많이 했던 말은 무엇인가요?",
  "지금 가장 풀리지 않는 생각은 무엇인가요?",
  "오늘 가장 감정이 흔들렸던 순간은 언제였나요?",
];

let lastThinkPromptIndex = -1;
function pickThinkPrompt() {
  if (THINK_PROMPTS.length <= 1) return THINK_PROMPTS[0];
  let idx = Math.floor(Math.random() * THINK_PROMPTS.length);
  if (idx === lastThinkPromptIndex) idx = (idx + 1) % THINK_PROMPTS.length;
  lastThinkPromptIndex = idx;
  return THINK_PROMPTS[idx];
}

// Live mic volume (0..1), sampled via Web Audio while `active`, driven
// entirely through a ref rather than React state — the waveform reads it
// 60x/sec and state updates at that rate would just cause needless
// re-renders. Fails silently (waveform stays calm/flat) if mic access is
// denied or unavailable; speech recognition itself has its own separate
// permission flow and keeps working either way.
function useMicLevel(active: boolean) {
  const levelRef = React.useRef(0);
  React.useEffect(() => {
    if (!active) {
      levelRef.current = 0;
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i += 1) {
            const v = (data[i] - 128) / 128;
            sumSquares += v * v;
          }
          const rms = Math.sqrt(sumSquares / data.length);
          levelRef.current = Math.min(1, rms * 4);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Mic permission denied/unavailable — leave levelRef at 0 (calm/flat).
      }
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [active]);
  return levelRef;
}

// Apple Voice Memos-style: thin, soft, single-color bars nudged by the
// live mic level plus a gentle per-bar phase offset so they ripple instead
// of moving in lockstep — never a colorful/equalizer look. Heights are
// written straight to the DOM every frame (not through React state) to
// stay smooth at 60fps.
const WAVEFORM_BAR_COUNT = 26;
function VoiceWaveform({ levelRef }: { levelRef: React.MutableRefObject<number> }) {
  const barsRef = React.useRef<(HTMLDivElement | null)[]>([]);
  const smoothedRef = React.useRef<number[]>(Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0));
  const phasesRef = React.useRef<number[]>(Array.from({ length: WAVEFORM_BAR_COUNT }, () => Math.random() * Math.PI * 2));

  React.useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.05;
      const level = levelRef.current;
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        const jitter = Math.sin(t * 2 + phasesRef.current[i]) * 0.15 + 0.85;
        const target = 0.1 + level * jitter * 0.9;
        smoothedRef.current[i] += (target - smoothedRef.current[i]) * 0.22;
        el.style.height = `${3 + smoothedRef.current[i] * 20}px`;
        el.style.opacity = String(0.3 + smoothedRef.current[i] * 0.55);
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 24 }}>
      {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          style={{ width: 2, borderRadius: 1, backgroundColor: "#F4F1EC", height: 3, opacity: 0.3 }}
        />
      ))}
    </div>
  );
}

// The mic button, redesigned to feel like a quiet living thing rather than
// a UI control: a soft glowing orb that breathes on its own (scale
// 1.00→1.04 every ~2.5s) so it never needs a "탭해서 시작하세요" caption to
// explain itself. Recording shifts the same breathing to a warmer glow and
// a slightly quicker pulse — still smooth, never flashy.
function NeuronOrb({ recording, onClick }: { recording: boolean; onClick: () => void }) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      whileTap={{ scale: 0.94 }}
      animate={{ scale: recording ? [1, 1.06, 1] : [1, 1.04, 1] }}
      transition={{ duration: recording ? 1.7 : 2.5, repeat: Infinity, ease: "easeInOut" }}
      style={{
        width: 76,
        height: 76,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        background: recording
          ? "radial-gradient(circle at 35% 30%, #E0876A 0%, #B5533C 58%, #7E3826 100%)"
          : "radial-gradient(circle at 35% 30%, #7C6EA8 0%, #4F4177 55%, #302647 100%)",
        boxShadow: recording
          ? "0 8px 26px rgba(181,83,60,0.4), 0 0 36px rgba(181,83,60,0.3)"
          : "0 8px 22px rgba(91,75,138,0.32), 0 0 28px rgba(91,75,138,0.22)",
      }}
    >
      <motion.div
        animate={{
          opacity: recording ? [0.6, 1, 0.6] : [0.4, 0.7, 0.4],
          scale: [0.9, 1.05, 0.9],
        }}
        transition={{ duration: recording ? 1.4 : 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: recording ? "#FFD9C7" : "#E8E3F5",
          boxShadow: recording ? "0 0 14px 4px rgba(232,128,100,0.65)" : "0 0 14px 4px rgba(180,165,230,0.55)",
        }}
      />
    </motion.div>
  );
}

function ScreenThink({ onDone, onBack }: { onDone?: (text: string) => void; onBack?: () => void }) {
  const [recording, setRecording] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const [textMode, setTextMode] = React.useState(false);
  const [text, setText] = React.useState("");
  const [promptHint] = React.useState(() => pickThinkPrompt());
  const [transcript, setTranscript] = React.useState("");
  const [interim, setInterim] = React.useState("");
  const voiceSupportedRef = React.useRef(!!getSpeechRecognitionCtor());
  const recognitionRef = React.useRef<any>(null);
  const micLevelRef = useMicLevel(recording);
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
            <AnimatePresence mode="wait">
              {!recording ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                >
                  <div style={{ ...serif, fontSize: 22, color: "#F4F1EC", textAlign: "center", lineHeight: 1.6, wordBreak: "keep-all" }}>
                    편하게 말하세요.<br />정리하려 하지 않아도 됩니다.
                  </div>
                  <div style={{ ...sans, fontSize: 13, color: "#8A8590", textAlign: "center", marginTop: 14, lineHeight: 1.6, wordBreak: "keep-all", minHeight: 20 }}>
                    {promptHint}
                  </div>
                  {!voiceSupportedRef.current && (
                    <div style={{ ...sans, fontSize: 12, color: tension, textAlign: "center", marginTop: 18, lineHeight: 1.6, wordBreak: "keep-all" }}>
                      이 브라우저는 음성 인식을 지원하지 않아요. "글로 쓰기"를 이용해주세요.
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="recording"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                >
                  <div style={{ ...serif, fontSize: 18, color: "#D9D6DE", textAlign: "center" }}>듣고 있어요</div>
                  <div style={{ ...mono, fontSize: 15, color: "#8A8590", marginTop: 10 }}>{mm}:{ss}</div>
                  <div style={{ ...sans, fontSize: 13, color: "#8A8590", textAlign: "center", marginTop: 12, lineHeight: 1.6, wordBreak: "keep-all" }}>
                    생각나는 대로 편하게 말해주세요.
                  </div>
                  {voiceSupportedRef.current && (transcript || interim) && (
                    <div style={{ ...serif, fontSize: 16, color: "#D9D6DE", textAlign: "center", marginTop: 24, lineHeight: 1.65, wordBreak: "keep-all" }}>
                      {(transcript + (interim ? " " + interim : "")).trim()}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div style={{ padding: "0 32px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            {recording && <VoiceWaveform levelRef={micLevelRef} />}
            <NeuronOrb recording={recording} onClick={() => (recording ? stopRecording() : startRecording())} />
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
function ScreenProcessing({
  text,
  matchableBeliefs,
  matchablePending,
  priorAssumptions,
  priorConnections,
  aspiration,
  onDone,
  onError,
}: {
  text?: string;
  matchableBeliefs?: Pick<StoredBelief, "id" | "domain" | "statement" | "confidence">[];
  matchablePending?: { id: string; domain: string; statement: string }[];
  priorAssumptions?: StoredAssumption[];
  priorConnections?: { aStatement: string; bStatement: string; note: string }[];
  aspiration?: string | null;
  onDone?: (result: any | null) => void;
  onError?: (message: string) => void;
}) {
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
      body: JSON.stringify({ text, matchableBeliefs, matchablePending, priorAssumptions, priorConnections, aspiration }),
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
      <Mindy dark size={110} holding={step >= 1} />
      <div style={{ ...sans, fontSize: 14, color: "#C7C2CE", marginTop: 22 }}>{STEPS[step]}</div>
    </div>
  );
}

// ── Screen 7 · Think complete ─────────────────────────────────────────────────
// Only reached now when there's nothing to show in the Analysis tab yet —
// a real result routes straight to "analysis" instead (see the app
// shell's onDone for the "processing" screen). Just the error state and a
// quiet fallback acknowledgment.
function ScreenThinkComplete({ error, onDone }: { error?: string; onDone?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        {error ? (
          <>
            <div style={{ ...serif, fontSize: 21, color: ink, lineHeight: 1.5, wordBreak: "keep-all" }}>
              분석하지 못했어요.
            </div>
            <div style={{ ...sans, fontSize: 13.5, color: tension, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
              {error}
            </div>
          </>
        ) : (
          <>
            <div style={{ ...serif, fontSize: 22, color: ink, lineHeight: 1.5, wordBreak: "keep-all" }}>
              잘 들었습니다.
            </div>
            <div style={{ ...sans, fontSize: 14, color: mid, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
              오늘 이야기도 기록에 더해졌어요. 판단하거나 정리하지 않습니다 — 그냥 조용히 쌓아둡니다.
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

// Affect labeling — naming an emotion is itself the intervention (Lieberman
// et al.: putting a feeling into words measurably calms the reaction to it),
// so this just surfaces whichever emotion showed up most, weighted by
// intensity, across the entries that actually support this belief. Not a
// claim that the belief "causes" the emotion — just what tended to be
// nearby when it did.
function dominantEmotion(entryIds: string[] | undefined, history: StoredHistoryEntry[]): string | null {
  if (!entryIds || entryIds.length === 0) return null;
  const totals = new Map<string, number>();
  entryIds.forEach((id) => {
    const entry = history.find((e) => e.id === id);
    entry?.analysis?.observation.emotions.forEach((em) => {
      totals.set(em.label, (totals.get(em.label) ?? 0) + em.intensity);
    });
  });
  if (totals.size === 0) return null;
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

// Whether at least one of a belief's own supporting entries carries a full
// situation→thought→emotion→action chain — powers BeliefCard's "이 패턴이
// 왜 반복되는지 보기" toggle.
function hasFunctionalLoopData(belief: Pick<StoredBelief, "supportingEntryIds">, history: StoredHistoryEntry[]): boolean {
  return (belief.supportingEntryIds ?? []).some((id) => history.find((e) => e.id === id)?.analysis?.observation.situation);
}

// Longitudinal drift (Level 4) — a plain sparkline over confidenceHistory,
// purely descriptive ("this is how it's moved"), never a forecast. Only
// renders once there are at least two points; a single point is just the
// belief's current confidence, already shown by the bar above it.
function ConfidenceTrend({ history }: { history: { date: string; value: number }[] }) {
  if (history.length < 2) return null;
  const w = 240;
  const h = 32;
  const pad = 3;
  const values = history.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = history
    .map((p, i) => {
      const x = pad + (i / (history.length - 1)) * (w - pad * 2);
      const y = h - pad - ((p.value - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const delta = history[history.length - 1].value - history[0].value;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: subtle }}>확신도 변화 · {history.length}회 기록</span>
        <span style={{ ...mono, fontSize: 10.5, color: delta > 0 ? accent : delta < 0 ? tension : faint }}>{delta > 0 ? "+" : ""}{delta}</span>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 4, display: "block" }}>
        <polyline points={points} fill="none" stroke={accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// Functional analysis (Level 2) — reads the situation → automatic thought →
// emotion → action chain straight off the belief's own supporting entries
// (already recorded per-entry, see ThoughtObservation) and closes the loop
// with a plain-language note about the action feeding back into a similar
// situation. No new extraction, no claim beyond what one real entry already
// showed — just naming the cycle instead of leaving it implicit.
function FunctionalLoopDiagram({ belief, history }: { belief: StoredBelief; history: StoredHistoryEntry[] }) {
  const candidateEntries = (belief.supportingEntryIds ?? [])
    .map((id) => history.find((e) => e.id === id))
    .filter((e): e is StoredHistoryEntry => !!e && !!e.analysis?.observation.situation);
  const entry = candidateEntries[candidateEntries.length - 1];
  if (!entry?.analysis) {
    return <div style={{ ...sans, fontSize: 12, color: faint }}>이 신념의 순환 구조를 보여줄 만한 상세 기록이 아직 없어요.</div>;
  }
  const obs = entry.analysis.observation;
  const topEmotion = [...obs.emotions].sort((a, b) => b.intensity - a.intensity)[0];
  const steps = [
    { label: "상황", text: obs.situation },
    { label: "자동적 사고", text: obs.automaticThought },
    { label: "감정", text: topEmotion ? `${topEmotion.label} (강도 ${topEmotion.intensity})` : "기록 없음" },
    { label: "행동", text: obs.actionUrge },
  ];
  return (
    <div>
      <div style={{ ...sans, fontSize: 12, color: subtle, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>
        {entry.date}의 기록에서, 이 신념이 실제로 어떻게 이어졌는지를 순서대로 짚어본 거예요.
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: accentSoft, color: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, paddingBottom: 4 }}>
                <div style={{ ...sans, fontSize: 10.5, fontWeight: 700, color: mid, letterSpacing: "0.04em" }}>{s.label}</div>
                <div style={{ ...serif, fontSize: 14, color: ink, marginTop: 2, lineHeight: 1.5, wordBreak: "keep-all" }}>{s.text}</div>
              </div>
            </div>
            {i < steps.length - 1 && <div style={{ marginLeft: 9, width: 1, height: 14, backgroundColor: hair }} />}
          </React.Fragment>
        ))}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, marginLeft: 32 }}>
          <span style={{ ...sans, fontSize: 15, color: accent, lineHeight: 1 }}>↺</span>
          <span style={{ ...sans, fontSize: 11.5, color: subtle, fontStyle: "italic", lineHeight: 1.5, wordBreak: "keep-all" }}>
            이 행동이 다시 비슷한 상황을 만들고, 같은 생각이 또 나타나는 식으로 이어지는 것으로 보여요.
          </span>
        </div>
      </div>
    </div>
  );
}

// One belief's full card — its own component (rather than inlined in the
// map below) so each can hold its own "which pattern tag is expanded" state
// without the cards interfering with each other.
function BeliefCard({ belief, history, onReject }: { belief: StoredBelief; history: StoredHistoryEntry[]; onReject?: (id: string) => void }) {
  const [openPattern, setOpenPattern] = React.useState<string | null>(null);
  const [showLoop, setShowLoop] = React.useState(false);
  const emotion = dominantEmotion(belief.supportingEntryIds, history);
  const patterns = belief.possibleCognitivePatterns ?? [];
  const hasLoopData = hasFunctionalLoopData(belief, history);
  return (
    <div style={{ padding: "16px 0", borderBottom: `1px solid ${hair}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: subtle, letterSpacing: "0.04em" }}>{belief.domain}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {belief.status === "conflicted" && <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: tension }}>상충하는 기록 있음</span>}
          {belief.status === "supported" && <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: accent }}>반복적으로 확인됨</span>}
          <span style={{ ...mono, fontSize: 11, color: faint }}>근거 {belief.evidenceCount}건</span>
        </div>
      </div>
      {/* Defusion reframe (ACT: "naming the thought") — a recurring visitor,
          not a fact about the person, shown just above the statement it
          reframes so the two read together. */}
      {belief.thoughtLabel && (
        <div style={{ ...sans, fontSize: 11, fontStyle: "italic", color: accent, marginTop: 8 }}>'{belief.thoughtLabel}'이 반복해서 나타나요</div>
      )}
      <div style={{ ...serif, fontSize: 18, color: ink, marginTop: belief.thoughtLabel ? 4 : 8, lineHeight: 1.4, wordBreak: "keep-all" }}>{belief.statement}</div>
      <div style={{ height: 4, borderRadius: 2, backgroundColor: hair, marginTop: 10 }}>
        <div style={{ height: "100%", width: `${belief.confidence}%`, borderRadius: 2, backgroundColor: accent }} />
      </div>
      {/* Longitudinal drift (Level 4) — how this belief's confidence has
          actually moved, not just where it stands right now. */}
      {belief.confidenceHistory && <ConfidenceTrend history={belief.confidenceHistory} />}
      {(patterns.length > 0 || emotion) && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {emotion && (
            <span style={{ ...sans, fontSize: 10.5, color: mid, backgroundColor: surface, padding: "3px 8px", borderRadius: 999 }}>주로 느낀 감정 · {emotion}</span>
          )}
          {patterns.map((p) => {
            const active = openPattern === p;
            return (
              <motion.span
                key={p} role="button" tabIndex={0} whileTap={{ opacity: 0.6 }}
                onClick={() => setOpenPattern(active ? null : p)}
                style={{ ...sans, fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? "#fff" : accent, backgroundColor: active ? accent : accentSoft, padding: "3px 8px", borderRadius: 999, cursor: "pointer" }}
              >
                {p}
              </motion.span>
            );
          })}
        </div>
      )}
      {openPattern && (
        <div style={{ ...sans, fontSize: 12, color: inkSoft, marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all", padding: 10, borderRadius: 10, backgroundColor: accentSoft }}>
          <div>{COGNITIVE_PATTERN_DESCRIPTIONS[openPattern as keyof typeof COGNITIVE_PATTERN_DESCRIPTIONS] ?? ""}</div>
          {/* Balanced reframe (ported from a parallel session) — most
              cognitive habits started as adaptive, not just a flaw. */}
          {(() => {
            const r = COGNITIVE_PATTERN_REFLECTIONS[openPattern as keyof typeof COGNITIVE_PATTERN_REFLECTIONS] ?? GENERIC_PATTERN_REFLECTION;
            return (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${hair}`, display: "flex", flexDirection: "column", gap: 4 }}>
                <div><span style={{ fontWeight: 700, color: accent }}>도움이 되는 점</span> · {r.benefit}</div>
                <div><span style={{ fontWeight: 700, color: tension }}>주의할 점</span> · {r.caution}</div>
              </div>
            );
          })()}
        </div>
      )}
      {belief.evidenceQuotes.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {[...belief.evidenceQuotes].reverse().slice(0, 2).map((q: StoredEvidenceQuote, qi: number) => (
            <div key={qi} style={{ ...sans, fontSize: 12, color: subtle, lineHeight: 1.5, wordBreak: "keep-all" }}>
              <span style={{ ...mono, fontSize: 10.5, color: faint }}>{q.date}</span> · "{q.quote}"
            </div>
          ))}
        </div>
      )}
      {hasLoopData && (
        <div style={{ marginTop: 10 }}>
          <motion.span
            role="button" tabIndex={0} whileTap={{ opacity: 0.6 }} onClick={() => setShowLoop((v) => !v)}
            style={{ ...sans, fontSize: 11.5, color: accent, fontWeight: 600, cursor: "pointer", display: "inline-block" }}
          >
            {showLoop ? "반복 구조 접기 ↑" : "이 패턴이 왜 반복되는지 보기 ↓"}
          </motion.span>
          {showLoop && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: surface }}>
              <FunctionalLoopDiagram belief={belief} history={history} />
            </div>
          )}
        </div>
      )}
      {onReject && (
        <motion.span
          role="button" tabIndex={0} onClick={() => onReject(belief.id)} whileTap={{ opacity: 0.6 }}
          style={{ ...sans, fontSize: 11.5, color: faint, marginTop: 10, display: "inline-block", cursor: "pointer" }}
        >
          이 관찰, 내 생각과 달라요
        </motion.span>
      )}
    </div>
  );
}

// A small circular node/edge diagram for one cluster — deliberately not
// force-directed (that needs real layout math for a payoff mainly visible
// with many nodes; a 3-6 node cluster reads just as clearly evenly spaced
// on a circle) so every pair gets a visible edge with no overlap.
function BeliefClusterDiagram({ count }: { count: number }) {
  const size = 96;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const positions = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {positions.map((p1, i) =>
        positions.slice(i + 1).map((p2, j) => (
          <line key={`${i}-${i + 1 + j}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={accent} strokeOpacity={0.3} strokeWidth={1} />
        ))
      )}
      {positions.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={8} fill={accentSoft} stroke={accent} strokeWidth={1.4} />
      ))}
    </svg>
  );
}

// Belief network mapping (Level 3) — a core belief rarely stands alone;
// this surfaces the connected clusters findBeliefClusters finds among
// "root" connections (3+ mutually-reinforcing beliefs), which the flat
// pairwise "발견된 연결" list elsewhere never states as a single structure.
function BeliefNetworkSection({ beliefs, connections }: { beliefs: StoredBelief[]; connections: StoredConnection[] }) {
  const clusters = findBeliefClusters(beliefs, connections);
  if (clusters.length === 0) return null;
  const byId = new Map(beliefs.map((b) => [b.id, b]));
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>서로 지지하는 신념들</div>
      <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
        핵심 신념은 보통 하나가 아니라, 여러 개가 서로를 지탱하는 구조로 함께 나타나요.
      </div>
      {clusters.map((clusterIds, ci) => {
        const clusterBeliefs = clusterIds.map((id) => byId.get(id)).filter((b): b is StoredBelief => !!b);
        if (clusterBeliefs.length === 0) return null;
        return (
          <div key={ci} style={{ marginTop: 14, padding: 16, borderRadius: 14, backgroundColor: surface, display: "flex", gap: 14, alignItems: "center" }}>
            <BeliefClusterDiagram count={clusterBeliefs.length} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...sans, fontSize: 12.5, fontWeight: 600, color: ink }}>신념 {clusterBeliefs.length}가지가 서로를 지탱하고 있어요</div>
              <div style={{ ...sans, fontSize: 11.5, color: subtle, marginTop: 6, lineHeight: 1.6, wordBreak: "keep-all" }}>
                {clusterBeliefs.map((b) => `'${b.statement}'`).join(", ")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Contradiction detection (Level 5) — just lays the two statements side by
// side and stops there; no verdict on which one is "true." This is the
// motivational-interviewing "discrepancy" technique — naming the tension
// out loud is the entire intervention.
function ContradictionSection({ beliefs, connections }: { beliefs: StoredBelief[]; connections: StoredConnection[] }) {
  const pairs = findContradictionPairs(beliefs, connections);
  if (pairs.length === 0) return null;
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>말과 말 사이의 긴장</div>
      <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
        어느 쪽이 맞는지는 정하지 않아요. 두 말을 나란히 보여드릴 뿐이에요.
      </div>
      {pairs.map((p, i) => (
        <div key={i} style={{ marginTop: 14, padding: 16, borderRadius: 14, backgroundColor: surface }}>
          <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: ink, lineHeight: 1.6, wordBreak: "keep-all" }}>"{p.a.statement}"</div>
          <div style={{ ...sans, fontSize: 11, color: faint, margin: "8px 0", textAlign: "center" }}>그리고</div>
          <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: ink, lineHeight: 1.6, wordBreak: "keep-all" }}>"{p.b.statement}"</div>
          {p.note && (
            <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${hair}`, lineHeight: 1.5, wordBreak: "keep-all" }}>
              {p.note}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Belief Map and Recurring Assumptions used to be two separate screens, but
// a belief ("안전이 최우선이다") and an assumption ("불확실할 때 → 기다리는
//게 안전하다") are the same kind of thing at different specificity — one
// screen now, sectioned, instead of two nearly-redundant ones.
function ScreenBeliefMap({ onBack, store, onRejectBelief }: { onBack?: () => void; store: Store; onRejectBelief?: (beliefId: string) => void }) {
  const hasBeliefs = store.beliefs.length > 0;
  const hasAssumptions = store.assumptions.length > 0;
  const visibleBeliefs = store.beliefs.filter((b) => b.userReaction !== "rejected");
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>무의식적 패턴</div>
        {!hasBeliefs && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
            <Mindy size={68} expression="happy" />
          </div>
        )}
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all", textAlign: hasBeliefs ? "left" : "center" }}>
          {hasBeliefs ? "당신이 스스로 안다고 생각하지 못한 채, 실제 말과 행동에서 반복적으로 드러난 것들이에요." : "아직 발견된 패턴이 없어요. '생각 말하기'로 첫 생각을 남겨보세요 — 여기서부터 패턴을 찾아드릴게요."}
        </div>
        <div style={{ ...sans, fontSize: 11, color: faint, marginTop: 10, lineHeight: 1.5, wordBreak: "keep-all" }}>
          {DISCLAIMER_NOTICE}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <div style={{ marginTop: 20 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>핵심 무의식적 신념</div>
          <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            "이렇게 믿는다"고 스스로 말하는 게 아니라, 상황과 관계없이 실제 선택과 말에서 반복적으로 드러나는 배경이에요. 원의 크기·막대 길이는 실제 근거 건수예요. 최소 3번 이상 비슷한 기록이 쌓여야 여기 나타나요 — 한 번의 기록만으로는 만들어지지 않아요.
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          {visibleBeliefs.length === 0 ? (
            <div style={{ ...sans, fontSize: 13, color: faint, padding: "12px 0" }}>아직 발견된 무의식적 신념이 없어요.</div>
          ) : (
            visibleBeliefs.map((b) => (
              <BeliefCard key={b.id} belief={b} history={store.history} onReject={onRejectBelief} />
            ))
          )}
        </div>

        <BeliefNetworkSection beliefs={visibleBeliefs} connections={store.connections} />
        <ContradictionSection beliefs={visibleBeliefs} connections={store.connections} />

        <div style={{ marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: accentSoft, borderLeft: `2px solid ${accent}` }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.04em" }}>무의식적 신념과 해석, 뭐가 다른가요</div>
          <div style={{ ...sans, fontSize: 12.5, color: inkSoft, marginTop: 8, lineHeight: 1.65, wordBreak: "keep-all" }}>
            무의식적 신념은 스스로 자각하지 못한 채 늘 배경에서 작동하는 것이고, 무의식적 해석은 그게 특정 순간(트리거)마다 실제 말과 행동으로 튀어나오는 구체적인 반응이에요. 무의식적 신념은 "왜 그런지"이고, 무의식적 해석은 "그게 실제로 벌어지는 순간"인 셈이에요. 예를 들어 위의 "{visibleBeliefs[0]?.statement ?? "완벽해야 시작할 수 있다"}"는 무의식적 신념이, 아래처럼 "새로운 걸 시작해야 할 때 → 아직 준비가 안 됐다며 미룬다"는 무의식적 해석으로 매번 구체적인 행동에 나타나는 식이에요.
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>반복되는 무의식적 해석</div>
          <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            "이런 상황에서 → 이렇게 자동으로 해석하고 행동한다"는 순간들이에요. 무의식적 신념보다 더 구체적이고, 실제로 관찰되는 트리거가 있어요.
          </div>
          <div style={{ marginTop: 12 }}>
            {!hasAssumptions ? (
              <div style={{ ...sans, fontSize: 13, color: faint, padding: "12px 0" }}>아직 발견된 무의식적 해석이 없어요.</div>
            ) : (
              store.assumptions.map((a, i) => (
                <div key={a.id} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: i < store.assumptions.length - 1 ? `1px solid ${hair}` : "none" }}>
                  <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: accent, lineHeight: 1.3, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: subtle }}>{a.trigger}</span>
                      <span style={{ ...serif, fontSize: 16, color: ink, lineHeight: 1.4, wordBreak: "keep-all" }}>→ {a.interpretation}</span>
                    </div>
                    {a.domains && a.domains.length > 0 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {a.domains.map((d: string) => (
                          <span key={d} style={{ ...sans, fontSize: 11, color: mid, backgroundColor: surface, padding: "3px 9px", borderRadius: 999 }}>{d}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ ...sans, fontSize: 11, color: faint, marginTop: 8 }}>{a.count}번의 대화에서 발견</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {store.connections.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>발견된 연결</div>
            <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
              서로 달라 보였던 두 무의식적 신념이, 사실은 같은 뿌리(근본 원인)에서 나온 것으로 보여요.
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {store.connections.map((c, i) => {
                const from = visibleBeliefs.find((b) => b.id === c.a);
                const to = visibleBeliefs.find((b) => b.id === c.b);
                if (!from || !to) return null;
                return (
                  <div key={i} style={{ padding: "12px 14px", borderRadius: 12, backgroundColor: accentSoft }}>
                    <ConnectionSpark aLabel={from.domain} bLabel={to.domain} />
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ ...sans, fontSize: 12.5, color: ink, lineHeight: 1.5, wordBreak: "keep-all" }}>
                        <span style={{ fontWeight: 700, color: accent }}>{from.domain}</span> — "{from.statement}"
                      </div>
                      <div style={{ ...sans, fontSize: 12.5, color: ink, lineHeight: 1.5, wordBreak: "keep-all" }}>
                        <span style={{ fontWeight: 700, color: accent }}>{to.domain}</span> — "{to.statement}"
                      </div>
                    </div>
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
function ScreenDrift({ onBack, store, onSetupAspiration }: { onBack?: () => void; store: Store; onSetupAspiration?: () => void }) {
  const hasAspiration = !!store.aspiration;
  const examples = store.aspirationExamples ?? [];
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
              <div style={{ ...mono, fontSize: 11, color: faint }}>{store.aspirationSetDate}, 당신이 한 말</div>
              <div style={{ ...serif, fontSize: 17, fontStyle: "italic", color: inkSoft, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>
                "{store.aspiration}"
              </div>
              <motion.span role="button" tabIndex={0} onClick={onSetupAspiration} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 12, color: accent, cursor: "pointer", display: "inline-block", marginTop: 10 }}>
                다시 설정하기
              </motion.span>
            </div>
            {store.driftNotes.length === 0 ? (
              <div style={{ ...sans, fontSize: 13.5, color: mid, lineHeight: 1.7, wordBreak: "keep-all" }}>
                아직 비교할 만큼 기록이 쌓이지 않았어요. 생각을 몇 번 더 남기면, 실제 패턴과 이 말 사이의 거리를 보여드릴게요.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[...store.driftNotes].reverse().map((d, i) => (
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
                {examples.length > 0
                  ? "한 문장만 남겨주시면, 실제로 쌓인 기록과 그 말 사이의 거리를 계속 보여드릴게요. (아래는 그 예시예요.)"
                  : "한 문장만 남겨주시면, 실제로 쌓인 기록과 그 말 사이의 거리를 계속 보여드릴게요."}
              </div>
            </div>
            {examples.map((a) => {
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
// Falls back to a generic reflective question when a hypothesis doesn't
// carry its own (real hypotheses don't yet) — same wording either way, so
// the detail screen never has to know why a question is showing.
const GENERIC_HYPOTHESIS_QUESTION = "이 통찰이 지금 당신에게 도움이 되고 있나요, 아니면 제한하고 있나요?";

// A hypothesis's evidence quotes come from one of two places: its own
// explicit `evidence` field if it has one, or — for real hypotheses, which
// don't — derived from the beliefs it's linked to via relatedBeliefIds.
function evidenceForHypothesis(h: StoredHypothesis, beliefs: StoredBelief[]): (StoredEvidenceQuote & { domain?: string })[] {
  if (h.evidence && h.evidence.length > 0) return h.evidence;
  return h.relatedBeliefIds
    .map((id) => beliefs.find((b) => b.id === id))
    .filter((b): b is StoredBelief => !!b)
    .flatMap((b) => b.evidenceQuotes.map((q) => ({ ...q, domain: b.domain })))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);
}

function ScreenHypotheses({ onBack, onOpen, store }: { onBack?: () => void; onOpen?: (i: number) => void; store: Store }) {
  const items = store.hypotheses;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
        <div style={{ ...serif, fontSize: 26, color: ink, marginTop: 10 }}>AI의 가설</div>
        <div style={{ ...sans, fontSize: 13, color: mid, marginTop: 6, lineHeight: 1.5 }}>확실하지 않습니다. 동의/반박하며 함께 다듬어가요.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {items.length === 0 ? (
          <div style={{ ...sans, fontSize: 13.5, color: mid, lineHeight: 1.7, wordBreak: "keep-all", padding: "12px 0" }}>
            충분한 생각이 쌓이면, 여러 무의식적 신념을 가로지르는 AI의 상위 이론이 여기 나타나요.
          </div>
        ) : (
          items.map((h, i) => (
            <motion.div
              key={h.id} role="button" tabIndex={0} onClick={() => onOpen?.(i)} whileTap={{ scale: 0.99, opacity: 0.9 }}
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
              {h.reaction && (
                <div style={{ ...sans, fontSize: 11, color: h.reaction === "agree" ? accent : tension, marginTop: 8 }}>
                  {h.reaction === "agree" ? "동의함" : "아니라고 답함"}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Screen 12 · Hypothesis detail ─────────────────────────────────────────────
// The full "오늘의 발견" experience for a hypothesis-sourced discovery —
// everything the old standalone "AI의 가설" detail page showed, plus the
// related-neurons/contradictory-evidence/evolution sections. Extracted so
// it can render identically whether it's reached through the legacy
// ScreenHypothesisDetail wrapper (back button + this body) or embedded
// inline as Analysis's first section (no wrapper, no back button — it's
// already inside a tab).
function HypothesisDiscoveryBody({
  h,
  store,
  onAgree,
  onDisagree,
  reinterpreting,
  onInvestigate,
}: {
  h: StoredHypothesis;
  store: Store;
  onAgree?: () => void;
  onDisagree?: () => void;
  reinterpreting?: boolean;
  onInvestigate?: () => void;
}) {
  const reaction = h.reaction;
  const exhausted = !!h.exhausted;
  const settled = reaction === "agree" || exhausted;
  const question = h.question ?? GENERIC_HYPOTHESIS_QUESTION;
  const evidence = evidenceForHypothesis(h, store.beliefs);

  // The beliefs this hypothesis actually crosses — reused for both the
  // "related activated neurons" mini-brain and the contradictory-evidence
  // list below, so both sections stay honest to the same underlying data
  // instead of inventing a separate notion of "related."
  const relatedBeliefs = h.relatedBeliefIds
    .map((id) => store.beliefs.find((b) => b.id === id))
    .filter((b): b is StoredBelief => !!b);
  const relatedBeliefIds = new Set(relatedBeliefs.map((b) => b.id));
  const relatedConnections = store.connections.filter((c) => relatedBeliefIds.has(c.a) && relatedBeliefIds.has(c.b));
  const contradictoryEntries = relatedBeliefs
    .flatMap((b) => (b.contradictoryEntryIds ?? []).map((id) => ({ belief: b, entry: store.history.find((e) => e.id === id) })))
    .filter((x): x is { belief: StoredBelief; entry: StoredHistoryEntry } => !!x.entry);

  return (
    <div>
      <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.04em" }}>오늘의 발견</div>
      <div style={{ ...serif, fontSize: 21, color: ink, marginTop: 10, lineHeight: 1.5, wordBreak: "keep-all" }}>{h.title}</div>
      <div style={{ marginTop: 18 }}><ConfidenceBar value={h.confidence} /></div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {h.domains.map((d: string) => (<span key={d} style={{ ...sans, fontSize: 11, color: mid, backgroundColor: surface, padding: "3px 9px", borderRadius: 999 }}>{d}</span>))}
      </div>

      {evidence.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>근거가 된 대화들</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {evidence.map((e, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 12, backgroundColor: surface }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...mono, fontSize: 11, color: faint }}>{e.date}</span>
                  {e.domain && <span style={{ ...sans, fontSize: 10, color: mid, backgroundColor: accentSoft, padding: "2px 8px", borderRadius: 999 }}>{e.domain}</span>}
                </div>
                <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: inkSoft, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{e.quote}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {relatedBeliefs.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>관련된 활성 뉴런</div>
          <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            이 발견을 이루는 무의식적 신념들이 뇌에서 실제로 활성화된 자리예요.
          </div>
          <div style={{ marginTop: 12 }}>
            <NeuralBeliefGraph3D beliefs={relatedBeliefs} connections={relatedConnections} height={200} />
          </div>
        </div>
      )}

      {contradictoryEntries.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>상충하는 기록</div>
          <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            이 결론과 다르게 나타난 기록도 있어요 — 확신도는 이걸 반영해 낮아져 있어요.
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {contradictoryEntries.map(({ belief, entry }, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 12, backgroundColor: surface, borderLeft: `2px solid ${tension}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...mono, fontSize: 11, color: faint }}>{entry.date}</span>
                  <span style={{ ...sans, fontSize: 10, color: mid, backgroundColor: accentSoft, padding: "2px 8px", borderRadius: 999 }}>{belief.domain}</span>
                </div>
                <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: inkSoft, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{entry.text}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {h.investigate && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em" }}>신념의 변화</div>
          <div style={{ ...sans, fontSize: 12, color: subtle, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            {h.investigate.originNote}
          </div>
          <div style={{ marginTop: 14 }}>
            <AlignedRowCompare
              rows={[
                { label: h.investigate.compareLabel1, steps: h.investigate.compareSteps1 },
                { label: h.investigate.compareLabel2, steps: h.investigate.compareSteps2, accent: true },
              ]}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: accentSoft, borderLeft: `2px solid ${accent}` }}>
        <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: ink, lineHeight: 1.65, wordBreak: "keep-all" }}>{question}</div>
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mid, letterSpacing: "0.06em", marginBottom: 12 }}>이 가설, 어떻게 생각하세요?</div>
        {!settled && (
          <>
            <ReactionButtons
              reaction={reaction}
              onReact={(r) => (r === "agree" ? onAgree?.() : onDisagree?.())}
              disabled={reinterpreting}
            />
            {reinterpreting && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ ...sans, fontSize: 12, color: subtle, marginTop: 12, textAlign: "center" }}>
                다른 해석을 찾는 중…
              </motion.div>
            )}
          </>
        )}
        <div style={{ marginTop: settled ? 0 : 10 }}>
          {h.investigate && <GhostBtn onClick={onInvestigate}>더 깊이 알아보기</GhostBtn>}
        </div>
        {settled && exhausted && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ ...sans, fontSize: 12, color: subtle, marginTop: 12, lineHeight: 1.5, wordBreak: "keep-all", textAlign: "center" }}>
            같은 근거로 더 다르게 볼 수 있는 해석은 없는 것 같아요. 새로운 기록이 쌓이면 다시 살펴볼게요.
          </motion.div>
        )}
        {settled && !exhausted && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: ink, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, lineHeight: 1 }}>✓</span>
            <span style={{ ...sans, fontSize: 12, color: subtle }}>기록했어요. 이 가설의 확신도가 조금 더 높아집니다.</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Legacy standalone route (reached only via the still-intact ScreenHypotheses
// list, no longer linked from Home) — same body, just wrapped with its own
// back button and page chrome.
function ScreenHypothesisDetail({
  index,
  onBack,
  onInvestigate,
  onAgree,
  onDisagree,
  reinterpreting,
  store,
}: {
  index: number;
  onBack?: () => void;
  onInvestigate?: () => void;
  onAgree?: () => void;
  onDisagree?: () => void;
  reinterpreting?: boolean;
  store: Store;
}) {
  const h = store.hypotheses[index] ?? store.hypotheses[0];
  if (!h) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <HypothesisDiscoveryBody h={h} store={store} onAgree={onAgree} onDisagree={onDisagree} reinterpreting={reinterpreting} onInvestigate={onInvestigate} />
      </div>
    </div>
  );
}

// ── Screen 12.5 · Investigate (deep dive into one hypothesis) ────────────────
// A short guided walk through the evidence trail: where the pattern first
// appeared, what changed between then and now, and how it connects to other
// patterns already surfaced — closing on the same reflective question grammar
// as the hypothesis card itself, not a new one. Takes the investigation
// content directly (rather than looking a hypothesis up itself) since the
// caller already knows exactly which one is open.
function ScreenInvestigate({ investigate, onBack }: { investigate: NonNullable<StoredHypothesis["investigate"]>; onBack?: () => void }) {
  const inv = investigate;
  const [step, setStep] = React.useState(0);
  const steps = 4;

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

// Parses "YYYY.MM.DD" (formatDateDots) into a local Date at midnight, or
// null if it doesn't parse — shared by the streak calculator and history
// grouping below so both agree on exactly what counts as "the same day."
function parseDotDate(dateStr: string): Date | null {
  const parts = dateStr.split(".").map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// "오늘"/"어제" relative to now, else the raw date — matches 기록 화면.dc.html's
// group headers without fabricating anything the date itself doesn't say.
function relativeDayLabel(dateStr: string): string {
  const d = parseDotDate(dateStr);
  if (!d) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  return dateStr;
}

// The design spec colors each history entry by domain, which this app's
// entries don't carry directly (only beliefs have a domain) — so this
// looks up whichever belief this entry actually supported, and borrows
// its domain + region color. Entries that never matched a pattern (most
// early ones) simply render without a domain badge, never a fabricated one.
function findEntryDomain(entryId: string, beliefs: StoredBelief[]): { domain: string; color: string } | null {
  const match = beliefs.find((b) => (b.supportingEntryIds ?? []).includes(entryId));
  if (!match) return null;
  return { domain: match.domain, color: REGION_CONFIG[resolveRegion(match)].color };
}

// Longest run of consecutive calendar days (ending at the most recent
// entry, not necessarily today — a real gap shouldn't quietly read as an
// active streak) with at least one entry — real data only, no rounding up.
function computeStreak(history: StoredHistoryEntry[]): number {
  const days = new Set<string>();
  history.forEach((e) => {
    const d = parseDotDate(e.date);
    if (d) days.add(d.toDateString());
  });
  if (days.size === 0) return 0;
  const sorted = Array.from(days)
    .map((s) => new Date(s))
    .sort((a, b) => b.getTime() - a.getTime());
  let streak = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const diff = Math.round((sorted[i - 1].getTime() - sorted[i].getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) streak += 1;
    else break;
  }
  return streak;
}

// ── Screen 13 · History ───────────────────────────────────────────────────────
// Dark theme + starfield background, ported from 기록 화면.dc.html. Entries
// grouped by day (오늘/어제/date), each carrying whatever real domain/tag
// data can be honestly derived (see findEntryDomain above) — never invented.
function ScreenHistory({ onNavSelect, store, onOpenEntry }: { onNavSelect?: (id: string) => void; store: Store; onOpenEntry?: (index: number) => void }) {
  const items = [...store.history].reverse();
  const groups = React.useMemo(() => {
    const map = new Map<string, { label: string; entries: { index: number; entry: StoredHistoryEntry }[] }>();
    items.forEach((entry, index) => {
      const label = relativeDayLabel(entry.date);
      const bucket = map.get(entry.date);
      if (bucket) bucket.entries.push({ index, entry });
      else map.set(entry.date, { label, entries: [{ index, entry }] });
    });
    return Array.from(map.values());
  }, [items]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...dkStarfield }}>
      <div style={{ padding: "24px 16px 8px", flexShrink: 0 }}>
        <div style={{ ...serif, fontSize: 34, fontWeight: 400, color: dkHeading, marginBottom: 6 }}>기록</div>
        <div style={{ ...sans, fontSize: 13, color: dkBody }}>지금까지 남긴 생각들이에요.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px 24px" }}>
        {items.length === 0 ? (
          <div style={{ ...sans, fontSize: 13, color: dkBody, padding: "12px 0" }}>아직 기록된 생각이 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {groups.map((grp) => (
              <div key={grp.label + grp.entries[0].entry.id}>
                <div style={{ ...mono, fontSize: 11, color: "#726A8A", marginBottom: 10, letterSpacing: "0.03em" }}>{grp.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {grp.entries.map(({ index, entry }) => {
                    const domainInfo = findEntryDomain(entry.id, store.beliefs);
                    const status = entry.analysis?.hypothesis?.status;
                    const tag = status === "supported" || status === "emerging" ? "반복되는 생각" : null;
                    return (
                      <motion.div
                        key={entry.id} role="button" tabIndex={0} onClick={() => onOpenEntry?.(index)} whileTap={{ opacity: 0.6 }}
                        style={{ backgroundColor: dkCard, border: `1px solid ${dkCardBorder}`, borderRadius: 16, padding: "16px 18px", boxShadow: "0 8px 20px rgba(0,0,0,0.3)", cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          {domainInfo && (
                            <>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: domainInfo.color, flexShrink: 0 }} />
                              <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: domainInfo.color }}>{domainInfo.domain}</span>
                            </>
                          )}
                          {entry.duration && <span style={{ ...mono, fontSize: 10.5, color: "#726A8A", marginLeft: "auto" }}>{entry.duration}</span>}
                        </div>
                        <p style={{ ...serif, fontStyle: "italic", fontSize: 16, color: dkBodyLight, margin: 0, lineHeight: 1.45, wordBreak: "keep-all" }}>"{entry.text}"</p>
                        {tag && (
                          <div style={{ marginTop: 10, display: "inline-block", ...sans, fontSize: 10.5, color: dkBody, backgroundColor: "rgba(150,120,255,0.08)", padding: "3px 10px", borderRadius: 999 }}>{tag}</div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav active="history" onSelect={onNavSelect} dark />
    </div>
  );
}

// ── Screen 13.5 · History entry detail ────────────────────────────────────────
function ScreenHistoryDetail({ index, store, onBack }: { index: number; store: Store; onBack?: () => void }) {
  const items = [...store.history].reverse();
  const entry = items[index] ?? items[0];
  if (!entry) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: page }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: subtle, cursor: "pointer" }}>← 뒤로</motion.span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ ...mono, fontSize: 12, color: faint }}>{entry.date}</span>
          {entry.duration && <span style={{ ...mono, fontSize: 11, color: faint }}>{entry.duration}</span>}
        </div>
        <div style={{ ...serif, fontSize: 19, color: ink, marginTop: 16, lineHeight: 1.7, wordBreak: "keep-all" }}>
          {entry.text}
        </div>
      </div>
    </div>
  );
}

// ── Screen 14 · Profile ────────────────────────────────────────────────────────
function ScreenProfile({
  onNavSelect,
  store,
  onOpenSettings,
  isDemoMode,
  onToggleDemoMode,
}: {
  onNavSelect?: (id: string) => void;
  store: Store;
  onOpenSettings?: (screen: "notifications" | "dataPrivacy" | "help") => void;
  isDemoMode: boolean;
  onToggleDemoMode: (v: boolean) => void;
}) {
  const name = store.account?.name || "익명의 관찰자";
  const initial = name.charAt(0);
  const firstEntryDate = [...store.history].sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
  const stats = [
    { value: String(store.entryCount), label: "남긴 생각" },
    { value: String(store.beliefs.length), label: "발견된 신념" },
    { value: `${computeStreak(store.history)}일`, label: "연속 기록" },
  ];
  const rows: { label: string; color: string; onClick?: () => void }[] = [
    { label: "알림", color: dkAccent, onClick: () => onOpenSettings?.("notifications") },
    { label: "데이터와 개인정보", color: "#4A90D9", onClick: () => onOpenSettings?.("dataPrivacy") },
    { label: "도움말", color: "#34B27B", onClick: () => onOpenSettings?.("help") },
    { label: "로그아웃", color: "#726A8A", onClick: onNavSelect ? () => onNavSelect("auth") : undefined },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...dkStarfield }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 16px 24px" }}>
        <div style={{ padding: "8px 4px 24px" }}>
          <div style={{ ...serif, fontSize: 34, fontWeight: 400, color: dkHeading, marginBottom: 6 }}>프로필</div>
          <div style={{ ...sans, fontSize: 13, color: dkBody }}>당신의 여정을 기록해왔어요.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, backgroundColor: dkCard, border: `1px solid ${dkCardBorder}`, borderRadius: 20, padding: 20, boxShadow: dkCardShadow, marginBottom: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%, #4C3B8C, #241a44)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...serif, fontSize: 24, color: dkAccentTagText }}>
            {initial}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ ...sans, fontSize: 17, fontWeight: 700, color: dkHeading }}>{name}</span>
            {firstEntryDate && <span style={{ ...mono, fontSize: 11.5, color: "#726A8A" }}>{firstEntryDate}부터 함께하고 있어요</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ flex: 1, backgroundColor: dkCard, border: `1px solid ${dkCardBorder}`, borderRadius: 16, padding: "16px 12px", textAlign: "center", boxShadow: "0 8px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ ...mono, fontSize: 22, color: dkAccentTagText, marginBottom: 4 }}>{s.value}</div>
              <div style={{ ...sans, fontSize: 11, color: dkBody }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Introduces the mascot by name once, here — nowhere else in the
            app names it or explains it, so someone who's only seen it
            silently holding the "brain" on the processing screen has a
            place to learn who it is. Not part of the imported spec, kept
            from before and restyled to match. */}
        <div style={{ marginBottom: 14, padding: 16, borderRadius: 16, backgroundColor: dkCard, border: `1px solid ${dkCardBorder}`, display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ flexShrink: 0 }}>
            <Mindy size={52} expression="happy" dark />
          </div>
          <div>
            <div style={{ ...serif, fontSize: 15, color: dkHeading }}>마인디</div>
            <div style={{ ...sans, fontSize: 12, color: dkBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
              정리하지 않아도 괜찮아요. 마인디가 당신의 생각을 받아주고, 그 속에 숨겨진 패턴을 함께 찾아줄게요.
            </div>
          </div>
        </div>

        {/* Design/dev affordance: instantly switches the whole app between
            curated demo content and a real, on-device, initially-empty
            store — see src/app/dataProvider.ts. Not something a real end
            user would normally touch, but there's no separate build
            target to hide it behind. */}
        <div style={{ marginBottom: 14, backgroundColor: dkCard, border: `1px solid ${dkCardBorder}`, borderRadius: 20, padding: "0 18px", boxShadow: dkCardShadow }}>
          <SettingsToggle
            label="데모 모드"
            note="켜면 예시 데이터로 화면을 둘러볼 수 있어요. 끄면 실제 내 기록만 보여요 — 새 계정은 빈 상태로 시작해요."
            value={isDemoMode}
            onChange={onToggleDemoMode}
            dark
          />
        </div>

        <div style={{ backgroundColor: dkCard, border: `1px solid ${dkCardBorder}`, borderRadius: 20, overflow: "hidden", boxShadow: dkCardShadow }}>
          {rows.map((r, i) => (
            <motion.div
              key={r.label} role="button" tabIndex={0} onClick={r.onClick} whileTap={{ opacity: 0.6 }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", cursor: "pointer", borderBottom: i < rows.length - 1 ? `1px solid ${dkDivider}` : "none" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: r.color, flexShrink: 0 }} />
              <span style={{ ...sans, fontSize: 14, color: dkBodyLight, flex: 1 }}>{r.label}</span>
              <span style={{ color: "#4A4460", fontSize: 15 }}>›</span>
            </motion.div>
          ))}
        </div>
      </div>
      <BottomNav active="profile" onSelect={onNavSelect} dark />
    </div>
  );
}

// ── Screen 14.1 · Notification settings ───────────────────────────────────────
function SettingsToggle({ label, note, value, onChange, dark }: { label: string; note?: string; value: boolean; onChange?: (v: boolean) => void; dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 0", borderBottom: `1px solid ${dark ? dkDivider : hair}` }}>
      <div style={{ paddingRight: 16 }}>
        <div style={{ ...sans, fontSize: 15, color: dark ? dkBodyLight : ink }}>{label}</div>
        {note && <div style={{ ...sans, fontSize: 12, color: dark ? dkBody : subtle, marginTop: 3, lineHeight: 1.5, wordBreak: "keep-all" }}>{note}</div>}
      </div>
      <motion.div
        role="button" tabIndex={0} onClick={() => onChange?.(!value)} whileTap={{ scale: 0.95 }}
        style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: value ? dkAccent : dark ? dkTrack : hair, flexShrink: 0, padding: 3, cursor: "pointer", display: "flex", justifyContent: value ? "flex-end" : "flex-start" }}
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
function ScreenDataPrivacy({ store, onBack, onResetData }: { store: Store; onBack?: () => void; onResetData?: () => void }) {
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
  { q: "이 분석은 무엇에 근거하나요?", a: "CBT(인지행동치료)와 ACT(수용전념치료)의 개념을 참고해요. '흑백사고', '과잉일반화' 같은 인지 왜곡 태그는 CBT에서, 목표와의 거리는 ACT의 '가치 방향' 개념에서 가져온 거예요. 한 번의 기록만으로는 신념이 만들어지지 않고, 최소 3번 이상 비슷한 패턴이 쌓여야 나타나요. 확신도는 절대 100%가 되지 않고, 상충하는 기록이 있으면 오히려 낮아져요. 다만 이건 심리 진단이나 치료가 아니라 자기성찰을 돕는 도구예요." },
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
  // Investigate is reachable from two places now — the legacy standalone
  // hypothesisDetail screen, and the Analysis tab's inline discovery body —
  // so its back button needs to know which one to return to.
  const [investigateReturnTo, setInvestigateReturnTo] = React.useState<"hypothesisDetail" | "analysis">("hypothesisDetail");
  const [historyEntryIndex, setHistoryEntryIndex] = React.useState(0);
  const [thinkText, setThinkText] = React.useState("");
  const [analysisError, setAnalysisError] = React.useState("");
  // The one data provider: `store` is whichever dataset is currently active
  // (curated demo content, or the real on-device store — see
  // src/app/dataProvider.ts), and every screen below reads only that, with
  // no idea which one it's looking at. `realStore`/`updateRealStore` are
  // used only for the pre-home account flow, which is always real even if
  // Demo Mode happens to be on.
  const { isDemoMode, setIsDemoMode, store, updateStore, realStore, updateRealStore } = useAppData();

  const goToTab = (id: string) => setScreen(id);

  // Shared by both the legacy hypothesisDetail screen and the Analysis
  // tab's inline discovery body, so agree/disagree behaves identically no
  // matter which one the user reached it through.
  const agreeToHypothesis = (index: number) => {
    updateStore((prev) => ({
      ...prev,
      hypotheses: prev.hypotheses.map((h, i) => (i === index ? { ...h, reaction: "agree" as const } : h)),
    }));
  };
  const rejectBelief = (beliefId: string) => {
    updateStore((prev) => ({
      ...prev,
      beliefs: prev.beliefs.map((b) => (b.id === beliefId ? { ...b, userReaction: "rejected" as const } : b)),
    }));
  };
  // Distinct from rejectBelief above: reacting to a belief as "오늘의
  // 발견" never hides it from 무의식적 패턴 — only the dedicated reject
  // link there does that.
  const agreeToBeliefDiscovery = (beliefId: string) => {
    updateStore((prev) => ({
      ...prev,
      beliefs: prev.beliefs.map((b) => (b.id === beliefId ? { ...b, discoveryReaction: "agree" as const } : b)),
    }));
  };

  // Disagreeing with a discovery no longer just records a reason — it asks
  // the model for a genuinely different reading of the same evidence and
  // loops (see /api/reinterpret in vite.config.ts). reinterpretingKey scopes
  // the in-flight request to exactly one hypothesis/belief so two discovery
  // surfaces can never race each other.
  const [reinterpretingKey, setReinterpretingKey] = React.useState<string | null>(null);

  async function requestReinterpretation(currentText: string, evidenceQuotes: string[], rejectedTexts: string[]) {
    const res = await fetch("/api/reinterpret", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentText, evidenceQuotes, rejectedTexts }),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error || "다른 해석을 가져오지 못했어요.");
    return data as { interpretation: string | null; confidence: number | null; exhausted: boolean; note?: string };
  }

  const disagreeWithHypothesis = async (index: number) => {
    const key = `hyp:${index}`;
    if (reinterpretingKey) return;
    const h = store.hypotheses[index];
    if (!h) return;
    setReinterpretingKey(key);
    try {
      const quotes = evidenceForHypothesis(h, store.beliefs).map((e) => e.quote);
      const result = await requestReinterpretation(h.title, quotes, h.rejectedTitles ?? []);
      updateStore((prev) => ({
        ...prev,
        hypotheses: prev.hypotheses.map((x, i) => {
          if (i !== index) return x;
          if (result.exhausted || !result.interpretation) {
            return { ...x, reaction: "disagree" as const, exhausted: true };
          }
          return {
            ...x,
            title: result.interpretation as string,
            confidence: typeof result.confidence === "number" ? result.confidence : x.confidence,
            rejectedTitles: [...(x.rejectedTitles ?? []), x.title],
            reaction: null,
          };
        }),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setReinterpretingKey(null);
    }
  };

  const disagreeWithBeliefDiscovery = async (beliefId: string) => {
    const key = `belief:${beliefId}`;
    if (reinterpretingKey) return;
    const b = store.beliefs.find((x) => x.id === beliefId);
    if (!b) return;
    setReinterpretingKey(key);
    try {
      const currentText = b.discoveryInterpretationOverride ?? b.statement;
      const quotes = b.evidenceQuotes.map((q) => q.quote);
      const result = await requestReinterpretation(currentText, quotes, b.rejectedStatements ?? []);
      updateStore((prev) => ({
        ...prev,
        beliefs: prev.beliefs.map((x) => {
          if (x.id !== beliefId) return x;
          if (result.exhausted || !result.interpretation) {
            return { ...x, discoveryReaction: "disagree" as const, discoveryExhausted: true };
          }
          const previousText = x.discoveryInterpretationOverride ?? x.statement;
          return {
            ...x,
            discoveryInterpretationOverride: result.interpretation as string,
            rejectedStatements: [...(x.rejectedStatements ?? []), previousText],
            discoveryReaction: null,
          };
        }),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setReinterpretingKey(null);
    }
  };

  let content: React.ReactNode = null;
  switch (screen) {
    case "splash": content = <ScreenSplash onDone={() => setScreen("auth")} />; break;
    case "auth": content = <ScreenAuth onEmailStart={() => setScreen(realStore.account ? "login" : "signup")} onGuest={() => setScreen("onboarding")} />; break;
    case "login": content = (
      <ScreenLogin
        account={realStore.account}
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
          updateRealStore((prev) => ({ ...prev, account }));
          setScreen("onboarding");
        }}
      />
    ); break;
    case "onboarding": content = (
      <ScreenOnboarding
        initialAspiration={realStore.aspiration}
        onDone={(aspiration) => {
          if (aspiration && aspiration !== realStore.aspiration) {
            updateRealStore((prev) => ({ ...prev, aspiration, aspirationSetDate: formatDateDots(new Date()) }));
          }
          setScreen("home");
        }}
      />
    ); break;
    case "home": content = (
      <ScreenHome
        onNavSelect={goToTab}
        onStartThink={() => setScreen("think")}
        store={store}
      />
    ); break;
    case "analysis": content = (
      <ScreenAnalysis
        onNavSelect={goToTab}
        store={store}
        onOpenArtifact={(id) => setScreen(id)}
        onAgreeHypothesis={agreeToHypothesis}
        onDisagreeHypothesis={disagreeWithHypothesis}
        onInvestigateHypothesis={(index) => {
          setHypothesisIndex(index);
          setInvestigateReturnTo("analysis");
          setScreen("investigate");
        }}
        onAgreeBeliefDiscovery={agreeToBeliefDiscovery}
        onDisagreeBeliefDiscovery={disagreeWithBeliefDiscovery}
        reinterpretingKey={reinterpretingKey}
      />
    ); break;
    case "think": content = <ScreenThink onBack={() => setScreen("home")} onDone={(text) => { setThinkText(text); setAnalysisError(""); setScreen("processing"); }} />; break;
    case "processing": content = (
      <ScreenProcessing
        text={thinkText}
        matchableBeliefs={matchableCandidates(store).beliefs}
        matchablePending={matchableCandidates(store).pending}
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
            updateStore(() => merged);
            // A real analysis landed — go straight to the Analysis tab
            // instead of a separate results-summary screen; computeDiscovery
            // will pick up whatever this entry just created/reinforced as
            // "오늘의 발견" on its own.
            setScreen("analysis");
          } else {
            setScreen("thinkComplete");
          }
        }}
        onError={(msg) => { setAnalysisError(msg); setScreen("thinkComplete"); }}
      />
    ); break;
    case "thinkComplete": content = <ScreenThinkComplete error={analysisError} onDone={() => setScreen("home")} />; break;
    case "beliefs": content = <ScreenBeliefMap onBack={() => setScreen("analysis")} store={store} onRejectBelief={rejectBelief} />; break;
    case "assumptions": content = <ScreenBeliefMap onBack={() => setScreen("home")} store={store} />; break;
    case "drift": content = <ScreenDrift onBack={() => setScreen("analysis")} store={store} onSetupAspiration={() => setScreen("aspirationSetup")} />; break;
    case "aspirationSetup": content = (
      <ScreenAspirationSetup
        initialValue={store.aspiration}
        onBack={() => setScreen("drift")}
        onSave={(value) => {
          updateStore((prev) => ({ ...prev, aspiration: value, aspirationSetDate: formatDateDots(new Date()) }));
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
        onInvestigate={() => {
          setInvestigateReturnTo("hypothesisDetail");
          setScreen("investigate");
        }}
        onAgree={() => agreeToHypothesis(hypothesisIndex)}
        onDisagree={() => disagreeWithHypothesis(hypothesisIndex)}
        reinterpreting={reinterpretingKey === `hyp:${hypothesisIndex}`}
      />
    ); break;
    case "investigate": {
      const investigatedHypothesis = store.hypotheses[hypothesisIndex] ?? store.hypotheses[0];
      content = investigatedHypothesis?.investigate ? (
        <ScreenInvestigate investigate={investigatedHypothesis.investigate} onBack={() => setScreen(investigateReturnTo)} />
      ) : (
        <ScreenHypotheses onBack={() => setScreen("home")} store={store} onOpen={(i) => { setHypothesisIndex(i); setScreen("hypothesisDetail"); }} />
      );
      break;
    }
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
        isDemoMode={isDemoMode}
        onToggleDemoMode={setIsDemoMode}
        onOpenSettings={(s) => setScreen(s === "notifications" ? "notifications" : s === "dataPrivacy" ? "dataPrivacy" : "help")}
      />
    ); break;
    case "notifications": content = (
      <ScreenNotificationSettings
        settings={store.settings}
        onBack={() => setScreen("profile")}
        onChange={(settings) => updateStore((prev) => ({ ...prev, settings }))}
      />
    ); break;
    case "dataPrivacy": content = (
      <ScreenDataPrivacy
        store={store}
        onBack={() => setScreen("profile")}
        onResetData={() => {
          updateStore(() => emptyStore());
          setScreen("profile");
        }}
      />
    ); break;
    case "help": content = <ScreenHelp onBack={() => setScreen("profile")} />; break;
    default: content = <ScreenHome onNavSelect={goToTab} onStartThink={() => setScreen("think")} store={store} />;
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
