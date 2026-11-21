import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { display, hand } from "./typefaces";
import type { CognitiveRegion } from "./neuralBrainLayout";
import { OPENING_TEXT, OPENING_MUTED } from "./OpeningScreens";
import { PenNib } from "@phosphor-icons/react";

// ── DiaryNotePaper ───────────────────────────────────────────────────────────
// The place you actually write, made to feel like your own diary page
// rather than a form field: pastel paper whose colors drift slowly, two
// strips of washi tape holding it down, soft colored ruled lines that
// scroll with the text (each line exactly one line of writing), a rose
// margin, and a pen nib in the corner that wiggles while you type and
// flicks out little drops of colored ink. A word count sits bottom-left.
// The ink drops and the drift stop under reduced motion.
const DIARY_INKS = [REGION_CONFIG.identity.color, REGION_CONFIG.relationships.color, REGION_CONFIG.career.color, REGION_CONFIG.curiosity.color, REGION_CONFIG.security.color, REGION_CONFIG.creativity.color];

export function DiaryNotePaper({ value, onChange, placeholder, ariaLabel, autoFocus, fontSize = 25, lineHeight = 36, minHeight, fill, onEnter, style, header, children }: {
  value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel: string; autoFocus?: boolean;
  fontSize?: number; lineHeight?: number; minHeight?: number; fill?: boolean; onEnter?: () => void; style?: React.CSSProperties;
  // header: written on the first ruled line, above where you type (a
  // salutation, say). children: overlays on the paper (a seal, a stamp).
  header?: React.ReactNode; children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [drops, setDrops] = React.useState<{ id: number; color: string; dx: number }[]>([]);
  const [typing, setTyping] = React.useState(false);
  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inkIndex = React.useRef(0);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const padTop = 18;
  const handle = (v: string) => {
    onChange(v);
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 650);
    if (reduce || v.length <= value.length) return;
    const did = Date.now() + Math.random();
    const color = DIARY_INKS[inkIndex.current++ % DIARY_INKS.length];
    setDrops((d) => [...d.slice(-8), { id: did, color, dx: (Math.random() - 0.5) * 34 }]);
    setTimeout(() => setDrops((d) => d.filter((x) => x.id !== did)), 900);
  };
  React.useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);
  const tape = (side: "left" | "right", a: string, b: string) => (
    <span aria-hidden style={{
      position: "absolute", top: -9, [side]: 22, width: 64, height: 20, borderRadius: 2, opacity: 0.85,
      transform: `rotate(${side === "left" ? -6 : 5}deg)`, boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
      backgroundImage: `repeating-linear-gradient(45deg, ${a} 0 7px, ${b} 7px 14px)`,
    } as React.CSSProperties} />
  );
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", ...(fill ? { flex: 1, minHeight: 0 } : {}), ...style }}>
      <div className={reduce ? undefined : "diary-wash"} style={{
        position: "relative", display: "flex", flexDirection: "column", ...(fill ? { flex: 1, minHeight: 0 } : {}),
        borderRadius: 16, padding: `0 16px 34px 38px`,
        // The app's own colors at ~30–35% over warm white: pastel, but with
        // enough real color that it stays colorful even on the dark
        // writing screen (plain tints read as gray there).
        backgroundColor: "#FFFCF6",
        backgroundImage: `linear-gradient(125deg, ${REGION_CONFIG.relationships.color}5c, ${REGION_CONFIG.career.color}55, ${REGION_CONFIG.creativity.color}4a, ${REGION_CONFIG.curiosity.color}4d, ${REGION_CONFIG.identity.color}55, ${REGION_CONFIG.relationships.color}5c)`,
        backgroundSize: "180% 180%",
        boxShadow: "0 0 0 1px rgba(42,38,33,0.06), 0 14px 30px -18px rgba(74,47,94,0.55)",
      }}>
        {tape("left", `${REGION_CONFIG.relationships.color}aa`, `${REGION_CONFIG.relationships.tint}`)}
        {tape("right", `${REGION_CONFIG.curiosity.color}99`, `${REGION_CONFIG.curiosity.tint}`)}
        {/* Margin line */}
        <span aria-hidden style={{ position: "absolute", left: 26, top: 10, bottom: 10, width: 1.5, borderRadius: 1, backgroundColor: `${REGION_CONFIG.relationships.color}88` }} />
        {header && (
          <div style={{
            ...hand, fontWeight: 500, fontSize, lineHeight: `${lineHeight}px`, height: padTop + lineHeight, padding: `${padTop}px 0 0`, flexShrink: 0,
            color: REGION_CONFIG.identity.ink, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
            backgroundPosition: `0 ${padTop}px`, backgroundRepeat: "no-repeat", backgroundSize: `100% ${lineHeight}px`,
            backgroundImage: `linear-gradient(to bottom, transparent ${lineHeight - 1}px, ${REGION_CONFIG.identity.color}38 ${lineHeight - 1}px)`,
          }}>{header}</div>
        )}
        <textarea
          autoFocus={autoFocus} value={value} placeholder={placeholder} aria-label={ariaLabel}
          onChange={(e) => handle(e.target.value)}
          onKeyDown={onEnter ? (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnter(); } } : undefined}
          rows={fill ? undefined : 2}
          style={{
            ...hand, fontWeight: 500, width: "100%", resize: "none", border: 0, outline: "none", ...(fill ? { flex: 1, minHeight: 0 } : { minHeight: minHeight ?? lineHeight * 2 + padTop }),
            padding: `${header ? 0 : padTop}px 0 0`, fontSize, lineHeight: `${lineHeight}px`, color: "#2E2547", caretColor: REGION_CONFIG.relationships.color,
            wordBreak: "keep-all", colorScheme: "light",
            // Ruled lines that scroll with the writing, one per line.
            backgroundColor: "transparent", backgroundAttachment: "local", backgroundPosition: `0 ${header ? 0 : padTop}px`,
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${lineHeight - 1}px, ${REGION_CONFIG.identity.color}38 ${lineHeight - 1}px, ${REGION_CONFIG.identity.color}38 ${lineHeight}px)`,
          }}
        />
        <span aria-hidden style={{ position: "absolute", left: 38, bottom: 6, ...hand, fontSize: 18, fontWeight: 600, color: REGION_CONFIG.identity.ink, opacity: words ? 0.85 : 0.45 }}>
          {words} {words === 1 ? "word" : "words"}
        </span>
        {/* The pen, and the ink it flicks while you write. */}
        <div aria-hidden style={{ position: "absolute", right: 14, bottom: 8 }}>
          {drops.map((d) => (
            <motion.span key={d.id} initial={{ x: 0, y: 0, scale: 1, opacity: 0.95 }} animate={{ x: d.dx, y: -38, scale: 0.4, opacity: 0 }} transition={{ duration: 0.85, ease: "easeOut" }}
              style={{ position: "absolute", left: 4, top: 2, width: 8, height: 8, borderRadius: "50%", backgroundColor: d.color, boxShadow: `0 0 8px ${d.color}` }} />
          ))}
          <motion.span animate={typing && !reduce ? { rotate: [-8, 10, -6, 8, -8], y: [0, -2, 0, -2, 0] } : { rotate: 0, y: 0 }}
            transition={typing && !reduce ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
            style={{ display: "block", lineHeight: 0, color: REGION_CONFIG.identity.ink }}>
            <PenNib size={22} weight="duotone" />
          </motion.span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Letter to your future self ───────────────────────────────────────────────
// Where the aspiration is written (the last onboarding page, and Profile →
// Your Journey): a diary page addressed "Dear future me," with today's date
// on the same line. When it's saved, a wax seal in the app's colours
// presses down onto the corner of the page, the way you'd close a letter
// meant to be opened later; the screen moves on once it has landed.
export const SEAL_MS = 900;

function WaxSeal() {
  const reduce = useReducedMotion();
  const c = REGION_CONFIG.relationships;
  return (
    <motion.div aria-hidden
      initial={reduce ? { opacity: 0 } : { scale: 2.4, opacity: 0, rotate: -40, y: -30 }}
      animate={{ scale: 1, opacity: 1, rotate: -12, y: 0 }}
      transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 320, damping: 17 }}
      style={{ position: "absolute", right: 16, bottom: 40, width: 72, height: 72, zIndex: 3 }}
    >
      {!reduce && (
        <motion.span initial={{ scale: 0.6, opacity: 0.55 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
          style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${c.color}` }} />
      )}
      <svg viewBox="0 0 72 72" width="72" height="72" style={{ display: "block", filter: `drop-shadow(0 4px 6px ${c.ink}55)` }}>
        <defs>
          <radialGradient id="wax" cx="38%" cy="32%" r="70%">
            <stop offset="0" stopColor="#F59BB4" /><stop offset="0.45" stopColor={c.color} /><stop offset="1" stopColor={c.ink} />
          </radialGradient>
        </defs>
        {/* Melted, uneven rim */}
        <path d="M36 3c6 0 9 3 14 4s10 5 12 10 4 9 5 14-1 9 0 14-4 10-8 13-8 6-13 7-9 4-14 3-9-3-14-5-9-6-11-11-5-9-5-14 2-10 2-15 5-9 9-12 10-5 14-6 4-2 9-2z" fill="url(#wax)" />
        <circle cx="36" cy="36" r="21" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="1.2" />
        <circle cx="36" cy="36" r="17.5" fill="none" stroke={c.ink} strokeOpacity="0.35" strokeWidth="1" />
        <text x="36" y="45" textAnchor="middle" style={{ ...display, fontStyle: "italic", fontSize: 26 }} fill="#FFFFFF" fillOpacity="0.88">M</text>
      </svg>
    </motion.div>
  );
}

export function FutureSelfLetter({ value, onChange, sealed, autoFocus, fontSize = 23, lineHeight = 34 }: { value: string; onChange: (v: string) => void; sealed: boolean; autoFocus?: boolean; fontSize?: number; lineHeight?: number }) {
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <DiaryNotePaper
      fill autoFocus={autoFocus} value={value} onChange={onChange} fontSize={fontSize} lineHeight={lineHeight}
      ariaLabel="What kind of person do you want to become? Write it as a note to your future self"
      placeholder="I want to be someone who chooses challenge over safety…"
      header={<><span>Dear future me,</span><span style={{ fontSize: Math.round(fontSize * 0.72), color: REGION_CONFIG.identity.ink, opacity: 0.75 }}>{date}</span></>}
    >
      <AnimatePresence>{sealed && <WaxSeal key="seal" />}</AnimatePresence>
    </DiaryNotePaper>
  );
}

export function DiaryHeading({ kicker, title, body, region, align = "left", size = 30, delay = 0 }: {
  kicker?: string; title: string; body?: React.ReactNode; region: CognitiveRegion; align?: "left" | "center"; size?: number; delay?: number;
}) {
  const reduce = useReducedMotion();
  const c = REGION_CONFIG[region];
  const lines = title.split("\n");
  const center = align === "center";
  const t = (at: number, duration = 0.5) => ({ duration: reduce ? 0 : duration, delay: reduce ? 0 : delay + at, ease: [0.22, 1, 0.36, 1] as const });
  return (
    <div style={{ textAlign: align, display: "flex", flexDirection: "column", alignItems: center ? "center" : "flex-start" }}>
      {kicker && (
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", marginBottom: 14 }}>
          <div style={{ ...hand, fontSize: 23, fontWeight: 600, color: c.ink, lineHeight: 1.1 }}>{kicker}</div>
          <svg width="100%" height="10" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden style={{ display: "block", marginTop: 2, overflow: "visible" }}>
            <motion.path d="M1 6 C 20 2.5, 38 8.5, 56 5 S 86 3, 99 5.5" fill="none" stroke={c.color} strokeWidth={2.4} strokeLinecap="round"
              vectorEffect="non-scaling-stroke" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={t(0.15, 0.6)} />
          </svg>
        </div>
      )}
      <div style={{ ...display, fontSize: size, color: OPENING_TEXT, lineHeight: 1.28, wordBreak: "keep-all" }}>
        {lines.map((line, idx) => {
          const last = idx === lines.length - 1;
          return (
            <motion.div key={idx} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={t(0.25 + idx * 0.12)}>
              <span style={{ position: "relative", display: "inline-block" }}>
                {last && (
                  <motion.span aria-hidden
                    initial={{ scaleX: reduce ? 1 : 0 }} animate={{ scaleX: 1 }} transition={t(0.75, 0.55)}
                    style={{
                      position: "absolute", left: -4, right: -6, bottom: "0.08em", height: "0.48em", zIndex: 0,
                      transformOrigin: "left center", borderRadius: "3px 8px 4px 9px", transform: "rotate(-0.8deg)",
                      background: `linear-gradient(100deg, ${c.color}66, ${c.color}40 70%, ${c.color}55)`,
                    }} />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>{line}</span>
              </span>
            </motion.div>
          );
        })}
      </div>
      {body && (
        <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={t(0.5 + lines.length * 0.12)}
          style={{ ...hand, fontSize: 21, fontWeight: 500, color: OPENING_MUTED, marginTop: 14, lineHeight: 1.3, wordBreak: "keep-all", maxWidth: center ? 320 : undefined }}>
          {body}
        </motion.div>
      )}
    </div>
  );
}
