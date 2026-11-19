// ── Screen-to-screen transitions ─────────────────────────────────────────────
// Every route used to share one opacity fade, and deeper routes ran it in
// AnimatePresence mode="wait" — old screen fades to 0, *then* the new one
// fades in from 0. For ~0.4s neither screen covered the frame, so the bare
// fallback color flashed between them. Here every transition keeps one
// opaque layer on screen at all times:
//
//   forward  new screen slides in on top; old one drifts back underneath
//   back     top screen slides off to the right, revealing the one below
//   tab      peers crossfade; the old tab holds until the new one covers it
//   opening  quote → splash → auth: a slow, slightly blurred dissolve
//   session  the think flow keeps its "lights dropping" scale-in
//
// Direction comes from a small visit stack, not from hand-labelling each
// setScreen call: navigating to a screen already in the stack is "back".
import * as React from "react";
import type { Variants, Transition } from "motion/react";

// zoom / unzoom: Home's brain jar opening into (and closing back from) the
// full Brain Map — see the clip-path variants below. grow: a page opening
// out of the row that was tapped (same clip-path idea, slower and eased at
// both ends so the growth itself is visible).
export type TransitionKind = "forward" | "back" | "tab" | "opening" | "session" | "zoom" | "unzoom" | "grow";

const PRIMARY_TABS = new Set(["home", "analysis", "discoveryAnalysis", "history"]);
const OPENING = new Set(["quote", "splash", "auth", "login", "signup", "onboarding"]);
const SESSION = new Set(["think", "aiConsent", "processing", "thinkComplete", "sessionSummary", "crisisSupport"]);

// Edge swipe-back only where "back" means returning down a stack: not on the
// opening flow, the writing session (swiping out mid-thought would be easy
// to do by accident), or the root tabs, which have nowhere to go back to.
export function canSwipeBack(screen: string): boolean {
  return !OPENING.has(screen) && !SESSION.has(screen) && !PRIMARY_TABS.has(screen);
}

function classify(from: string, to: string, stack: string[]): TransitionKind {
  if (OPENING.has(from) || OPENING.has(to)) return "opening";
  if (SESSION.has(from) || SESSION.has(to)) return "session";
  if (PRIMARY_TABS.has(from) && PRIMARY_TABS.has(to)) return "tab";
  return stack.includes(to) ? "back" : "forward";
}

// Returns how the *current* change of `screen` should animate, plus the
// screen below it in the visit stack (what an edge swipe-back reveals).
// Kept in refs and only advanced when `screen` actually changes, so
// StrictMode's double render can't push the same screen twice. A caller
// can force the next change's kind (e.g. "zoom") through `override`.
export function useScreenTransitionKind(
  screen: string,
  override?: React.MutableRefObject<TransitionKind | null>,
): { kind: TransitionKind; below: string | null } {
  const state = React.useRef({ last: screen, stack: [screen], kind: "opening" as TransitionKind });
  const s = state.current;
  if (s.last !== screen) {
    s.kind = override?.current ?? classify(s.last, screen, s.stack);
    if (override) override.current = null;
    const idx = s.stack.indexOf(screen);
    if (idx >= 0) s.stack = s.stack.slice(0, idx + 1);
    // A primary tab is a root: whatever was stacked above it is gone.
    else if (PRIMARY_TABS.has(screen)) s.stack = [screen];
    else s.stack = [...s.stack, screen];
    s.last = screen;
  }
  return { kind: s.kind, below: s.stack.length > 1 ? s.stack[s.stack.length - 2] : null };
}

// clip: for zoom/unzoom, the jar's rectangle and the full-coverage end
// state, both as clip-path inset() strings relative to the screen layer.
export type TransitionCustom = { kind: TransitionKind; reduce: boolean; clip?: { jar: string; full: string } };

// iOS-style deceleration: fast start, long gentle settle.
const PUSH_EASE = [0.32, 0.72, 0, 1] as const;
const SOFT_EASE = [0.22, 1, 0.36, 1] as const;
const GROW_EASE = [0.65, 0, 0.25, 1] as const;

function enterTransition(kind: TransitionKind): Transition {
  switch (kind) {
    case "forward": return { duration: 0.42, ease: PUSH_EASE };
    case "back": return { duration: 0.36, ease: PUSH_EASE };
    case "tab": return { duration: 0.2, ease: "easeOut" };
    case "opening": return { duration: 0.6, ease: SOFT_EASE };
    case "session": return { duration: 0.28, ease: SOFT_EASE };
    case "zoom": return { duration: 0.55, ease: PUSH_EASE };
    case "unzoom": return { duration: 0.45, ease: PUSH_EASE };
    case "grow": return { duration: 0.62, ease: GROW_EASE };
  }
}

export const screenVariants: Variants = {
  initial: ({ kind, reduce, clip }: TransitionCustom) => {
    if (reduce) return { opacity: 0, zIndex: 2 };
    // clip-path, not a transform: the Brain Map's root is position:fixed,
    // and a transform on this wrapper would re-anchor it mid-animation.
    if ((kind === "zoom" || kind === "grow") && clip) return { opacity: 1, clipPath: clip.jar, zIndex: 2 };
    if (kind === "unzoom") return { opacity: 1, scale: 1.04, zIndex: 0 };
    switch (kind) {
      case "forward": return { opacity: 0, x: "6%", zIndex: 2 };
      // Going back, the destination is *under* the leaving screen.
      case "back": return { opacity: 1, x: "-4%", zIndex: 0 };
      case "tab": return { opacity: 0, zIndex: 2 };
      case "opening": return { opacity: 0, scale: 1.012, filter: "blur(6px)", zIndex: 2 };
      case "session": return { opacity: 0, scale: 0.985, zIndex: 2 };
      default: return { opacity: 0, zIndex: 2 }; // zoom without a jar rect
    }
  },
  animate: ({ kind, reduce, clip }: TransitionCustom) => ({
    opacity: 1, x: "0%", scale: 1, filter: "blur(0px)",
    ...((kind === "zoom" || kind === "grow") && clip && !reduce ? { clipPath: clip.full } : {}),
    transition: reduce ? { duration: 0.12 } : enterTransition(kind),
    // A leftover filter/transform on this wrapper would become the
    // containing block for position:fixed children (the brain map's
    // full-viewport UI), so clear them once the screen has landed.
    transitionEnd: { zIndex: 1, filter: "none", x: 0, clipPath: "none" },
  }),
  exit: ({ kind, reduce, clip }: TransitionCustom) => {
    const t = (rest: Transition): Transition => ({ ...rest, zIndex: { duration: 0 } });
    // The leaving screen must never take taps meant for the arriving one.
    const base = { pointerEvents: "none" as const };
    if (reduce) return { ...base, opacity: 0, transition: { duration: 0.12 } };
    switch (kind) {
      // Home leans in toward the jar while the map grows out of it.
      case "zoom":
        return { ...base, scale: 1.04, opacity: 1, zIndex: 1, transition: t({ duration: 0.55, ease: PUSH_EASE }) };
      // The map folds back into the jar, then dissolves into it.
      case "unzoom":
        return clip
          ? { ...base, clipPath: clip.jar, opacity: 0, zIndex: 2, transition: t({ duration: 0.45, ease: PUSH_EASE, opacity: { delay: 0.28, duration: 0.17 } }) }
          : { ...base, opacity: 0, zIndex: 2, transition: t({ duration: 0.3 }) };
      // The page you were on settles back a little as the new one opens over it.
      case "grow":
        return { ...base, scale: 0.97, opacity: 1, zIndex: 1, transition: t({ duration: 0.62, ease: GROW_EASE }) };
      case "forward":
        return { ...base, x: "-3%", zIndex: 1, opacity: 1, transition: t({ duration: 0.42, ease: PUSH_EASE }) };
      case "back":
        return { ...base, x: "10%", opacity: 0, zIndex: 2, transition: t({ duration: 0.32, ease: PUSH_EASE }) };
      // Hold fully opaque until the new screen has covered it, then drop.
      case "tab":
        return { ...base, opacity: 0, zIndex: 1, transition: t({ delay: 0.2, duration: 0.01 }) };
      case "opening":
        return { ...base, opacity: 0, zIndex: 1, transition: t({ delay: 0.35, duration: 0.3 }) };
      case "session":
        return { ...base, opacity: 0, scale: 0.99, zIndex: 1, transition: t({ duration: 0.22, ease: "easeOut" }) };
    }
  },
};
