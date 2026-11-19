import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { display, hand } from "./typefaces";
import { REGION_CONFIG } from "./brainRegions";

// ── Diary opening ────────────────────────────────────────────────────────────
// The first thing the app shows: a closed cloth-bound diary with
// "Mindscape" stamped in gold foil. The elastic band slips off, the cover
// swings open on its spine (a real 3D turn: the front face and the marbled
// endpaper behind it are two faces of one card), the first page writes
// itself in, and then the view falls into that page, which is the same
// ivory as the screen after it, so the hand-off has no seam.
//
// The book's look and motion live here; App.tsx supplies the first page's
// contents (`page`), mounted only once the cover starts to open so its own
// entrance animations play as the page is revealed. A tap anywhere skips
// ahead. Under reduced motion the diary is shown already open and simply
// fades on.

const T = { band: 1.0, open: 1.3, reveal: 1.75, zoom: 4.6, done: 5.3 };
const OPEN_DURATION = 1.2;
const ZOOM_DURATION = 0.7;

const GOLD = "linear-gradient(100deg, #B38A3C 0%, #E9C978 30%, #FFF3CF 46%, #F1D38E 56%, #B8913F 80%, #E2BF6E 100%)";
const GOLD_SOLID = "#E3C47C";
const PAPER = "#FDFBF6";
const SCREEN_IVORY = "#F2EEE6";

// Cloth grain: fine noise, multiplied over the cover colour.
const CLOTH = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .5 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`;

// The emblem above the title: the same idea as the splash constellation —
// a few points of light, joined — pressed in gold.
const EMBLEM_POINTS: [number, number, number][] = [[8, 30, 2.2], [26, 12, 1.7], [46, 22, 2.6], [64, 8, 1.7], [74, 32, 2], [38, 40, 1.5]];
const EMBLEM_LINKS: [number, number][] = [[0, 1], [1, 2], [2, 3], [2, 4], [0, 5], [5, 2]];

function useBookSize(rootRef: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = React.useState({ w: 270, h: 372, zoom: 3.2 });
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(Math.min(r.width * 0.68, 290));
      const h = Math.round(w * 1.38);
      // Enough to make the page cover the whole screen, with a margin.
      const zoom = Math.max(r.width / w, r.height / h) * 1.12;
      setBox({ w, h, zoom });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rootRef]);
  return box;
}

export function DiaryOpening({ onDone, page, backdrop }: { onDone?: () => void; page: React.ReactNode; backdrop?: React.ReactNode }) {
  const reduce = !!useReducedMotion();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const { w, h, zoom } = useBookSize(rootRef);
  const [phase, setPhase] = React.useState<"closed" | "band" | "open" | "zoom">(reduce ? "open" : "closed");
  const [revealed, setRevealed] = React.useState(reduce);
  const doneRef = React.useRef(false);
  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone?.();
  }, [onDone]);

  React.useEffect(() => {
    if (reduce) {
      const t = setTimeout(finish, 2200);
      return () => clearTimeout(t);
    }
    const timers = [
      setTimeout(() => setPhase("band"), T.band * 1000),
      setTimeout(() => setPhase("open"), T.open * 1000),
      setTimeout(() => setRevealed(true), T.reveal * 1000),
      setTimeout(() => setPhase("zoom"), T.zoom * 1000),
      setTimeout(finish, T.done * 1000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduce, finish]);

  const bandGone = phase !== "closed";
  const open = phase === "open" || phase === "zoom";
  const zooming = phase === "zoom";

  return (
    <motion.div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label="Mindscape, your diary, opening. Tap to continue"
      onClick={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          finish();
        }
      }}
      initial={{ opacity: reduce ? 0 : 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0.5 : 0 }}
      style={{ position: "relative", height: "100%", overflow: "hidden", backgroundColor: SCREEN_IVORY, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {backdrop}

      {/* Soft shadow on the "desk" under the book. */}
      <motion.div
        aria-hidden
        initial={reduce ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: zooming ? 0 : 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ position: "absolute", width: w * 1.1, height: 46, top: `calc(50% + ${h / 2 - 14}px)`, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(46,32,80,0.32), transparent)", filter: "blur(4px)", zIndex: 1 }}
      />

      {/* The book: entrance, then the fall into the first page. */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 28, scale: 0.92, rotate: -3 }}
        animate={zooming ? { opacity: 1, y: 0, scale: zoom, rotate: 0 } : { opacity: 1, y: 0, scale: 1, rotate: open ? 0 : -1.5 }}
        transition={zooming ? { duration: ZOOM_DURATION, ease: [0.7, 0, 0.84, 0] } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: w, height: h, zIndex: 2, perspective: 1600 }}
      >
        {/* Page block — page edges stacked along the fore-edge and foot. */}
        <motion.div
          animate={{ backgroundColor: zooming ? SCREEN_IVORY : PAPER }}
          transition={{ duration: ZOOM_DURATION * 0.8 }}
          style={{
            position: "absolute", inset: "5px 4px 5px 0", borderRadius: "3px 10px 10px 3px", overflow: "hidden",
            boxShadow: zooming ? "none" : "1px 1px 0 #EFE8DA, 2px 2px 0 #E6DDCB, 3px 3px 0 #EFE8DA, 4px 4px 0 #DED3BE, 0 10px 28px -12px rgba(46,32,80,0.35)",
          }}
        >
          {/* Ruling and margin line */}
          <motion.div aria-hidden animate={{ opacity: zooming ? 0 : 1 }} transition={{ duration: 0.3 }}
            style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(180deg, transparent 0 29px, rgba(110,130,180,0.13) 29px 30px)", backgroundPosition: "0 22px" }} />
          <motion.span aria-hidden animate={{ opacity: zooming ? 0 : 1 }} transition={{ duration: 0.3 }}
            style={{ position: "absolute", left: 26, top: 0, bottom: 0, width: 1.5, backgroundColor: `${REGION_CONFIG.relationships.color}55` }} />
          {/* Gutter shadow by the spine */}
          <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 22, backgroundImage: "linear-gradient(90deg, rgba(46,32,80,0.16), transparent)" }} />
          {/* The first page's own content */}
          <motion.div
            animate={{ opacity: zooming ? 0 : 1 }}
            transition={{ duration: 0.25 }}
            style={{ position: "absolute", inset: "0 0 0 26px", padding: "26px 18px 20px 14px", display: "flex", flexDirection: "column" }}
          >
            {revealed && page}
          </motion.div>
          {/* Shade cast by the cover while it is still over the page */}
          <motion.div aria-hidden
            initial={false}
            animate={{ opacity: open ? 0 : 0.55 }}
            transition={{ duration: OPEN_DURATION * 0.9, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0, backgroundColor: "#2A2350", pointerEvents: "none" }} />
        </motion.div>

        {/* Ribbon bookmark peeking out of the foot */}
        <motion.span aria-hidden
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1, rotate: reduce || zooming ? 0 : [0, 4, -3, 0], opacity: zooming ? 0 : 1 }}
          transition={{ scaleY: { duration: 0.5, delay: 0.5 }, rotate: { duration: 4.5, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.2 } }}
          style={{ position: "absolute", left: "62%", bottom: -26, width: 13, height: 40, transformOrigin: "50% 0%", zIndex: -1,
            backgroundImage: `linear-gradient(180deg, ${REGION_CONFIG.identity.ink}, ${REGION_CONFIG.identity.color})`,
            clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)" }} />

        {/* The cover: one card, two faces, turning on its spine. */}
        <motion.div
          initial={false}
          animate={{ rotateY: open ? -178 : 0 }}
          transition={{ duration: reduce ? 0 : OPEN_DURATION, ease: [0.65, 0, 0.3, 1] }}
          style={{ position: "absolute", inset: 0, transformOrigin: "left center", transformStyle: "preserve-3d", zIndex: 3 }}
        >
          {/* Front */}
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
            borderRadius: "5px 14px 14px 5px", overflow: "hidden",
            backgroundColor: "#33296A",
            backgroundImage: `radial-gradient(120% 80% at 18% 8%, rgba(255,255,255,0.16), transparent 55%), linear-gradient(150deg, #4A3B86 0%, #33296A 48%, #241D4E 100%)`,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 22px 44px -18px rgba(30,20,60,0.6)",
          }}>
            <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: CLOTH, mixBlendMode: "multiply", opacity: 0.5 }} />
            {/* Spine and hinge groove */}
            <div aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 20, backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.32), rgba(0,0,0,0.12) 70%, rgba(255,255,255,0.08))" }} />
            <div aria-hidden style={{ position: "absolute", left: 22, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(0,0,0,0.25)", boxShadow: "1px 0 0 rgba(255,255,255,0.08)" }} />
            {/* Stitched gold border */}
            <div aria-hidden style={{ position: "absolute", inset: "12px 12px 12px 32px", borderRadius: 9, border: `1.5px dashed ${GOLD_SOLID}59` }} />

            <div style={{ position: "absolute", inset: "0 14px 0 34px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <svg aria-hidden viewBox="0 0 82 48" width={Math.round(w * 0.3)} style={{ overflow: "visible", marginBottom: 14 }}>
                {EMBLEM_LINKS.map(([a, b], i) => (
                  <line key={i} x1={EMBLEM_POINTS[a][0]} y1={EMBLEM_POINTS[a][1]} x2={EMBLEM_POINTS[b][0]} y2={EMBLEM_POINTS[b][1]} stroke={GOLD_SOLID} strokeOpacity="0.7" strokeWidth="0.9" />
                ))}
                {EMBLEM_POINTS.map(([x, y, r], i) => (
                  <motion.circle key={i} cx={x} cy={y} r={r} fill={GOLD_SOLID}
                    initial={{ opacity: 0.75 }}
                    animate={reduce ? undefined : { opacity: [0.75, 1, 0.75] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }} />
                ))}
              </svg>
              {/* Gold foil title with a light sweep across it */}
              <motion.div
                initial={{ backgroundPosition: "120% 0%" }}
                animate={reduce ? undefined : { backgroundPosition: ["120% 0%", "-20% 0%"] }}
                transition={{ duration: 1.6, delay: 0.35, ease: "easeInOut" }}
                style={{
                  ...display, fontStyle: "italic", fontSize: Math.round(w * 0.165), lineHeight: 1.05, letterSpacing: "-0.01em",
                  backgroundImage: GOLD, backgroundSize: "260% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                  filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.35))",
                }}
              >
                Mindscape
              </motion.div>
              <div aria-hidden style={{ width: 54, height: 1, backgroundColor: `${GOLD_SOLID}99`, margin: "14px 0 10px" }} />
              <div style={{ ...hand, fontSize: Math.round(w * 0.075), color: `${GOLD_SOLID}D9` }}>a diary of how you think</div>
            </div>

            {/* Elastic band, slipping off before the cover opens */}
            <motion.div aria-hidden
              initial={false}
              animate={bandGone ? { x: 46, opacity: 0 } : { x: 0, opacity: 1 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 1, 1] }}
              style={{ position: "absolute", top: -2, bottom: -2, right: "6%", width: 10,
                backgroundImage: `linear-gradient(90deg, ${REGION_CONFIG.relationships.ink}, ${REGION_CONFIG.relationships.color} 45%, ${REGION_CONFIG.relationships.ink})`,
                boxShadow: "-2px 0 4px rgba(0,0,0,0.25)" }} />
            {/* Darkens as the cover turns away from the light */}
            <motion.div aria-hidden initial={false} animate={{ opacity: open ? 0.45 : 0 }} transition={{ duration: OPEN_DURATION * 0.6 }}
              style={{ position: "absolute", inset: 0, backgroundColor: "#000" }} />
          </div>

          {/* Back: marbled endpaper */}
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)",
            borderRadius: "14px 5px 5px 14px", overflow: "hidden", backgroundColor: "#F4EDE0",
            backgroundImage: [
              `radial-gradient(40% 30% at 22% 24%, ${REGION_CONFIG.curiosity.color}40, transparent 70%)`,
              `radial-gradient(46% 34% at 78% 40%, ${REGION_CONFIG.identity.color}3a, transparent 70%)`,
              `radial-gradient(42% 30% at 30% 74%, ${REGION_CONFIG.relationships.color}38, transparent 70%)`,
              `radial-gradient(36% 28% at 80% 84%, ${REGION_CONFIG.career.color}40, transparent 70%)`,
            ].join(", "),
            boxShadow: "inset -14px 0 18px -10px rgba(46,32,80,0.25)",
          }}>
            <div style={{ position: "absolute", left: "14%", right: "18%", bottom: "16%", textAlign: "left" }}>
              <div style={{ ...hand, fontSize: Math.round(w * 0.07), color: "rgba(42,38,33,0.6)" }}>This diary belongs to</div>
              <div style={{ ...hand, fontSize: Math.round(w * 0.095), color: REGION_CONFIG.identity.ink, borderBottom: "1px solid rgba(42,38,33,0.3)", paddingBottom: 2, marginTop: 2 }}>you</div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: zooming ? 0 : 0.42 }}
        transition={{ duration: 0.5, delay: zooming ? 0 : 1.6 }}
        style={{ ...hand, position: "absolute", bottom: 34, left: 0, right: 0, fontSize: 17, textAlign: "center", color: "#2A2621", zIndex: 2 }}
      >
        Tap to continue
      </motion.div>
    </motion.div>
  );
}
