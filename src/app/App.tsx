import React from "react";
import { motion, AnimatePresence } from "motion/react";
import NeuralBeliefGraph3D, { REGION_CONFIG, resolveRegion } from "./NeuralBeliefGraph3D";
import BrainNodeMapScreen from "./BrainNodeMapScreen";
import { CognitiveRegion, COGNITIVE_REGIONS } from "./neuralBrainLayout";
import {
  LanguageObservation,
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
import { appendUnanalyzedEntry, mergeAnalysisIntoStore } from "./realStore";
import { detectCrisisSignal } from "./crisisDetection";
import { isCloudSyncConfigured } from "./supabaseClient";
import { cloudSignIn, cloudSignOut, cloudSignUp } from "./cloudSync";
import { useAppData } from "./dataProvider";
import { COGNITIVE_PATTERN_DESCRIPTIONS, COGNITIVE_PATTERN_REFLECTIONS, DISCLAIMER_NOTICE, GENERIC_PATTERN_REFLECTION, findBeliefClusters, findContradictionPairs, isLikelyRuminating, matchableCandidates } from "./analysisFramework";
import { comparePronounLean, compareCognitiveVerbTrend, extractCognitiveVerbExamples } from "./cognitiveLexicon";
import { pickInputGuidance } from "./inputGuidance";

// ── Launch config ────────────────────────────────────────────────────────────
// Off for the initial launch: gathering real usage/feedback matters more
// right now than revenue, so every screen behaves as if every account were
// Pro — full analysis, Brain Map, hypotheses, drift, all of it, for free.
// The entire Pro/paywall/checkout/subscription-management system underneath
// this flag is fully built and untouched (see ScreenPaywall, ScreenCheckout,
// ScreenManageSubscription, PRO_PLANS below, and appendUnanalyzedEntry in
// realStore.ts) — flipping this back to true is the only change needed to
// re-enable it later. Every gate below reads MONETIZATION_ENABLED, never
// store.isPro directly, specifically so this one flag is a real kill switch
// and not just one of several places that would need to change together.
const MONETIZATION_ENABLED = false;

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
// Home/Analysis/History/Profile screens.dc.html). Every other screen
// (onboarding, login, think-out-loud, etc.) still uses the light palette above — those weren't
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
// History/Profile only — a faint scattered-star texture behind the flat dark
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

// ── Modernist theme — per the imported claude.ai/design "Modernist" design
// system (project 18c81e97, Undecided - Modernist redesign.dc.html): a light,
// architectural mono-red-on-white palette replacing the dk* dark theme.
// Values are the design system's own CSS custom properties resolved to
// literal strings (styles.css: --color-bg/--color-text/--color-accent and
// their OKLCH tonal ramps) — this app has no external stylesheet, so every
// screen reads these as plain inline-style constants instead of `.tag`/
// `.btn` classes, same convention as the old dk* tokens.
const mdBg = "#f3f2f2";
const mdCard = "#ffffff";
const mdCardShadow = "0 1px 2px rgba(45,43,43,0.14)";
const mdCardShadowLg = "0 12px 32px rgba(45,43,43,0.22)";
const mdHeading = "#201e1d";
const mdBody = "rgba(32,30,29,0.62)";
const mdBodyLight = "rgba(32,30,29,0.85)";
const mdFaint = "rgba(32,30,29,0.42)";
const mdAccent = "#ec3013";
const mdAccentHover = "#dd2b0f";
const mdAccentText = "#ae1800"; // deep ramp step — the design system's own rule for accent-colored body/paragraph text (the accent itself is only 3:1 against this ground, not enough for small text)
const mdAccentSoft = "#fff2ef";
const mdAccentTag = "#ffe0d9";
const mdAccentTagText = "#7c1405";
const mdTrack = "#d7d3d3";
const mdDivider = "rgba(32,30,29,0.14)";
const mdNeutralTag = "#f8f4f4";
const mdNeutralTagText = "#444141";
// Warn ramp — a distinct muted amber (not the red accent) for "conflicting
// evidence"/caution states, same relationship dkWarn has to dkAccent in the
// dark theme: a second, clearly different hue reserved for that one job,
// never competing with the mono-red accent everywhere else.
const mdWarn = "#a85a1a";
const mdWarnSoft = "rgba(168,90,26,0.10)";
const mdWarnTag = "rgba(168,90,26,0.14)";
const mdWarnTagText = "#7a4310";
const mdWarnLabel = "#7a4310";

// ── Status bar ────────────────────────────────────────────────────────────────
function StatusBar({ modernist }: { modernist?: boolean }) {
  const color = modernist ? mdHeading : dkHeading;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 4px", flexShrink: 0 }}>
      <span style={{ ...sans, fontSize: 13, fontWeight: modernist ? 800 : 600, color }}>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 16, height: 10, border: `1px solid ${color}`, borderRadius: 2, position: "relative" }}>
          <div style={{ position: "absolute", inset: 1, right: 4, backgroundColor: color, borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

// Same parallel-session port as NavIcon below — a small waveform glyph for
// Home's "Speak your mind" button, replacing the plain dot with something that
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
function BottomNav({ active, onSelect, dark, modernist }: { active: string; onSelect?: (id: string) => void; dark?: boolean; modernist?: boolean }) {
  const items = [
    { id: "home", label: "Home" },
    { id: "analysis", label: "Mind" },
    { id: "history", label: "History" },
    { id: "profile", label: "Profile" },
  ];
  const activeColor = modernist ? mdAccentText : dark ? dkAccentLight : "#6B6EF6";
  const inactiveColor = modernist ? "#8b8785" /* --color-neutral-600 */ : dark ? "#726A8A" : "#8B8A92";
  const pillColor = modernist ? mdAccentSoft : dark ? "rgba(123,92,240,0.16)" : "#F0EEFF";
  const themeKey = modernist ? "modernist" : dark ? "dark" : "light";
  return (
    <div
      style={{
        position: modernist || dark ? "sticky" : "static",
        bottom: modernist || dark ? 0 : undefined,
        display: "flex",
        borderTop: `1px solid ${modernist ? mdDivider : dark ? dkDivider : hair}`,
        backgroundColor: modernist ? "rgba(255,255,255,0.82)" : dark ? "rgba(10,7,22,0.85)" : "rgba(255,255,255,0.82)",
        backdropFilter: "blur(12px)",
        padding: "8px 10px",
        // Real value on a notched/gesture-nav phone (clears the home
        // indicator so nothing renders under it), 0px everywhere else —
        // always safe to include unconditionally.
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        flexShrink: 0,
      }}
    >
      {items.map((item) => {
        const isActive = active === item.id;
        const color = isActive ? activeColor : inactiveColor;
        return (
          <motion.div
            key={item.id}
            data-tutorial={`nav-${item.id}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(item.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect?.(item.id); }}
            whileTap={{ opacity: 0.7 }}
            style={{ flex: 1, position: "relative", display: "flex", justifyContent: "center", padding: "2px 4px", cursor: "pointer" }}
          >
            {isActive && (
              <motion.div
                layoutId={`navSelectedPill-${themeKey}`}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: "absolute", inset: "0 6px", borderRadius: 18, backgroundColor: pillColor, zIndex: 0 }}
              />
            )}
            <div style={{ position: "relative", zIndex: 1, minWidth: 44, minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <NavIcon id={item.id} color={color} />
              <span style={{ ...sans, fontSize: 10.5, fontWeight: isActive ? (modernist ? 800 : 600) : (modernist ? 500 : 400), color }}>{item.label}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, modernist = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; modernist?: boolean }) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => { if (!disabled && onClick && (e.key === "Enter" || e.key === " ")) onClick(); }}
      whileTap={disabled ? undefined : { scale: 0.98, opacity: 0.9 }}
      style={{
        ...sans, width: "100%", padding: "15px 0", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: disabled ? (modernist ? mdTrack : dkTrack) : (modernist ? mdAccent : dkAccent),
        color: disabled ? (modernist ? "#a29d9d" : "#6E6580") : "#fff",
        borderRadius: 14, fontSize: 16, fontWeight: 600, cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </motion.div>
  );
}

function GhostBtn({ children, onClick, modernist = false }: { children: React.ReactNode; onClick?: () => void; modernist?: boolean }) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      whileTap={{ opacity: 0.6 }}
      style={{
        ...sans, width: "100%", padding: "15px 0", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "transparent", color: modernist ? mdBody : dkBody,
        border: `1px solid ${modernist ? mdDivider : dkDivider}`, borderRadius: 14, fontSize: 15, fontWeight: 500, cursor: "pointer",
      }}
    >
      {children}
    </motion.div>
  );
}

// ── Confidence bar — the one recurring data visualization: always a real
// 0-100 number backing an AI hypothesis, never decorative. ───────────────────
function ConfidenceBar({ value, dark, modernist }: { value: number; dark?: boolean; modernist?: boolean }) {
  const labelColor = modernist ? mdBody : dark ? dkBody : subtle;
  const fillColor = modernist ? mdAccent : dark ? dkAccent : accent;
  const trackColor = modernist ? mdTrack : dark ? dkTrack : hair;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: labelColor, letterSpacing: "0.04em" }}>Confidence</span>
        <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: fillColor }}>{value}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, backgroundColor: trackColor, marginTop: 6 }}>
        <div style={{ height: "100%", width: `${value}%`, backgroundColor: fillColor, borderRadius: 3 }} />
      </div>
    </div>
  );
}

// A pacing/breather card between dense content — a lesson carried over from
// an earlier project: don't staple a bridging question onto the bottom of a
// content card. Give it its own quiet screen instead. No chart, no stat, no
// decoration competes with it; deliberately visual-free by design, not a
// placeholder for a chart that's missing.
// Only ever used by ScreenInvestigate below, which is fully Modernist —
// straight md* tokens, no dual-theme prop needed (see BeliefCard/etc. above
// for the pattern this would follow if a dark consumer ever showed up).
function ScreenPivot({ kicker, statement, counter, cta }: { kicker?: string; statement: React.ReactNode; counter?: string; cta?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 24px 14px", minHeight: 0 }}>
        <div style={{ flex: 1.4 }} />
        <div>
          {kicker && (
            <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em", wordBreak: "keep-all" }}>{kicker}</div>
          )}
          <div style={{ ...serif, fontSize: 26, color: mdHeading, lineHeight: 1.45, marginTop: kicker ? 14 : 0, wordBreak: "keep-all" }}>{statement}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div>
          {cta}
          {counter && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: cta ? 14 : 0 }}>
              <span style={{ ...mono, fontSize: 12, color: mdBody }}>{counter}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared "current vs. actual" row grammar — arrow-connected steps kept at
// identical geometry across rows so alignment itself teaches the comparison,
// a hairline divider instead of a bordered card per row. Only ever used by
// ScreenInvestigate, which is fully Modernist — straight md* tokens.
function AlignedRowCompare({ rows }: { rows: { label: string; steps: string[]; accent?: boolean }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((row, ri) => (
        <div key={row.label} style={{ paddingTop: ri === 0 ? 0 : 16, paddingBottom: ri < rows.length - 1 ? 16 : 0, borderBottom: ri < rows.length - 1 ? `1px solid ${mdDivider}` : "none" }}>
          <div style={{ ...sans, fontSize: 10.5, fontWeight: 700, color: row.accent ? mdAccentText : mdBody, letterSpacing: "0.03em", marginBottom: 10 }}>{row.label}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {row.steps.map((step, i) => (
              <React.Fragment key={step}>
                <div style={{ ...sans, fontSize: 12, fontWeight: i % 2 === 1 ? 700 : 500, color: i % 2 === 1 ? (row.accent ? mdAccentText : mdHeading) : mdBody, textAlign: "center", lineHeight: 1.3, wordBreak: "keep-all" }}>{step}</div>
                {i < row.steps.length - 1 && (<div style={{ ...sans, fontSize: 12, color: row.accent ? mdAccentText : mdBody, flexShrink: 0, padding: "0 4px" }}>→</div>)}
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", backgroundColor: mdBg, padding: 32 }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: mdBody, textAlign: "center", letterSpacing: "0.02em" }}>
          Mindscape
        </div>
        <div style={{ ...serif, fontSize: 26, color: mdHeading, textAlign: "center", marginTop: 18, lineHeight: 1.5, wordBreak: "keep-all" }}>
          There's a pattern<br />in your thinking.
        </div>
        <div style={{ ...sans, fontSize: 14, color: mdBody, textAlign: "center", marginTop: 14, lineHeight: 1.6, wordBreak: "keep-all" }}>
          You just can't see it from the inside.
        </div>
      </motion.div>
    </div>
  );
}

// ── Screen 2 · Auth ───────────────────────────────────────────────────────────
function ScreenAuth({ onEmailStart, onGuest }: { onEmailStart?: () => void; onGuest?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: mdBody, textAlign: "center" }}>Mindscape</div>
        <div style={{ ...serif, fontSize: 24, color: mdHeading, textAlign: "center", marginTop: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>
          Not a journaling app —<br />a tool for understanding how you think
        </div>
      </div>
      <div style={{ padding: "0 28px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        <PrimaryBtn onClick={onEmailStart} modernist>Continue with email</PrimaryBtn>
        <GhostBtn onClick={onGuest} modernist>Browse as a guest</GhostBtn>
      </div>
    </div>
  );
}

function TextField({ label, type = "text", value, onChange, placeholder, error }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...sans, width: "100%", padding: "13px 14px", borderRadius: 12, boxSizing: "border-box",
          border: `1px solid ${error ? mdWarn : mdDivider}`,
          // 16px, not 15 — iOS Safari auto-zooms the whole page on focus for
          // any input under 16px, which then has to be manually pinched back
          // out. Below that threshold it's a real mobile bug, not a style nit.
          fontSize: 16, color: mdHeading,
          backgroundColor: mdCard, outline: "none",
        }}
      />
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Real Supabase auth when cloud sync is configured (see supabaseClient.ts);
// otherwise the original local-only mock — checking against the single
// account stored on this device (see StoredAccount) — so the app still
// works exactly as before wherever Supabase env vars aren't set.
function ScreenLogin({ account, onBack, onGoSignup, onLogin }: { account: StoredAccount | null; onBack?: () => void; onGoSignup?: () => void; onLogin?: () => void }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    if (loading) return;
    setError("");
    if (!email.trim() || !password) { setError("Please enter both an email and a password."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("That doesn't look like a valid email."); return; }
    setLoading(true);

    if (isCloudSyncConfigured) {
      try {
        await cloudSignIn(email.trim(), password);
        setLoading(false);
        onLogin?.();
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Couldn't log in.");
      }
      return;
    }

    setTimeout(() => {
      setLoading(false);
      if (!account) { setError("No account found. Please sign up first."); return; }
      if (account.email.toLowerCase() !== email.trim().toLowerCase() || account.password !== password) {
        setError("Email or password is incorrect.");
        return;
      }
      onLogin?.();
    }, 500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 0", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 28px 24px" }}>
        <div style={{ ...serif, fontSize: 24, color: mdHeading, lineHeight: 1.4 }}>Welcome back</div>
        <div style={{ marginTop: 24 }}>
          <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" error={!!error} />
          <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" error={!!error} />
        </div>
        {error && <div style={{ ...sans, fontSize: 12.5, color: mdWarn, marginTop: 2, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>{error}</div>}
        <PrimaryBtn onClick={submit} disabled={loading} modernist>{loading ? "Checking…" : "Log in"}</PrimaryBtn>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span style={{ ...sans, fontSize: 13, color: mdBody }}>Don't have an account? </span>
          <motion.span role="button" tabIndex={0} onClick={onGoSignup} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdAccentText, fontWeight: 600, cursor: "pointer" }}>Sign up</motion.span>
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
  // Distinct from `error` — Supabase projects that require email
  // confirmation return a user with no active session yet, which isn't a
  // failure, just a "one more step" state that needs its own tone (not
  // red/warning-colored) and shouldn't advance past this screen.
  const [info, setInfo] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    if (loading) return;
    setError("");
    setInfo("");
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("That doesn't look like a valid email."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);

    if (isCloudSyncConfigured) {
      try {
        const data = await cloudSignUp(email.trim(), password, name.trim());
        setLoading(false);
        if (!data.session) {
          setInfo("Check your email for a confirmation link, then log in.");
          return;
        }
        // Real auth already has the password, hashed, in Supabase's own
        // auth.users table — never duplicated here in plaintext, since
        // this object is what gets synced to user_stores as part of the
        // Store (see cloudSync.ts / supabase/schema.sql).
        onSignup?.({ name: name.trim(), email: email.trim(), password: "" });
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Couldn't create an account.");
      }
      return;
    }

    setTimeout(() => {
      setLoading(false);
      onSignup?.({ name: name.trim(), email: email.trim(), password });
    }, 500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 0", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 28px 24px" }}>
        <div style={{ ...serif, fontSize: 24, color: mdHeading, lineHeight: 1.4 }}>Let's create an account</div>
        <div style={{ ...sans, fontSize: 12.5, color: mdBody, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>
          {isCloudSyncConfigured
            ? "Synced privately to your account, so it's there on any device you log into — never sold, never shared."
            : "It only lives on this device. Nothing is sent to any server."}
        </div>
        <div style={{ marginTop: 20 }}>
          <TextField label="Name" value={name} onChange={setName} placeholder="What should we call you?" error={!!error} />
          <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" error={!!error} />
          <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="6+ characters" error={!!error} />
        </div>
        {error && <div style={{ ...sans, fontSize: 12.5, color: mdWarn, marginTop: 2, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>{error}</div>}
        {info && <div style={{ ...sans, fontSize: 12.5, color: mdAccentText, marginTop: 2, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>{info}</div>}
        <PrimaryBtn onClick={submit} disabled={loading} modernist>{loading ? "Creating…" : "Sign up"}</PrimaryBtn>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span style={{ ...sans, fontSize: 13, color: mdBody }}>Already have an account? </span>
          <motion.span role="button" tabIndex={0} onClick={onGoLogin} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdAccentText, fontWeight: 600, cursor: "pointer" }}>Log in</motion.span>
        </div>
      </div>
    </div>
  );
}

// ── Screen 3 · Onboarding (3 short beats) ────────────────────────────────────
// Simple stroke-based glyphs, same style as WaveformIcon/the bottom-nav
// icons (24x24 viewBox, no fill, rounded strokes) — one per onboarding
// slide, Apple-onboarding-style (Health/Fitness+: a big glyph, a headline,
// one line of body copy, nothing busier than that).
function OnboardingIcon({ kind, size = 56 }: { kind: "welcome" | "speak" | "watch" | "pattern"; size?: number }) {
  const color = mdAccent;
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const };
  if (kind === "welcome") {
    // A loose constellation radiating from a center point — the same
    // "your thoughts become this brain" idea the Home hero card shows in
    // miniature, here as a single simple glyph rather than the real 3D field.
    return (
      <svg {...common}>
        <g stroke={color} strokeWidth="1" opacity="0.4">
          <path d="M12 12L6 8M12 12L18 9M12 12L8 17M12 12L17 16M12 12L12 4" />
        </g>
        <circle cx="12" cy="12" r="1.8" fill={color} />
        <circle cx="6" cy="8" r="1.1" fill={color} opacity="0.75" />
        <circle cx="18" cy="9" r="1.3" fill={color} opacity="0.85" />
        <circle cx="8" cy="17" r="1.4" fill={color} opacity="0.9" />
        <circle cx="17" cy="16" r="1" fill={color} opacity="0.65" />
        <circle cx="12" cy="4" r="0.9" fill={color} opacity="0.55" />
      </svg>
    );
  }
  if (kind === "speak") {
    return (
      <svg {...common}>
        <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v7A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5v-7Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
          <path d="M8.5 8.5v2" />
          <path d="M11.5 7v5" />
          <path d="M14.5 8.5v2" />
        </g>
      </svg>
    );
  }
  if (kind === "watch") {
    return (
      <svg {...common}>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  // "pattern" — concentric rings, the repeated-signal idea rendered simply.
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7.5" stroke={color} strokeWidth="1.2" opacity="0.55" />
      <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

// Two loose hand-placed clusters (not the real generateBrainCloud — this is
// a decorative ~20-point stand-in, not the actual tissue) roughly tracing
// two hemispheres, same visual language as the real Brain Map without the
// WebGL cost of mounting/unmounting a Three.js scene every time onboarding's
// AnimatePresence swaps slides. viewBox is 0 0 100 80.
const MINI_BRAIN_DOTS: { x: number; y: number; r: number }[] = [
  { x: 22, y: 35, r: 1.8 }, { x: 30, y: 26, r: 1.3 }, { x: 16, y: 46, r: 1.6 },
  { x: 26, y: 58, r: 1.2 }, { x: 36, y: 42, r: 1.9 }, { x: 14, y: 60, r: 1.1 },
  { x: 33, y: 66, r: 1.4 }, { x: 24, y: 20, r: 1.0 }, { x: 41, y: 50, r: 1.3 },
  { x: 11, y: 40, r: 1.2 },
  { x: 78, y: 35, r: 1.7 }, { x: 70, y: 26, r: 1.4 }, { x: 84, y: 46, r: 1.5 },
  { x: 74, y: 58, r: 1.2 }, { x: 64, y: 42, r: 1.8 }, { x: 86, y: 60, r: 1.1 },
  { x: 67, y: 66, r: 1.3 }, { x: 76, y: 20, r: 1.0 }, { x: 59, y: 50, r: 1.4 },
  { x: 89, y: 40, r: 1.2 },
];

// Onboarding's own "show, don't tell" moment for the whole "just say
// anything" idea — a real (if tiny) text field, and typing into it and
// tapping "Try it" spawns one new glowing point at the center gap between
// the two hemispheres, echoing the interactive tour's own first line
// almost verbatim ("Every time you speak, a new point appears") so this
// reads as a preview of that mechanic, not a different one. What's typed
// here is never saved anywhere — purely a demonstration, matching the "no
// pressure" tone the rest of onboarding already has.
function OnboardingBrainDemo() {
  const [text, setText] = React.useState("");
  const [activated, setActivated] = React.useState(false);
  const tryIt = () => {
    if (!text.trim()) return;
    setActivated(true);
  };
  return (
    <div style={{ width: "100%" }}>
      <svg width="100%" height="120" viewBox="0 0 100 80" style={{ display: "block" }}>
        {MINI_BRAIN_DOTS.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={mdAccent} opacity={0.28} />
        ))}
        {activated && (
          <>
            <motion.circle
              cx={50} cy={44} fill={mdAccent}
              initial={{ r: 0, opacity: 0 }}
              animate={{ r: 3.2, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            <motion.circle
              cx={50} cy={44} r={3.2} fill="none" stroke={mdAccent} strokeWidth={0.6}
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 2.8 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </>
        )}
      </svg>
      {!activated ? (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") tryIt(); }}
            placeholder="Try typing anything…"
            style={{
              flex: 1, ...sans, fontSize: 14, padding: "10px 12px", borderRadius: 10,
              border: `1px solid ${mdDivider}`, backgroundColor: mdCard, color: mdHeading, outline: "none",
            }}
          />
          <motion.div
            role="button" tabIndex={0} onClick={tryIt} whileTap={text.trim() ? { scale: 0.96 } : undefined}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", borderRadius: 10,
              backgroundColor: text.trim() ? mdAccent : mdTrack, color: text.trim() ? "#fff" : "#a29d9d",
              ...sans, fontSize: 13, fontWeight: 700, cursor: text.trim() ? "pointer" : "default", flexShrink: 0,
            }}
          >
            Try it
          </motion.div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          style={{ ...sans, fontSize: 13, fontWeight: 600, color: mdAccentText, marginTop: 8, textAlign: "center" }}
        >
          That's what happens every time you speak.
        </motion.div>
      )}
    </div>
  );
}

const ONBOARDING_SLIDES = [
  {
    icon: "welcome" as const,
    kicker: null as string | null,
    title: "Welcome to\nMindscape.",
    body: "A quiet mirror for the unconscious beliefs running underneath your everyday thoughts.",
  },
  {
    icon: "speak" as const,
    kicker: "Don't organize it",
    title: "Just say whatever\ncomes to mind.",
    body: "No tidy sentences, no prompts required — try it below.",
  },
  {
    icon: "watch" as const,
    kicker: "The AI's role",
    title: "The AI doesn't give answers.\nIt watches for patterns.",
    body: "Instead of advising you each time, it quietly observes the unconscious interpretations and judgment habits you repeat across hundreds of conversations.",
  },
  {
    icon: "pattern" as const,
    kicker: "Over time",
    title: "You start to see patterns\nyou never noticed in yourself.",
    body: "\"When things are uncertain, it's safest to wait\" — it's hard to notice from the inside that this underlying interpretation has repeated in your career, your relationships, and your investing.",
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

  const isWelcome = slide?.kicker == null;
  // The one slide that shows instead of just telling — see
  // OnboardingBrainDemo above for why this is worth a special case rather
  // than threading a demo prop through the generic slide template used by
  // the other three.
  const isInteractive = i === 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 6, padding: "20px 28px 0", flexShrink: 0 }}>
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div key={idx} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: idx <= i ? mdAccentText : mdDivider }} />
        ))}
      </div>
      {!isAspirationStep ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            style={{
              flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px",
              alignItems: isWelcome ? "center" : "stretch", textAlign: isWelcome ? "center" : "left",
            }}
          >
            {!isInteractive && (
              <div style={{ marginBottom: isWelcome ? 22 : 16 }}>
                <OnboardingIcon kind={slide!.icon} size={isWelcome ? 72 : 44} />
              </div>
            )}
            {slide!.kicker && (
              <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdAccentText, letterSpacing: "0.06em" }}>{slide!.kicker}</div>
            )}
            <div
              style={{
                ...serif, fontSize: isWelcome ? 34 : 28, color: mdHeading, marginTop: isWelcome ? 4 : 14,
                lineHeight: 1.32, whiteSpace: "pre-line", wordBreak: "keep-all",
              }}
            >
              {slide!.title}
            </div>
            <div style={{ ...sans, fontSize: isWelcome ? 15.5 : 15, color: mdBody, marginTop: isWelcome ? 16 : 18, lineHeight: 1.65, wordBreak: "keep-all", maxWidth: isWelcome ? 280 : undefined }}>
              {slide!.body}
            </div>
            {isInteractive && (
              <div style={{ marginTop: 22 }}>
                <OnboardingBrainDemo />
              </div>
            )}
            {/* The one place this disclosure needs to land before anyone
                types a word — both halves matter equally: "not therapy" is
                the legal/ethical baseline, and naming the crisis exception
                up front is what keeps ScreenCrisisSupport from reading as a
                surprise breach of "observe, don't judge" the one time it
                actually activates. See crisisDetection.ts. */}
            {isWelcome && (
              <div style={{ ...sans, fontSize: 12, color: mdFaint, marginTop: 22, lineHeight: 1.6, wordBreak: "keep-all", maxWidth: 280 }}>
                Not a substitute for therapy or counseling. If what you share ever suggests you're in crisis, we'll gently connect you with real support — that's the one exception to keeping this just between you and the app.
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 28px" }}>
          <div style={{ flexShrink: 0, paddingTop: 8 }}>
            <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdAccentText, letterSpacing: "0.06em" }}>Last thing</div>
            <div style={{ ...serif, fontSize: 26, color: mdHeading, marginTop: 14, lineHeight: 1.4, wordBreak: "keep-all" }}>
              What kind of person<br />do you want to become?
            </div>
            <div style={{ ...sans, fontSize: 13.5, color: mdBody, marginTop: 12, lineHeight: 1.6, wordBreak: "keep-all" }}>
              Optional. If you write it down, we'll keep showing you the distance between this and the thoughts you leave here going forward.
            </div>
          </div>
          <textarea
            autoFocus
            value={aspiration}
            onChange={(e) => setAspiration(e.target.value)}
            placeholder="e.g. I want to be someone who chooses challenge over safety."
            style={{
              ...serif, flex: 1, width: "100%", resize: "none", border: "none", outline: "none",
              backgroundColor: "transparent", color: mdHeading, fontSize: 18, lineHeight: 1.7,
              wordBreak: "keep-all", marginTop: 18, minHeight: 0, colorScheme: "light",
            }}
          />
        </div>
      )}
      <div style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <PrimaryBtn onClick={() => (isLast ? onDone?.(aspiration.trim() || null) : setI((v) => v + 1))} modernist>
          {isLast ? (aspiration.trim() ? "Save and start" : "Skip and start") : i === 0 ? "Get Started" : "Next"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// A real, interactive coach-mark tour instead of a detached slide deck —
// the whole point being "point at the actual thing, explain it, let the
// real tap through" rather than a wall of text about the app. Every step
// spotlights one real, already-rendered element (found by its
// data-tutorial attribute — see BrainNodeMapScreen's card, BottomNav's
// items, SectionCard's dataTutorial prop, etc.), dims everything else via
// four surrounding bands (not a CSS mask/clip-path, so the math stays
// simple and the spotlighted element's own click handler keeps working
// completely unmodified underneath), and shows a tooltip with the step's
// explanation. A step with `navTo` is a real navigation step: its own
// nav-bar icon is left clickable under the spotlight, and the tooltip's
// button performs the exact same setScreen the real tap would — both
// paths converge on one `useEffect` (see the app shell) that advances the
// tour once `screen` actually reaches that step's target, so there's only
// one place that decides "we've arrived," never two competing ones.
type TutorialStep = {
  screen: "home" | "analysis" | "history" | "profile";
  target: string;
  title: string;
  body: string;
  navTo?: "analysis" | "history" | "profile";
};

// A function of isPro, not a static list — free tier lands on ScreenPaywall
// instead of the real ScreenAnalysis for the "analysis" step, so that one
// step needs different copy pointing at the paywall's feature list instead
// of the (Pro-only) real discovery card. Same target key ("today-discovery")
// exists on both — see the paywall's own data-tutorial. Everything else is
// identical either way; recomputed via useMemo in the App shell whenever
// isPro changes so a mid-tour upgrade doesn't leave stale copy in place.
function buildTutorialSteps(isPro: boolean): TutorialStep[] {
  return [
    {
      screen: "home",
      target: "brain-card",
      title: "This brain is going to become you",
      body: "Every time you speak, a new point appears — and the more a pattern repeats, the more brightly that spot glows.",
    },
    {
      screen: "home",
      target: "think-card",
      title: "Just say it, however it comes out",
      body: "Something that happened today, a thought that popped up — leave it as is, no need to organize it. Voice or text both work.",
    },
    {
      screen: "home",
      target: "nav-analysis",
      title: "Check patterns in Mind",
      body: "We organize the patterns that keep showing up across what you've recorded. Want to tap in and take a look?",
      navTo: "analysis",
    },
    isPro
      ? {
          screen: "analysis",
          target: "today-discovery",
          title: "Today's discovery",
          body: "This is where we show you beliefs that keep repeating without you noticing. Not a diagnosis — just an observation, as-is.",
        }
      : {
          screen: "analysis",
          target: "today-discovery",
          title: "This is what Pro unlocks",
          body: "Recording is always free. Once you're subscribed, this is where your recorded thoughts turn into beliefs, connections, and hypotheses like these.",
        },
    {
      screen: "analysis",
      target: "nav-history",
      title: "See past thoughts in History",
      body: "They're gathered here by the date you spoke them. Want to tap in and take a look?",
      navTo: "history",
    },
    {
      screen: "history",
      target: "history-list",
      title: "Your past thoughts gather here",
      body: "You can open any of them back up whenever you're curious.",
    },
    {
      screen: "history",
      target: "nav-profile",
      title: "See your journey in Profile",
      body: "You can see everything you've built up at a glance. Want to tap in and take a look?",
      navTo: "profile",
    },
    {
      screen: "profile",
      target: "profile-stats",
      title: "Your journey builds up here",
      body: "You can track things like questions you've engaged with, shifts in your thinking, and your streak of days showing up.",
    },
  ];
}

// Re-measures on step/screen change and on resize, plus one short retry —
// the target it's looking for may not have mounted yet the instant a new
// screen's fade-in starts (AnimatePresence), so a single synchronous
// measurement on mount can legitimately come up empty.
function useTutorialTargetRect(target: string, frameRef: React.RefObject<HTMLDivElement>, screen: string) {
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number; height: number } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const frame = frameRef.current;
      const el = frame?.querySelector(`[data-tutorial="${target}"]`) as HTMLElement | null;
      if (!frame || !el) { setRect(null); return; }
      const f = frame.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - f.top, left: r.left - f.left, width: r.width, height: r.height });
    };
    measure();
    const retry = setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    return () => { cancelled = true; clearTimeout(retry); window.removeEventListener("resize", measure); };
  }, [target, frameRef, screen]);
  return rect;
}

function TutorialOverlay({
  step,
  stepIndex,
  totalSteps,
  frameRef,
  screen,
  onNext,
  onSkip,
}: {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  frameRef: React.RefObject<HTMLDivElement>;
  screen: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  const rect = useTutorialTargetRect(step.target, frameRef, screen);
  const isLast = stepIndex === totalSteps - 1;
  // Only render once the current real screen matches this step's screen —
  // otherwise we're mid-transition and the target genuinely isn't there
  // yet; useTutorialTargetRect's retry picks it back up a moment later.
  if (screen !== step.screen || !rect) return null;

  const pad = 6;
  const spot = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  // Was a hardcoded 852 (the desktop device-mockup's fixed height) — wrong
  // on mobile, where the frame renders full-bleed at 100dvh (see the app
  // shell's frameRef div), so a real phone's actual height could be well
  // under or over 852 and this "should the tooltip go above or below"
  // math would place it off-screen. Measuring the real frame gets both
  // modes right with the same formula.
  const FRAME_H = frameRef.current?.getBoundingClientRect().height ?? 852;
  // ~190 is the tooltip's own approximate rendered height (title + 2-3
  // lines of body + button) — no ref-measurement needed for a card this
  // predictable in shape, and it's already the threshold the "does it fit
  // below" check used before this fix. A spotlight target that's short
  // (a card, a nav icon) always clears one side or the other; one that
  // spans nearly the full screen (an empty full-height list, e.g.
  // "history-list" with no entries yet) can leave neither side with 190px
  // to spare, in which case the tooltip pins to a fixed safe top instead
  // of bottom-anchoring above the spotlight and running off the top of
  // the screen — reachable and fully readable beats non-overlap here.
  const TOOLTIP_H = 190;
  const fitsBelow = spot.top + spot.height + TOOLTIP_H < FRAME_H;
  const fitsAbove = spot.top - TOOLTIP_H > 40;
  const tooltipPosition: "below" | "above" | "pinned" = fitsBelow ? "below" : fitsAbove ? "above" : "pinned";
  const bandColor = "rgba(24,20,18,0.72)";

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 300, pointerEvents: "none" }}>
      {/* Four dimming bands around the spotlight — never a mask/clip-path
      over the whole overlay, so the spotlighted element itself has no
      overlay above it at all and its real onClick fires completely
      normally when navTo steps are tapped directly. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(0, spot.top), backgroundColor: bandColor, pointerEvents: "auto" }} />
      <div style={{ position: "absolute", top: spot.top + spot.height, left: 0, right: 0, bottom: 0, backgroundColor: bandColor, pointerEvents: "auto" }} />
      <div style={{ position: "absolute", top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height, backgroundColor: bandColor, pointerEvents: "auto" }} />
      <div style={{ position: "absolute", top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height, backgroundColor: bandColor, pointerEvents: "auto" }} />

      {/* Glow ring on the real element — the spotlight itself. */}
      <motion.div
        key={step.target}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{
          position: "absolute", top: spot.top, left: spot.left, width: spot.width, height: spot.height,
          borderRadius: 18, border: `2px solid ${mdAccent}`, boxShadow: `0 0 0 5px ${mdAccentSoft}`,
          pointerEvents: "none",
        }}
      />

      {/* Skip, always reachable. */}
      <motion.span
        role="button" tabIndex={0} onClick={onSkip} whileTap={{ opacity: 0.6 }}
        style={{
          position: "absolute", top: 16, right: 16, ...sans, fontSize: 12, fontWeight: 600, color: "#fff",
          backgroundColor: "rgba(0,0,0,0.35)", padding: "6px 12px", borderRadius: 999, cursor: "pointer", backdropFilter: "blur(6px)",
          pointerEvents: "auto",
        }}
      >
        Skip {stepIndex + 1}/{totalSteps}
      </motion.span>

      {/* Tooltip — below/above/pinned depending on where the spotlight sits
      and how much room is actually available (see tooltipPosition above). */}
      <motion.div
        key={`tip-${step.target}`}
        initial={{ opacity: 0, y: tooltipPosition === "above" ? -8 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut", delay: 0.1 }}
        style={{
          position: "absolute",
          left: 20, right: 20,
          // "below"/"above" anchor by `top`/`bottom` respectively (the
          // "above" case grows upward from the spotlight so it can never
          // overlap the cutout no matter how tall the content renders);
          // "pinned" is the neither-fits fallback (e.g. a spotlight target
          // that spans nearly the full screen) and just sits at a fixed
          // safe offset from the top instead of running off-screen.
          ...(tooltipPosition === "below"
            ? { top: spot.top + spot.height + 14 }
            : tooltipPosition === "above"
              ? { bottom: FRAME_H - spot.top + 14 }
              : { top: 60 }),
          backgroundColor: mdCard, borderRadius: 18, padding: "18px 20px", boxShadow: mdCardShadowLg,
          pointerEvents: "auto",
        }}
      >
        <div style={{ ...sans, fontSize: 11, fontWeight: 700, color: mdAccentText, letterSpacing: "0.04em" }}>{step.title}</div>
        <div style={{ ...sans, fontSize: 13.5, color: mdBody, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>{step.body}</div>
        <div style={{ marginTop: 16 }}>
          <PrimaryBtn onClick={onNext} modernist>{isLast ? "Get started" : step.navTo ? "Tap to check it out" : "Next"}</PrimaryBtn>
        </div>
      </motion.div>
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
      style={{ flex: 1, padding: "18px 16px", borderRadius: 20, backgroundColor: mdCard, boxShadow: mdCardShadow, cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 13.5, fontWeight: 800, color: mdHeading }}>{label}</span>
        {badge && <span style={{ ...sans, fontSize: 10, fontWeight: 700, color: mdAccentTagText, backgroundColor: mdAccentSoft, padding: "2px 7px", borderRadius: 999 }}>{badge}</span>}
      </div>
      <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>{teaser}</div>
    </motion.div>
  );
}

// The one thing Today's Discovery can point at — either the freshest unreacted AI
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
// used to live below the fold here — recent thoughts, unconscious patterns,
// distance from your aspiration — now belongs to History or Analysis;
// duplicating any of it here would give it two homes, which is exactly
// what this reorg is meant to remove. See ScreenAnalysis for where all of
// that moved.
//
// Dark theme, ported directly from the claude.ai/design spec (home screen.dc.html)
// — see the dk* tokens near the top of the file. The 3D brain's own card
// styling is left untouched (that component wasn't part of this import).
function ScreenHome({ onNavSelect, onStartThink, onOpenBrainMap, store }: { onNavSelect?: (id: string) => void; onStartThink?: () => void; onOpenBrainMap?: () => void; store: Store }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 20px 24px" }}>
        {/* ── Hero: date, headline, brain, Speak your mind — nothing else. This is
            the whole first impression: "my thoughts become this brain."
            BrainNodeMapScreen — a dedicated full-screen node map (ported
            from a parallel session), embedded here as the mini card with
            an expand button that opens the full-screen "brainmap" route.
            Analysis's "related active neurons" section deliberately does NOT reuse
            this component — its thousands-strong dormant tissue field is
            the right metaphor for "my whole mind" here, but reads as noisy
            clutter for a handful of beliefs behind one discovery. See
            NeuralBeliefGraph3D (used there instead) for that "sparse
            constellation" job. ── */}
        <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: mdAccent }}>{formatDateDots(new Date())}</div>
        <div style={{ ...serif, fontSize: 32, fontWeight: 400, lineHeight: 1.28, color: mdHeading, marginTop: 14, wordBreak: "keep-all" }}>
          What thought crossed<br />your mind today?
        </div>

        <div data-tutorial="brain-card" style={{ marginTop: 28 }}>
          {(!MONETIZATION_ENABLED || store.isPro) ? (
            <BrainNodeMapScreen beliefs={store.beliefs} connections={store.connections} embedded height={336} onExpand={onOpenBrainMap} modernist />
          ) : (
            // Locked teaser instead of quietly rendering an always-empty
            // brain — a free store's beliefs/connections never populate
            // (see appendUnanalyzedEntry in realStore.ts), so without this
            // a free user would just see "0 beliefs" forever with no
            // explanation why. Routes through onOpenBrainMap/"brainmap"
            // rather than a separate handler — that route already renders
            // ScreenPaywall for a non-Pro store.
            <motion.div
              role="button" tabIndex={0} onClick={onOpenBrainMap} whileTap={{ scale: 0.98, opacity: 0.92 }}
              style={{
                height: 336, borderRadius: 30, backgroundColor: mdCard, boxShadow: mdCardShadow, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center",
              }}
            >
              <span style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: mdAccentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="4.5" y="9" width="11" height="8" rx="2" stroke={mdAccentText} strokeWidth="1.5" />
                  <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke={mdAccentText} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <div style={{ ...sans, fontSize: 15, fontWeight: 800, color: mdHeading }}>Unlock your Brain Map</div>
              <div style={{ ...sans, fontSize: 12.5, color: mdBody, lineHeight: 1.5, wordBreak: "keep-all", maxWidth: 240 }}>
                Upgrade to Pro to see your unconscious beliefs light up and connect.
              </div>
            </motion.div>
          )}
        </div>

        <div data-tutorial="think-card" style={{ marginTop: 16 }}>
          <motion.div
            role="button" tabIndex={0} onClick={onStartThink} whileTap={{ scale: 0.98, opacity: 0.92 }}
            style={{ display: "flex", alignItems: "center", gap: 14, backgroundColor: mdCard, borderRadius: 20, padding: "16px 18px", cursor: "pointer", boxShadow: mdCardShadow }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${mdAccent}, ${mdAccentText})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <WaveformIcon color="#fff" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ ...sans, fontSize: 15, fontWeight: 800, color: mdHeading }}>Speak your mind</span>
              <span style={{ ...sans, fontSize: 12, color: mdBody }}>It's okay if it's not organized</span>
            </div>
          </motion.div>
        </div>
      </div>
      <BottomNav active="home" onSelect={onNavSelect} modernist />
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
            <span style={{ ...sans, fontSize: 13.5, color: mdBodyLight, flex: 1 }}>{REGION_CONFIG[region].label}</span>
            <span style={{ ...mono, fontSize: 12, color: mdBody }}>{count}</span>
            <span style={{ ...mono, fontSize: 12, color: mdAccentText, width: 36, textAlign: "right" }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// Fallback for "related active neurons" — the crimson glow on the brain above is
// subtle at this card's small embed size (a real point in a dense field,
// not a big obvious marker), so this gives a guaranteed-legible list of
// exactly which beliefs make up today's discovery, plus the relationship
// note between them when the graph itself would already be drawing a line
// there — reuses store.connections rather than inventing a second notion
// of "related."
function DiscoveryBeliefList({ beliefIds, store, modernist = false }: { beliefIds: string[]; store: Store; modernist?: boolean }) {
  const items = beliefIds.map((id) => store.beliefs.find((b) => b.id === id)).filter((b): b is StoredBelief => !!b);
  if (items.length === 0) return null;
  const notes = store.connections.filter((c) => beliefIds.includes(c.a) && beliefIds.includes(c.b) && c.note);
  const tagBg = modernist ? mdNeutralTag : dkTrack;
  const tagText = modernist ? mdNeutralTagText : dkBody;
  const heading = modernist ? mdHeading : dkHeading;
  const body = modernist ? mdBody : dkBody;
  const noteBg = modernist ? mdAccentSoft : dkAccentSoft;
  const noteText = modernist ? mdAccentText : dkAccentLight;
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${modernist ? mdDivider : dkDivider}` }}>
      <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: body, letterSpacing: "0.06em" }}>
        The beliefs behind this discovery · the spots glowing on your brain
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {items.map((belief) => (
          <div key={belief.id} style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: tagBg, borderRadius: 12, padding: "10px 12px" }}>
            <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: tagText, flexShrink: 0 }}>{belief.domain}</span>
            <span style={{ ...serif, fontSize: 13.5, color: heading, flex: 1, lineHeight: 1.4, wordBreak: "keep-all" }}>{belief.statement}</span>
            <span style={{ ...mono, fontSize: 11, color: tagText, flexShrink: 0 }}>{belief.confidence}%</span>
          </div>
        ))}
      </div>
      {notes.map((c, i) => (
        <div key={i} style={{ ...sans, fontSize: 12, color: noteText, backgroundColor: noteBg, borderRadius: 10, padding: "10px 12px", marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all" }}>
          {c.note}
        </div>
      ))}
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
    return <div style={{ ...sans, fontSize: 13, color: mdBody }}>No emotion data yet. It'll show up here after you leave a few thoughts.</div>;
  }

  const maxAvg = rows[0].avg || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ ...sans, fontSize: 13, color: mdBodyLight }}>{r.label}</span>
            <span style={{ ...mono, fontSize: 11.5, color: mdBody }}>{r.avg} · {r.count}×</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, backgroundColor: mdTrack, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(r.avg / maxAvg) * 100}%`, borderRadius: 4, backgroundColor: mdAccent }} />
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 2px", borderBottom: last ? "none" : `1px solid ${mdDivider}` }}>
      <span style={{ ...sans, fontSize: 13.5, color: mdFaint }}>{label}</span>
      <span style={{ ...sans, fontSize: 10.5, fontWeight: 700, color: mdBody, backgroundColor: mdNeutralTag, padding: "3px 9px", borderRadius: 999 }}>Coming soon</span>
    </div>
  );
}

// The one shared agree/disagree control — used compactly in the hero (a
// quick read, available before the user has even scrolled) and again in
// the Reflection section further down (where disagreeing also asks what
// specifically didn't land). Both touchpoints read/write the exact same
// reaction, so they can never contradict each other about what the user
// actually said.
function ReactionButtons({ reaction, onReact, disabled, dark, modernist }: { reaction: "agree" | "disagree" | null | undefined; onReact?: (r: "agree" | "disagree") => void; disabled?: boolean; dark?: boolean; modernist?: boolean }) {
  if (modernist) {
    return (
      <div style={{ display: "flex", gap: 8, opacity: disabled ? 0.55 : 1 }}>
        <motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 14, backgroundColor: mdHeading, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 13.5, fontWeight: 800, color: "#fff" }}>I agree</span>
        </motion.div>
        <motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 14, border: `1px solid ${mdDivider}`, backgroundColor: "transparent", cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 13.5, fontWeight: 800, color: mdHeading }}>Doesn't feel right</span>
        </motion.div>
      </div>
    );
  }
  if (dark) {
    return (
      <div style={{ display: "flex", gap: 10, opacity: disabled ? 0.55 : 1 }}>
        <motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, backgroundColor: dkAccent, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 14, fontWeight: 600, color: "#fff" }}>I agree</span>
        </motion.div>
        <motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, border: `1px solid ${dkCardBorder}`, backgroundColor: dkTrack, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 14, fontWeight: 600, color: dkBodyLight }}>Doesn't feel right</span>
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
        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: reaction === "agree" ? "#fff" : ink }}>I agree</span>
      </motion.div>
      <motion.div
        role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} whileTap={disabled ? undefined : { scale: 0.97 }}
        style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, border: `1px solid ${reaction === "disagree" ? tension : hair}`, backgroundColor: reaction === "disagree" ? tension : "transparent", cursor: disabled ? "default" : "pointer" }}
      >
        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: reaction === "disagree" ? "#fff" : ink }}>Doesn't feel right</span>
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
      <p style={{ ...sans, fontSize: 15, color: mdBodyLight, margin: "0 0 6px", lineHeight: 1.5 }}>Does this observation match your experience right now?</p>
      {/* Observer-self framing (ACT: self-as-context) — agree/disagree here
          isn't a verdict on whether the thought is true, just whether this
          reading of it matches what was actually noticed. */}
      <p style={{ ...serif, fontStyle: "italic", fontSize: 13.5, color: mdFaint, margin: "0 0 16px", lineHeight: 1.5, wordBreak: "keep-all" }}>
        This isn't about deciding whether to believe this thought. It's just about whether it fits who you are right now.
      </p>
      {reinterpreting && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0" }}>
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: mdAccent }}
          />
          <span style={{ ...sans, fontSize: 13, color: mdBody }}>Reconsidering...</span>
        </div>
      )}
      {!settled && !reinterpreting && <ReactionButtons reaction={reaction} onReact={onReact} modernist />}
      {settled && exhausted && (
        <p style={{ ...sans, fontSize: 13, color: mdBody, margin: "0 0 12px" }}>We can't come up with a new interpretation right now. We'll take another look next time.</p>
      )}
      {settled && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: mdAccent, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✓</span>
          <span style={{ ...sans, fontSize: 13.5, color: mdBodyLight }}>{exhausted ? "That's as far as we've gotten for now." : "You accepted this observation."}</span>
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
              <div style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: p.accent ? mdAccent : mdTrack, flexShrink: 0, marginTop: 3 }} />
              {hasNext && <div style={{ width: 2, flex: 1, backgroundColor: mdDivider, minHeight: 28 }} />}
            </div>
            <div style={{ paddingBottom: 20 }}>
              <div style={{ ...mono, fontSize: 10.5, color: mdBody, marginBottom: 3 }}>{p.label}</div>
              <p style={{ ...serif, fontStyle: "italic", fontSize: 14.5, color: mdBodyLight, margin: 0, lineHeight: 1.4, wordBreak: "keep-all" }}>{p.text}</p>
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
    <div style={{ backgroundColor: mdAccentSoft, borderLeft: `3px solid ${mdAccent}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ ...mono, fontSize: 11, color: mdBody }}>{date}</span>
        {domain && <span style={{ ...sans, fontSize: 10.5, fontWeight: 700, color: mdAccentTagText, backgroundColor: mdAccentTag, padding: "2px 8px", borderRadius: 999 }}>{domain}</span>}
      </div>
      <p style={{ ...serif, fontStyle: "italic", fontSize: 15, color: mdBodyLight, margin: 0, lineHeight: 1.45, wordBreak: "keep-all" }}>"{quote}"</p>
    </div>
  );
}

// The Analysis tab's one layout primitive — a raised white card on the
// screen's surface-tinted background (see ScreenAnalysis), Apple grouped-
// list style: elevation instead of a border does the work a thin `hair`
// divider used to (and couldn't, since surface-on-page is barely visible).
// Every section from "why" onward is one of these, so the page reads as
// distinct, scannable groups rather than one continuous flow of text.
function SectionCard({ title, subtitle, children, dataTutorial }: { title?: string; subtitle?: string; children: React.ReactNode; dataTutorial?: string }) {
  return (
    <div data-tutorial={dataTutorial} style={{ backgroundColor: mdCard, borderRadius: 20, padding: "22px 20px", boxShadow: mdCardShadow }}>
      {title && <div style={{ ...serif, fontSize: 19, color: mdHeading, marginBottom: subtitle ? 4 : 18 }}>{title}</div>}
      {subtitle && <div style={{ ...sans, fontSize: 12.5, color: mdBody, marginBottom: 16, lineHeight: 1.5, wordBreak: "keep-all" }}>{subtitle}</div>}
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

  // SECTION 4's "related active neurons" — literally the beliefs related to *this*
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
    const base = filtered.length > 0 ? filtered : store.beliefs;
    return base.map((belief) => ({
      ...belief,
      emotionGranularity: beliefEmotionGranularity(belief, store.history),
      ruminationLikely: isLikelyRuminating(belief, store.connections, store.history),
    }));
  }, [store.beliefs, store.connections, store.history, relatedBeliefIds]);
  const relatedBrainConnections = React.useMemo(() => {
    if (relatedBeliefIds.size === 0) return store.connections;
    return store.connections.filter((c) => relatedBeliefIds.has(c.a) && relatedBeliefIds.has(c.b));
  }, [store.connections, relatedBeliefIds]);
  const relatedBrainClusters = React.useMemo(
    () => findBeliefClusters(relatedBrainBeliefs, relatedBrainConnections),
    [relatedBrainBeliefs, relatedBrainConnections]
  );
  // Exactly the discovery itself, not its wider "related" context above —
  // a hypothesis IS the relationship between several beliefs, so all of
  // them are the discovery; a belief-kind discovery is just that one
  // belief, not everything connected to it. Used by DiscoveryBeliefList
  // below to call out which of the constellation's stars is the actual
  // discovery vs. supporting context.
  const discoveryBeliefIds = React.useMemo(() => {
    if (h) return h.relatedBeliefIds;
    if (b) return [b.id];
    return [];
  }, [h, b]);

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
        { label: "Today", text: evidence[evidence.length - 1]?.quote ?? h.title },
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 24px" }}>
        <div style={{ padding: "8px 4px 20px" }}>
          <div style={{ ...serif, fontSize: 34, fontWeight: 400, color: mdHeading, marginBottom: 6 }}>Mind</div>
          <div style={{ ...sans, fontSize: 13, color: mdBody }}>What the AI has learned about you so far — not just today, but across all the time you've spent here.</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* ── SECTION 1 · HERO — title, discovery, confidence. Nothing else. ── */}
          <SectionCard dataTutorial="today-discovery">
            {discovery ? (
              <>
                <div style={{ ...sans, fontSize: 11, fontWeight: 800, color: mdAccent, letterSpacing: "0.04em", marginBottom: 10 }}>Today's discovery</div>
                {(h?.thoughtLabel || b?.thoughtLabel) && (
                  <p style={{ ...serif, fontStyle: "italic", fontSize: 16, color: mdAccentText, margin: "0 0 8px" }}>
                    The "{h?.thoughtLabel || b?.thoughtLabel}" thought showed up again
                  </p>
                )}
                <p style={{ ...serif, fontSize: 24, lineHeight: 1.4, color: mdHeading, margin: "0 0 18px", wordBreak: "keep-all" }}>{discovery.text}</p>
                <div style={{ height: 1, backgroundColor: mdDivider, margin: "0 0 14px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ ...sans, fontSize: 12, fontWeight: 700, color: mdBody }}>Confidence</span>
                  <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: mdAccentText }}>{h ? h.confidence : b?.confidence ?? 0}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, backgroundColor: mdTrack, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${h ? h.confidence : b?.confidence ?? 0}%`, borderRadius: 3, background: `linear-gradient(90deg, ${mdAccent}, ${mdAccentText})` }} />
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 10px 8px", gap: 14 }}>
                <svg width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="44" fill={mdAccentSoft} />
                  <circle cx="34" cy="44" r="5" fill={mdAccent} />
                  <circle cx="62" cy="44" r="5" fill={mdAccent} />
                  <path d="M36 60 Q48 68 60 60" stroke={mdAccent} strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
                <p style={{ ...sans, fontSize: 14, color: mdBody, lineHeight: 1.6, margin: 0, maxWidth: 260 }}>Nothing discovered yet. It'll show up here after you leave a few thoughts.</p>
              </div>
            )}
          </SectionCard>

          {discovery && (
            <>
              {/* ── SECTION 2 · WHY — only the strongest supporting evidence, chronological. ── */}
              <SectionCard title="Why did this interpretation come up?" subtitle="These are parts where you actually said this.">
                {evidence.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {evidence.map((e, i) => (
                      <EvidenceQuoteCard key={i} date={e.date} quote={e.quote} domain={e.domain} />
                    ))}
                  </div>
                ) : (
                  <div style={{ ...sans, fontSize: 13, color: mdBody }}>No entries to cite as evidence yet.</div>
                )}

                {contradictoryEntries.length > 0 && (
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${mdDivider}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 13 }}>⚠</span>
                      <span style={{ ...sans, fontSize: 12.5, fontWeight: 800, color: mdAccentText }}>There are entries pointing the other way too</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {contradictoryEntries.map(({ belief, entry }, i) => (
                        <div key={i} style={{ backgroundColor: mdAccentSoft, borderLeft: `3px solid ${mdAccent}`, borderRadius: 8, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ ...mono, fontSize: 11, color: mdBody }}>{entry.date}</span>
                            <span style={{ ...sans, fontSize: 10.5, fontWeight: 700, color: mdAccentTagText, backgroundColor: mdAccentTag, padding: "2px 8px", borderRadius: 999 }}>{belief.domain}</span>
                          </div>
                          <p style={{ ...serif, fontStyle: "italic", fontSize: 15, color: mdBodyLight, margin: 0, lineHeight: 1.45, wordBreak: "keep-all" }}>"{entry.text}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* ── SECTION 3 · BELIEF EVOLUTION — watch the pattern develop over time. ── */}
              {evolutionPoints.length > 0 && (
                <SectionCard title="How this belief has evolved">
                  <EvolutionTimeline points={evolutionPoints} />
                </SectionCard>
              )}

              {/* ── SECTION 4 · RELATED NEURAL ACTIVITY — deliberately NOT
              Home's full brain (BrainNodeMapScreen): that component always
              renders its whole thousands-strong dormant tissue field
              alongside whatever's active, which is the right metaphor for
              "my entire mind" but reads as noisy clutter for "just the
              handful of beliefs behind this one discovery." NeuralBeliefGraph3D
              never had that background field — it only ever draws the nodes
              it's handed — so scoping it to relatedBrainBeliefs (this
              discovery + whatever it's actually connected to, not the full
              store) gives a sparse, legible "constellation" instead of a
              star field. Kept as its own self-contained dark canvas (not
              part of the Modernist mockup, which drops this section)
              rather than reworking the WebGL scene's own palette — reads as
              an intentional "window into the tissue" panel, not a stray
              dark card, same as it always has. ── */}
              <SectionCard title="Related active neurons">
                <NeuralBeliefGraph3D beliefs={relatedBrainBeliefs} connections={relatedBrainConnections} clusters={relatedBrainClusters} height={280} defaultStructureMode />
                <DiscoveryBeliefList beliefIds={discoveryBeliefIds} store={store} modernist />
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${mdDivider}` }}>
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
                    style={{ marginTop: 14, width: "100%", boxSizing: "border-box", textAlign: "center", background: "transparent", border: `1.5px solid ${mdDivider}`, color: mdHeading, borderRadius: 14, padding: 12, ...sans, fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}
                  >
                    Dig deeper
                  </motion.div>
                )}
              </SectionCard>
            </>
          )}

          {/* ── SECTION 6 · EXPLORE MORE — secondary analysis, each its own independent page. ── */}
          <div style={{ ...sans, fontSize: 11, fontWeight: 800, color: mdAccent, letterSpacing: "0.1em", padding: "6px 4px 2px", textTransform: "uppercase" }}>Dive deeper</div>
          <div style={{ display: "flex", gap: 12 }}>
            <ArtifactTile
              label="Unconscious patterns"
              teaser={hasBeliefs ? "Explore your belief map" : "No patterns have surfaced yet."}
              onClick={() => onOpenArtifact?.("beliefs")}
            />
            <ArtifactTile
              label="Distance from your aspiration"
              teaser="Between who you are and who you want to be"
              onClick={() => onOpenArtifact?.("drift")}
            />
          </div>

          <SectionCard title="Emotion distribution" subtitle="The average intensity of recorded emotions.">
            <EmotionDistribution history={store.history} />
          </SectionCard>

          <SectionCard>
            <ComingSoonRow label="Value shifts" />
            <ComingSoonRow label="Thinking patterns (CBT)" last />
          </SectionCard>
        </div>
      </div>
      <BottomNav active="analysis" onSelect={onNavSelect} modernist />
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
  "What thought stuck with you the longest today?",
  "Is there a thought that keeps circling in your head?",
  "What was on your mind the most today?",
  "What did you say to yourself the most today?",
  "What's the thought you can't quite resolve right now?",
  "When did your emotions shift the most today?",
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
// 1.00→1.04 every ~2.5s) so it never needs a "tap to start" caption to
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
  // Text-first: voice self-reports lower self-disclosure than text at the
  // same response length (perceived anonymity drops with voice) — text is
  // the default, voice is the opt-in via the toggle below, not the other
  // way around.
  const [textMode, setTextMode] = React.useState(true);
  const [text, setText] = React.useState("");
  const [promptHint] = React.useState(() => pickThinkPrompt());
  const [transcript, setTranscript] = React.useState("");
  const [interim, setInterim] = React.useState("");
  const voiceSupportedRef = React.useRef(!!getSpeechRecognitionCtor());
  const recognitionRef = React.useRef<any>(null);
  const micLevelRef = useMicLevel(recording);
  const manualStopRef = React.useRef(false);
  // Authoritative running transcript, mirrors the `transcript` state but
  // read synchronously (state set via a functional updater isn't
  // guaranteed to be visible in the same tick, and the silence-watcher
  // below needs the current value the instant it fires).
  const finalTranscriptRef = React.useRef("");

  // INPUT-role silence guidance (see inputGuidance.ts) — a few seconds of
  // no new input fades in one short line. `lastActivityAt`/`latestText` are
  // refs, not state, so the watcher interval below never closes over a
  // stale value; `inputGuidance` itself is the only piece that needs to
  // trigger a render.
  const [inputGuidance, setInputGuidance] = React.useState<string | null>(null);
  const lastActivityRef = React.useRef(Date.now());
  const latestTextRef = React.useRef("");
  const guidanceShownRef = React.useRef(false);
  const guidanceDelayRef = React.useRef<any>(null);

  const noteActivity = (currentText: string) => {
    latestTextRef.current = currentText;
    lastActivityRef.current = Date.now();
    guidanceShownRef.current = false;
    setInputGuidance(null);
    if (guidanceDelayRef.current) { clearTimeout(guidanceDelayRef.current); guidanceDelayRef.current = null; }
  };

  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  React.useEffect(() => () => { manualStopRef.current = true; recognitionRef.current?.stop?.(); }, []);

  // Guidance only applies while input is actually expected — typing (text
  // mode, whether or not anything's written yet) or actively recording.
  // Switching modes or starting a fresh recording resets the silence clock.
  React.useEffect(() => {
    lastActivityRef.current = Date.now();
    guidanceShownRef.current = false;
    setInputGuidance(null);
  }, [textMode, recording]);

  React.useEffect(() => {
    const active = textMode || recording;
    if (!active) return;
    const watcher = setInterval(() => {
      if (guidanceShownRef.current) return;
      if (Date.now() - lastActivityRef.current >= 5000) {
        guidanceShownRef.current = true;
        // Async fade-in delay — the prompt doesn't snap in the instant the
        // threshold crosses, so it never reads as a timer going off.
        guidanceDelayRef.current = setTimeout(() => {
          setInputGuidance(pickInputGuidance(latestTextRef.current));
        }, 700);
      }
    }, 1000);
    return () => { clearInterval(watcher); if (guidanceDelayRef.current) clearTimeout(guidanceDelayRef.current); };
  }, [textMode, recording]);

  const startRecording = () => {
    setTranscript("");
    setInterim("");
    setSeconds(0);
    finalTranscriptRef.current = "";
    const SR = getSpeechRecognitionCtor();
    if (SR) {
      manualStopRef.current = false;
      const recognition = new SR();
      recognition.lang = "en-US";
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
        if (finalChunk) {
          finalTranscriptRef.current = (finalTranscriptRef.current ? finalTranscriptRef.current + " " : "") + finalChunk.trim();
          setTranscript(finalTranscriptRef.current);
        }
        setInterim(interimChunk);
        noteActivity((finalTranscriptRef.current + (interimChunk ? " " + interimChunk : "")).trim());
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: dkBody, cursor: "pointer" }}>
          ✕ Stop
        </motion.span>
        {!recording && (
          <motion.span role="button" tabIndex={0} onClick={() => setTextMode((v) => !v)} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: dkAccentLight, cursor: "pointer" }}>
            {textMode ? "Use voice instead" : "Write instead"}
          </motion.span>
        )}
      </div>

      {textMode ? (
        <>
          <div style={{ flex: 1, minHeight: 0, padding: "20px 24px 0", display: "flex", flexDirection: "column" }}>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => { setText(e.target.value); noteActivity(e.target.value); }}
              placeholder={`${promptHint} Write whatever feels natural.`}
              style={{
                ...serif, flex: 1, width: "100%", resize: "none", border: "none", outline: "none",
                backgroundColor: "transparent", color: dkHeading, fontSize: 19, lineHeight: 1.7,
                wordBreak: "keep-all", colorScheme: "dark",
              }}
            />
            <AnimatePresence>
              {inputGuidance && (
                <motion.div
                  key={inputGuidance}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ ...sans, fontSize: 12.5, color: dkBody, marginTop: 10, marginBottom: 4, lineHeight: 1.6, wordBreak: "keep-all" }}
                >
                  {inputGuidance}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div style={{ padding: "0 24px 40px" }}>
            <PrimaryBtn disabled={!text.trim()} onClick={() => onDone?.(text.trim())}>Next</PrimaryBtn>
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
                  <div style={{ ...serif, fontSize: 22, color: dkHeading, textAlign: "center", lineHeight: 1.6, wordBreak: "keep-all" }}>
                    Speak freely.<br />You don't need to organize your thoughts.
                  </div>
                  <div style={{ ...sans, fontSize: 13, color: dkBody, textAlign: "center", marginTop: 14, lineHeight: 1.6, wordBreak: "keep-all", minHeight: 20 }}>
                    {promptHint}
                  </div>
                  {!voiceSupportedRef.current && (
                    <div style={{ ...sans, fontSize: 12, color: dkWarn, textAlign: "center", marginTop: 18, lineHeight: 1.6, wordBreak: "keep-all" }}>
                      This browser doesn't support speech recognition. Please use "Write instead."
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
                  {/* No mm:ss countup here on purpose — a visible timer reads as
                      "this is being measured," which raises self-censorship the
                      same way a visible recording light does. `seconds` is still
                      tracked internally (silence/auto-stop timing), just not shown. */}
                  <div style={{ ...serif, fontSize: 18, color: dkBodyLight, textAlign: "center" }}>Listening</div>
                  <div style={{ ...sans, fontSize: 13, color: dkBody, textAlign: "center", marginTop: 12, lineHeight: 1.6, wordBreak: "keep-all" }}>
                    Say whatever comes to mind.
                  </div>
                  {/* No live transcript here on purpose — watching your own
                      words appear in real time is its own kind of self-
                      editing pressure (perceived anonymity drops sharply
                      once you can see exactly what's being captured).
                      `transcript`/`interim` are still tracked and used once
                      recording stops; they're just not rendered while it's
                      running. */}
                  <AnimatePresence>
                    {inputGuidance && (
                      <motion.div
                        key={inputGuidance}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        style={{ ...sans, fontSize: 13, color: dkBodyLight, textAlign: "center", marginTop: 22, lineHeight: 1.6, wordBreak: "keep-all", maxWidth: 260 }}
                      >
                        {inputGuidance}
                      </motion.div>
                    )}
                  </AnimatePresence>
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
  name,
  onDone,
  onError,
}: {
  text?: string;
  matchableBeliefs?: Pick<StoredBelief, "id" | "domain" | "statement" | "confidence">[];
  matchablePending?: { id: string; domain: string; statement: string }[];
  priorAssumptions?: StoredAssumption[];
  priorConnections?: { aStatement: string; bStatement: string; note: string }[];
  aspiration?: string | null;
  // Distanced self-talk (Kross & Ayduk) needs a name or "you" to reframe
  // toward — undefined for guests, who get the 2nd-person fallback server-side.
  name?: string;
  // sessionSummary is undefined whenever /api/summarize-session didn't
  // return one (no key, network error, bad response) — a missing summary
  // never blocks or fails the main analysis, per Feature 3's own spec.
  onDone?: (result: any | null, sessionSummary?: string) => void;
  onError?: (message: string) => void;
}) {
  const STEPS = ["Listening", "Connecting it to past conversations", "Double-checking the pattern"];
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

    // Feature 3 — fired alongside /api/analyze, not chained after it, so
    // the summary doesn't add extra wait time on top of the main analysis.
    // Deliberately swallows its own errors to undefined: a missing summary
    // just means the session-summary card skips that paragraph, never a
    // reason to fail the session.
    const summaryPromise = fetch("/api/summarize-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || typeof data?.summary !== "string") return undefined;
        return data.summary as string;
      })
      .catch(() => undefined);

    fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, matchableBeliefs, matchablePending, priorAssumptions, priorConnections, aspiration, name }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Analysis failed.");
        return data;
      })
      .then(async (data) => {
        const sessionSummary = await summaryPromise;
        if (cancelled) return;
        clearInterval(stepTimer);
        setStep(STEPS.length - 1);
        setTimeout(() => { if (!cancelled) onDone?.(data, sessionSummary); }, 500);
      })
      .catch((err) => {
        if (cancelled) return;
        clearInterval(stepTimer);
        onError?.(err instanceof Error ? err.message : "Analysis failed.");
      });
    return () => { cancelled = true; clearInterval(stepTimer); };
  }, [text]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", backgroundColor: dkBg, padding: 32 }}>
      <motion.div
        animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: dkAccent, boxShadow: `0 0 24px 6px ${dkAccentSoft}` }}
      />
      <div style={{ ...sans, fontSize: 14, color: dkBodyLight, marginTop: 22 }}>{STEPS[step]}</div>
    </div>
  );
}

// ── Screen 7 · Think complete ─────────────────────────────────────────────────
// Reached two ways now: a Pro entry where the model itself found nothing new
// to report, or any free-tier entry (recording is the entire free feature —
// see appendUnanalyzedEntry in realStore.ts and the "think" case's onDone).
// showUpsell distinguishes the two only by adding one extra line and a CTA;
// the core "Got it" acknowledgment is identical either way, since a free
// entry isn't a lesser version of a Pro one, just an unanalyzed one.
function ScreenThinkComplete({ error, showUpsell, onDone, onUpgrade }: { error?: string; showUpsell?: boolean; onDone?: () => void; onUpgrade?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        {error ? (
          <>
            <div style={{ ...serif, fontSize: 21, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
              Couldn't analyze that.
            </div>
            <div style={{ ...sans, fontSize: 13.5, color: dkWarn, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
              {error}
            </div>
          </>
        ) : (
          <>
            <div style={{ ...serif, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
              Got it.
            </div>
            <div style={{ ...sans, fontSize: 14, color: dkBody, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
              Today's thoughts have been added to your record. Nothing is judged or organized — it's just quietly kept.
            </div>
            {showUpsell && (
              <div
                role="button" tabIndex={0} onClick={onUpgrade}
                style={{ marginTop: 20, padding: 16, borderRadius: 14, backgroundColor: dkAccentSoft, borderLeft: `2px solid ${dkAccent}`, cursor: "pointer" }}
              >
                <div style={{ ...sans, fontSize: 13, fontWeight: 700, color: dkAccentLight }}>Curious what pattern this is part of?</div>
                <div style={{ ...sans, fontSize: 12.5, color: dkBodyLight, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>Upgrade to Pro to turn your record into unconscious beliefs, connections, and hypotheses.</div>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <PrimaryBtn onClick={onDone}>Go home</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Screen 6.6 · Soft paywall (one-time nudge) ────────────────────────────────
// Fires exactly once, replacing the usual "Got it" beat right after the free
// tier's 3rd recorded entry (see UPSELL_PROMPT_AT_ENTRY_COUNT and the
// "think" case's onDone in the App shell) — a deliberate, one-time ask
// rather than the quiet recurring footnote ScreenThinkComplete's showUpsell
// already adds to every free entry. Never repeats after this: the App shell
// marks hasSeenUpgradePrompt true the instant this screen is shown, whether
// the person taps through to plans or dismisses with "Not now."
function ScreenSoftPaywall({ onSeePlans, onDismiss }: { onSeePlans?: () => void; onDismiss?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        <div style={{ ...serif, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
          You've recorded three thoughts now.
        </div>
        <div style={{ ...sans, fontSize: 14, color: dkBody, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
          That's usually enough for the first patterns to start showing. Want Pro to show you what's underneath them?
        </div>
      </div>
      <div style={{ padding: "0 28px 40px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <PrimaryBtn onClick={onSeePlans}>See Pro plans</PrimaryBtn>
        <GhostBtn onClick={onDismiss}>Not now</GhostBtn>
      </div>
    </div>
  );
}

// ── Screen 6.7 · Crisis support ───────────────────────────────────────────────
// The one deliberate exception to "observe, don't judge" — see
// crisisDetection.ts for why this exists and why it's keyword-based rather
// than a model call. Reached instead of processing/thinkComplete/the soft
// paywall/anything else the "think" case's onDone would otherwise route to
// — checked first, before the isPro branch, so a crisis-flagged entry never
// reaches /api/analyze or the belief/hypothesis pipeline regardless of tier.
// The entry itself is still saved (see appendUnanalyzedEntry in the App
// shell's onDone) — this is about response routing, not about withholding
// or hiding what someone wrote. Real tel:/sms: links, not styled buttons
// wired to JS, so the OS's own dialer/messages app opens directly.
function CrisisResourceCard({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <a
      href={href}
      style={{
        display: "block", textDecoration: "none", padding: "16px 18px", borderRadius: 14,
        backgroundColor: dkCard, border: `1px solid ${dkDivider}`,
      }}
    >
      <div style={{ ...sans, fontSize: 14.5, fontWeight: 700, color: dkHeading }}>{title}</div>
      <div style={{ ...sans, fontSize: 12.5, color: dkBody, marginTop: 3, lineHeight: 1.5 }}>{subtitle}</div>
    </a>
  );
}

function ScreenCrisisSupport({ onContinue }: { onContinue?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "48px 28px 24px" }}>
        <div style={{ ...serif, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
          It sounds like you might be going through something really hard right now.
        </div>
        <div style={{ ...sans, fontSize: 14, color: dkBody, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
          If that's true, you don't have to go through it alone. These are free, confidential, and available right now — not just for emergencies, for whatever this is too.
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <CrisisResourceCard
            title="988 Suicide & Crisis Lifeline"
            subtitle="Call or text 988 — free, confidential, 24/7"
            href="tel:988"
          />
          <CrisisResourceCard
            title="Crisis Text Line"
            subtitle="Text HOME to 741741 — a real person, by text"
            href="sms:741741&body=HOME"
          />
          <CrisisResourceCard
            title="Outside the US"
            subtitle="Find a local helpline at findahelpline.com"
            href="https://findahelpline.com"
          />
        </div>

        <div style={{ ...sans, fontSize: 12, color: dkBody, marginTop: 24, lineHeight: 1.6, wordBreak: "keep-all" }}>
          What you wrote is still saved, just like always — nothing else about it changes. Mindscape isn't a substitute for real support, which is exactly why these are here.
        </div>
      </div>
      <div style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <GhostBtn onClick={onContinue}>Continue</GhostBtn>
      </div>
    </div>
  );
}

// ── Screen 6.5 · Session summary (Feature 2) ─────────────────────────────────
// Shown once, right after a successful analysis, before landing on the
// Analysis tab — a quiet "here's what was just observed about how you
// talked" beat, purely descriptive (see cognitiveLexicon.ts). Feature 3
// will add an AI-written recap paragraph above this same card later; this
// screen already reads entry.sessionSummary so nothing else needs to
// change when that lands.
// Feature: emotional granularity (Note 2) — how many *distinct* emotion
// labels this session's analysis surfaced, compared to the last 3
// sessions' average. A raw unique-label count, not the "unique / total"
// ratio the note describes: within a single entry the model's own
// emotions list essentially never repeats a label, so that ratio would
// trivially read ~1.0 on every entry and say nothing — comparing the
// count itself across sessions is what this data can actually show.
// Never surfaced as a number anywhere in the UI — emotional-granularity
// scores are associated with clinical instruments in the literature (see
// the gap-analysis doc's BPD caution), so this only ever becomes a plain
// observational sentence, same rule as the cognitive-verb trend above.
function countUniqueEmotions(entry: StoredHistoryEntry): number | null {
  const emotions = entry.analysis?.observation.emotions;
  if (!emotions || emotions.length === 0) return null;
  return new Set(emotions.map((e) => e.label)).size;
}

// Same underlying signal as countUniqueEmotions/buildEmotionVarietyLine
// above, averaged over one belief's last few supporting entries instead of
// compared session-to-session. Unlike that line, this never becomes text —
// it only ever drives the 3D neuron's surface geometry (see
// NeuralBeliefGraph3D's facetDetail), so the "never surface a number"
// caution above doesn't apply the same way: nothing here is labeled,
// scored, or shown as a figure, just a texture a viewer can't put a value on.
function beliefEmotionGranularity(belief: StoredBelief, history: StoredHistoryEntry[]): number | undefined {
  const counts = (belief.supportingEntryIds ?? [])
    .map((id) => history.find((e) => e.id === id))
    .filter((e): e is StoredHistoryEntry => !!e)
    .slice(-3)
    .map((e) => countUniqueEmotions(e))
    .filter((n): n is number => n !== null);
  if (counts.length === 0) return undefined;
  return counts.reduce((sum, n) => sum + n, 0) / counts.length;
}

function buildEmotionVarietyLine(entry: StoredHistoryEntry, priorEntries: StoredHistoryEntry[]): string | null {
  const current = countUniqueEmotions(entry);
  if (current === null) return null;
  const priorCounts = priorEntries
    .slice(-3)
    .map((e) => countUniqueEmotions(e))
    .filter((n): n is number => n !== null);
  if (priorCounts.length === 0) return null;
  const avgPrior = priorCounts.reduce((sum, n) => sum + n, 0) / priorCounts.length;
  const delta = current - avgPrior;
  // Flat comparisons aren't reported — unlike the cognitive-verb trend,
  // where "about the same as usual" is still worth saying, a near-equal
  // emotion count says little on its own and would just add a third
  // near-identical trend line to every card.
  if (Math.abs(delta) < 0.5) return null;
  return delta > 0
    ? "You used a wider range of emotion words today than in recent sessions."
    : "You used a narrower range of emotion words today than in recent sessions.";
}

function buildLanguageObservationLines(entry: StoredHistoryEntry, priorObservations: LanguageObservation[]): string[] {
  const obs = entry.languageObservation;
  if (!obs) return [];
  const lines: string[] = [];

  const trend = compareCognitiveVerbTrend(obs, priorObservations);
  if (trend && obs.cognitiveVerbCount > 0) {
    const examples = extractCognitiveVerbExamples(entry.text, 2);
    const examplePhrase = examples.length > 0 ? `words like ${examples.map((e) => `"${e}"`).join(", ")} ` : "";
    if (trend === "increased") lines.push(`Today you used ${examplePhrase}more than in recent sessions.`);
    else if (trend === "decreased") lines.push(`Today you used ${examplePhrase}less than in recent sessions.`);
    else lines.push(`Today you used ${examplePhrase}about as much as in recent sessions.`);
  }

  const lean = comparePronounLean(obs);
  if (lean === "firstPerson") lines.push("Today you used the word \"I\" a lot.");
  else if (lean === "collectiveOrOther") lines.push("Today you used words like \"we\" and \"they\" more than \"I.\"");

  return lines;
}

function ScreenSessionSummary({ store, onDone }: { store: Store; onDone?: () => void }) {
  const entry = store.history[store.history.length - 1] ?? null;
  const priorEntries = store.history.slice(0, -1);
  const priorObservations = priorEntries
    .map((e) => e.languageObservation)
    .filter((o): o is LanguageObservation => !!o);
  const lines = entry ? buildLanguageObservationLines(entry, priorObservations) : [];
  const emotionVarietyLine = entry ? buildEmotionVarietyLine(entry, priorEntries) : null;
  if (emotionVarietyLine) lines.push(emotionVarietyLine);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        <div style={{ ...serif, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
          Got it.
        </div>
        {entry?.sessionSummary && (
          <div style={{ ...sans, fontSize: 14.5, color: dkBodyLight, marginTop: 16, lineHeight: 1.7, wordBreak: "keep-all" }}>
            {entry.sessionSummary}
          </div>
        )}
        {lines.length > 0 && (
          <div style={{ marginTop: entry?.sessionSummary ? 18 : 12, display: "flex", flexDirection: "column", gap: 8, paddingTop: entry?.sessionSummary ? 16 : 0, borderTop: entry?.sessionSummary ? `1px solid ${dkDivider}` : "none" }}>
            {lines.map((line, i) => (
              <div key={i} style={{ ...sans, fontSize: 13, color: dkBody, lineHeight: 1.65, wordBreak: "keep-all" }}>{line}</div>
            ))}
          </div>
        )}
        {!entry?.sessionSummary && lines.length === 0 && (
          <div style={{ ...sans, fontSize: 14, color: dkBody, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
            Today's thoughts have been added to your record. Nothing is judged or organized — it's just quietly kept.
          </div>
        )}
      </div>
      <div style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <PrimaryBtn onClick={onDone}>Got it</PrimaryBtn>
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
        stroke={dkAccentLight} strokeWidth={1.6}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.5 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
      <motion.circle
        r={3} fill={dkAccentLight}
        initial={{ opacity: 0, cx: ax, cy: ay }}
        animate={{ opacity: [0, 1, 1, 0], cx: [ax, ax, bx, bx], cy: [ay, ay, by, by] }}
        transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.9, delay: 0.8, ease: "easeInOut", times: [0, 0.08, 0.92, 1] }}
      />
      <motion.circle
        cx={ax} cy={ay} r={r} fill={dkAccentSoft} stroke={dkAccentLight} strokeOpacity={0.5} strokeWidth={1.2}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.4, ease: "backOut" }}
        style={{ transformOrigin: `${ax}px ${ay}px` }}
      />
      <motion.circle
        cx={bx} cy={by} r={r} fill={dkAccentSoft} stroke={dkAccentLight} strokeOpacity={0.5} strokeWidth={1.2}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.4, delay: 0.15, ease: "backOut" }}
        style={{ transformOrigin: `${bx}px ${by}px` }}
      />
      <text x={ax} y={ay} textAnchor="middle" dominantBaseline="central" style={{ ...sans, fontSize: 8.5, fontWeight: 700, fill: dkHeading }}>{aLabel}</text>
      <text x={bx} y={by} textAnchor="middle" dominantBaseline="central" style={{ ...sans, fontSize: 8.5, fontWeight: 700, fill: dkHeading }}>{bLabel}</text>
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
          <text x={b.x} y={b.y + Math.max(b.r * 0.3, 12)} textAnchor="middle" dominantBaseline="central" style={{ ...mono, fontSize: Math.max(b.r * 0.16, 7.5), fontWeight: 600, fill: mid }}>{b.evidenceCount}</text>
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
// situation→thought→emotion→action chain — powers BeliefCard's "see why
// this pattern repeats" toggle.
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
        <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: mdBody }}>Confidence over time · {history.length} entries</span>
        <span style={{ ...mono, fontSize: 10.5, color: delta > 0 ? mdAccentText : delta < 0 ? mdWarn : mdFaint }}>{delta > 0 ? "+" : ""}{delta}</span>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 4, display: "block" }}>
        <polyline points={points} fill="none" stroke={mdAccentText} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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
    return <div style={{ ...sans, fontSize: 12, color: mdFaint }}>There isn't a detailed enough entry yet to show this belief's cycle.</div>;
  }
  const obs = entry.analysis.observation;
  const topEmotion = [...obs.emotions].sort((a, b) => b.intensity - a.intensity)[0];
  const steps = [
    { label: "Situation", text: obs.situation },
    { label: "Automatic thought", text: obs.automaticThought },
    { label: "Emotion", text: topEmotion ? `${topEmotion.label} (intensity ${topEmotion.intensity})` : "No record" },
    { label: "Action", text: obs.actionUrge },
  ];
  return (
    <div>
      <div style={{ ...sans, fontSize: 12, color: mdBody, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>
        From your entry on {entry.date}, here's how this belief actually played out, step by step.
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: mdAccentSoft, color: mdAccentText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, paddingBottom: 4 }}>
                <div style={{ ...sans, fontSize: 10.5, fontWeight: 700, color: mdBody, letterSpacing: "0.04em" }}>{s.label}</div>
                <div style={{ ...serif, fontSize: 14, color: mdHeading, marginTop: 2, lineHeight: 1.5, wordBreak: "keep-all" }}>{s.text}</div>
              </div>
            </div>
            {i < steps.length - 1 && <div style={{ marginLeft: 9, width: 1, height: 14, backgroundColor: mdDivider }} />}
          </React.Fragment>
        ))}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, marginLeft: 32 }}>
          <span style={{ ...sans, fontSize: 15, color: mdAccentText, lineHeight: 1 }}>↺</span>
          <span style={{ ...sans, fontSize: 11.5, color: mdBody, fontStyle: "italic", lineHeight: 1.5, wordBreak: "keep-all" }}>
            It looks like this action tends to create a similar situation again, and the same thought shows back up.
          </span>
        </div>
      </div>
    </div>
  );
}

// One belief's full card — its own component (rather than inlined in the
// map below) so each can hold its own "which pattern tag is expanded" state
// without the cards interfering with each other.
function BeliefCard({ belief, history, connections, onReject, isLast }: { belief: StoredBelief; history: StoredHistoryEntry[]; connections: StoredConnection[]; onReject?: (id: string) => void; isLast?: boolean }) {
  const [openPattern, setOpenPattern] = React.useState<string | null>(null);
  const [showLoop, setShowLoop] = React.useState(false);
  const emotion = dominantEmotion(belief.supportingEntryIds, history);
  const patterns = belief.possibleCognitivePatterns ?? [];
  const hasLoopData = hasFunctionalLoopData(belief, history);
  // Rumination-vs-reflection (Trapnell & Campbell): rising confidence with no
  // new connection and no widening emotional register reads as circling, not
  // moving. The line stays purely observational — a frequency fact, not a
  // suggestion to stop or a diagnostic label — same principle as every other
  // card element here.
  const ruminationLikely = isLikelyRuminating(belief, connections, history);
  // Distanced self-talk (Kross & Ayduk) — a literal card-flip metaphor for
  // the reframe itself, not just an expand/collapse: the statement is a
  // fact-in-1st-person on one face, the same meaning at 2nd-person distance
  // on the other.
  const [reframeFlipped, setReframeFlipped] = React.useState(false);
  return (
    <div style={{ padding: 20, borderBottom: isLast ? "none" : `1px solid ${mdDivider}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdBody, letterSpacing: "0.04em" }}>{belief.domain}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {belief.status === "conflicted" && <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: mdWarn }}>Conflicting entries exist</span>}
          {belief.status === "supported" && <span style={{ ...sans, fontSize: 10.5, fontWeight: 600, color: mdAccentText }}>Confirmed repeatedly</span>}
          <span style={{ ...mono, fontSize: 11, color: mdFaint }}>{belief.evidenceCount} pieces of evidence</span>
        </div>
      </div>
      {/* Defusion reframe (ACT: "naming the thought") — a recurring visitor,
          not a fact about the person, shown just above the statement it
          reframes so the two read together. */}
      {belief.thoughtLabel && (
        <div style={{ ...sans, fontSize: 11, fontStyle: "italic", color: mdAccentText, marginTop: 8 }}>The "{belief.thoughtLabel}" thought keeps showing up</div>
      )}
      {belief.distancedReframe ? (
        <div style={{ marginTop: belief.thoughtLabel ? 4 : 8 }}>
          <div style={{ perspective: 800 }}>
            {/* Both faces share one grid cell — lets the container auto-size
            to whichever face wraps to more lines, instead of an absolutely-
            positioned back face clipping/overlapping the shorter front. */}
            <motion.div
              animate={{ rotateY: reframeFlipped ? 180 : 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ display: "grid", transformStyle: "preserve-3d" }}
            >
              <div style={{ ...serif, fontSize: 18, color: mdHeading, lineHeight: 1.4, wordBreak: "keep-all", gridArea: "1 / 1", backfaceVisibility: "hidden" }}>
                {belief.statement}
              </div>
              <div
                style={{
                  ...serif, fontSize: 18, color: mdAccentText, lineHeight: 1.4, wordBreak: "keep-all",
                  gridArea: "1 / 1", backfaceVisibility: "hidden", transform: "rotateY(180deg)",
                }}
              >
                {belief.distancedReframe}
              </div>
            </motion.div>
          </div>
          <motion.span
            role="button" tabIndex={0} whileTap={{ opacity: 0.6 }}
            onClick={() => setReframeFlipped((v) => !v)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setReframeFlipped((v) => !v); }}
            style={{ ...sans, fontSize: 10.5, color: mdFaint, marginTop: 8, display: "inline-block", cursor: "pointer" }}
          >
            {reframeFlipped ? "↺ Back to the original" : "See it from a distance ↻"}
          </motion.span>
        </div>
      ) : (
        <div style={{ ...serif, fontSize: 18, color: mdHeading, marginTop: belief.thoughtLabel ? 4 : 8, lineHeight: 1.4, wordBreak: "keep-all" }}>{belief.statement}</div>
      )}
      <div style={{ height: 4, borderRadius: 2, backgroundColor: mdTrack, marginTop: 10 }}>
        <div style={{ height: "100%", width: `${belief.confidence}%`, borderRadius: 2, backgroundColor: mdAccent }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <span style={{ ...mono, fontSize: 10.5, color: mdFaint }}>Confidence {belief.confidence}%</span>
      </div>
      {/* Longitudinal drift (Level 4) — how this belief's confidence has
          actually moved, not just where it stands right now. */}
      {belief.confidenceHistory && <ConfidenceTrend history={belief.confidenceHistory} />}
      {ruminationLikely && (
        <div style={{ ...sans, fontSize: 11.5, color: mdBody, marginTop: 10, lineHeight: 1.5, wordBreak: "keep-all" }}>
          This thought has come back often in recent sessions.
        </div>
      )}
      {(patterns.length > 0 || emotion) && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {emotion && (
            <span style={{ ...sans, fontSize: 10.5, color: mdBody, backgroundColor: mdTrack, padding: "3px 8px", borderRadius: 999 }}>Predominant emotion · {emotion}</span>
          )}
          {patterns.map((p) => {
            const active = openPattern === p;
            return (
              <motion.span
                key={p} role="button" tabIndex={0} whileTap={{ opacity: 0.6 }}
                onClick={() => setOpenPattern(active ? null : p)}
                style={{ ...sans, fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? "#fff" : mdAccentText, backgroundColor: active ? mdAccent : mdAccentSoft, padding: "3px 8px", borderRadius: 999, cursor: "pointer" }}
              >
                {p}
              </motion.span>
            );
          })}
        </div>
      )}
      {openPattern && (
        <div style={{ ...sans, fontSize: 12, color: mdBodyLight, marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all", padding: 10, borderRadius: 10, backgroundColor: mdAccentSoft }}>
          <div>{COGNITIVE_PATTERN_DESCRIPTIONS[openPattern as keyof typeof COGNITIVE_PATTERN_DESCRIPTIONS] ?? ""}</div>
          {/* Balanced reframe (ported from a parallel session) — most
              cognitive habits started as adaptive, not just a flaw. */}
          {(() => {
            const r = COGNITIVE_PATTERN_REFLECTIONS[openPattern as keyof typeof COGNITIVE_PATTERN_REFLECTIONS] ?? GENERIC_PATTERN_REFLECTION;
            return (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${mdDivider}`, display: "flex", flexDirection: "column", gap: 4 }}>
                <div><span style={{ fontWeight: 700, color: mdAccentText }}>What helps</span> · {r.benefit}</div>
                <div><span style={{ fontWeight: 700, color: mdWarn }}>What to watch for</span> · {r.caution}</div>
              </div>
            );
          })()}
        </div>
      )}
      {belief.evidenceQuotes.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {[...belief.evidenceQuotes].reverse().slice(0, 2).map((q: StoredEvidenceQuote, qi: number) => (
            <div key={qi} style={{ ...sans, fontSize: 12, color: mdBody, lineHeight: 1.5, wordBreak: "keep-all" }}>
              <span style={{ ...mono, fontSize: 10.5, color: mdFaint }}>{q.date}</span> · "{q.quote}"
            </div>
          ))}
        </div>
      )}
      {hasLoopData && (
        <div style={{ marginTop: 10 }}>
          <motion.span
            role="button" tabIndex={0} whileTap={{ opacity: 0.6 }} onClick={() => setShowLoop((v) => !v)}
            style={{ ...sans, fontSize: 11.5, color: mdAccentText, fontWeight: 600, cursor: "pointer", display: "inline-block" }}
          >
            {showLoop ? "Collapse repeat structure ↑" : "See why this pattern repeats ↓"}
          </motion.span>
          {showLoop && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: mdTrack }}>
              <FunctionalLoopDiagram belief={belief} history={history} />
            </div>
          )}
        </div>
      )}
      {onReject && (
        <motion.span
          role="button" tabIndex={0} onClick={() => onReject(belief.id)} whileTap={{ opacity: 0.6 }}
          style={{ ...sans, fontSize: 11.5, color: mdFaint, marginTop: 10, display: "inline-block", cursor: "pointer" }}
        >
          This observation doesn't match how I see it
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
          <line key={`${i}-${i + 1 + j}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={mdAccentText} strokeOpacity={0.3} strokeWidth={1} />
        ))
      )}
      {positions.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={8} fill={mdAccentSoft} stroke={mdAccentText} strokeWidth={1.4} />
      ))}
    </svg>
  );
}

// Belief network mapping (Level 3) — a core belief rarely stands alone;
// this surfaces the connected clusters findBeliefClusters finds among
// "root" connections (3+ mutually-reinforcing beliefs), which the flat
// pairwise "Discovered Connections" list elsewhere never states as a single structure.
function BeliefNetworkSection({ beliefs, connections }: { beliefs: StoredBelief[]; connections: StoredConnection[] }) {
  const clusters = findBeliefClusters(beliefs, connections);
  if (clusters.length === 0) return null;
  const byId = new Map(beliefs.map((b) => [b.id, b]));
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Beliefs That Support Each Other</div>
      <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
        Core beliefs usually don't show up alone — several of them tend to appear together, propping each other up.
      </div>
      {clusters.map((clusterIds, ci) => {
        const clusterBeliefs = clusterIds.map((id) => byId.get(id)).filter((b): b is StoredBelief => !!b);
        if (clusterBeliefs.length === 0) return null;
        return (
          <div key={ci} style={{ marginTop: 14, padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow, display: "flex", gap: 14, alignItems: "center" }}>
            <BeliefClusterDiagram count={clusterBeliefs.length} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...sans, fontSize: 12.5, fontWeight: 600, color: mdHeading }}>{clusterBeliefs.length} beliefs are supporting each other</div>
              <div style={{ ...sans, fontSize: 11.5, color: mdBody, marginTop: 6, lineHeight: 1.6, wordBreak: "keep-all" }}>
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
      <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Tension Between What You've Said</div>
      <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
        This doesn't decide which one is right. It just places the two side by side.
      </div>
      {pairs.map((p, i) => (
        <div key={i} style={{ marginTop: 14, padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
          <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: mdHeading, lineHeight: 1.6, wordBreak: "keep-all" }}>"{p.a.statement}"</div>
          <div style={{ ...sans, fontSize: 11, color: mdFaint, margin: "8px 0", textAlign: "center" }}>and</div>
          <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: mdHeading, lineHeight: 1.6, wordBreak: "keep-all" }}>"{p.b.statement}"</div>
          {p.note && (
            <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${mdDivider}`, lineHeight: 1.5, wordBreak: "keep-all" }}>
              {p.note}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Belief Map and Recurring Assumptions used to be two separate screens, but
// a belief ("Safety comes first") and an assumption ("When uncertain →
// waiting is safer") are the same kind of thing at different specificity — one
// screen now, sectioned, instead of two nearly-redundant ones.
function ScreenBeliefMap({ onBack, store, onRejectBelief }: { onBack?: () => void; store: Store; onRejectBelief?: (beliefId: string) => void }) {
  const hasBeliefs = store.beliefs.length > 0;
  const hasAssumptions = store.assumptions.length > 0;
  const visibleBeliefs = store.beliefs.filter((b) => b.userReaction !== "rejected");
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <div style={{ ...serif, fontSize: 26, color: mdHeading, marginTop: 10 }}>Unconscious Patterns</div>
        <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: hasBeliefs ? 6 : 20, lineHeight: 1.5, wordBreak: "keep-all", textAlign: hasBeliefs ? "left" : "center" }}>
          {hasBeliefs ? "Things that keep showing up in your actual words and actions, without you consciously realizing it." : "No patterns discovered yet. Log your first thought with \"Speak your mind\" — we'll start finding patterns from there."}
        </div>
        <div style={{ ...sans, fontSize: 11, color: mdFaint, marginTop: 10, lineHeight: 1.5, wordBreak: "keep-all" }}>
          {DISCLAIMER_NOTICE}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <div style={{ marginTop: 20 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Core Unconscious Beliefs</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            Not something you'd say "this is what I believe" out loud — it's the background pattern that keeps showing up in your actual choices and words, regardless of the situation. Circle size / bar length reflects how much real evidence backs it. It takes at least 3 similar entries before one appears here — a single entry is never enough to create one.
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          {visibleBeliefs.length === 0 ? (
            <div style={{ ...sans, fontSize: 13, color: mdFaint, padding: "12px 0" }}>No unconscious beliefs discovered yet.</div>
          ) : (
            <div style={{ backgroundColor: mdCard, boxShadow: mdCardShadow, borderRadius: 18, overflow: "hidden" }}>
              {visibleBeliefs.map((b, i) => (
                <BeliefCard key={b.id} belief={b} history={store.history} connections={store.connections} onReject={onRejectBelief} isLast={i === visibleBeliefs.length - 1} />
              ))}
            </div>
          )}
        </div>

        <BeliefNetworkSection beliefs={visibleBeliefs} connections={store.connections} />
        <ContradictionSection beliefs={visibleBeliefs} connections={store.connections} />

        <div style={{ marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: mdAccentSoft, borderLeft: `2px solid ${mdAccent}` }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em" }}>What's the difference between an unconscious belief and an interpretation?</div>
          <div style={{ ...sans, fontSize: 12.5, color: mdBodyLight, marginTop: 8, lineHeight: 1.65, wordBreak: "keep-all" }}>
            An unconscious belief is the thing that quietly runs in the background without you noticing it. An unconscious interpretation is the specific reaction that belief triggers in your actual words and actions at a particular moment. The belief is "why," and the interpretation is "the moment it actually happens." For example, the belief above, "{visibleBeliefs[0]?.statement ?? "I can only start once it's perfect"}," shows up as the concrete interpretation below — "When starting something new → puts it off, telling myself I'm not ready yet" — every time, in a specific action.
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Recurring Unconscious Interpretations</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            Moments where "in this situation → I automatically interpret and act this way." More specific than an unconscious belief, with an actual observed trigger.
          </div>
          <div style={{ marginTop: 12 }}>
            {!hasAssumptions ? (
              <div style={{ ...sans, fontSize: 13, color: mdFaint, padding: "12px 0" }}>No unconscious interpretations discovered yet.</div>
            ) : (
              <div style={{ backgroundColor: mdCard, boxShadow: mdCardShadow, borderRadius: 18, overflow: "hidden" }}>
                {store.assumptions.map((a, i) => (
                  <div key={a.id} style={{ display: "flex", gap: 14, padding: 18, borderBottom: i < store.assumptions.length - 1 ? `1px solid ${mdDivider}` : "none" }}>
                    <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: mdAccentText, lineHeight: 1.3, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</div>
                    <div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdBody }}>{a.trigger}</span>
                        <span style={{ ...serif, fontSize: 16, color: mdHeading, lineHeight: 1.4, wordBreak: "keep-all" }}>→ {a.interpretation}</span>
                      </div>
                      {a.domains && a.domains.length > 0 && (
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          {a.domains.map((d: string) => (
                            <span key={d} style={{ ...sans, fontSize: 11, color: mdBody, backgroundColor: mdTrack, padding: "3px 9px", borderRadius: 999 }}>{d}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ ...sans, fontSize: 11, color: mdFaint, marginTop: 8 }}>Found in {a.count} conversations</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {store.connections.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Discovered Connections</div>
            <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
              Two unconscious beliefs that looked different turn out to come from the same root cause.
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {store.connections.map((c, i) => {
                const from = visibleBeliefs.find((b) => b.id === c.a);
                const to = visibleBeliefs.find((b) => b.id === c.b);
                if (!from || !to) return null;
                return (
                  <div key={i} style={{ padding: "12px 14px", borderRadius: 12, backgroundColor: mdAccentSoft }}>
                    <ConnectionSpark aLabel={from.domain} bLabel={to.domain} />
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ ...sans, fontSize: 12.5, color: mdHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
                        <span style={{ fontWeight: 700, color: mdAccentText }}>{from.domain}</span> — "{from.statement}"
                      </div>
                      <div style={{ ...sans, fontSize: 12.5, color: mdHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
                        <span style={{ fontWeight: 700, color: mdAccentText }}>{to.domain}</span> — "{to.statement}"
                      </div>
                    </div>
                    <div style={{ ...sans, fontSize: 13, color: mdBodyLight, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>{c.note}</div>
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
// score. This is the one screen most tied to the mission line "helps you
// consciously become the person you want to be" — it has to show the gap
// plainly, not soften it into a neutral-sounding statistic.
function ScreenDrift({ onBack, store, onSetupAspiration }: { onBack?: () => void; store: Store; onSetupAspiration?: () => void }) {
  const hasAspiration = !!store.aspiration;
  const examples = store.aspirationExamples ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <div style={{ ...serif, fontSize: 26, color: mdHeading, marginTop: 10 }}>Distance from Your Goal</div>
        <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
          The gap between the person you said you wanted to be and your recent actual patterns.
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px" }}>
        {hasAspiration ? (
          <>
            <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${mdDivider}` }}>
              <div style={{ ...mono, fontSize: 11, color: mdFaint }}>{store.aspirationSetDate}, what you said</div>
              <div style={{ ...serif, fontSize: 17, fontStyle: "italic", color: mdBodyLight, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>
                "{store.aspiration}"
              </div>
              <motion.span role="button" tabIndex={0} onClick={onSetupAspiration} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 12, color: mdAccentText, cursor: "pointer", display: "inline-block", marginTop: 10 }}>
                Set again
              </motion.span>
            </div>
            {store.driftNotes.length === 0 ? (
              <div style={{ ...sans, fontSize: 13.5, color: mdBody, lineHeight: 1.7, wordBreak: "keep-all" }}>
                Not enough entries yet to compare. Log a few more thoughts and we'll show you the gap between this and your actual patterns.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[...store.driftNotes].reverse().map((d, i) => (
                  <div key={i} style={{ padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
                    <div style={{ ...mono, fontSize: 11, color: mdFaint }}>{d.date}</div>
                    <div style={{ ...sans, fontSize: 14, color: mdBodyLight, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>{d.note}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div
              role="button" tabIndex={0} onClick={onSetupAspiration}
              style={{ padding: 16, borderRadius: 14, backgroundColor: mdAccentSoft, borderLeft: `2px solid ${mdAccent}`, marginBottom: 24, cursor: "pointer" }}
            >
              <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: mdAccentText }}>Tell us who you want to become</div>
              <div style={{ ...sans, fontSize: 12.5, color: mdBodyLight, marginTop: 6, lineHeight: 1.6, wordBreak: "keep-all" }}>
                {examples.length > 0
                  ? "Just leave one sentence, and we'll keep showing you the gap between it and what you actually log. (Examples below.)"
                  : "Just leave one sentence, and we'll keep showing you the gap between it and what you actually log."}
              </div>
            </div>
            {examples.map((a) => {
              const gap = Math.abs(a.target - a.actual);
              return (
                <div key={a.said} style={{ marginBottom: 26, paddingBottom: 26, borderBottom: `1px solid ${mdDivider}` }}>
                  <div style={{ ...mono, fontSize: 11, color: mdFaint }}>{a.saidDate}, what you said</div>
                  <div style={{ ...serif, fontSize: 16, fontStyle: "italic", color: mdBodyLight, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
                    "{a.said}"
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span style={{ ...sans, fontSize: 12, color: mdBody }}>{a.label}</span>
                      <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: mdWarn }}>{gap}pp gap</span>
                    </div>
                    <div style={{ position: "relative", height: 8, borderRadius: 4, backgroundColor: mdTrack, marginTop: 8 }}>
                      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(a.target, a.actual)}%`, width: `${gap}%`, backgroundColor: mdWarnSoft }} />
                      <div style={{ position: "absolute", top: -3, height: 14, width: 2, backgroundColor: mdFaint, left: `${a.target}%` }} />
                      <div style={{ position: "absolute", top: -3, height: 14, width: 3, borderRadius: 2, backgroundColor: mdAccent, left: `${a.actual}%` }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ ...sans, fontSize: 10, color: mdFaint }}>Target {a.target}%</span>
                      <span style={{ ...sans, fontSize: 10, color: mdAccentText }}>Actual {a.actual}%</span>
                    </div>
                  </div>

                  <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 12, lineHeight: 1.55, wordBreak: "keep-all" }}>{a.note}</div>
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <div style={{ ...serif, fontSize: 24, color: mdHeading, marginTop: 10, lineHeight: 1.4, wordBreak: "keep-all" }}>Who do you want to become?</div>
        <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all" }}>
          We'll keep comparing this to the thoughts you log going forward.
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "8px 22px 0", display: "flex" }}>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. I want to be someone who chooses challenge over safety."
          style={{
            ...serif, flex: 1, width: "100%", resize: "none", border: "none", outline: "none",
            backgroundColor: "transparent", color: mdHeading, fontSize: 19, lineHeight: 1.7,
            wordBreak: "keep-all", colorScheme: "light",
          }}
        />
      </div>
      <div style={{ padding: "0 22px 32px", flexShrink: 0 }}>
        <PrimaryBtn disabled={!value.trim()} onClick={() => onSave?.(value.trim())} modernist>Save</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Screen 11 · Active Hypotheses ─────────────────────────────────────────────
// Falls back to a generic reflective question when a hypothesis doesn't
// carry its own (real hypotheses don't yet) — same wording either way, so
// the detail screen never has to know why a question is showing.
const GENERIC_HYPOTHESIS_QUESTION = "Is this insight helping you right now, or holding you back?";

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <div style={{ ...serif, fontSize: 26, color: mdHeading, marginTop: 10 }}>AI's Hypotheses</div>
        <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 6, lineHeight: 1.5 }}>Not certain. Agree or push back to help refine it together.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {items.length === 0 ? (
          <div style={{ ...sans, fontSize: 13.5, color: mdBody, lineHeight: 1.7, wordBreak: "keep-all", padding: "12px 0" }}>
            Once enough thoughts build up, the AI's higher-level theories spanning multiple unconscious beliefs will show up here.
          </div>
        ) : (
          items.map((h, i) => (
            <motion.div
              key={h.id} role="button" tabIndex={0} onClick={() => onOpen?.(i)} whileTap={{ scale: 0.99, opacity: 0.9 }}
              style={{ padding: "18px 0", borderBottom: i < items.length - 1 ? `1px solid ${mdDivider}` : "none", cursor: "pointer" }}
            >
              <div style={{ ...serif, fontSize: 16, color: mdHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{h.title}</div>
              <div style={{ marginTop: 12 }}>
                <ConfidenceBar value={h.confidence} modernist />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {h.domains.map((d: string) => (
                  <span key={d} style={{ ...sans, fontSize: 11, color: mdBody, backgroundColor: mdTrack, padding: "3px 9px", borderRadius: 999 }}>{d}</span>
                ))}
              </div>
              {h.reaction && (
                <div style={{ ...sans, fontSize: 11, color: h.reaction === "agree" ? mdAccentText : mdWarn, marginTop: 8 }}>
                  {h.reaction === "agree" ? "Agreed" : "Said no"}
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
// The full "Today's Discovery" experience for a hypothesis-sourced discovery —
// everything the old standalone "AI's Hypotheses" detail page showed, plus the
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
    .filter((b): b is StoredBelief => !!b)
    .map((belief) => ({
      ...belief,
      emotionGranularity: beliefEmotionGranularity(belief, store.history),
      ruminationLikely: isLikelyRuminating(belief, store.connections, store.history),
    }));
  const relatedBeliefIds = new Set(relatedBeliefs.map((b) => b.id));
  const relatedConnections = store.connections.filter((c) => relatedBeliefIds.has(c.a) && relatedBeliefIds.has(c.b));
  const contradictoryEntries = relatedBeliefs
    .flatMap((b) => (b.contradictoryEntryIds ?? []).map((id) => ({ belief: b, entry: store.history.find((e) => e.id === id) })))
    .filter((x): x is { belief: StoredBelief; entry: StoredHistoryEntry } => !!x.entry);

  return (
    <div>
      <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em" }}>Today's Discovery</div>
      <div style={{ ...serif, fontSize: 21, color: mdHeading, marginTop: 10, lineHeight: 1.5, wordBreak: "keep-all" }}>{h.title}</div>
      <div style={{ marginTop: 18 }}><ConfidenceBar value={h.confidence} modernist /></div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {h.domains.map((d: string) => (<span key={d} style={{ ...sans, fontSize: 11, color: mdBody, backgroundColor: mdTrack, padding: "3px 9px", borderRadius: 999 }}>{d}</span>))}
      </div>

      {evidence.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Conversations Behind This</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {evidence.map((e, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 12, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...mono, fontSize: 11, color: mdFaint }}>{e.date}</span>
                  {e.domain && <span style={{ ...sans, fontSize: 10, color: mdAccentText, backgroundColor: mdAccentSoft, padding: "2px 8px", borderRadius: 999 }}>{e.domain}</span>}
                </div>
                <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: mdBodyLight, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{e.quote}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {relatedBeliefs.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Related Active Neurons</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            These are the actual places in the brain where the unconscious beliefs behind this discovery are activated.
          </div>
          <div style={{ marginTop: 12 }}>
            <NeuralBeliefGraph3D beliefs={relatedBeliefs} connections={relatedConnections} height={200} defaultStructureMode />
          </div>
          <DiscoveryBeliefList beliefIds={h.relatedBeliefIds} store={store} />
        </div>
      )}

      {contradictoryEntries.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Conflicting Entries</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            There are entries that pointed a different way from this conclusion — the confidence score reflects that.
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {contradictoryEntries.map(({ belief, entry }, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 12, backgroundColor: mdWarnSoft, borderLeft: `2px solid ${mdWarn}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...mono, fontSize: 11, color: mdFaint }}>{entry.date}</span>
                  <span style={{ ...sans, fontSize: 10, color: mdWarnTagText, backgroundColor: mdWarnTag, padding: "2px 8px", borderRadius: 999 }}>{belief.domain}</span>
                </div>
                <div style={{ ...serif, fontSize: 14, fontStyle: "italic", color: mdBodyLight, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{entry.text}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {h.investigate && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>How This Belief Has Changed</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
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

      <div style={{ marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: mdAccentSoft, borderLeft: `2px solid ${mdAccent}` }}>
        <div style={{ ...serif, fontSize: 15, fontStyle: "italic", color: mdHeading, lineHeight: 1.65, wordBreak: "keep-all" }}>{question}</div>
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em", marginBottom: 12 }}>What do you think of this hypothesis?</div>
        {!settled && (
          <>
            <ReactionButtons
              reaction={reaction}
              onReact={(r) => (r === "agree" ? onAgree?.() : onDisagree?.())}
              disabled={reinterpreting}
              dark
            />
            {reinterpreting && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 12, textAlign: "center" }}>
                Looking for another interpretation…
              </motion.div>
            )}
          </>
        )}
        <div style={{ marginTop: settled ? 0 : 10 }}>
          {h.investigate && <GhostBtn onClick={onInvestigate} modernist>Dig deeper</GhostBtn>}
        </div>
        {settled && exhausted && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 12, lineHeight: 1.5, wordBreak: "keep-all", textAlign: "center" }}>
            There doesn't seem to be another way to read the same evidence. We'll take another look once new entries come in.
          </motion.div>
        )}
        {settled && !exhausted && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: mdAccent, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, lineHeight: 1 }}>✓</span>
            <span style={{ ...sans, fontSize: 12, color: mdBody }}>Logged. This hypothesis's confidence goes up a bit.</span>
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
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
        kicker="Dig deeper"
        statement={<>Let's find out<br />where this pattern<br />first started.</>}
        cta={<PrimaryBtn onClick={() => setStep(1)} modernist>Start</PrimaryBtn>}
      />
    );
  } else if (step === 1) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "52px 22px 90px" }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em" }}>The First Time This Showed Up</div>
          <div style={{ marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
            <div style={{ ...mono, fontSize: 11, color: mdFaint }}>{inv.origin.date}</div>
            <div style={{ ...serif, fontSize: 16, fontStyle: "italic", color: mdBodyLight, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>"{inv.origin.quote}"</div>
          </div>
          <div style={{ ...sans, fontSize: 13.5, color: mdBody, marginTop: 18, lineHeight: 1.75, wordBreak: "keep-all" }}>{inv.originNote}</div>
        </div>
      </div>
    );
  } else if (step === 2) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "52px 22px 90px" }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em" }}>Then and Now, Side by Side</div>
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
        kicker="Connection to another pattern"
        statement={inv.related}
        cta={<PrimaryBtn onClick={onBack} modernist>Back to the hypothesis</PrimaryBtn>}
      />
    );
  }

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px 0", zIndex: 2 }}>
        <motion.span role="button" tabIndex={0} onClick={step === 0 ? onBack : () => setStep(step - 1)} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <span style={{ ...mono, fontSize: 11, color: mdFaint }}>{step + 1} / {steps}</span>
      </div>
      <div style={{ height: "100%" }}>{body}</div>
      {step > 0 && step < steps - 1 && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 22px 24px" }}>
          <PrimaryBtn onClick={() => setStep(step + 1)} modernist>Next</PrimaryBtn>
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

// "Today"/"Yesterday" relative to now, else the raw date — matches the
// History screen's original mockup group headers without fabricating
// anything the date itself doesn't say.
function relativeDayLabel(dateStr: string): string {
  const d = parseDotDate(dateStr);
  if (!d) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
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
// Dark theme + starfield background, ported from the History screen's
// original mockup. Entries grouped by day (Today/Yesterday/date), each carrying whatever real domain/tag
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "24px 16px 8px", flexShrink: 0 }}>
        <div style={{ ...serif, fontSize: 34, fontWeight: 400, color: mdHeading, marginBottom: 6 }}>History</div>
        <div style={{ ...sans, fontSize: 13, color: mdBody }}>The thoughts you've logged so far.</div>
      </div>
      <div data-tutorial="history-list" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px 24px" }}>
        {items.length === 0 ? (
          <div style={{ ...sans, fontSize: 13, color: mdBody, padding: "12px 0" }}>No thoughts logged yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {groups.map((grp) => (
              <div key={grp.label + grp.entries[0].entry.id}>
                <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: mdFaint, marginBottom: 10, letterSpacing: "0.03em" }}>{grp.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {grp.entries.map(({ index, entry }) => {
                    const domainInfo = findEntryDomain(entry.id, store.beliefs);
                    const status = entry.analysis?.hypothesis?.status;
                    const tag = status === "supported" || status === "emerging" ? "Recurring thought" : null;
                    return (
                      <motion.div
                        key={entry.id} role="button" tabIndex={0} onClick={() => onOpenEntry?.(index)} whileTap={{ opacity: 0.6 }}
                        style={{ backgroundColor: mdCard, borderRadius: 16, padding: "16px 18px", boxShadow: mdCardShadow, cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          {domainInfo && (
                            <>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: domainInfo.color, flexShrink: 0 }} />
                              <span style={{ ...sans, fontSize: 10.5, fontWeight: 700, color: domainInfo.color }}>{domainInfo.domain}</span>
                            </>
                          )}
                          {entry.duration && <span style={{ ...mono, fontSize: 10.5, color: mdFaint, marginLeft: "auto" }}>{entry.duration}</span>}
                        </div>
                        <p style={{ ...serif, fontSize: 16, color: mdHeading, margin: 0, lineHeight: 1.45, wordBreak: "keep-all" }}>"{entry.text}"</p>
                        {tag && (
                          <div style={{ marginTop: 10, display: "inline-block", ...sans, fontSize: 10.5, fontWeight: 700, color: mdAccentTagText, backgroundColor: mdAccentTag, padding: "3px 10px", borderRadius: 999 }}>{tag}</div>
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
      <BottomNav active="history" onSelect={onNavSelect} modernist />
    </div>
  );
}

// ── Screen 13.5 · History entry detail ────────────────────────────────────────
function ScreenHistoryDetail({ index, store, onBack }: { index: number; store: Store; onBack?: () => void }) {
  const items = [...store.history].reverse();
  const entry = items[index] ?? items[0];
  if (!entry) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: dkBody, cursor: "pointer" }}>← Back</motion.span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ ...mono, fontSize: 12, color: "#726A8A" }}>{entry.date}</span>
          {entry.duration && <span style={{ ...mono, fontSize: 11, color: "#726A8A" }}>{entry.duration}</span>}
        </div>
        <div style={{ ...serif, fontSize: 19, color: dkHeading, marginTop: 16, lineHeight: 1.7, wordBreak: "keep-all" }}>
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
  onOpenPaywall,
  onOpenManageSubscription,
}: {
  onNavSelect?: (id: string) => void;
  store: Store;
  onOpenSettings?: (screen: "notifications" | "dataPrivacy" | "help") => void;
  isDemoMode: boolean;
  onToggleDemoMode: (v: boolean) => void;
  onOpenPaywall?: () => void;
  onOpenManageSubscription?: () => void;
}) {
  const name = store.account?.name || "Anonymous observer";
  const initial = name.charAt(0);
  const firstEntryDate = [...store.history].sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
  const planLabel = store.proPlan === "monthly" ? "Monthly plan" : store.proPlan === "yearly" ? "Yearly plan" : null;
  const stats = [
    { value: String(store.entryCount), label: "Thoughts logged" },
    { value: String(store.beliefs.length), label: "Beliefs discovered" },
    { value: `${computeStreak(store.history)} days`, label: "Streak" },
  ];
  const rows: { label: string; onClick?: () => void; destructive?: boolean }[] = [
    ...(MONETIZATION_ENABLED && store.isPro ? [{ label: "Manage subscription", onClick: onOpenManageSubscription }] : []),
    { label: "Notifications", onClick: () => onOpenSettings?.("notifications") },
    { label: "Data & Privacy", onClick: () => onOpenSettings?.("dataPrivacy") },
    { label: "Help", onClick: () => onOpenSettings?.("help") },
    {
      label: "Log out",
      onClick: onNavSelect
        ? () => {
            if (isCloudSyncConfigured) cloudSignOut();
            onNavSelect("auth");
          }
        : undefined,
      destructive: true,
    },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 16px 24px" }}>
        <div style={{ padding: "8px 4px 24px" }}>
          <div style={{ ...serif, fontSize: 34, fontWeight: 400, color: mdHeading, marginBottom: 6 }}>Profile</div>
          <div style={{ ...sans, fontSize: 13, color: mdBody }}>We've been tracking your journey.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, backgroundColor: mdCard, borderRadius: 20, padding: 20, boxShadow: mdCardShadow, marginBottom: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: `linear-gradient(135deg, ${mdAccent}, ${mdAccentText})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...serif, fontSize: 24, color: "#fff" }}>
            {initial}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...sans, fontSize: 17, fontWeight: 800, color: mdHeading }}>{name}</span>
              {MONETIZATION_ENABLED && store.isPro && (
                <span style={{ ...sans, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", color: mdAccentText, backgroundColor: mdAccentSoft, padding: "2px 8px", borderRadius: 999 }}>PRO</span>
              )}
            </div>
            {planLabel ? (
              <span style={{ ...mono, fontSize: 11.5, color: mdFaint }}>{planLabel}</span>
            ) : (
              firstEntryDate && <span style={{ ...mono, fontSize: 11.5, color: mdFaint }}>With you since {firstEntryDate}</span>
            )}
          </div>
        </div>

        {MONETIZATION_ENABLED && !store.isPro && (
          <motion.div
            role="button" tabIndex={0} onClick={onOpenPaywall} whileTap={{ opacity: 0.6 }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 12,
              backgroundColor: mdCard, borderRadius: 20, padding: "16px 18px", boxShadow: mdCardShadow, marginBottom: 14,
              borderLeft: `2px solid ${mdAccent}`,
            }}
          >
            <div>
              <div style={{ ...sans, fontSize: 14, fontWeight: 800, color: mdHeading }}>Upgrade to Pro</div>
              <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 2 }}>Unlock your Brain Map, hypotheses, and more</div>
            </div>
            <span style={{ color: mdAccentText, fontSize: 18 }}>›</span>
          </motion.div>
        )}

        <div data-tutorial="profile-stats" style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ flex: 1, backgroundColor: mdCard, borderRadius: 16, padding: "16px 12px", textAlign: "center", boxShadow: mdCardShadow }}>
              <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: mdAccentText, marginBottom: 4 }}>{s.value}</div>
              <div style={{ ...sans, fontSize: 11, color: mdBody }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Design/dev affordance: instantly switches the whole app between
            curated demo content and a real, on-device, initially-empty
            store — see src/app/dataProvider.ts. Not something a real end
            user would normally touch, but there's no separate build
            target to hide it behind. */}
        <div style={{ marginBottom: 14, backgroundColor: mdCard, borderRadius: 20, padding: "0 18px", boxShadow: mdCardShadow }}>
          <SettingsToggle
            label="Demo Mode"
            note="Turn it on to browse the screens with example data. Turn it off to see only your real entries — a new account starts empty."
            value={isDemoMode}
            onChange={onToggleDemoMode}
            modernist
          />
        </div>

        <div style={{ backgroundColor: mdCard, borderRadius: 20, overflow: "hidden", boxShadow: mdCardShadow }}>
          {rows.map((r, i) => (
            <motion.div
              key={r.label} role="button" tabIndex={0} onClick={r.onClick} whileTap={{ opacity: 0.6 }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", cursor: "pointer", borderBottom: i < rows.length - 1 ? `1px solid ${mdDivider}` : "none" }}
            >
              <span style={{ ...sans, fontSize: 14, fontWeight: 700, color: r.destructive ? mdAccentText : mdHeading, flex: 1 }}>{r.label}</span>
              <span style={{ color: mdFaint, fontSize: 15 }}>›</span>
            </motion.div>
          ))}
        </div>
      </div>
      <BottomNav active="profile" onSelect={onNavSelect} modernist />
    </div>
  );
}

// ── Screen 14.1 · Notification settings ───────────────────────────────────────
function SettingsToggle({ label, note, value, onChange, dark, modernist }: { label: string; note?: string; value: boolean; onChange?: (v: boolean) => void; dark?: boolean; modernist?: boolean }) {
  const labelColor = modernist ? mdHeading : dark ? dkBodyLight : ink;
  const noteColor = modernist ? mdBody : dark ? dkBody : subtle;
  const dividerColor = modernist ? mdDivider : dark ? dkDivider : hair;
  const trackOff = modernist ? mdTrack : dark ? dkTrack : hair;
  const trackOn = modernist ? mdAccent : dkAccent;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 0", borderBottom: `1px solid ${dividerColor}` }}>
      <div style={{ paddingRight: 16 }}>
        <div style={{ ...sans, fontSize: 15, fontWeight: modernist ? 800 : 400, color: labelColor }}>{label}</div>
        {note && <div style={{ ...sans, fontSize: 12, color: noteColor, marginTop: 3, lineHeight: 1.5, wordBreak: "keep-all" }}>{note}</div>}
      </div>
      <motion.div
        role="button" tabIndex={0} onClick={() => onChange?.(!value)} whileTap={{ scale: 0.95 }}
        style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: value ? trackOn : trackOff, flexShrink: 0, padding: 3, cursor: "pointer", display: "flex", justifyContent: value ? "flex-end" : "flex-start" }}
      >
        <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff" }} />
      </motion.div>
    </div>
  );
}

function ScreenNotificationSettings({ settings, onBack, onChange }: { settings: StoredSettings; onBack?: () => void; onChange?: (settings: StoredSettings) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <div style={{ ...serif, fontSize: 26, color: mdHeading, marginTop: 10 }}>Notifications</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <SettingsToggle
          label="Daily reminder"
          note="Once a day, a nudge to log what's on your mind today."
          value={settings.dailyReminder}
          onChange={(v) => onChange?.({ ...settings, dailyReminder: v })}
          modernist
        />
        <SettingsToggle
          label="New hypothesis alerts"
          note="We'll let you know when the AI finds a new pattern."
          value={settings.newHypothesisAlert}
          onChange={(v) => onChange?.({ ...settings, newHypothesisAlert: v })}
          modernist
        />
        <SettingsToggle
          label="Weekly summary"
          note="A single recap of the unconscious beliefs and changes that built up over the week."
          value={settings.weeklySummary}
          onChange={(v) => onChange?.({ ...settings, weeklySummary: v })}
          modernist
        />
      </div>
    </div>
  );
}

// ── Screen 14.2 · Data & privacy ───────────────────────────────────────────────
function ScreenDataPrivacy({
  store,
  onBack,
  onResetData,
  onOpenPrivacyPolicy,
  onOpenTermsOfService,
}: {
  store: Store;
  onBack?: () => void;
  onResetData?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenTermsOfService?: () => void;
}) {
  const [armed, setArmed] = React.useState(false);
  const s = store;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <div style={{ ...serif, fontSize: 26, color: mdHeading, marginTop: 10 }}>Data & Privacy</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <div style={{ ...sans, fontSize: 13.5, color: mdBody, lineHeight: 1.75, wordBreak: "keep-all" }}>
          {isCloudSyncConfigured
            ? "Browsing as a guest, everything stays only in this device's browser. If you've signed up, your unconscious beliefs, interpretations, and conversation history are also synced to a private, encrypted account — accessible only to you, never sold or shared, and protected by database-level access rules that make it impossible for anyone else to read your data even by mistake. Text you log with \"Speak your mind\" is only sent to Claude (Anthropic) at the moment it's analyzed."
            : "This app doesn't create an account on a separate server. Your unconscious beliefs, interpretations, and conversation history are stored only in this device's browser. Text you log with \"Speak your mind\" is only sent to Claude (Anthropic) at the moment it's analyzed, and never leaves your device otherwise."}
        </div>

        <div style={{ ...sans, fontSize: 13.5, color: mdBody, marginTop: 16, lineHeight: 1.75, wordBreak: "keep-all" }}>
          One exception: what you write is checked on this device, before anything is sent anywhere, for language that suggests you might be in crisis. That check never leaves your device either — if it matches, you're shown real crisis resources instead of the usual analysis. Nothing about that check is stored, scored, or shared.
        </div>

        <div style={{ marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Data Stored on This Device</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["Unconscious beliefs", s?.beliefs.length ?? 0],
              ["Recurring unconscious interpretations", s?.assumptions.length ?? 0],
              ["Connections between unconscious beliefs", s?.connections.length ?? 0],
              ["Conversation history", s?.history.length ?? 0],
              ["AI's hypotheses", s?.hypotheses.length ?? 0],
            ].map(([label, count]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ ...sans, fontSize: 13, color: mdBodyLight }}>{label}</span>
                <span style={{ ...mono, fontSize: 13, color: mdBody }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <div
            role="button" tabIndex={0}
            onClick={() => (armed ? onResetData?.() : setArmed(true))}
            style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${armed ? mdWarn : mdDivider}`, backgroundColor: armed ? mdWarnSoft : "transparent", cursor: "pointer" }}
          >
            <span style={{ ...sans, fontSize: 14, fontWeight: 600, color: mdWarn }}>
              {armed ? "Are you sure? Tap again to delete everything" : "Delete all my data"}
            </span>
          </div>
          {armed && (
            <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 8, lineHeight: 1.5 }}>
              All unconscious beliefs, interpretations, conversation history, and your goal stored on this device will be gone. This can't be undone.
            </div>
          )}
        </div>

        <div style={{ marginTop: 28, backgroundColor: mdCard, borderRadius: 20, overflow: "hidden", boxShadow: mdCardShadow }}>
          {[
            { label: "Privacy Policy", onClick: onOpenPrivacyPolicy },
            { label: "Terms of Service", onClick: onOpenTermsOfService },
          ].map((r, i, arr) => (
            <motion.div
              key={r.label} role="button" tabIndex={0} onClick={r.onClick} whileTap={{ opacity: 0.6 }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", cursor: "pointer", borderBottom: i < arr.length - 1 ? `1px solid ${mdDivider}` : "none" }}
            >
              <span style={{ ...sans, fontSize: 14, fontWeight: 700, color: mdHeading, flex: 1 }}>{r.label}</span>
              <span style={{ color: mdFaint, fontSize: 15 }}>›</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Screen 14.3 · Help ─────────────────────────────────────────────────────────
const HELP_ITEMS = [
  { q: "What does this app do?", a: "It's not a diary for logging what happened. Over time, it quietly reflects back why you think and act the way you do — the unconscious beliefs and interpretations that keep showing up in your actual words and actions, without you consciously realizing it." },
  { q: "How do I use \"Speak your mind\"?", a: "Don't try to organize it. Whatever happened today, a thought that suddenly crossed your mind, something you haven't decided yet — just say or type it in whatever order it comes to you. Voice uses your browser's built-in recognition; text supports direct typing." },
  { q: "What are unconscious patterns?", a: "It shows the unconscious beliefs that seem to drive your actual decisions, even ones you're not fully aware of, as circles that grow as more evidence builds up. Below that are \"recurring unconscious interpretations\" — interpretations that automatically pop up in specific situations. Lines between circles are connections between unconscious beliefs that appear to come from the same root." },
  { q: "How is an AI hypothesis different from an unconscious belief?", a: "An unconscious belief is the thing itself — what repeatedly shows up in your actual words and actions. A hypothesis is a higher-level theory the AI offers by crossing multiple unconscious beliefs/connections (e.g., \"this pattern shows up the same way in both your career and your relationships\"). It's not a settled fact — it's an interpretation you refine together by agreeing or pushing back." },
  { q: "How is distance from your goal calculated?", a: "The AI points out the concrete gap between who you said you wanted to become and the unconscious beliefs/interpretations that have actually built up. You set the goal directly on that screen." },
  { q: "What is this analysis based on?", a: "It draws on concepts from CBT (Cognitive Behavioral Therapy) and ACT (Acceptance and Commitment Therapy). Cognitive-distortion tags like \"All-or-nothing thinking\" and \"Overgeneralization\" come from CBT; distance from your goal comes from ACT's \"value direction\" concept. A single entry never creates a belief — it takes at least 3 similar patterns building up. Confidence never reaches 100%, and actually goes down when there are conflicting entries. That said, this is a self-reflection tool, not a psychological diagnosis or treatment." },
  { q: "What if I'm in crisis?", a: "If what you write suggests you might be in crisis, we show you real crisis resources (like the 988 Suicide & Crisis Lifeline) right away, instead of the usual analysis — that check happens entirely on your device, before anything is sent anywhere. If you're in danger right now, please contact emergency services or 988 directly rather than waiting on this app." },
];

function ScreenHelp({ onBack, onReplayTutorial }: { onBack?: () => void; onReplayTutorial?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <div style={{ ...serif, fontSize: 26, color: mdHeading, marginTop: 10 }}>Help</div>
        <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
          There are patterns in your mind. You just can't see them from inside.
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px" }}>
        {onReplayTutorial && (
          <motion.div
            role="button" tabIndex={0} onClick={onReplayTutorial} whileTap={{ opacity: 0.6 }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
              padding: "14px 16px", borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow, marginBottom: 18,
            }}
          >
            <span style={{ ...sans, fontSize: 14, fontWeight: 600, color: mdHeading }}>Replay the tutorial</span>
            <span style={{ ...sans, fontSize: 14, color: mdFaint }}>›</span>
          </motion.div>
        )}
        {HELP_ITEMS.map((h, i) => (
          <div key={h.q} style={{ padding: "16px 0", borderBottom: i < HELP_ITEMS.length - 1 ? `1px solid ${mdDivider}` : "none" }}>
            <div style={{ ...serif, fontSize: 16, color: mdHeading, lineHeight: 1.4, wordBreak: "keep-all" }}>{h.q}</div>
            <div style={{ ...sans, fontSize: 13.5, color: mdBody, marginTop: 8, lineHeight: 1.65, wordBreak: "keep-all" }}>{h.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Screen 14.4/14.5 · Legal documents ────────────────────────────────────────
// Both drafted to accurately describe how the app actually behaves today
// (local-storage-only, what gets sent to Claude/Anthropic and when,
// on-device crisis-language checking, the current MONETIZATION_ENABLED
// state) rather than generic boilerplate — but they're still a draft, not
// legal advice, and say so prominently. Swap in this file's content once
// an actual lawyer has reviewed it for your jurisdiction; nothing else
// about how these render needs to change.
type LegalSection = { heading: string; body: string };

function ScreenLegalDocument({
  title,
  lastUpdated,
  sections,
  onBack,
}: {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
  onBack?: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <div style={{ ...serif, fontSize: 26, color: mdHeading, marginTop: 10 }}>{title}</div>
        <div style={{ ...mono, fontSize: 11, color: mdFaint, marginTop: 6 }}>Last updated {lastUpdated}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 32px" }}>
        <div style={{ padding: 14, borderRadius: 12, backgroundColor: mdWarnSoft, borderLeft: `2px solid ${mdWarn}`, marginBottom: 22 }}>
          <div style={{ ...sans, fontSize: 12.5, color: mdWarnLabel, lineHeight: 1.6, wordBreak: "keep-all" }}>
            Draft — written to accurately describe how the app works today, but not yet reviewed by a lawyer. Have this reviewed for your jurisdiction before relying on it.
          </div>
        </div>
        {sections.map((s) => (
          <div key={s.heading} style={{ marginBottom: 22 }}>
            <div style={{ ...sans, fontSize: 13, fontWeight: 700, color: mdHeading }}>{s.heading}</div>
            <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 6, lineHeight: 1.7, wordBreak: "keep-all" }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    heading: "1. Overview",
    body: isCloudSyncConfigured
      ? "Browsing as a guest, everything you record lives only in your browser's local storage, on your own device, unless you delete it. If you sign up, your data is also synced to a private, encrypted account so it's there across your devices — see \"Where your data goes\" below for exactly what that means and doesn't mean."
      : "Mindscape does not operate its own server and does not create accounts on a server you don't control — there is no Mindscape backend that stores your data. Everything you record lives in your browser's local storage, on your own device, unless you delete it (see \"Deleting your data\" below).",
  },
  {
    heading: "2. What we collect",
    body: "Text you write or speak using \"Speak your mind\"; the AI's analysis of that text (beliefs, interpretations, hypotheses), generated and stored back on your device; basic account info if you sign up (name, email); and an optional aspiration statement, if you choose to set one. We do not collect your location, contacts, photos, browsing history outside the app, or anything you haven't directly entered.",
  },
  {
    heading: "3. Where your data goes",
    body: isCloudSyncConfigured
      ? "Stored in this browser's local storage on this device, and — only if you've signed up for an account — also synced to a private database row tied to your account, encrypted at rest, and protected by database-level access rules that only your own login can satisfy; not even we can query another user's data through the normal app, and we don't build tools to bypass that. Guests (no account) stay fully local, no different from before. When you use \"Speak your mind,\" the text you wrote is sent to Claude, an AI model operated by Anthropic, solely to generate the analysis shown back to you; Anthropic's own privacy policy governs how they handle that request, which we don't control beyond what's needed to return a response. If you've set a name on your account, that name may be included in the request so the AI can address you by it. We use no third-party analytics or advertising of any kind."
      : "Stored only in this browser's local storage on this device — it does not sync across devices and isn't backed up anywhere by us. When you use \"Speak your mind,\" the text you wrote is sent to Claude, an AI model operated by Anthropic, solely to generate the analysis shown back to you; Anthropic's own privacy policy governs how they handle that request, which we don't control beyond what's needed to return a response. If you've set a name on your account, that name may be included in the request so the AI can address you by it. We use no third-party analytics, advertising, or tracking of any kind — there's no \"us\" to send usage data to, because there's no Mindscape server collecting it.",
  },
  {
    heading: "4. Crisis-language detection",
    body: "Separately from AI analysis, every entry is checked on your device — not sent anywhere, not reviewed by the AI — for language that may indicate a mental health crisis. If detected, you're shown crisis support resources instead of the usual analysis. This check happens entirely locally; its result is never stored, logged, or transmitted.",
  },
  {
    heading: "5. Deleting your data",
    body: isCloudSyncConfigured
      ? "You can delete everything the app has stored at any time from Profile → Data & Privacy → \"Delete all my data.\" This immediately and permanently removes your beliefs, interpretations, conversation history, and goal from this device — and, if you're signed in, from your synced account as well, the next time a change syncs (effectively immediately)."
      : "You can delete everything the app has stored at any time from Profile → Data & Privacy → \"Delete all my data.\" This immediately and permanently removes your beliefs, interpretations, conversation history, and goal from this device. Because nothing is stored on a server, there's nothing left anywhere else to delete afterward.",
  },
  {
    heading: "6. Children's privacy",
    body: "Mindscape is not directed at children under 13, and we don't knowingly collect information from anyone under 13.",
  },
  {
    heading: "7. Changes to this policy",
    body: "If this policy changes, the \"Last updated\" date above will change. Continuing to use the app after an update means you accept the revised policy.",
  },
  {
    heading: "8. Contact",
    body: "[Add a real contact email here before publishing.]",
  },
];

const TERMS_OF_SERVICE_SECTIONS: LegalSection[] = [
  {
    heading: "1. What this app is",
    body: "Mindscape is a self-reflection tool that uses AI to help surface patterns in your own words and actions, drawing on concepts from Cognitive Behavioral Therapy (CBT) and Acceptance and Commitment Therapy (ACT).",
  },
  {
    heading: "2. Not medical or mental health treatment",
    body: "Mindscape is not therapy, counseling, medical advice, or a mental health treatment service, and no part of it is provided or reviewed by a licensed clinician. The AI's observations are not a diagnosis and shouldn't be treated as one. If you're experiencing a mental health crisis, contact a licensed professional or emergency services — see the in-app crisis resources, or call or text 988 (US).",
  },
  {
    heading: "3. Your account",
    body: "If you create an account, you're responsible for keeping your login information accurate and for anything that happens under it. Accounts and their data exist only on your local device (see our Privacy Policy) — we cannot recover a lost account or restore deleted data.",
  },
  {
    heading: "4. Acceptable use",
    body: "Don't use Mindscape to harm yourself or others, to violate any law, or to attempt to disrupt, reverse-engineer, or abuse the service, including the AI systems it relies on.",
  },
  {
    heading: "5. AI-generated content",
    body: "Analysis, hypotheses, and other AI-generated content are probabilistic and can be wrong, incomplete, or reflect the limitations of the underlying model. Use your own judgment about anything the AI surfaces — nothing it says is a fact about you unless you decide it resonates.",
  },
  {
    heading: "6. Subscriptions",
    body: "Some features may be offered as part of a paid subscription (Mindscape Pro). At current launch, Mindscape Pro is not active — every feature is available at no cost; this section is included so the terms are ready if that changes. Where a subscription is active, it renews automatically at the price and interval shown at signup until canceled, and can be canceled any time from Profile → Manage subscription.",
  },
  {
    heading: "7. Disclaimer of warranties",
    body: "Mindscape is provided \"as is,\" without warranties of any kind. We don't guarantee the app will be uninterrupted or error-free, or that its analysis will be accurate or useful for any particular purpose.",
  },
  {
    heading: "8. Limitation of liability",
    body: "To the fullest extent permitted by law, Mindscape and its creators are not liable for any damages arising from your use of the app, including reliance on any AI-generated content.",
  },
  {
    heading: "9. Changes",
    body: "We may update these terms; continued use after a change means you accept the new terms.",
  },
  {
    heading: "10. Governing law",
    body: "[Add your jurisdiction here before publishing.]",
  },
  {
    heading: "11. Contact",
    body: "[Add a real contact email here before publishing.]",
  },
];

// ── Screen 15 · Paywall ───────────────────────────────────────────────────────
// Free tier only records entries (see appendUnanalyzedEntry in realStore.ts)
// — every screen that reads AI-derived data (Mind/Analysis tab, Brain Map,
// AI's Hypotheses, Distance from Your Goal) renders this instead when
// !store.isPro, rather than showing an empty/broken version of itself. No
// real billing here — onContinue hands the picked plan to ScreenCheckout,
// which is the one place that actually flips store.isPro (see
// upgradeToPro in the App shell) — but both screens are written as a real
// paywall/checkout would be, so swapping in a payment SDK later only
// touches ScreenCheckout's submit handler.
const PRO_FEATURES = [
  { title: "Unconscious Patterns", detail: "See the core beliefs quietly running underneath your words and actions." },
  { title: "Brain Map", detail: "Watch your beliefs light up and connect to each other as a living map." },
  { title: "AI's Hypotheses", detail: "Get higher-level theories that cross multiple beliefs, and refine them together." },
  { title: "Distance from Your Goal", detail: "See the real gap between who you want to become and your actual patterns." },
];

type ProPlan = "monthly" | "yearly";

// Which free-tier entry triggers ScreenSoftPaywall — see the "think" case's
// onDone in the App shell and hasSeenUpgradePrompt in types.ts. 3 gives the
// free experience a little room to prove itself (a single entry has nothing
// to show a pattern in) before asking, without waiting so long the ask
// feels disconnected from what just happened.
const UPSELL_PROMPT_AT_ENTRY_COUNT = 3;

// Priced like the mental-wellness/self-reflection apps this one sits
// alongside (Reflectly, Stoic, etc. cluster around $7-13/mo or $40-70/yr) —
// yearly is the default selection below and priced to read as the
// obviously better deal (58% cheaper per month than paying monthly), which
// is what "BEST VALUE" is doing the actual math for, not just asserting.
const PRO_PLANS: { id: ProPlan; label: string; price: string; period: string; billedNote: string; badge?: string }[] = [
  { id: "yearly", label: "Yearly", price: "$49.99", period: "/year", billedNote: "$4.17/mo, billed annually", badge: "BEST VALUE" },
  { id: "monthly", label: "Monthly", price: "$9.99", period: "/month", billedNote: "Billed monthly" },
];

function ScreenPaywall({
  onBack,
  onContinue,
  activeTab,
  onNavSelect,
}: {
  onBack?: () => void;
  onContinue?: (plan: ProPlan) => void;
  // Set only when this screen is standing in for a real tab (currently just
  // "analysis" — the only gated screen whose real version has its own
  // BottomNav; see the "analysis" case in the App shell). Keeps this a full-
  // screen modal everywhere else it's used (from Profile, from the post-
  // recording upsell), matching those entry points' own real screens, none
  // of which have a tab bar either.
  activeTab?: string;
  onNavSelect?: (id: string) => void;
}) {
  const [selected, setSelected] = React.useState<ProPlan>("yearly");
  const plan = PRO_PLANS.find((p) => p.id === selected)!;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px" }}>
        <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: mdAccent, textTransform: "uppercase" }}>Upgrade to Pro</div>
        <div style={{ ...serif, fontSize: 26, color: mdHeading, marginTop: 10, lineHeight: 1.4, wordBreak: "keep-all" }}>
          Recording is free.<br />Understanding the pattern isn't yet.
        </div>
        <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 10, lineHeight: 1.6, wordBreak: "keep-all" }}>
          Every thought you speak is already being kept, free. Pro turns that record into the unconscious beliefs, connections, and hypotheses behind it.
        </div>

        {/* Also the interactive tutorial's "today-discovery" spotlight target
            when a free-tier tour reaches the Mind tab — see buildTutorialSteps
            in the App shell, which swaps in Pro-aware copy pointing here
            instead of at the (Pro-only) real discovery card. */}
        <div data-tutorial="today-discovery" style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
          {PRO_FEATURES.map((f) => (
            <div key={f.title} style={{ display: "flex", gap: 12, padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: mdAccentSoft, color: mdAccentText, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>✓</span>
              <div>
                <div style={{ ...sans, fontSize: 13.5, fontWeight: 700, color: mdHeading }}>{f.title}</div>
                <div style={{ ...sans, fontSize: 12.5, color: mdBody, marginTop: 3, lineHeight: 1.5, wordBreak: "keep-all" }}>{f.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
          {PRO_PLANS.map((p) => {
            const active = p.id === selected;
            return (
              <div
                key={p.id} role="button" tabIndex={0} onClick={() => setSelected(p.id)}
                style={{
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                  padding: "16px 18px", borderRadius: 14, backgroundColor: active ? mdAccentSoft : mdCard,
                  boxShadow: mdCardShadow, border: `1.5px solid ${active ? mdAccent : "transparent"}`,
                }}
              >
                {p.badge && (
                  <span style={{ position: "absolute", top: -9, left: 16, ...sans, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", color: "#fff", backgroundColor: mdAccent, padding: "3px 9px", borderRadius: 999 }}>
                    {p.badge}
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${active ? mdAccent : mdDivider}`, backgroundColor: active ? mdAccent : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {active && <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#fff" }} />}
                  </span>
                  <div>
                    <div style={{ ...sans, fontSize: 14, fontWeight: 700, color: mdHeading }}>{p.label}</div>
                    <div style={{ ...sans, fontSize: 11.5, color: mdBody, marginTop: 2 }}>{p.billedNote}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: mdHeading }}>{p.price}</div>
                  <div style={{ ...sans, fontSize: 11, color: mdFaint }}>{p.period}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ padding: "0 22px 20px", flexShrink: 0 }}>
        <PrimaryBtn onClick={() => onContinue?.(selected)} modernist>Continue — {plan.price}{plan.period}</PrimaryBtn>
        <div style={{ ...sans, fontSize: 11, color: mdFaint, textAlign: "center", marginTop: 10 }}>Cancel anytime. No commitment.</div>
      </div>
      {activeTab && <BottomNav active={activeTab} onSelect={onNavSelect} modernist />}
    </div>
  );
}

// ── Screen 15.5 · Checkout ────────────────────────────────────────────────────
// The one place that actually calls onSubscribed (which flips store.isPro —
// see upgradeToPro in the App shell). Card fields are formatted/validated
// like a real checkout (grouped digits, MM/YY, length checks) but nothing
// here is sent anywhere or charged — see the disclosure line above the
// submit button. Swapping in Stripe/RevenueCat later means replacing this
// screen's submit handler with a real charge call and firing onSubscribed
// only from its success callback; nothing else in the app would change.
function formatCardNumber(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ");
}
function formatExpiry(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function ScreenCheckout({ plan, onBack, onSubscribed }: { plan: ProPlan; onBack?: () => void; onSubscribed?: () => void }) {
  const planInfo = PRO_PLANS.find((p) => p.id === plan)!;
  const [cardNumber, setCardNumber] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [cvc, setCvc] = React.useState("");
  const [name, setName] = React.useState("");
  const [processing, setProcessing] = React.useState(false);

  const canSubmit = cardNumber.replace(/\s/g, "").length === 16 && /^\d{2}\/\d{2}$/.test(expiry) && cvc.length >= 3 && name.trim().length > 0;

  const submit = () => {
    if (!canSubmit || processing) return;
    setProcessing(true);
    setTimeout(() => { setProcessing(false); onSubscribed?.(); }, 900);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 0", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <div style={{ ...serif, fontSize: 24, color: mdHeading, marginTop: 14 }}>Payment</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow, marginBottom: 22 }}>
          <div>
            <div style={{ ...sans, fontSize: 13.5, fontWeight: 700, color: mdHeading }}>Mindscape Pro — {planInfo.label}</div>
            <div style={{ ...sans, fontSize: 11.5, color: mdBody, marginTop: 2 }}>{planInfo.billedNote}</div>
          </div>
          <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: mdHeading }}>{planInfo.price}<span style={{ fontSize: 12, fontWeight: 500, color: mdBody }}>{planInfo.period}</span></div>
        </div>

        <TextField label="Card number" value={cardNumber} onChange={(v) => setCardNumber(formatCardNumber(v))} placeholder="4242 4242 4242 4242" />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}><TextField label="Expiry" value={expiry} onChange={(v) => setExpiry(formatExpiry(v))} placeholder="MM/YY" /></div>
          <div style={{ flex: 1 }}><TextField label="CVC" value={cvc} onChange={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))} placeholder="123" /></div>
        </div>
        <TextField label="Name on card" value={name} onChange={setName} placeholder="Jane Doe" />

        <div style={{ ...sans, fontSize: 11, color: mdFaint, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
          This is a demo checkout — no real card is charged.
        </div>
      </div>
      <div style={{ padding: "0 22px 32px", flexShrink: 0 }}>
        <PrimaryBtn onClick={submit} disabled={!canSubmit || processing} modernist>{processing ? "Processing…" : `Subscribe — ${planInfo.price}${planInfo.period}`}</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Screen 15.7 · Manage subscription ─────────────────────────────────────────
// Profile's settings-list entry point once isPro is true — same armed-
// confirmation pattern ScreenDataPrivacy uses for "Delete all my data,"
// since canceling is the same kind of one-way, worth-a-pause action.
// Canceling drops back to free immediately (no real billing period to
// honor) rather than pretending to schedule an end-of-period cancellation.
function ScreenManageSubscription({ store, onBack, onCancel }: { store: Store; onBack?: () => void; onCancel?: () => void }) {
  const [armed, setArmed] = React.useState(false);
  const planInfo = PRO_PLANS.find((p) => p.id === store.proPlan) ?? PRO_PLANS[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <motion.span role="button" tabIndex={0} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: mdBody, cursor: "pointer" }}>← Back</motion.span>
        <div style={{ ...serif, fontSize: 26, color: mdHeading, marginTop: 10 }}>Manage Subscription</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
          <div>
            <div style={{ ...sans, fontSize: 13.5, fontWeight: 700, color: mdHeading }}>Mindscape Pro — {planInfo.label}</div>
            <div style={{ ...sans, fontSize: 11.5, color: mdBody, marginTop: 2 }}>{planInfo.billedNote}</div>
          </div>
          <div style={{ ...mono, fontSize: 15, fontWeight: 700, color: mdHeading }}>{planInfo.price}<span style={{ fontSize: 11, fontWeight: 500, color: mdBody }}>{planInfo.period}</span></div>
        </div>

        <div style={{ marginTop: 28 }}>
          <div
            role="button" tabIndex={0}
            onClick={() => (armed ? onCancel?.() : setArmed(true))}
            style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${armed ? mdWarn : mdDivider}`, backgroundColor: armed ? mdWarnSoft : "transparent", cursor: "pointer" }}
          >
            <span style={{ ...sans, fontSize: 14, fontWeight: 600, color: mdWarn }}>
              {armed ? "Are you sure? Tap again to cancel" : "Cancel subscription"}
            </span>
          </div>
          {armed && (
            <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all" }}>
              You'll immediately lose access to your Brain Map, hypotheses, and analysis. Your recorded entries stay right where they are.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// On a real phone, the fixed 393×852 "device mockup" frame below (rounded
// corners, drop shadow, centered on a desktop backdrop) is exactly wrong —
// it reads as a small floating box with wasted padding around it instead of
// filling the actual screen. This flips the frame to full-bleed (edge to
// edge, no chrome) whenever the viewport itself is phone-width, so the same
// component tree serves both "a nice mockup to review on desktop" and "the
// real app on someone's phone" without a separate mobile build.
function useIsMobileViewport(): boolean {
  const query = "(max-width: 480px)";
  const [isMobile, setIsMobile] = React.useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
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
  const { isDemoMode, setIsDemoMode, hasSeenTutorial, setHasSeenTutorial, store, updateStore, realStore, updateRealStore } = useAppData();

  const goToTab = (id: string) => setScreen(id);

  // Interactive tour state — see TutorialOverlay/buildTutorialSteps above.
  // Recomputed off store.isPro so a mid-tour upgrade (unlikely, but
  // possible if someone subscribes from the tour's own paywall step) shows
  // the Pro-flavored "today-discovery" copy from that point on instead of
  // the free one. frameRef lets the overlay measure real targets relative
  // to the phone frame; the effect below is the single place that decides
  // "we've arrived at a nav step's destination," whether that arrival came
  // from the real nav-bar tap passing through the spotlight or from the
  // tooltip's own button calling the identical setScreen.
  const TUTORIAL_STEPS = React.useMemo(
    () => buildTutorialSteps(!MONETIZATION_ENABLED || store.isPro),
    [store.isPro]
  );
  const [tutorialActive, setTutorialActive] = React.useState(false);
  const [tutorialStep, setTutorialStep] = React.useState(0);
  const frameRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!tutorialActive) return;
    const step = TUTORIAL_STEPS[tutorialStep];
    if (step?.navTo && screen === step.navTo) {
      setTutorialStep((s) => s + 1);
    }
  }, [screen, tutorialActive, tutorialStep]);
  // The single trigger for "should the tour start now" — arriving at Home
  // at all, for any reason (guest/signup onboarding, but also a returning
  // user logging into an existing account, which skips onboarding
  // entirely and used to skip the tour with it). Wiring this only into
  // onboarding's onDone meant anyone who already had an account never saw
  // it. Fires at most once per browser: hasSeenTutorial flips true the
  // moment the tour starts, and this effect's own condition then never
  // matches again.
  React.useEffect(() => {
    if (screen === "home" && !hasSeenTutorial && !tutorialActive) {
      setTutorialStep(0);
      setTutorialActive(true);
    }
  }, [screen, hasSeenTutorial, tutorialActive]);
  const finishTutorial = () => { setTutorialActive(false); setHasSeenTutorial(true); };
  const advanceTutorial = () => {
    const step = TUTORIAL_STEPS[tutorialStep];
    if (step?.navTo) { setScreen(step.navTo); return; }
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) { finishTutorial(); return; }
    setTutorialStep((s) => s + 1);
  };

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
  // Mocked upgrade — no real billing wired up yet, just flips the flag that
  // gates analysis/belief-map/hypotheses/drift (see the "isPro" case guards
  // in the screen switch below), called only from ScreenCheckout's
  // onSubscribed once its (also mocked) card form validates. Real payment
  // processing (App Store/Play Store IAP or a web checkout) would replace
  // that one call site with a purchase-success callback; nothing else in
  // the app would need to change.
  const upgradeToPro = (plan: ProPlan) => {
    updateStore((prev) => ({ ...prev, isPro: true, proPlan: plan }));
  };
  const cancelPro = () => {
    updateStore((prev) => ({ ...prev, isPro: false, proPlan: undefined }));
  };
  // Where checkout (and the paywall itself, when reached as its own "paywall"
  // route rather than inline-gated) returns to on cancel/back or a
  // successful subscribe. Set right before navigating into that flow —
  // see each onContinue/onOpenPaywall/onUpgrade call site below.
  const [paywallReturnTo, setPaywallReturnTo] = React.useState("home");
  const [checkoutPlan, setCheckoutPlan] = React.useState<ProPlan>("yearly");
  // Distinct from rejectBelief above: reacting to a belief as "Today's
  // Discovery" never hides it from "Unconscious Patterns" — only the dedicated reject
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
    if (!res.ok || !data) throw new Error(data?.error || "Couldn't get another interpretation.");
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
          // Starting the tour itself is handled by the "arrived at Home"
          // effect above, not here — this used to be the only trigger,
          // which meant a returning user logging into an existing account
          // (skipping onboarding entirely) never saw it.
          setScreen("home");
        }}
      />
    ); break;
    case "home": content = (
      <ScreenHome
        onNavSelect={goToTab}
        onStartThink={() => setScreen("think")}
        onOpenBrainMap={() => setScreen("brainmap")}
        store={store}
      />
    ); break;
    case "brainmap": content = (!MONETIZATION_ENABLED || store.isPro) ? (
      <BrainNodeMapScreen beliefs={store.beliefs} connections={store.connections} onBack={() => setScreen("home")} modernist />
    ) : (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("brainmap"); setScreen("checkout"); }} />
    ); break;
    case "analysis": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall
        onBack={() => setScreen("home")}
        onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("analysis"); setScreen("checkout"); }}
        activeTab="analysis"
        onNavSelect={goToTab}
      />
    ) : (
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
    case "think": content = (
      <ScreenThink
        onBack={() => setScreen("home")}
        onDone={(text) => {
          setThinkText(text);
          setAnalysisError("");
          // Checked before anything else, regardless of tier — a crisis-
          // flagged entry never reaches /api/analyze or the belief/
          // hypothesis pipeline. The entry is still saved (see
          // appendUnanalyzedEntry below) — this is about where it routes
          // to next, not about withholding what was written. See
          // crisisDetection.ts for why this is the one exception to
          // "observe, don't judge."
          if (detectCrisisSignal(text)) {
            updateStore((prev) => appendUnanalyzedEntry(prev, text));
            setScreen("crisisSupport");
          } else if (!MONETIZATION_ENABLED || store.isPro) {
            setScreen("processing");
          } else {
            // Free tier: no /api/analyze call — just record the entry (see
            // appendUnanalyzedEntry) and acknowledge it, same "Got it" beat
            // Pro sees when the model itself finds nothing new to report.
            // The one-time soft-paywall ask (ScreenSoftPaywall) preempts
            // that beat exactly once, right as the 3rd free entry lands —
            // decided off the pre-update entryCount since this is a
            // synchronous read within the same event, not a stale closure.
            const isUpsellMoment = store.entryCount + 1 === UPSELL_PROMPT_AT_ENTRY_COUNT && !store.hasSeenUpgradePrompt;
            updateStore((prev) => {
              const appended = appendUnanalyzedEntry(prev, text);
              return isUpsellMoment ? { ...appended, hasSeenUpgradePrompt: true } : appended;
            });
            setScreen(isUpsellMoment ? "softPaywall" : "thinkComplete");
          }
        }}
      />
    ); break;
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
        name={store.account?.name}
        onDone={(result, sessionSummary) => {
          if (result) {
            const merged = mergeAnalysisIntoStore(store, result, thinkText, sessionSummary);
            updateStore(() => merged);
            // A real analysis landed — pass through a brief session-summary
            // beat (Feature 2's language observation + Feature 3's AI
            // recap, when either is available) before the Analysis tab;
            // computeDiscovery will pick up whatever this entry just
            // created/reinforced as "Today's Discovery" once there.
            setScreen("sessionSummary");
          } else {
            setScreen("thinkComplete");
          }
        }}
        onError={(msg) => { setAnalysisError(msg); setScreen("thinkComplete"); }}
      />
    ); break;
    case "sessionSummary": content = <ScreenSessionSummary store={store} onDone={() => setScreen("analysis")} />; break;
    case "thinkComplete": content = (
      <ScreenThinkComplete
        error={analysisError}
        showUpsell={MONETIZATION_ENABLED && !store.isPro && !analysisError}
        onDone={() => setScreen("home")}
        onUpgrade={() => { setPaywallReturnTo("home"); setScreen("paywall"); }}
      />
    ); break;
    case "softPaywall": content = (
      <ScreenSoftPaywall
        onSeePlans={() => { setPaywallReturnTo("home"); setScreen("paywall"); }}
        onDismiss={() => setScreen("home")}
      />
    ); break;
    case "crisisSupport": content = <ScreenCrisisSupport onContinue={() => setScreen("home")} />; break;
    case "beliefs": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("beliefs"); setScreen("checkout"); }} />
    ) : (
      <ScreenBeliefMap onBack={() => setScreen("analysis")} store={store} onRejectBelief={rejectBelief} />
    ); break;
    case "assumptions": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("assumptions"); setScreen("checkout"); }} />
    ) : (
      <ScreenBeliefMap onBack={() => setScreen("home")} store={store} />
    ); break;
    case "drift": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("drift"); setScreen("checkout"); }} />
    ) : (
      <ScreenDrift onBack={() => setScreen("analysis")} store={store} onSetupAspiration={() => setScreen("aspirationSetup")} />
    ); break;
    case "aspirationSetup": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("aspirationSetup"); setScreen("checkout"); }} />
    ) : (
      <ScreenAspirationSetup
        initialValue={store.aspiration}
        onBack={() => setScreen("drift")}
        onSave={(value) => {
          updateStore((prev) => ({ ...prev, aspiration: value, aspirationSetDate: formatDateDots(new Date()) }));
          setScreen("drift");
        }}
      />
    ); break;
    case "hypotheses": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("hypotheses"); setScreen("checkout"); }} />
    ) : (
      <ScreenHypotheses onBack={() => setScreen("home")} store={store} onOpen={(i) => { setHypothesisIndex(i); setScreen("hypothesisDetail"); }} />
    ); break;
    case "hypothesisDetail": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("hypothesisDetail"); setScreen("checkout"); }} />
    ) : (
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
      if (MONETIZATION_ENABLED && !store.isPro) {
        content = <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("investigate"); setScreen("checkout"); }} />;
        break;
      }
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
        onOpenPaywall={() => { setPaywallReturnTo("profile"); setScreen("paywall"); }}
        onOpenManageSubscription={() => setScreen("manageSubscription")}
      />
    ); break;
    case "paywall": content = (
      <ScreenPaywall
        onBack={() => setScreen(paywallReturnTo)}
        onContinue={(plan) => { setCheckoutPlan(plan); setScreen("checkout"); }}
      />
    ); break;
    case "checkout": content = (
      <ScreenCheckout
        plan={checkoutPlan}
        onBack={() => setScreen(paywallReturnTo)}
        onSubscribed={() => { upgradeToPro(checkoutPlan); setScreen(paywallReturnTo); }}
      />
    ); break;
    case "manageSubscription": content = (
      <ScreenManageSubscription
        store={store}
        onBack={() => setScreen("profile")}
        onCancel={() => { cancelPro(); setScreen("profile"); }}
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
        onOpenPrivacyPolicy={() => setScreen("privacyPolicy")}
        onOpenTermsOfService={() => setScreen("termsOfService")}
      />
    ); break;
    case "privacyPolicy": content = (
      <ScreenLegalDocument
        title="Privacy Policy"
        lastUpdated="August 15, 2026"
        sections={PRIVACY_POLICY_SECTIONS}
        onBack={() => setScreen("dataPrivacy")}
      />
    ); break;
    case "termsOfService": content = (
      <ScreenLegalDocument
        title="Terms of Service"
        lastUpdated="August 15, 2026"
        sections={TERMS_OF_SERVICE_SECTIONS}
        onBack={() => setScreen("dataPrivacy")}
      />
    ); break;
    case "help": content = <ScreenHelp onBack={() => setScreen("profile")} onReplayTutorial={() => { setTutorialStep(0); setTutorialActive(true); setScreen("home"); }} />; break;
    default: content = <ScreenHome onNavSelect={goToTab} onStartThink={() => setScreen("think")} onOpenBrainMap={() => setScreen("brainmap")} store={store} />;
  }

  const isMobileViewport = useIsMobileViewport();
  // The fake "9:41 + battery" status bar is mockup chrome for the desktop
  // preview — a real phone already has its own real status bar, so showing
  // ours too would just be a second, wrong clock sitting under the actual
  // one. Safe-area padding (below) takes over its job of clearing the
  // notch on mobile instead.
  const showStatusBar = !["splash"].includes(screen) && !isMobileViewport;
  // Screens ported from the Modernist (light/red) design import — every
  // other screen keeps the dark theme, see the dk*/md* token comments.
  const isModernistScreen = [
    "home", "brainmap", "analysis", "history", "profile",
    "beliefs", "drift", "aspirationSetup", "hypotheses", "hypothesisDetail", "investigate",
    "splash", "auth", "login", "signup", "onboarding",
    "notifications", "dataPrivacy", "help",
  ].includes(screen);

  // Think is the app's one self-disclosure moment — the disinhibition-theory
  // note this roadmap draws from asks for the whole frame to read as a
  // slightly more private space while it's open: a faint dimming (not just
  // ScreenThink's own already-dark background) plus a distinct threshold
  // motion on the way in and out, instead of the plain fade every other
  // screen uses.
  const isThink = screen === "think";

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "#EDEAE4", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobileViewport ? 0 : 20 }}>
      <div
        ref={frameRef}
        style={{
          width: isMobileViewport ? "100%" : 393,
          height: isMobileViewport ? "100dvh" : 852,
          borderRadius: isMobileViewport ? 0 : 40,
          overflow: "hidden",
          boxShadow: isMobileViewport ? "none" : "0 20px 60px rgba(0,0,0,0.25)",
          backgroundColor: isModernistScreen ? mdBg : dkBg,
          display: "flex", flexDirection: "column", position: "relative",
          // Clears the real notch/Dynamic Island whenever the fake status
          // bar isn't the one doing that job (mobile, or the status-bar-
          // less splash screen) — a no-op (0px) anywhere without a real
          // safe area, so it's always safe to include.
          paddingTop: showStatusBar ? 0 : "env(safe-area-inset-top)",
        }}
      >
        {showStatusBar && <StatusBar modernist={isModernistScreen} />}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={isThink ? { opacity: 0, scale: 0.97 } : { opacity: 0 }}
              animate={isThink ? { opacity: 1, scale: 1 } : { opacity: 1 }}
              exit={isThink ? { opacity: 0, scale: 0.97 } : { opacity: 0 }}
              transition={isThink ? { duration: 0.5, ease: "easeInOut" } : { duration: 0.25, ease: "easeOut" }}
              style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Session dimming — a faint scrim over the whole frame (status bar
        included), not just ScreenThink's own dark background, so opening
        the session reads as the room's lights dropping a notch. ~12% black,
        within the note's 10-15% range. */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: isThink ? 1 : 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.12)", pointerEvents: "none", zIndex: 40 }}
        />

        {tutorialActive && TUTORIAL_STEPS[tutorialStep] && (
          <TutorialOverlay
            step={TUTORIAL_STEPS[tutorialStep]}
            stepIndex={tutorialStep}
            totalSteps={TUTORIAL_STEPS.length}
            frameRef={frameRef}
            screen={screen}
            onNext={advanceTutorial}
            onSkip={finishTutorial}
          />
        )}
      </div>
    </div>
  );
}
