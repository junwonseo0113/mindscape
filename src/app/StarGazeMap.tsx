// ── The night sky (formerly the Brain Map) ───────────────────────────────────
// A stargazing scene in place of the old 3D brain-shaped point cloud. Each
// belief is one of the app's own glowing orbs, set in the night sky; the
// six areas of life are six constellations, their stars joined by faint
// figure lines and named the way constellations are; the real connections
// between beliefs (store.connections) are the bright lines across the sky —
// root links solid, tensions dashed in warm light. Below the sky is a sea:
// you're out on it in a small boat with a lantern, the stars sliding slowly
// past overhead and their colours reflected on the water, as if sailing
// through a sea of stars.
//
// Everything the old map did is still here: region filter with
// counts, "Show all", tap a star for its detail (statement, confidence, the
// beliefs it's joined to and why, what you actually said), and opening
// straight onto a region or one belief from Home and Mind.
//
// It's an HTML/SVG scene, not WebGL: twinkling, the Milky Way, the shooting
// star, the drifting star layers, nebulae, waves, glints and the boat are
// CSS (styles/index.css: .twinkle, .milky-way, .shooting-star, .sky-sail,
// .nebula, .wave-roll, .sea-glint, .boat-bob, .lens-current), and all of it
// stops under reduced motion. Stars are real
// buttons, so they're reachable by keyboard and screen reader.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, X } from "@phosphor-icons/react";
import { REGION_CONFIG, resolveRegion, recencyFromDate, type NeuralBeliefNode, type NeuralBeliefConnection } from "./brainRegions";
import { COGNITIVE_REGIONS, type CognitiveRegion } from "./neuralBrainLayout";
import type { StoredEvidenceQuote } from "./types";
import { Node } from "./orb";
import { display, hand, mono, sans, serif } from "./typefaces";

const INK = "#F3EFFA";
// The round, frosted buttons of the sky's app bar.
const skyIconBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: "50%", border: 0, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  color: "#F3EFFA", backgroundColor: "rgba(255,255,255,0.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14)",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", WebkitTapHighlightColor: "transparent",
};
const INK_SOFT = "rgba(243,239,250,0.78)";
const INK_FAINT = "rgba(243,239,250,0.55)";

type SkyBelief = NeuralBeliefNode & { evidenceQuotes?: StoredEvidenceQuote[]; thoughtLabel?: string };

// Where each constellation sits, as a fraction of the sky band.
// The bottom ~110px is the sea, so the band ends above it.
const CONSTELLATION_HOME: Record<CognitiveRegion, [number, number]> = {
  identity: [0.26, 0.12],
  career: [0.72, 0.2],
  curiosity: [0.2, 0.45],
  relationships: [0.74, 0.52],
  security: [0.32, 0.76],
  creativity: [0.7, 0.8],
};
const HILLS = 110;

// Small deterministic RNG so the sky is the same every visit.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// The field of faint background stars — fixed positions, each with its own
// twinkle period and phase.
const FIELD_STARS = (() => {
  const r = seeded(1729);
  return Array.from({ length: 130 }, () => ({
    x: r() * 100, y: r() * 84, size: 0.8 + r() * 1.9, dur: 2.4 + r() * 4, delay: -r() * 6, warm: r() < 0.18, tint: r(),
  }));
})();
// Far stars drift slower than near ones; that difference is what makes the
// sky read as depth you're moving through.
const STAR_LAYERS = [
  { stars: FIELD_STARS.filter((f) => f.size < 1.7), dur: "240s" },
  { stars: FIELD_STARS.filter((f) => f.size >= 1.7), dur: "130s" },
];
const STAR_TINTS = ["#FFFFFF", "#FFFFFF", "#DCD6FF", "#FFE3B8", "#CFE6FF"];
// Starlight on the water: short horizontal glints that flicker.
const SEA_GLINTS = (() => {
  const r = seeded(4242);
  return Array.from({ length: 26 }, () => ({ x: r() * 100, y: 18 + r() * 70, w: 6 + r() * 16, dur: 2 + r() * 3, delay: -r() * 4 }));
})();
// Soft clouds of colour behind the stars.
const NEBULAE: { region: CognitiveRegion; left: string; top: string; size: number; dx: string; dy: string; dur: string }[] = [
  { region: "identity", left: "-18%", top: "4%", size: 340, dx: "18px", dy: "10px", dur: "26s" },
  { region: "relationships", left: "52%", top: "34%", size: 300, dx: "-16px", dy: "12px", dur: "31s" },
  { region: "curiosity", left: "-8%", top: "52%", size: 280, dx: "14px", dy: "-12px", dur: "23s" },
];
// One wave crest, repeated across a 720-wide strip (two matching halves).
const WAVE = (amp: number, y: number) => {
  let d = `M0 ${y}`;
  for (let x = 0; x < 720; x += 60) d += ` q 15 ${-amp} 30 0 t 30 0`;
  return `${d} L720 40 L0 40 Z`;
};

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

type PlacedStar = { b: SkyBelief; region: CognitiveRegion; x: number; y: number; size: number; vitality: number };

// Lay every belief out in its constellation: a golden-angle spiral around
// the constellation's home, then a few relaxation passes so no two stars
// crowd each other, kept inside the sky.
function placeStars(beliefs: SkyBelief[], w: number, h: number): PlacedStar[] {
  if (!w || !h) return [];
  const byRegion = new Map<CognitiveRegion, SkyBelief[]>();
  beliefs.forEach((b) => {
    const r = resolveRegion(b);
    byRegion.set(r, [...(byRegion.get(r) ?? []), b]);
  });
  const unit = Math.min(w, h);
  const stars: PlacedStar[] = [];
  byRegion.forEach((list, region) => {
    const [hx, hy] = CONSTELLATION_HOME[region];
    const spin = (hash(region) % 360) * (Math.PI / 180);
    list.forEach((b, i) => {
      const n = list.length;
      const radius = n === 1 ? 0 : unit * (0.07 + 0.08 * Math.sqrt(i / Math.max(1, n - 1)));
      const angle = spin + i * 2.39996;
      stars.push({
        b, region,
        x: hx * w + Math.cos(angle) * radius,
        y: 40 + hy * (h - HILLS - 60) + Math.sin(angle) * radius * 0.85,
        size: 14 + (b.confidence / 100) * 14,
        vitality: b.recency ?? recencyFromDate(b.lastUpdatedAt) ?? 0.75,
      });
    });
  });
  // Labeled stars (≤ 10 of them) need room for their names too.
  const minGap = stars.length <= 10 ? 64 : 46;
  for (let pass = 0; pass < 30; pass++) {
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i], c = stars[j];
        const dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= minGap) continue;
        const push = (minGap - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        c.x += (dx / d) * push; c.y += (dy / d) * push;
      }
    }
    stars.forEach((s) => { s.x = Math.max(28, Math.min(w - 28, s.x)); s.y = Math.max(40, Math.min(h - HILLS, s.y)); });
  }
  // Fit: when only a few constellations are lit, they'd crowd one part of
  // the sky. Stretch the set vertically (at most 2.2×, order preserved)
  // so it fills the sky above the hills.
  if (stars.length > 1) {
    const ys = stars.map((s) => s.y);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    const top = 44, bottom = h - HILLS - 24;
    if (hi - lo > 1) {
      const k = Math.min(2.2, (bottom - top) / (hi - lo));
      if (k > 1) stars.forEach((s) => { s.y = top + (s.y - lo) * k; });
    }
  }
  return stars;
}

export default function StarGazeMap({
  beliefs,
  connections,
  onBack,
  initialActiveRegion = null,
  initialSelectedBeliefId = null,
}: {
  beliefs: SkyBelief[];
  connections: NeuralBeliefConnection[];
  onBack?: () => void;
  initialActiveRegion?: CognitiveRegion | null;
  initialSelectedBeliefId?: string | null;
  // Accepted for call-site compatibility with the old Brain Map; the sky
  // is always the full-screen night scene.
  modernist?: boolean;
  embedded?: boolean;
}) {
  const reduce = useReducedMotion();
  const [skyRef, { w, h }] = useSize<HTMLDivElement>();
  // Whether a star has been tapped yet, so the "Tap a star" hint can go.
  const [tappedOnce, setTappedOnce] = useState(false);
  const [activeRegion, setActiveRegion] = useState<CognitiveRegion | null>(initialActiveRegion);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedBeliefId);
  const stars = useMemo(() => placeStars(beliefs, w, h), [beliefs, w, h]);
  const byId = useMemo(() => new Map(stars.map((s) => [s.b.id, s])), [stars]);
  const regionCounts = useMemo(() => {
    const m = Object.fromEntries(COGNITIVE_REGIONS.map((r) => [r, 0])) as Record<CognitiveRegion, number>;
    beliefs.forEach((b) => { m[resolveRegion(b)] += 1; });
    return m;
  }, [beliefs]);
  const visibleConnections = connections.filter((c) => byId.has(c.a) && byId.has(c.b));
  const matches = (s: PlacedStar) => !activeRegion || s.region === activeRegion;
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const linkedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(connections.filter((c) => c.a === selectedId || c.b === selectedId).map((c) => (c.a === selectedId ? c.b : c.a)));
  }, [connections, selectedId]);
  const starOpacity = (s: PlacedStar) => {
    if (selected) return s.b.id === selected.b.id || linkedIds.has(s.b.id) ? 1 : 0.28;
    return matches(s) ? 1 : 0.25;
  };
  const reset = () => { setActiveRegion(null); setSelectedId(null); };

  // Constellation figures: each region's stars joined in order around
  // their center — the shape, not a claim about connection.
  const figures = useMemo(() => {
    const out: { region: CognitiveRegion; points: [number, number][]; cx: number; cy: number; top: number }[] = [];
    COGNITIVE_REGIONS.forEach((region) => {
      const list = stars.filter((s) => s.region === region);
      if (list.length === 0) return;
      const cx = list.reduce((a, s) => a + s.x, 0) / list.length;
      const cy = list.reduce((a, s) => a + s.y, 0) / list.length;
      const ordered = [...list].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
      out.push({ region, points: ordered.map((s) => [s.x, s.y]), cx, cy, top: Math.min(...list.map((s) => s.y)) });
    });
    return out;
  }, [stars]);

  const glass: React.CSSProperties = { backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" };
  const showLabels = stars.length <= 10;

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column", color: INK,
      backgroundImage: "linear-gradient(180deg, #060A1C 0%, #0E1538 36%, #221B4A 64%, #4A2F5E 84%, #7A4C66 100%)" }}>
      {/* The Milky Way: a soft diagonal band of light, drifting slowly. */}
      <div aria-hidden className="milky-way" style={{
        position: "absolute", left: "-30%", top: "8%", width: "160%", height: "38%", transform: "rotate(-24deg)", pointerEvents: "none",
        backgroundImage: "radial-gradient(ellipse at center, rgba(196,180,255,0.20) 0%, rgba(150,170,255,0.10) 35%, transparent 70%)",
      }} />
      {/* Nebulae: soft clouds of the app's colours, breathing slowly. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {NEBULAE.map((n, i) => (
          <div key={i} className="nebula" style={{
            position: "absolute", left: n.left, top: n.top, width: n.size, height: n.size * 0.7, borderRadius: "50%",
            backgroundImage: `radial-gradient(closest-side, ${REGION_CONFIG[n.region].color}38, ${REGION_CONFIG[n.region].color}12 55%, transparent)`,
            ["--dx" as string]: n.dx, ["--dy" as string]: n.dy, ["--dur" as string]: n.dur, ["--delay" as string]: `-${i * 7}s`,
          } as React.CSSProperties} />
        ))}
      </div>
      {/* Field stars, in two layers sliding past at different speeds. Each
          layer is two identical halves side by side, so the loop is seamless. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {STAR_LAYERS.map((layer, li) => (
          <div key={li} className="sky-sail" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "200%", ["--sail-dur" as string]: layer.dur } as React.CSSProperties}>
            {[0, 50].map((offset) => layer.stars.map((f, i) => (
              // Only every third star twinkles (the rest hold steady): a sky
              // full of individually animated stars was ~300 running
              // animations and the main cost of this screen.
              <span key={`${offset}-${i}`} className={i % 3 === 0 ? "twinkle" : undefined} style={{
                position: "absolute", left: `${offset + f.x / 2}%`, top: `${f.y}%`, width: f.size, height: f.size, borderRadius: "50%",
                backgroundColor: f.warm ? "#FFE3B8" : STAR_TINTS[Math.floor(f.tint * STAR_TINTS.length)],
                boxShadow: f.size > 2.3 ? "0 0 4px rgba(255,255,255,0.75)" : undefined, opacity: i % 3 === 0 ? undefined : 0.75,
                ["--tw-dur" as string]: `${f.dur.toFixed(2)}s`, ["--tw-delay" as string]: `${f.delay.toFixed(2)}s`,
              } as React.CSSProperties} />
            )))}
          </div>
        ))}
        {!reduce && <span className="shooting-star" style={{ position: "absolute", left: "62%", top: "10%" }} />}
        {!reduce && <span className="shooting-star" style={{ position: "absolute", left: "30%", top: "34%", animationDelay: "8.5s", animationDuration: "14s" }} />}
      </div>

      {/* ── Header: an app bar (round back button, the title in the middle,
          a search button that opens into the search field), then the
          area tags. ── */}
      <div style={{ position: "relative", zIndex: 3, padding: "10px 14px 6px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 44 }}>
          <motion.button type="button" aria-label="Go back" onClick={onBack} whileTap={{ scale: 0.9 }} style={skyIconBtn}>
            <ArrowLeft size={18} weight="bold" />
          </motion.button>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ ...display, fontSize: 21, color: INK, lineHeight: 1 }}>Your sky</div>
            <div style={{ ...hand, fontSize: 15, color: INK_FAINT, lineHeight: 1, marginTop: 3 }}>{stars.length} {stars.length === 1 ? "star" : "stars"} · {visibleConnections.length} {visibleConnections.length === 1 ? "line" : "lines"}</div>
          </div>
          {/* Keeps the title centred opposite the back button. */}
          <span aria-hidden style={{ width: 40, flexShrink: 0 }} />
        </div>
        <div className="no-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 8, paddingBottom: 2 }}>
          {/* Each area of life as a small glowing tag in its own colour: its
              orb, its name in hand like the constellation names in the sky,
              and how many stars it holds. Areas with no stars yet aren't
              shown; there's nothing to filter to. */}
          {COGNITIVE_REGIONS.filter((r) => regionCounts[r] > 0).map((r, i) => {
            const on = activeRegion === r;
            const n = regionCounts[r];
            const c = REGION_CONFIG[r];
            return (
              <motion.button key={r} type="button" aria-pressed={on} aria-label={`${c.label}, ${n} ${n === 1 ? "star" : "stars"}`}
                initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: on ? -2 : 0 }} whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 380, damping: 24, delay: reduce ? 0 : 0.15 + i * 0.05 }}
                onClick={() => { setActiveRegion(on ? null : r); setSelectedId(null); }}
                style={{
                  position: "relative", display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0, padding: "5px 12px 5px 7px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${on ? c.color : `${c.color}66`}`,
                  backgroundColor: on ? `${c.color}40` : "rgba(20,16,40,0.45)",
                  backgroundImage: `radial-gradient(120% 140% at 0% 50%, ${c.color}${on ? "88" : "38"}, transparent 70%)`,
                  boxShadow: on ? `0 0 18px -2px ${c.color}, inset 0 0 10px ${c.color}55` : `0 0 12px -6px ${c.color}`,
                  backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", WebkitTapHighlightColor: "transparent", transition: "background-color 0.25s, box-shadow 0.25s",
                }}>
                <span style={{ lineHeight: 0 }}><Node color={c.color} size={14} intensity={on ? 1 : 0.8} /></span>
                <span style={{ ...hand, fontSize: 19, fontWeight: 600, lineHeight: 1, color: on ? "#FFFFFF" : c.color, textShadow: on ? `0 0 8px ${c.color}` : undefined }}>{c.label}</span>
                <span style={{
                  ...sans, fontSize: 11, fontWeight: 700, lineHeight: 1, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, boxSizing: "border-box",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: on ? c.ink : "#1A1533", backgroundColor: on ? "#FFFFFF" : c.color,
                }}>{n}</span>
              </motion.button>
            );
          })}
          {(activeRegion || selectedId) && (
            <motion.button type="button" onClick={reset} whileTap={{ scale: 0.94 }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              style={{ ...glass, flexShrink: 0, color: INK, ...hand, fontSize: 18, fontWeight: 600, lineHeight: 1, padding: "6px 13px", borderRadius: 999, cursor: "pointer" }}>
              Show all
            </motion.button>
          )}
        </div>
      </div>

      {/* ── The sky ── */}
      <div ref={skyRef} style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
        <svg aria-hidden width={w} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
          <defs>
            {visibleConnections.map((c, i) => {
              const A = byId.get(c.a)!, B = byId.get(c.b)!;
              return (
                <linearGradient key={i} id={`sky-link-${i}`} gradientUnits="userSpaceOnUse" x1={A.x} y1={A.y} x2={B.x} y2={B.y}>
                  <stop offset="0" stopColor={REGION_CONFIG[A.region].color} />
                  <stop offset="1" stopColor={REGION_CONFIG[B.region].color} />
                </linearGradient>
              );
            })}
          </defs>
          {/* Constellation figures — faint, the shape of each area of life. */}
          {figures.map((f) => f.points.length > 1 && (
            <motion.polyline key={f.region}
              points={[...f.points, ...(f.points.length > 2 ? [f.points[0]] : [])].map((p) => p.join(",")).join(" ")}
              fill="none" stroke="#FFFFFF" strokeOpacity={activeRegion && activeRegion !== f.region ? 0.06 : 0.22} strokeWidth="1" strokeDasharray="2 5"
              initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 1.4, ease: "easeOut", delay: 0.3 }} />
          ))}
          {/* Real connections — the bright lines across the sky. */}
          {visibleConnections.map((c, i) => {
            const A = byId.get(c.a)!, B = byId.get(c.b)!;
            const touchesSelected = selected && (c.a === selected.b.id || c.b === selected.b.id);
            const dim = selected ? !touchesSelected : (activeRegion ? A.region !== activeRegion && B.region !== activeRegion : false);
            const tension = c.type === "contradiction";
            return (
              <motion.line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                stroke={tension ? "#F4A261" : `url(#sky-link-${i})`} strokeWidth={touchesSelected ? 2.6 : 1.6} strokeLinecap="round"
                strokeDasharray={tension ? "6 6" : undefined}
                initial={{ pathLength: reduce ? 1 : 0, opacity: 0 }} animate={{ pathLength: 1, opacity: dim ? 0.12 : touchesSelected ? 1 : 0.7 }}
                transition={{ pathLength: { duration: reduce ? 0 : 1.1, delay: reduce ? 0 : 0.6 + i * 0.12, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.3 } }} />
            );
          })}
        </svg>

        {/* Constellation names, set above each figure. */}
        {figures.map((f) => (
          <div key={f.region} aria-hidden style={{
            position: "absolute", left: f.cx, top: f.top - 34, transform: "translateX(-50%)", pointerEvents: "none",
            ...hand, fontSize: 20, fontWeight: 600, whiteSpace: "nowrap",
            color: REGION_CONFIG[f.region].color, opacity: activeRegion && activeRegion !== f.region ? 0.25 : 0.85,
            textShadow: "0 0 12px rgba(0,0,0,0.6)", transition: "opacity 0.3s",
          }}>
            {REGION_CONFIG[f.region].label}
          </div>
        ))}

        {/* The belief stars — the app's own orbs. */}
        {stars.map((s, i) => {
          const isSel = selected?.b.id === s.b.id;
          return (
            <motion.button
              key={s.b.id} type="button"
              aria-label={`${REGION_CONFIG[s.region].label} star: ${s.b.statement}. ${s.b.confidence}% confidence.`}
              aria-pressed={isSel}
              onClick={() => { setTappedOnce(true); setSelectedId(isSel ? null : s.b.id); }}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.3 }} animate={{ opacity: starOpacity(s), scale: isSel ? 1.25 : 1 }}
              transition={{ opacity: { duration: 0.35, delay: reduce ? 0 : 0.1 + i * 0.07 }, scale: { type: "spring", stiffness: 260, damping: 22, delay: reduce ? 0 : 0.1 + i * 0.07 } }}
              whileTap={{ scale: 0.9 }}
              style={{ position: "absolute", left: s.x, top: s.y, border: 0, background: "transparent", padding: 6, margin: 0, cursor: "pointer", borderRadius: "50%", WebkitTapHighlightColor: "transparent", x: "-50%", y: "-50%" }}
            >
              <motion.span style={{ display: "block" }}
                animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
                transition={reduce ? undefined : { duration: 3 + (hash(s.b.id) % 20) / 10, repeat: Infinity, ease: "easeInOut" }}>
                <Node color={REGION_CONFIG[s.region].color} size={s.size} intensity={0.55 + s.vitality * 0.45} />
              </motion.span>
              {showLabels && (() => {
                // Written on the sky in hand, in the star's own colour, like
                // the constellation names, with a dark halo instead of a
                // box so it stays readable over lines and other stars. A
                // star with another star just below it puts its name above,
                // so the two names don't land on each other.
                const crowdedBelow = stars.some((t) => t !== s && Math.abs(t.x - s.x) < 100 && t.y > s.y && t.y - s.y < 52);
                const edge = s.x > w - 70 ? "right" : s.x < 70 ? "left" : "center";
                return (
                  <span style={{
                    position: "absolute", width: 116, pointerEvents: "none",
                    ...(crowdedBelow ? { bottom: "100%", marginBottom: -4 } : { top: "100%", marginTop: -5 }),
                    ...(edge === "right" ? { right: 0, textAlign: "right" as const } : edge === "left" ? { left: 0, textAlign: "left" as const } : { left: "50%", marginLeft: -58, textAlign: "center" as const }),
                    ...hand, fontSize: 17, fontWeight: 600, lineHeight: 1, letterSpacing: "0.01em",
                    color: REGION_CONFIG[s.region].color, filter: "brightness(1.25)",
                    textShadow: "0 0 3px #0A0920, 0 0 8px #0A0920, 0 0 14px rgba(10,9,32,0.9)",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                  {s.b.thoughtLabel || s.b.statement}
                  </span>
                );
              })()}
            </motion.button>
          );
        })}

        {/* Foreground: the sea. The horizon glows; each constellation's colour
            is reflected on the water below it; starlight glints; two lines
            of waves roll past; and you're out there in a small boat with a
            lantern, bobbing on them. */}
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: HILLS, pointerEvents: "none", overflow: "hidden",
          backgroundImage: "linear-gradient(180deg, #3A2A66 0%, #1C1645 22%, #0F0C2C 60%, #06051A 100%)" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1.5, backgroundImage: "linear-gradient(90deg, transparent, rgba(255,214,240,0.75), rgba(200,190,255,0.8), transparent)", boxShadow: "0 0 14px 3px rgba(220,180,255,0.35)" }} />
          {figures.map((f) => (
            <div key={f.region} className="sea-glint" style={{
              position: "absolute", left: f.cx - 14, top: 4, width: 28, height: "78%", borderRadius: "50%", filter: "blur(7px)",
              backgroundImage: `linear-gradient(180deg, ${REGION_CONFIG[f.region].color}aa, ${REGION_CONFIG[f.region].color}00)`,
              opacity: activeRegion && activeRegion !== f.region ? 0.15 : 0.7,
              ["--gl-dur" as string]: `${3 + (hash(f.region) % 20) / 10}s`,
            } as React.CSSProperties} />
          ))}
          {SEA_GLINTS.map((g, i) => (
            <span key={i} className="sea-glint" style={{
              position: "absolute", left: `${g.x}%`, top: `${g.y}%`, width: g.w, height: 1.5, borderRadius: 1, backgroundColor: i % 4 === 0 ? "#FFE3B8" : "#E6E0FF",
              ["--gl-dur" as string]: `${g.dur.toFixed(2)}s`, ["--gl-delay" as string]: `${g.delay.toFixed(2)}s`,
            } as React.CSSProperties} />
          ))}
          {[{ y: 30, top: 6, amp: 4, fill: "rgba(120,100,200,0.16)", dur: "18s" }, { y: 28, top: 30, amp: 5, fill: "rgba(70,55,150,0.22)", dur: "11s" }, { y: 26, top: 58, amp: 6, fill: "rgba(10,8,34,0.55)", dur: "8s" }].map((wv, i) => (
            <svg key={i} className="wave-roll" viewBox="0 0 720 40" preserveAspectRatio="none"
              style={{ position: "absolute", left: 0, top: wv.top, width: "200%", height: 40, ["--wave-dur" as string]: wv.dur } as React.CSSProperties}>
              <path d={WAVE(wv.amp, wv.y)} fill={wv.fill} />
            </svg>
          ))}
        </div>
        <div aria-hidden className="boat-bob" style={{ position: "absolute", right: "13%", bottom: HILLS - 62, width: 66, height: 60, pointerEvents: "none" }}>
          {/* Lantern glow, on the water and in the air */}
          <div style={{ position: "absolute", left: 30, top: 12, width: 40, height: 40, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(255,200,120,0.55), transparent)" }} />
          <svg viewBox="0 0 66 60" width="66" height="60" style={{ position: "relative", overflow: "visible" }}>
            {/* Sail */}
            <path d="M30 6 L30 40 L10 40 Z" fill="#E9E3FF" fillOpacity="0.9" />
            <path d="M33 12 L33 40 L48 40 Z" fill="#C9BFF5" fillOpacity="0.75" />
            <line x1="31.5" y1="4" x2="31.5" y2="44" stroke="#0B0A1E" strokeWidth="1.6" />
            {/* Hull */}
            <path d="M4 43 L60 43 C 56 52, 48 54, 32 54 C 16 54, 8 52, 4 43 Z" fill="#0B0A1E" />
            {/* Someone sitting at the stern, looking up */}
            <circle cx="52" cy="33" r="3.4" fill="#0B0A1E" />
            <path d="M48 43 C 48 39, 49 37, 52 37 C 55 37, 56 39, 56 43 Z" fill="#0B0A1E" />
            {/* Lantern on its pole */}
            <line x1="44" y1="43" x2="47" y2="28" stroke="#0B0A1E" strokeWidth="1.2" />
            <circle cx="47.5" cy="27" r="2.6" fill="#FFD28A" />
            <circle cx="47.5" cy="27" r="5" fill="#FFD28A" fillOpacity="0.25" />
          </svg>
          {/* Its reflection */}
          <div style={{ position: "absolute", left: 6, right: 4, top: 52, height: 14, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(255,210,140,0.35), transparent)", filter: "blur(2px)" }} />
        </div>

        {/* A small floating hint over the water, until the first star is tapped. */}
        <AnimatePresence>
          {!tappedOnce && stars.length > 0 && (
            <motion.div key="hint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ delay: reduce ? 0 : 1.2, duration: 0.4 }}
              style={{ position: "absolute", left: 0, right: 0, bottom: 14, width: "fit-content", margin: "0 auto", pointerEvents: "none", display: "flex", alignItems: "center", gap: 7,
                padding: "6px 14px 6px 10px", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16)",
                backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", ...hand, fontSize: 18, fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>
              <motion.span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#FFE7A8", boxShadow: "0 0 8px #FFE7A8" }}
                animate={reduce ? undefined : { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
              Tap a star to open it
            </motion.div>
          )}
        </AnimatePresence>

        {stars.length === 0 && w > 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", ...display, fontStyle: "italic", fontSize: 17, color: INK_SOFT }}>
            No stars yet. Each belief that takes shape in what you write appears here as one.
          </div>
        )}
      </div>

      {/* ── The tapped star ── */}
      <AnimatePresence>
        {selected && (
          <StarSheet
            key={selected.b.id} star={selected}
            linked={connections.filter((c) => c.a === selected.b.id || c.b === selected.b.id).map((c) => ({ conn: c, other: byId.get(c.a === selected.b.id ? c.b : c.a) })).filter((x): x is { conn: NeuralBeliefConnection; other: PlacedStar } => !!x.other)}
            onClose={() => setSelectedId(null)} onSelect={(id) => setSelectedId(id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StarSheet({ star, linked, onClose, onSelect }: { star: PlacedStar; linked: { conn: NeuralBeliefConnection; other: PlacedStar }[]; onClose: () => void; onSelect: (id: string) => void }) {
  const r = REGION_CONFIG[star.region];
  const quotes = (star.b.evidenceQuotes ?? []).slice(-2).reverse();
  return (
    <motion.div
      role="dialog" aria-label={`About this star: ${star.b.statement}`}
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
      transition={{ type: "spring", stiffness: 260, damping: 32 }}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 5, maxHeight: "62%", overflowY: "auto", borderRadius: "22px 22px 0 0", padding: "16px 18px 22px", color: INK,
        boxShadow: `0 -18px 40px rgba(0,0,0,0.45), 0 -1px 0 ${r.color}66, 0 -12px 40px -16px ${r.color}`,
        backgroundColor: "#100E2C",
        backgroundImage: `radial-gradient(120% 60% at 15% 0%, ${r.color}45, transparent 60%), linear-gradient(180deg, #1B1745 0%, #100E2C 70%)` }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Node color={r.color} size={14} intensity={0.9} />
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: INK, backgroundColor: `${r.color}38`, border: `1px solid ${r.color}66`, padding: "3px 8px", borderRadius: 999 }}>{r.label}</span>
        <span style={{ ...sans, fontSize: 12, color: INK_SOFT, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{star.b.domain}</span>
        <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "transparent", cursor: "pointer", color: INK_FAINT, lineHeight: 0, padding: 6, margin: -6 }}><X size={16} weight="bold" /></button>
      </div>
      <div style={{ ...display, fontSize: 25, color: INK, lineHeight: 1.25, marginTop: 12, wordBreak: "keep-all" }}>“{star.b.statement}”</div>
      {star.b.thoughtLabel && <div style={{ ...hand, fontSize: 18, color: r.color, marginTop: 4 }}>{star.b.thoughtLabel}</div>}
      {/* How often it comes up, in words and five dots, not a percentage. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <span aria-hidden style={{ display: "inline-flex", gap: 3 }}>
          {Array.from({ length: 5 }, (_, k) => {
            const on = k < Math.max(1, Math.round(star.b.confidence / 20));
            return <span key={k} style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: on ? r.color : "rgba(255,255,255,0.16)", boxShadow: on ? `0 0 6px ${r.color}` : undefined }} />;
          })}
        </span>
        <span style={{ ...hand, fontSize: 18, fontWeight: 600, color: INK }}>
          {star.b.confidence >= 75 ? "Comes up a lot" : star.b.confidence >= 50 ? "Comes up often" : "Comes up now and then"}
        </span>
        <span style={{ ...sans, fontSize: 12, color: INK_SOFT }}>· in {star.b.evidenceCount} {star.b.evidenceCount === 1 ? "entry" : "entries"}</span>
      </div>

      {linked.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ ...hand, fontSize: 21, fontWeight: 600, color: INK, marginBottom: 6 }}>Connected thoughts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {linked.map(({ conn, other }) => {
              const o = REGION_CONFIG[other.region];
              const tension = conn.type === "contradiction";
              return (
                <motion.button key={other.b.id} type="button" onClick={() => onSelect(other.b.id)} whileTap={{ scale: 0.98 }}
                  style={{ textAlign: "left", cursor: "pointer", borderRadius: 12, padding: "10px 12px", color: INK, border: `1px solid ${o.color}44`, backgroundColor: "rgba(255,255,255,0.03)", backgroundImage: `linear-gradient(135deg, ${o.color}30 0%, rgba(255,255,255,0.02) 100%)` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: o.color, boxShadow: `0 0 6px ${o.color}` }} />
                    <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: tension ? "#F6B37A" : o.color }}>{tension ? "Pulls against it" : "Goes along with it"}</span>
                  </div>
                  <div style={{ ...display, fontSize: 17, color: INK, marginTop: 3, lineHeight: 1.4, wordBreak: "keep-all" }}>{other.b.statement}</div>
                  {conn.note && <div style={{ ...sans, fontSize: 12, color: INK_SOFT, marginTop: 3, lineHeight: 1.45, wordBreak: "keep-all" }}>{conn.note}</div>}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {quotes.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ ...hand, fontSize: 21, fontWeight: 600, color: INK, marginBottom: 6 }}>What you said</div>
          {quotes.map((qt, i) => (
            <div key={i} style={{ marginTop: i ? 8 : 0 }}>
              <div style={{ ...mono, fontSize: 11, color: INK_FAINT }}>{qt.date}</div>
              <div style={{ ...display, fontStyle: "italic", fontSize: 15, color: INK, lineHeight: 1.45, marginTop: 2, wordBreak: "keep-all" }}>"{qt.quote}"</div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
