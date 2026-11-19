// ── In-screen motion primitives ──────────────────────────────────────────────
// Small, reusable pieces for motion *inside* a screen (screenTransitions.ts
// handles motion *between* screens). Everything here answers something the
// person did or something that changed in their data — nothing animates
// just because it mounted on a tab they're flipping through. The global
// <MotionConfig reducedMotion="user"> in App.tsx already turns transforms
// and layout motion off for people who asked their OS for less motion, so
// these only special-case what that config can't (number counting).
import * as React from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type Transition } from "motion/react";

export const SETTLE: Transition = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 };
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// ── Breathe ──────────────────────────────────────────────────────────────────
// Every tappable thing breathes: swells and settles on a 4.2s cycle (about
// 14 a minute — a person sitting quietly). It wraps the control rather
// than being the control, so the press-and-release spring on the inside
// never fights it. The motion itself is a CSS keyframe (styles/index.css,
// `.breathe`, after animate.css's `pulse`), so a screen of forty buttons
// costs the compositor, not the JS thread, and the OS's reduced-motion
// setting turns it off in one media query.
//
// Each instance starts at a random point in the cycle. In sync they would
// read as one pulsing machine; out of phase they read as many quiet
// living things, which is the point.
export function Breathe({ children, active = true, amount = 1.04, inline = false, style }: { children: React.ReactNode; active?: boolean; amount?: number; inline?: boolean; style?: React.CSSProperties }) {
  const delay = React.useMemo(() => `-${(Math.random() * 4.2).toFixed(2)}s`, []);
  const vars = { "--breathe-max": String(amount), "--breathe-delay": delay } as React.CSSProperties;
  return (
    <div className={active ? "breathe" : undefined} style={{ ...(inline ? { display: "inline-block" } : { width: "100%" }), borderRadius: "inherit", ...vars, ...style }}>
      {children}
    </div>
  );
}

// ── Collapse ─────────────────────────────────────────────────────────────────
// Expand/collapse that measures itself (height: auto). Content keeps
// rendering during the close so nothing pops; the outer div clips it.
export function Collapse({ open, children, style }: { open: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration: 0.28, ease: EASE_OUT }, opacity: { duration: 0.2 } }}
          style={{ overflow: "hidden", ...style }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── AnimatedNumber ───────────────────────────────────────────────────────────
// Counts from the last value it showed to the new one. `memoryKey` keeps
// that last value across remounts (module-level), so a number that has
// *changed* since the person last saw it counts up — the one honest reason
// to animate a stat — while a number that merely re-rendered holds still.
// Without a key it still animates on in-place changes, never on mount.
const numberMemory = new Map<string, number>();

export function AnimatedNumber({ value, memoryKey, format = (n) => String(Math.round(n)) }: { value: number; memoryKey?: string; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const start = memoryKey !== undefined && numberMemory.has(memoryKey) ? numberMemory.get(memoryKey)! : value;
  const mv = useMotionValue(start);
  const text = useTransform(mv, (v) => format(v));
  React.useEffect(() => {
    if (memoryKey !== undefined) numberMemory.set(memoryKey, value);
    if (reduce || mv.get() === value) { mv.set(value); return; }
    const controls = animate(mv, value, { duration: 0.7, ease: EASE_OUT });
    return () => controls.stop();
  }, [value, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  return <motion.span>{text}</motion.span>;
}

// ── MeterFill ────────────────────────────────────────────────────────────────
// A 0–100 bar that fills the first time it scrolls into view, and re-fills
// in place if its value later changes. The fill is motion; the track is not.
export function MeterFill({ value, color, track, height = 4, radius = 2, style }: { value: number; color: string; track: string; height?: number; radius?: number; style?: React.CSSProperties }) {
  const pct = `${Math.max(0, Math.min(100, value))}%`;
  // A 6-digit hex fill ramps from a lighter step of itself at the start to
  // full strength at its end, so the fill reads as building up toward its
  // value rather than a flat slab with a hard cut. Any other color format
  // stays a solid fill.
  const fill: React.CSSProperties = /^#[0-9a-f]{6}$/i.test(color)
    ? { backgroundImage: `linear-gradient(90deg, ${color}66 0%, ${color} 100%)` }
    : { backgroundColor: color };
  return (
    <div style={{ height, borderRadius: radius, backgroundColor: track, overflow: "hidden", ...style }}>
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: pct }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.1 }}
        style={{ height: "100%", borderRadius: radius, ...fill }}
      />
    </div>
  );
}

// ── Reveal ───────────────────────────────────────────────────────────────────
// A staggered reveal for a screen that is itself a *result* — the summary
// after a recording, a confirmation — where the content arriving in order
// is the point. <RevealGroup> sets the timing; each <RevealItem> is one
// beat. Not for ordinary content screens (see the file comment).
const groupVariants = {
  hidden: {},
  // 0.13s a beat: slow enough that each line registers as its own
  // arrival, fast enough that a five-line summary is done in under a
  // second. Tune here, not per screen.
  shown: (delay: number = 0) => ({ transition: { delayChildren: delay, staggerChildren: 0.13 } }),
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

export function RevealGroup({ children, delay = 0.15, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  return (
    <motion.div variants={groupVariants} custom={delay} initial="hidden" animate="shown" style={style}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <motion.div variants={itemVariants} style={style}>{children}</motion.div>;
}
