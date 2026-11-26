// ── The voyage ───────────────────────────────────────────────────────────────
// Mindscape's main feature, drawn: a sea chart inked on diary paper, with
// your boat somewhere on the course between where you started and a gold
// star, the person you said you want to be. Where the boat sits is your
// closeness (aspirationPath.ts). VoyageCard is used on Home, Mind and the
// journey screen, and in a night version after you write. It replaced a
// day-by-day line graph, which didn't read as distance.
import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { display, hand, sans } from "./typefaces";
import { MIN_STEPS } from "./aspirationPath";

const INK = "#2A2621";
const INK_SOFT = "rgba(42,38,33,0.62)";
const GOLD = "#E2A847";
const SEA = REGION_CONFIG.curiosity.color;
const TOWARD = REGION_CONFIG.security;
const AWAY = REGION_CONFIG.relationships;

// The course: a gentle curve from the start (left) to the star (right).
const P0 = { x: 26, y: 74 }, P1 = { x: 160, y: 100 }, P2 = { x: 292, y: 34 };
function at(t: number) {
  const u = 1 - t;
  return { x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x, y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y };
}
// The part of the course already sailed, as its own curve (de Casteljau).
function sailed(t: number) {
  const c = { x: (1 - t) * P0.x + t * P1.x, y: (1 - t) * P0.y + t * P1.y };
  const e = at(t);
  return `M${P0.x} ${P0.y} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
}

function changeText(change: number | null) {
  if (change === null) return null;
  if (change === 0) return { text: "Same as last week", tone: INK_SOFT };
  return change > 0
    ? { text: `${change} closer than last week`, tone: TOWARD.ink }
    : { text: `${-change} further than last week`, tone: AWAY.ink };
}

export function VoyageCard({ closeness, change, aspiration, from, theme = "paper", onOpen, onSetAspiration, steps, adrift = false }: {
  closeness: number | null;
  change: number | null;
  // Steps so far, while there are too few for a number (aspirationPath's
  // MIN_STEPS): the card shows fog and "1 of 3" instead of a score.
  steps?: number;
  // Several steps away in a row: say so gently instead of a falling number.
  adrift?: boolean;
  aspiration: string | null;
  // Where the boat was before the latest entry; it sails from there.
  from?: number | null;
  theme?: "paper" | "night";
  onOpen?: () => void;
  onSetAspiration?: () => void;
}) {
  const reduce = useReducedMotion();
  const night = theme === "night";
  const ink = night ? "#F3EFFA" : INK;
  const soft = night ? "rgba(243,239,250,0.7)" : INK_SOFT;
  const t = closeness === null ? 0.04 : Math.max(0.04, Math.min(0.96, closeness / 100));
  const t0 = from === null || from === undefined ? t : Math.max(0.04, Math.min(0.96, from / 100));
  const samples = Array.from({ length: 9 }, (_, i) => at(t0 + ((t - t0) * i) / 8));
  const hasGoal = !!aspiration;
  const fog = hasGoal && closeness === null && steps !== undefined;
  const ch = adrift && closeness !== null
    ? { text: "Currents pulled you off course", tone: INK_SOFT }
    : changeText(change);
  const action = hasGoal ? onOpen : onSetAspiration;

  return (
    <motion.div
      role={action ? "button" : undefined} tabIndex={action ? 0 : undefined}
      aria-label={!hasGoal ? "Write who you want to be"
        : fog ? `Your voyage to who you want to be: getting to know you, ${steps} of ${MIN_STEPS} entries so far.`
        : `Your voyage to who you want to be: ${closeness ?? "no"} out of 100.${adrift ? " Currents pulled you off course lately." : ""}`}
      onClick={action}
      onKeyDown={(e) => { if (action && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); action(); } }}
      whileTap={action ? { scale: 0.985 } : undefined}
      style={{
        position: "relative", borderRadius: 18, padding: "12px 14px 6px", cursor: action ? "pointer" : "default", WebkitTapHighlightColor: "transparent",
        ...(night
          ? { backgroundColor: "rgba(255,255,255,0.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }
          : {
            backgroundColor: "#FFFCF6",
            backgroundImage: `radial-gradient(100% 80% at 100% 0%, ${GOLD}26, transparent 60%), radial-gradient(90% 80% at 0% 100%, ${SEA}1f, transparent 60%)`,
            boxShadow: `0 0 0 1px ${SEA}2e, 0 14px 28px -20px ${REGION_CONFIG.identity.ink}`,
          }),
      }}
    >
      {!night && (
        <span aria-hidden style={{ position: "absolute", top: -7, left: 28, width: 56, height: 15, transform: "rotate(-4deg)", opacity: 0.85,
          backgroundImage: `repeating-linear-gradient(45deg, ${GOLD}aa 0 6px, #F8EFD9 6px 12px)` }} />
      )}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...hand, fontSize: 20, fontWeight: 600, color: night ? GOLD : REGION_CONFIG.career.ink, lineHeight: 1 }}>To who you want to be</div>
          {hasGoal ? (
            <div style={{ ...sans, fontSize: 12, color: soft, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>“{aspiration}”</div>
          ) : (
            <div style={{ ...sans, fontSize: 12, color: soft, marginTop: 4 }}>Write it once, and every entry shows if you're getting closer.</div>
          )}
        </div>
        {hasGoal && closeness !== null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ ...display, fontSize: 32, lineHeight: 0.9, color: ink }}>{closeness}<span style={{ fontSize: 15, color: soft }}>/100</span></div>
            {ch && <div style={{ ...hand, fontSize: 16, fontWeight: 600, color: night ? (adrift ? soft : change! > 0 ? "#9BE3B8" : change! < 0 ? "#F7A9C4" : soft) : ch.tone, marginTop: 2 }}>{ch.text}</div>}
          </div>
        )}
        {fog && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ ...display, fontSize: 22, lineHeight: 1, color: ink }}>{steps}<span style={{ fontSize: 14, color: soft }}> of {MIN_STEPS}</span></div>
            <div style={{ ...hand, fontSize: 16, fontWeight: 600, color: soft, marginTop: 2 }}>Getting to know you</div>
          </div>
        )}
      </div>

      <svg viewBox="0 0 320 104" role="img" aria-hidden style={{ width: "100%", height: "auto", display: "block", overflow: "visible", marginTop: 2 }}>
        {/* The sea, in a few strokes of ink. */}
        {[58, 78, 94].map((y, i) => (
          <path key={y} d={`M${8 + i * 14} ${y} q 10 -4 20 0 t 20 0 t 20 0 M${150 + i * 22} ${y + 4} q 10 -4 20 0 t 20 0`} fill="none"
            stroke={night ? "rgba(200,190,255,0.35)" : `${SEA}66`} strokeWidth="1.3" strokeLinecap="round" />
        ))}
        {/* The whole course, dotted, and the part already sailed, solid gold. */}
        <path d={`M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`} fill="none" stroke={night ? "rgba(243,239,250,0.35)" : `${INK}44`} strokeWidth="1.6" strokeDasharray="2 6" strokeLinecap="round" />
        {hasGoal && closeness !== null && (
          <motion.path d={sailed(t)} fill="none" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : t0 / t }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} />
        )}
        {/* Fog over the course until there are enough entries for a number. */}
        {fog && (
          <g aria-hidden>
            <defs><filter id="voyage-fog" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="7" /></filter></defs>
            {[[120, 70, 70, 20], [200, 56, 80, 22], [262, 44, 54, 18]].map(([cx, cy, rx, ry], i) => (
              <motion.ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={night ? "#3A3560" : "#FFFCF6"} filter="url(#voyage-fog)"
                initial={{ opacity: 0.9 }} animate={reduce ? undefined : { opacity: [0.9, 0.7, 0.9], x: [0, 6, 0] }}
                transition={{ duration: 7 + i * 2, repeat: Infinity, ease: "easeInOut" }} />
            ))}
          </g>
        )}
        {/* Where you started. */}
        <circle cx={P0.x} cy={P0.y} r="3.2" fill={night ? "#F3EFFA" : INK} opacity="0.6" />
        {/* The star: who you want to be. */}
        <g transform={`translate(${P2.x} ${P2.y})`}>
          <circle r="16" fill={GOLD} opacity="0.18" />
          {/* Pulse with scale, not the r attribute: keyframing r made Motion write
          r="undefined" on some frames (a console error on every Home visit). */}
          <motion.circle r="9" fill={GOLD} opacity="0.35" style={{ transformBox: "fill-box", transformOrigin: "center" }}
            animate={reduce ? undefined : { scale: [1, 13 / 9, 1], opacity: [0.35, 0.1, 0.35] }} transition={{ duration: 2.6, repeat: Infinity }} />
          <path d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z" fill={GOLD} />
        </g>
        {/* Your boat. */}
        <motion.g
          initial={{ x: samples[0].x, y: samples[0].y }}
          animate={{ x: samples.map((p) => p.x), y: samples.map((p) => p.y) }}
          transition={{ duration: reduce ? 0 : 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          <g className={reduce ? undefined : "boat-bob"}>
            <path d="M-11 -2 L11 -2 L7 4 L-7 4 Z" fill={night ? "#F3EFFA" : INK} />
            <path d="M-1 -3 L-1 -20 L9 -5 Z" fill={night ? "#F3EFFA" : "#FFFCF6"} stroke={night ? "none" : INK} strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M-2.5 -4 L-2.5 -15 L-9 -5 Z" fill={GOLD} />
          </g>
        </motion.g>
      </svg>
      {!hasGoal && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <span style={{ ...hand, fontSize: 18, fontWeight: 700, color: "#3A2508", padding: "5px 14px", borderRadius: 999,
            backgroundImage: `linear-gradient(135deg, #FBE0A6, ${GOLD})`, boxShadow: `0 6px 14px -8px ${GOLD}` }}>
            Write who you want to be
          </span>
        </div>
      )}
    </motion.div>
  );
}
