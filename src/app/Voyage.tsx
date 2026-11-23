// ── The voyage ───────────────────────────────────────────────────────────────
// Mindscape's main feature, drawn: a sea chart inked on diary paper, with
// your boat somewhere on the course between where you started and a gold
// star, the person you said you want to be. Where the boat sits is your
// closeness (aspirationPath.ts). Two pieces live here:
//   · VoyageCard: the chart with the number and the week's change (Home,
//     and the night version after you write).
//   · PathChart: closeness day by day for the last week, with each day's
//     checked-in feelings as coloured dots under it (Analysis).
import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import type { CognitiveRegion } from "./neuralBrainLayout";
import { display, hand, sans } from "./typefaces";
import type { PathDay } from "./aspirationPath";

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

export function VoyageCard({ closeness, change, aspiration, from, theme = "paper", onOpen, onSetAspiration }: {
  closeness: number | null;
  change: number | null;
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
  const ch = changeText(change);
  const hasGoal = !!aspiration;
  const action = hasGoal ? onOpen : onSetAspiration;

  return (
    <motion.div
      role={action ? "button" : undefined} tabIndex={action ? 0 : undefined}
      aria-label={hasGoal ? `Your voyage to who you want to be: ${closeness ?? "no"} out of 100.` : "Write who you want to be"}
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
            {ch && <div style={{ ...hand, fontSize: 16, fontWeight: 600, color: night ? (change! > 0 ? "#9BE3B8" : change! < 0 ? "#F7A9C4" : soft) : ch.tone, marginTop: 2 }}>{ch.text}</div>}
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

// ── PathChart ──
// The week as a line: how close you were at the end of each day, with a
// faint band at 50 (as many steps away as toward). Days you wrote get a
// solid point; under each day, a dot per feeling you checked in.
const MOOD_COLOR: Record<string, CognitiveRegion> = { Calm: "security", Happy: "career", Anxious: "curiosity", Sad: "identity", Frustrated: "creativity" };

export function PathChart({ days }: { days: PathDay[] }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 320, H = 132, top = 14, bottom = 92, left = 14, right = W - 14;
  const xs = days.map((_, i) => left + ((right - left) * i) / Math.max(1, days.length - 1));
  const y = (v: number) => bottom - ((bottom - top) * v) / 100;
  const pts = days.map((d, i) => (d.score === null ? null : { x: xs[i], y: y(d.score), d, i }));
  const line = pts.filter((p): p is NonNullable<typeof p> => !!p);
  const path = line.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = line.length > 1 ? `${path} L${line[line.length - 1].x} ${bottom} L${line[0].x} ${bottom} Z` : "";
  const label = (d: PathDay) => new Date(+d.date.slice(0, 4), +d.date.slice(5, 7) - 1, +d.date.slice(8, 10)).toLocaleDateString("en-US", { weekday: "short" });
  const h = hover !== null ? days[hover] : null;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        aria-label={`Closeness to who you want to be, last ${days.length} days: ${days.map((d) => `${label(d)} ${d.score ?? "none"}`).join(", ")}.`}
        onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={GOLD} stopOpacity="0.35" /><stop offset="1" stopColor={GOLD} stopOpacity="0" /></linearGradient>
        </defs>
        {/* 100 / 50 / 0 guides */}
        {[100, 50, 0].map((v) => (
          <g key={v}>
            <line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke={INK} strokeOpacity={v === 50 ? 0.16 : 0.07} strokeDasharray={v === 50 ? "3 4" : undefined} />
          </g>
        ))}
        <text x={right} y={y(100) - 4} textAnchor="end" fontSize="9" fill={INK_SOFT} style={{ fontFamily: sans.fontFamily }}>who you want to be</text>
        {area && <motion.path d={area} fill="url(#pc-fill)" initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }} />}
        {line.length > 1 && (
          <motion.path d={path} fill="none" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 1, ease: [0.22, 1, 0.36, 1] }} />
        )}
        {line.map((p) => (
          <circle key={p.i} cx={p.x} cy={p.y} r={p.d.wrote ? 4.5 : 2.5} fill={p.d.wrote ? GOLD : "#FFFCF6"} stroke={p.d.wrote ? "#FFFCF6" : GOLD} strokeWidth="2" />
        ))}
        {/* Day labels and the feelings checked in that day. */}
        {days.map((d, i) => (
          <g key={d.date}>
            {/* Two weeks of labels don't fit, so every other day (always the last). */}
            {(days.length <= 7 || (days.length - 1 - i) % 2 === 0) && (
              <text x={xs[i]} y={bottom + 16} textAnchor="middle" fontSize="10" fill={hover === i ? INK : INK_SOFT} style={{ fontFamily: sans.fontFamily }}>{label(d)}</text>
            )}
            {d.moods.slice(0, 3).map((m, k) => (
              <circle key={k} cx={xs[i] + (k - (Math.min(3, d.moods.length) - 1) / 2) * 8} cy={bottom + 28} r="3.2"
                fill={REGION_CONFIG[MOOD_COLOR[m] ?? "identity"].color} />
            ))}
            {/* Hit area for the day */}
            <rect x={xs[i] - 20} y={top - 10} width={40} height={H - top} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
          </g>
        ))}
        {hover !== null && <line x1={xs[hover]} x2={xs[hover]} y1={top} y2={bottom} stroke={INK} strokeOpacity="0.25" />}
      </svg>
      {h && (
        <div style={{ position: "absolute", top: -6, left: `${(xs[hover!] / W) * 100}%`, transform: `translateX(${hover! > days.length / 2 ? "-100%" : "0"})`, pointerEvents: "none",
          ...sans, fontSize: 12, color: INK, backgroundColor: "#FFFCF6", boxShadow: "0 6px 16px -8px rgba(42,38,33,0.5), 0 0 0 1px rgba(42,38,33,0.08)", borderRadius: 8, padding: "5px 8px", whiteSpace: "nowrap" }}>
          <b>{label(h)}</b> · {h.score === null ? "no steps yet" : `${h.score}/100`}{h.wrote ? " · wrote" : ""}{h.moods.length ? ` · felt ${h.moods.join(", ").toLowerCase()}` : ""}
        </div>
      )}
    </div>
  );
}

// Small legend line under the chart, so the dots aren't a guess.
export function PathLegend() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px", ...sans, fontSize: 11, color: INK_SOFT }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <svg width="20" height="10" aria-hidden><line x1="1" y1="5" x2="19" y2="5" stroke={GOLD} strokeWidth="2" /><circle cx="10" cy="5" r="3.5" fill={GOLD} stroke="#FFFCF6" strokeWidth="1.5" /></svg>
        how close, each day
      </span>
      <span style={{ color: INK_SOFT }}>Feelings:</span>
      {Object.entries(MOOD_COLOR).map(([m, r]) => (
        <span key={m} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: REGION_CONFIG[r].color }} />{m.toLowerCase()}</span>
      ))}
    </div>
  );
}
