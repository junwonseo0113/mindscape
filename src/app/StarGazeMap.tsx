// ── The night sky (formerly the Brain Map) ───────────────────────────────────
// A stargazing scene in place of the old 3D brain-shaped point cloud. Each
// belief is one of the app's own glowing orbs, set in the night sky; the
// six areas of life are six constellations, their stars joined by faint
// figure lines and named the way constellations are; the real connections
// between beliefs (store.connections) are the bright lines across the sky —
// root links solid, tensions dashed in warm light. Someone sits on a hill
// in the foreground, looking up.
//
// Everything the old map did is still here: search, region filter with
// counts, Reset, tap a star for its detail (statement, confidence, the
// beliefs it's joined to and why, what you actually said), and opening
// straight onto a region or one belief from Home and Mind.
//
// It's an HTML/SVG scene, not WebGL: twinkling, the Milky Way's drift and
// the shooting star are CSS (styles/index.css: .twinkle, .milky-way,
// .shooting-star), and all of it stops under reduced motion. Stars are real
// buttons, so they're reachable by keyboard and screen reader.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, MagnifyingGlass, X } from "@phosphor-icons/react";
import { REGION_CONFIG, resolveRegion, recencyFromDate, type NeuralBeliefNode, type NeuralBeliefConnection } from "./brainRegions";
import { COGNITIVE_REGIONS, type CognitiveRegion } from "./neuralBrainLayout";
import type { StoredEvidenceQuote } from "./types";
import { Node } from "./orb";
import { AnimatedNumber, MeterFill } from "./motionPrimitives";

const serif = { fontFamily: "'Source Serif 4 Variable', 'Gowun Batang', Georgia, serif" };
const sans = { fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif" };
const mono = { fontFamily: "'Monaspace Neon', ui-monospace, monospace" };
const INK = "#F3EFFA";
const INK_SOFT = "rgba(243,239,250,0.78)";
const INK_FAINT = "rgba(243,239,250,0.55)";

type SkyBelief = NeuralBeliefNode & { evidenceQuotes?: StoredEvidenceQuote[]; thoughtLabel?: string };

// Where each constellation sits, as a fraction of the sky band.
// The bottom ~110px is the hills, so the band ends above them.
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
  return Array.from({ length: 120 }, () => ({
    x: r() * 100, y: r() * 80, size: 0.8 + r() * 1.8, dur: 2.4 + r() * 4, delay: -r() * 6, warm: r() < 0.18,
  }));
})();

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
  const [query, setQuery] = useState("");
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
  const q = query.trim().toLowerCase();
  const matches = (s: PlacedStar) =>
    (!activeRegion || s.region === activeRegion) &&
    (!q || s.b.statement.toLowerCase().includes(q) || s.b.domain.toLowerCase().includes(q) || REGION_CONFIG[s.region].label.toLowerCase().includes(q));
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const linkedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(connections.filter((c) => c.a === selectedId || c.b === selectedId).map((c) => (c.a === selectedId ? c.b : c.a)));
  }, [connections, selectedId]);
  const starOpacity = (s: PlacedStar) => {
    if (selected) return s.b.id === selected.b.id || linkedIds.has(s.b.id) ? 1 : 0.28;
    return matches(s) ? 1 : 0.25;
  };
  const reset = () => { setQuery(""); setActiveRegion(null); setSelectedId(null); };

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
      {/* Field stars. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {FIELD_STARS.map((f, i) => (
          <span key={i} className="twinkle" style={{
            position: "absolute", left: `${f.x}%`, top: `${f.y}%`, width: f.size, height: f.size, borderRadius: "50%",
            backgroundColor: f.warm ? "#FFE3B8" : "#FFFFFF", boxShadow: f.size > 2 ? "0 0 4px rgba(255,255,255,0.7)" : undefined,
            ["--tw-dur" as string]: `${f.dur.toFixed(2)}s`, ["--tw-delay" as string]: `${f.delay.toFixed(2)}s`,
          } as React.CSSProperties} />
        ))}
        {!reduce && <span className="shooting-star" style={{ position: "absolute", left: "62%", top: "10%" }} />}
      </div>

      {/* ── Header: back, title, search, constellation chips ── */}
      <div style={{ position: "relative", zIndex: 3, padding: "14px 16px 6px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <motion.button type="button" aria-label="Go back" onClick={onBack} whileTap={{ opacity: 0.6 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "transparent", color: INK_SOFT, ...sans, fontSize: 13, padding: "8px 10px", margin: "-8px -10px", cursor: "pointer" }}>
            <ArrowLeft size={13} weight="bold" aria-hidden /> Back
          </motion.button>
          {(query || activeRegion || selectedId) && (
            <motion.button type="button" onClick={reset} whileTap={{ scale: 0.95 }}
              style={{ ...glass, color: INK, ...sans, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, cursor: "pointer" }}>
              Reset
            </motion.button>
          )}
        </div>
        <div style={{ ...serif, fontSize: 28, color: INK, marginTop: 12, lineHeight: 1.15 }}>Your sky</div>
        <div style={{ ...sans, fontSize: 13, color: INK_SOFT, marginTop: 4, lineHeight: 1.45 }}>
          Each star is a belief. Lines show which ones connect.
        </div>
        <div style={{ ...glass, display: "flex", alignItems: "center", gap: 8, borderRadius: 12, padding: "9px 12px", marginTop: 12 }}>
          <MagnifyingGlass size={16} color={INK_FAINT} aria-hidden />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a belief" aria-label="Search beliefs"
            style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", color: INK, ...sans, fontSize: 14 }}
          />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")} style={{ border: 0, background: "transparent", color: INK_FAINT, cursor: "pointer", lineHeight: 0, padding: 2 }}><X size={14} /></button>}
        </div>
        <div className="no-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>
          {COGNITIVE_REGIONS.map((r) => {
            const on = activeRegion === r;
            const n = regionCounts[r];
            return (
              <motion.button key={r} type="button" aria-pressed={on} disabled={n === 0} whileTap={n ? { scale: 0.95 } : undefined}
                onClick={() => { setActiveRegion(on ? null : r); setSelectedId(null); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "6px 11px", borderRadius: 999, cursor: n ? "pointer" : "default",
                  border: `1px solid ${on ? REGION_CONFIG[r].color : "rgba(255,255,255,0.12)"}`,
                  backgroundColor: on ? `${REGION_CONFIG[r].color}33` : "rgba(255,255,255,0.06)",
                  color: n ? INK : "rgba(243,239,250,0.35)", ...sans, fontSize: 12, fontWeight: 600,
                }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: REGION_CONFIG[r].color, opacity: n ? 1 : 0.4 }} />
                {REGION_CONFIG[r].label}
                <span style={{ ...mono, fontSize: 11, color: INK_FAINT }}>{n}</span>
              </motion.button>
            );
          })}
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
            ...serif, fontStyle: "italic", fontSize: 13, letterSpacing: "0.02em", whiteSpace: "nowrap",
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
              onClick={() => setSelectedId(isSel ? null : s.b.id)}
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
              {showLabels && (
                <span style={{
                  position: "absolute", top: "100%", whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis",
                  // Near an edge the label hangs inward instead of centering,
                  // so it never runs off the screen.
                  ...(s.x > w - 80 ? { right: 0, transform: "translateY(-6px)", textAlign: "right" as const }
                    : s.x < 80 ? { left: 0, transform: "translateY(-6px)" }
                    : { left: "50%", transform: "translate(-50%, -6px)" }),
                  ...sans, fontSize: 11, color: INK_SOFT, textShadow: "0 1px 6px rgba(0,0,0,0.8)", pointerEvents: "none",
                }}>
                  {s.b.thoughtLabel || s.b.statement}
                </span>
              )}
            </motion.button>
          );
        })}

        {/* Foreground: hills, and someone sitting on one, looking up. */}
        <svg aria-hidden viewBox="0 0 360 90" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 90, pointerEvents: "none" }}>
          <path d="M0 52 C 60 34, 120 44, 180 40 S 300 26, 360 44 L360 90 L0 90 Z" fill="#1A1436" />
          <path d="M0 70 C 80 56, 170 70, 250 60 S 330 56, 360 64 L360 90 L0 90 Z" fill="#0B0A1E" />
        </svg>
        <svg aria-hidden viewBox="0 0 40 40" style={{ position: "absolute", right: "16%", bottom: 22, width: 34, height: 34, pointerEvents: "none" }}>
          <circle cx="16" cy="9" r="4.2" fill="#0B0A1E" />
          <path d="M12 14 C 10 20, 10 26, 13 30 L 27 30 C 27 27, 24 26, 20 25 L 20 16 C 19 14, 15 13, 12 14 Z" fill="#0B0A1E" />
          <path d="M20 17 L 27 12" stroke="#0B0A1E" strokeWidth="2.2" strokeLinecap="round" />
        </svg>

        {/* Footer, on the dark hill. */}
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 12, ...sans, fontSize: 12, color: INK_FAINT, pointerEvents: "none" }}>
          {beliefs.length} {beliefs.length === 1 ? "star" : "stars"} · {visibleConnections.length} {visibleConnections.length === 1 ? "connection" : "connections"} · tap a star
        </div>

        {stars.length === 0 && w > 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", ...serif, fontStyle: "italic", fontSize: 16, color: INK_SOFT }}>
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
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 5, maxHeight: "62%", overflowY: "auto", borderRadius: "22px 22px 0 0", padding: "16px 18px 22px", boxShadow: "0 -18px 40px rgba(0,0,0,0.35)",
        backgroundImage: `linear-gradient(170deg, ${r.tint} 0%, #FBF8F2 40%)` }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Node color={r.color} size={14} intensity={0.9} />
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: r.ink, backgroundColor: r.tint, padding: "4px 7px", borderRadius: 6 }}>{r.label}</span>
        <span style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{star.b.domain}</span>
        <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "transparent", cursor: "pointer", color: "rgba(42,38,33,0.5)", lineHeight: 0, padding: 6, margin: -6 }}><X size={16} weight="bold" /></button>
      </div>
      {star.b.thoughtLabel && <div style={{ ...serif, fontStyle: "italic", fontSize: 14, color: r.ink, marginTop: 12 }}>The "{star.b.thoughtLabel}" thought</div>}
      <div style={{ ...serif, fontSize: 21, color: "#2A2621", lineHeight: 1.35, marginTop: 6, wordBreak: "keep-all" }}>{star.b.statement}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <MeterFill value={star.b.confidence} color={r.color} track="rgba(42,38,33,0.08)" height={5} radius={3} style={{ flex: 1 }} />
        <span style={{ ...mono, fontSize: 12, color: "rgba(42,38,33,0.65)", whiteSpace: "nowrap" }}><AnimatedNumber value={star.b.confidence} />% · {star.b.evidenceCount} {star.b.evidenceCount === 1 ? "entry" : "entries"}</span>
      </div>

      {linked.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: "#2A2621", marginBottom: 8 }}>Joined to</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {linked.map(({ conn, other }) => {
              const o = REGION_CONFIG[other.region];
              const tension = conn.type === "contradiction";
              return (
                <motion.button key={other.b.id} type="button" onClick={() => onSelect(other.b.id)} whileTap={{ scale: 0.98 }}
                  style={{ textAlign: "left", border: 0, cursor: "pointer", borderRadius: 12, padding: "10px 12px", backgroundImage: `linear-gradient(135deg, ${o.tint} 0%, rgba(255,255,255,0.8) 100%)` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: o.color }} />
                    <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: tension ? "#7a4310" : o.ink }}>{tension ? "In tension" : "Reinforces"}</span>
                  </div>
                  <div style={{ ...serif, fontSize: 15, color: "#2A2621", marginTop: 3, lineHeight: 1.4, wordBreak: "keep-all" }}>{other.b.statement}</div>
                  {conn.note && <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)", marginTop: 3, lineHeight: 1.45, wordBreak: "keep-all" }}>{conn.note}</div>}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {quotes.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: "#2A2621", marginBottom: 8 }}>What you said</div>
          {quotes.map((qt, i) => (
            <div key={i} style={{ marginTop: i ? 8 : 0 }}>
              <div style={{ ...mono, fontSize: 11, color: "rgba(42,38,33,0.55)" }}>{qt.date}</div>
              <div style={{ ...serif, fontStyle: "italic", fontSize: 14, color: "#2A2621", lineHeight: 1.45, marginTop: 2, wordBreak: "keep-all" }}>"{qt.quote}"</div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
