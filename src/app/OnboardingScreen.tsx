import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { CognitiveRegion } from "./neuralBrainLayout";
import { SETTLE } from "./motionPrimitives";
import { sans } from "./typefaces";
import { Sparkle } from "@phosphor-icons/react";
import { mdAccent, mdAccentText } from "./screenTheme";
import { loadAnime } from "./animeLoader";
import { DiaryHeading, DiaryNotePaper, useLetterSeal, FutureSelfLetter } from "./diaryPaper";
import { OPENING_BG, OPENING_TEXT, OpeningBackdrop } from "./OpeningScreens";
import { PrimaryBtn } from "./screenUI";

// ── Screen 3 · Onboarding (3 short beats) ────────────────────────────────────
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
// The activation point sits in the midline gap between hemispheres (see
// the circle at cx=50/cy=44 below) — every background dot's ripple delay
// is its own distance from that point, so the wave reads as actually
// originating there and propagating outward through both hemispheres,
// not a generic stagger-by-list-order.
const BRAIN_DEMO_ACTIVATION_POINT = { x: 50, y: 44 };

function OnboardingBrainDemo() {
  const [text, setText] = React.useState("");
  const [activated, setActivated] = React.useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const reducedMotion = useReducedMotion();
  const tryIt = () => {
    if (!text.trim()) return;
    setActivated(true);
  };

  // Anime.js owns this ripple specifically because it's a radial wave over
  // 20 independent elements, each with its own distance-derived delay and a
  // two-stage opacity+scale tween — a shape of animation Motion's
  // declarative variants don't express without manually splitting into 20
  // separate motion components. Everything else in this demo (the input,
  // the "Try it" button, the tapped-node pop/ring) stays on Motion.
  //
  // Animates `scale` (a transform), not `r` — `r` is an SVG geometry
  // property that forces layout/paint on every frame across 20 elements;
  // `transform: scale()` is compositor-only. Each dot's own
  // transform-box/transform-origin (set below) is what makes that scale
  // happen around its own center instead of the shared <svg>'s origin.
  React.useEffect(() => {
    if (!activated || !svgRef.current) return;
    const dots = svgRef.current.querySelectorAll<SVGCircleElement>(".bg-dot");
    let cancelled = false;
    let animation: { cancel: () => unknown } | undefined;
    void loadAnime().then(({ animate }) => {
      if (cancelled) return;
      // Reduced motion: jump straight to the lit state and back with no
      // propagating wave (delay 0) and no eased travel (duration 0) — the
      // same "duration: reducedMotion ? 0 : …" convention this file already
      // uses in ScreenQuoteOfTheDay/OpeningStars, just applied to an
      // imperative anime.js call instead of a declarative transition prop.
      animation = animate(dots, {
        opacity: [
          { to: 0.85, duration: reducedMotion ? 0 : 260, ease: "outQuad" },
          { to: 0.28, duration: reducedMotion ? 0 : 650, ease: "inOutQuad" },
        ],
        scale: [
          { to: 1.7, duration: reducedMotion ? 0 : 260, ease: "outQuad" },
          { to: 1, duration: reducedMotion ? 0 : 650, ease: "inOutQuad" },
        ],
        // Always a function (not a reducedMotion ? 0 : fn ternary) — a union
        // between a plain number and a per-target function there confuses
        // anime.js's TweenParamValue overload resolution. `el: any` (rather
        // than `SVGCircleElement`) is deliberate too: anime's own
        // FunctionValue type expects `(target?: Target, …)` where Target is
        // a broad union, so narrowing the param type makes this function not
        // assignable to it under contravariant checking — immediately cast
        // below instead, since every real target here is in fact one.
        delay: (el: any) => {
          if (reducedMotion) return 0;
          const circle = el as SVGCircleElement;
          const dx = Number(circle.dataset.x) - BRAIN_DEMO_ACTIVATION_POINT.x;
          const dy = Number(circle.dataset.y) - BRAIN_DEMO_ACTIVATION_POINT.y;
          return Math.hypot(dx, dy) * 9; // ms per viewBox unit of distance — the wave's propagation speed
        },
      });
    }).catch(() => { /* The demo still shows its new thought without the ripple. */ });
    return () => { cancelled = true; animation?.cancel(); };
  }, [activated, reducedMotion]);

  return (
    <div style={{ width: "100%" }}>
      <svg ref={svgRef} width="100%" height="120" viewBox="0 0 100 80" style={{ display: "block" }}>
        {MINI_BRAIN_DOTS.map((d, i) => (
          <circle
            key={i}
            className="bg-dot"
            data-x={d.x}
            data-y={d.y}
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill={mdAccent}
            opacity={0.28}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        ))}
        {activated && (
          <>
            <motion.circle
              cx={50} cy={44} fill={mdAccent}
              initial={{ r: reducedMotion ? 3.2 : 0.6, opacity: reducedMotion ? 1 : 0 }}
              animate={{ r: 3.2, opacity: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
            />
            <motion.circle
              cx={50} cy={44} r={3.2} fill="none" stroke={mdAccent} strokeWidth={0.6}
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 2.8 }}
              transition={{ duration: reducedMotion ? 0 : 0.9, ease: "easeOut" }}
            />
          </>
        )}
      </svg>
      {!activated ? (
        <div style={{ marginTop: 14 }}>
          <DiaryNotePaper
            value={text} onChange={setText} onEnter={tryIt} fontSize={22} lineHeight={32}
            placeholder="Try writing anything…" ariaLabel="Try writing anything, to preview how your mind map responds"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <motion.button
              type="button" onClick={tryIt} disabled={!text.trim()} whileTap={text.trim() ? { scale: 0.94 } : undefined} transition={SETTLE}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, border: 0,
                ...sans, fontSize: 14, fontWeight: 700, cursor: text.trim() ? "pointer" : "default",
                color: text.trim() ? "#fff" : "rgba(42,38,33,0.4)",
                backgroundImage: text.trim() ? `linear-gradient(110deg, ${REGION_CONFIG.identity.color}, ${REGION_CONFIG.relationships.color}, ${REGION_CONFIG.career.color})` : "none",
                backgroundColor: text.trim() ? undefined : "rgba(42,38,33,0.08)",
                boxShadow: text.trim() ? `0 8px 18px -10px ${REGION_CONFIG.relationships.color}` : "none",
                transition: "color 0.2s, box-shadow 0.2s",
              }}
            >
              <Sparkle size={14} weight="fill" /> Try it
            </motion.button>
          </div>
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

// The diary's heading style for every intro page: a kicker in hand with a
// pen stroke drawn under it, the title set line by line with its last line
// swiped by a highlighter in that page's colour, and the body in hand.
const SLIDE_TONES: Record<string, CognitiveRegion> = { speak: "relationships", watch: "curiosity", pattern: "career" };

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
    body: "No tidy sentences needed. Try it below.",
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

// The aspiration is the point of the app (how far am I from who I want to
// be?), so it's asked right after the welcome page, before any explanation
// of how the app works. It used to be the last page, where it read as an
// optional extra and was easy to skip. Guided journals that last open the
// same way: "what matters most to you right now?" first, everything else
// built on the answer. The welcome page stays first because its "not
// therapy" notice has to land before anyone types a word. Still optional:
// leaving it blank just skips ahead.
const ASPIRATION_STEP = 1;

export function ScreenOnboarding({ initialAspiration, onSaveAspiration, onDone }: { initialAspiration?: string | null; onSaveAspiration?: (aspiration: string) => void; onDone?: () => void }) {
  const totalSteps = ONBOARDING_SLIDES.length + 1;
  const [i, setI] = React.useState(0);
  const [aspiration, setAspiration] = React.useState(initialAspiration ?? "");
  const { sealing, seal } = useLetterSeal();
  const isAspirationStep = i === ASPIRATION_STEP;
  const isLast = i === totalSteps - 1;
  const slide = isAspirationStep ? null : ONBOARDING_SLIDES[i < ASPIRATION_STEP ? i : i - 1];

  const isWelcome = slide?.kicker == null;
  // The one slide that shows instead of just telling — see
  // OnboardingBrainDemo above for why this is worth a special case rather
  // than threading a demo prop through the generic slide template used by
  // the other three.
  const isInteractive = slide?.icon === "speak";
  const backdrop = isAspirationStep ? "aspire"
    : ({ welcome: "welcome", speak: "speak", watch: "notice", pattern: "map" } as const)[slide!.icon];

  const next = () => {
    if (isLast) return onDone?.();
    const value = aspiration.trim();
    if (!isAspirationStep || !value) return setI((v) => v + 1);
    seal(() => {
      onSaveAspiration?.(value);
      setI((v) => v + 1);
    });
  };
  const label = sealing ? "Sealing…" : isLast ? "Start"
    : isAspirationStep ? (aspiration.trim() ? "Seal it" : "Skip for now")
    : i === 0 ? "Get Started" : "Next";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: OPENING_BG, overflow: "hidden", position: "relative", color: OPENING_TEXT }}>
      {/* The backdrop's palette shifts with each step (remounted per step
          so the blooms pick up the new colors). */}
      <OpeningBackdrop key={i} variant={backdrop} />
      <div style={{ display: "flex", gap: 6, position: "relative", zIndex: 1, padding: "20px 28px 0", flexShrink: 0 }}>
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div key={idx} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: idx <= i ? "rgba(42,38,33,.7)" : "rgba(42,38,33,.12)" }} />
        ))}
      </div>
      {!isAspirationStep ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            // Leaving is quick, arriving keeps its pace: under mode="wait"
            // the exit is pure delay between the tap and the next slide.
            exit={{ opacity: 0, y: -4, transition: { duration: 0.14, ease: "easeIn" } }}
            transition={{ duration: 0.38, ease: "easeOut" }}
            style={{
              flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px", position: "relative", zIndex: 1,
              alignItems: isWelcome ? "center" : "stretch", textAlign: isWelcome ? "center" : "left",
            }}
          >
            {slide!.kicker ? (
              <DiaryHeading kicker={slide!.kicker} title={slide!.title} body={slide!.body} region={SLIDE_TONES[slide!.icon] ?? "identity"} />
            ) : (
              <DiaryHeading align="center" size={36} kicker="Page one" title={slide!.title} body={slide!.body} region="identity" />
            )}
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
              <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,.42)", marginTop: 22, lineHeight: 1.6, wordBreak: "keep-all", maxWidth: 280 }}>
                Not a substitute for therapy or counseling. If what you share ever suggests you're in crisis, we'll gently connect you with real support — that's the one exception to keeping this just between you and the app.
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 28px", position: "relative", zIndex: 1, overflowY: "auto" }}>
          <div style={{ flexShrink: 0, paddingTop: 8 }}>
            <DiaryHeading kicker="Before anything else" title={"What kind of person\ndo you want to become?"} region="security"
              body="Everything you write from here gets measured against this. Optional, and you can change it anytime in Profile." />
          </div>
          <div style={{ flex: 1, minHeight: 175, display: "flex", flexDirection: "column", marginTop: 22, paddingBottom: 18 }}>
            <FutureSelfLetter autoFocus value={aspiration} onChange={setAspiration} sealed={sealing} />
          </div>
        </div>
      )}
      <div style={{ padding: "0 28px max(30px, calc(12px + env(safe-area-inset-bottom)))", flexShrink: 0, position: "relative", zIndex: 1 }}>
        <PrimaryBtn ivory tone={isAspirationStep ? "security" : slide?.kicker ? SLIDE_TONES[slide.icon] ?? "identity" : "identity"} disabled={sealing} onClick={next}>
          {label}
        </PrimaryBtn>
      </div>
    </div>
  );
}
