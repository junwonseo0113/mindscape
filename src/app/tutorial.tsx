import React from "react";
import { motion } from "motion/react";
import { sans } from "./typefaces";
import { ivSurfaceSolid, ivCardShadow, ivHeading, ivBody } from "./screenTheme";
import { PrimaryBtn } from "./screenUI";

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
  screen: "home" | "analysis" | "discoveryAnalysis" | "history";
  target: string;
  title: string;
  body: string;
  navTo?: "analysis" | "discoveryAnalysis" | "history";
};

// A lazy screen can mount after the transition starts. Observe DOM changes
// until its target appears, then remeasure after the transition and on resize.
function useTutorialTargetRect(target: string, frameRef: React.RefObject<HTMLDivElement>, screen: string) {
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number; height: number } | null>(null);
  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const el = frame.querySelector(`[data-screen="${screen}"] [data-tutorial="${target}"]`);
      if (!el) { setRect(null); return false; }
      const f = frame.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - f.top, left: r.left - f.left, width: r.width, height: r.height });
      return true;
    };
    let retry: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      if (!measure()) return;
      observer.disconnect();
      retry = setTimeout(measure, 320);
    });
    if (measure()) retry = setTimeout(measure, 320);
    else observer.observe(frame, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      clearTimeout(retry);
      window.removeEventListener("resize", measure);
    };
  }, [target, frameRef, screen]);
  return rect;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
    {
      screen: "home",
      target: "voyage-card",
      title: "Your path starts here",
      body: "Your letter sets the direction shown here. As you write, Mindscape can help you notice which moments brought you closer. You can set or change your direction anytime.",
    },
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
      title: "See your beliefs, in detail, in Mind",
      body: "The beliefs behind what you've been noticing lately, laid out in full — what connects them, and where they show up. Want to tap in and take a look?",
      navTo: "analysis",
    },
    {
      screen: "analysis",
      target: "mind-neurons",
      title: "Your confirmed beliefs, mapped",
      body: "Each belief here is a real, confirmed pattern — not everything you've ever said, just what's repeated enough to count.",
    },
    {
      screen: "analysis",
      target: "nav-discoveryAnalysis",
      title: "See why in Analysis",
      body: "This is where we walk through today's one discovery — the evidence behind it, how it's evolved, and what to do with it. Want to tap in and take a look?",
      navTo: "discoveryAnalysis",
    },
    {
      screen: "discoveryAnalysis",
      target: "today-discovery",
      title: "Today's discovery",
      body: "This is where we show you beliefs that keep repeating without you noticing. Not a diagnosis — just an observation, as-is.",
    },
    {
      screen: "discoveryAnalysis",
      target: "nav-history",
      title: "Your past thoughts, in your Diary",
      body: "They're gathered here by the date you spoke them. Want to tap in and take a look?",
      navTo: "history",
    },
    {
      screen: "history",
      target: "history-list",
      title: "Your past thoughts gather here",
      body: "You can open any of them back up whenever you're curious.",
    },
];

export function TutorialOverlay({
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
  // Moves focus to each new step's tooltip title as it appears — same
  // "screen reader announces whatever gets focus" fix as
  // ScreenCrisisSupport, applied here so a keyboard/screen-reader user
  // actually gets told a new spotlight step showed up, not just left to
  // discover it by tabbing around blind. Declared before the early return
  // below (hooks can't follow a conditional return).
  const titleRef = React.useRef<HTMLDivElement>(null);
  const showStep = screen === step.screen && rect !== null;
  React.useEffect(() => {
    if (showStep) titleRef.current?.focus();
  }, [showStep, step.target]);
  const skip = (
      <motion.span
        role="button" tabIndex={0} onClick={onSkip} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onSkip)?.(); } }} whileTap={{ opacity: 0.6 }}
        style={{
          position: "absolute", top: 16, right: 16, ...sans, fontSize: 12, fontWeight: 600, color: "#fff",
          backgroundColor: "rgba(24,20,18,0.85)", padding: "6px 12px", borderRadius: 999, cursor: "pointer",
          pointerEvents: "auto",
        }}
      >
        Skip {stepIndex + 1}/{totalSteps}
      </motion.span>
  );
  if (screen !== step.screen) return null;
  if (!rect) return <div style={{ position: "absolute", inset: 0, zIndex: 300, pointerEvents: "none" }}>{skip}</div>;

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
          borderRadius: 18, border: `2px solid ${ivHeading}`, boxShadow: "0 0 0 5px rgba(42,38,33,0.14)",
          pointerEvents: "none",
        }}
      />

      {skip}

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
          backgroundColor: ivSurfaceSolid, borderRadius: 18, padding: "18px 20px", boxShadow: ivCardShadow,
          pointerEvents: "auto",
        }}
      >
        <div ref={titleRef} tabIndex={-1} style={{ ...sans, fontSize: 11, fontWeight: 700, color: ivHeading, letterSpacing: "0.04em", outline: "none" }}>{step.title}</div>
        <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>{step.body}</div>
        <div style={{ marginTop: 16 }}>
          <PrimaryBtn onClick={onNext} ivory>{isLast ? "Get started" : step.navTo ? "Tap to check it out" : "Next"}</PrimaryBtn>
        </div>
      </motion.div>
    </div>
  );
}
