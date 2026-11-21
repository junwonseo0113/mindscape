import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { CognitiveRegion } from "./neuralBrainLayout";
import { Node } from "./orb";
import { DiaryOpening } from "./DiaryOpening";
import { display, hand } from "./typefaces";
import { ivBg2, ivBackground, ivHeading, ivBody } from "./screenTheme";

// ── Screen 0 · Quote of the Day ────────────────────────────────────────────────
// This deliberately lives before the branded splash instead of on Home. The
// old Home quote block competed with the hero photograph, while the opening
// beat gives the quote its own quiet moment without adding permanent UI.
// Selection is based on the user's local calendar date, so reopening the app
// on the same day shows the same line and the quote naturally turns over at
// midnight without needing persistence or another store field.
const DAILY_QUOTES = [
  { text: "We don't see things as they are, we see them as we are.", author: "Anaïs Nin" },
  { text: "The privilege of a lifetime is to become who you truly are.", author: "Carl Jung" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "Life can only be understood backwards; but it must be lived forwards.", author: "Søren Kierkegaard" },
  { text: "The quieter you become, the more you are able to hear.", author: "Rumi" },
  { text: "What you seek is seeking you.", author: "Rumi" },
  { text: "I am rooted, but I flow.", author: "Virginia Woolf" },
  { text: "One does not become enlightened by imagining figures of light, but by making the darkness conscious.", author: "Carl Jung" },
  { text: "The curious paradox is that when I accept myself just as I am, then I can change.", author: "Carl Rogers" },
  { text: "Your vision will become clear only when you can look into your own heart.", author: "Carl Jung" },
  { text: "The only journey is the one within.", author: "Rainer Maria Rilke" },
  { text: "There is no greater agony than bearing an untold story inside you.", author: "Maya Angelou" },
] as const;

function getDailyQuote(now = new Date()) {
  // Local midnight is intentional: "today" should follow the person's day,
  // not UTC, especially around late evening / early morning app opens.
  const localDayNumber = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
  return DAILY_QUOTES[((localDayNumber % DAILY_QUOTES.length) + DAILY_QUOTES.length) % DAILY_QUOTES.length];
}

export function ScreenQuoteOfTheDay({ onDone }: { onDone?: () => void }) {
  const quote = React.useMemo(() => getDailyQuote(), []);
  const reducedMotion = useReducedMotion();
  // A different ink each day, following the quote.
  const quoteTone = REGION_CONFIG[(["identity", "relationships", "curiosity", "career", "security", "creativity"] as CognitiveRegion[])[DAILY_QUOTES.indexOf(quote) % 6]];

  React.useEffect(() => {
    const t = setTimeout(() => onDone?.(), reducedMotion ? 2600 : 3600);
    return () => clearTimeout(t);
  }, [onDone, reducedMotion]);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label="Quote of the day. Continue"
      onClick={onDone}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDone?.();
        }
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.7, ease: "easeOut" }}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        ...ivBackground,
        color: ivHeading,
        padding: "44px 30px 34px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <OpeningBackdrop variant="quote" />
      <div style={{ zIndex: 1, display: "inline-flex", flexDirection: "column", alignSelf: "flex-start" }}>
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : .65, delay: reducedMotion ? 0 : .15 }}
          style={{ ...hand, fontSize: 23, fontWeight: 600, color: quoteTone.ink, lineHeight: 1.1 }}
        >
          Today's quote
        </motion.div>
        <svg width="100%" height="10" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden style={{ display: "block", marginTop: 2, overflow: "visible" }}>
          <motion.path d="M1 6 C 20 2.5, 38 8.5, 56 5 S 86 3, 99 5.5" fill="none" stroke={quoteTone.color} strokeWidth={2.4} strokeLinecap="round"
            vectorEffect="non-scaling-stroke" initial={{ pathLength: reducedMotion ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reducedMotion ? 0 : 0.6, delay: reducedMotion ? 0 : 0.3 }} />
        </svg>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", zIndex: 1 }}>
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : .9, delay: reducedMotion ? 0 : .35, ease: "easeOut" }}
          style={{ width: "100%", transform: "translateY(-2%)" }}
        >
          <div style={{ ...display, fontSize: 28, lineHeight: 1.42, letterSpacing: "-.015em", color: ivHeading, wordBreak: "keep-all" }}>
            {/* A highlighter over every line of the quote: an inline span
            whose background is cloned onto each wrapped line, grown from
            0 to full width. */}
            <motion.span
              initial={{ backgroundSize: reducedMotion ? "100% 100%" : "0% 100%" }}
              animate={{ backgroundSize: "100% 100%" }}
              transition={{ duration: reducedMotion ? 0 : 1.1, delay: reducedMotion ? 0 : 1.0, ease: [0.22, 1, 0.36, 1] }}
              style={{
                backgroundImage: `linear-gradient(transparent 58%, ${quoteTone.color}4d 58%, ${quoteTone.color}33 92%, transparent 92%)`,
                backgroundRepeat: "no-repeat", WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone", padding: "0 2px",
              }}
            >
              “{quote.text}”
            </motion.span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
            <svg width="30" height="8" viewBox="0 0 30 8" aria-hidden><path d="M1 4.5 C 8 1.5, 14 7, 21 3.5 S 27 3, 29 4" fill="none" stroke={quoteTone.color} strokeWidth="2" strokeLinecap="round" /></svg>
            <span style={{ ...hand, fontSize: 22, fontWeight: 600, color: quoteTone.ink }}>{quote.author}</span>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: .42 }}
        transition={{ duration: reducedMotion ? 0 : .6, delay: reducedMotion ? 0 : 1.25 }}
        style={{ ...hand, fontSize: 19, fontWeight: 500, textAlign: "center", zIndex: 1 }}
      >
        Tap anywhere to continue
      </motion.div>
    </motion.div>
  );
}

// Opening flow (quote/splash/auth/login/signup/onboarding) used to be its
// own dark-navy-and-purple theme, visually unrelated to the ivory canvas
// every screen past it renders on — these three now just alias the ivory
// tokens so the whole pre-Home experience is one continuous palette
// instead of a jarring hand-off at "Browse as a guest". OpeningStars (the
// white starfield that used to run under all six of these) is gone for
// the same reason: a starfield only reads correctly on a dark sky, and
// Brain Map is the one screen that still has one.
export const OPENING_BG = ivBg2;
export const OPENING_TEXT = ivHeading;
export const OPENING_MUTED = ivBody;

// ── Opening backdrop ─────────────────────────────────────────────────────────
// The first screens (quote, splash, auth, login, sign-up, onboarding) were
// flat ivory with text in the middle — calm, but lifeless, and identical to
// each other. Behind each one now: a slow aurora in the app's own region
// colors (three soft blooms drifting on long, out-of-step loops), and a
// few small orbs of light floating near the edges, away from the text.
// Each screen gets its own palette, so moving through them feels like
// moving through a dawn rather than past the same wall. Pure CSS
// transforms (styles/index.css: .aurora, .float-drift), off under reduced
// motion; pointer-events none, so it never takes a tap.
type OpeningVariant = "quote" | "splash" | "auth" | "form" | "welcome" | "speak" | "notice" | "map" | "aspire";
const OPENING_PALETTES: Record<OpeningVariant, [CognitiveRegion, CognitiveRegion, CognitiveRegion]> = {
  quote: ["career", "relationships", "creativity"],
  splash: ["identity", "curiosity", "relationships"],
  auth: ["identity", "relationships", "career"],
  form: ["curiosity", "security", "identity"],
  welcome: ["relationships", "career", "identity"],
  speak: ["creativity", "relationships", "career"],
  notice: ["career", "security", "curiosity"],
  map: ["identity", "curiosity", "security"],
  aspire: ["security", "career", "curiosity"],
};
// Blooms: where each sits (% of the screen) and which way it wanders.
const AURORA_BLOOMS = [
  { left: "-30%", top: "-18%", size: 420, dx: "38px", dy: "26px", dur: "26s" },
  { left: "48%", top: "28%", size: 380, dx: "-44px", dy: "34px", dur: "31s" },
  { left: "-12%", top: "66%", size: 400, dx: "30px", dy: "-40px", dur: "23s" },
];
// Orbs: only in the top and bottom bands and at the very side edges —
// places no line of text on these screens ever reaches.
const OPENING_ORBS = [
  { left: "46%", top: "2%", size: 12, fx: "10px", fy: "8px", dur: "15s" },
  { left: "84%", top: "6%", size: 10, fx: "-12px", fy: "8px", dur: "18s" },
  { left: "95%", top: "38%", size: 14, fx: "-6px", fy: "14px", dur: "21s" },
  { left: "-2%", top: "68%", size: 11, fx: "8px", fy: "-10px", dur: "17s" },
  { left: "91%", top: "96%", size: 12, fx: "-10px", fy: "-6px", dur: "19s" },
]

export function OpeningBackdrop({ variant }: { variant: OpeningVariant }) {
  const palette = OPENING_PALETTES[variant];
  // Out-of-step start points, fixed per mount.
  const delays = React.useMemo(() => AURORA_BLOOMS.map(() => `-${(Math.random() * 20).toFixed(1)}s`).concat(OPENING_ORBS.map(() => `-${(Math.random() * 15).toFixed(1)}s`)), []);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {AURORA_BLOOMS.map((b, i) => (
        <div
          key={`b${i}`} className="aurora"
          style={{
            position: "absolute", left: b.left, top: b.top, width: b.size, height: b.size, borderRadius: "50%",
            backgroundImage: `radial-gradient(circle, ${REGION_CONFIG[palette[i]].color}55 0%, ${REGION_CONFIG[palette[i]].color}1f 40%, transparent 68%)`,
            transition: "background-image 0.8s ease",
            ["--dx" as string]: b.dx, ["--dy" as string]: b.dy, ["--dur" as string]: b.dur, ["--delay" as string]: delays[i],
          } as React.CSSProperties}
        />
      ))}
      {OPENING_ORBS.map((o, i) => (
        <div
          key={`o${i}`} className="float-drift"
          style={{
            position: "absolute", left: o.left, top: o.top,
            ["--fx" as string]: o.fx, ["--fy" as string]: o.fy, ["--dur" as string]: o.dur, ["--delay" as string]: delays[AURORA_BLOOMS.length + i],
          } as React.CSSProperties}
        >
          <Node color={REGION_CONFIG[palette[i % palette.length]].color} size={o.size} intensity={0.6} />
        </div>
      ))}
    </div>
  );
}

// "There's a pattern in your thinking," drawn: six orbs of light appear
// one by one, then the lines between them draw in, the way a pattern
// becomes visible only once enough points are there to connect. After
// that they keep breathing. Used on the splash (where it has to finish
// inside the 2.2s auto-advance) and the auth screen.
const CONSTELLATION_POINTS: { x: number; y: number; r: CognitiveRegion; s: number }[] = [
  { x: 40, y: 92, r: "identity", s: 9 },
  { x: 92, y: 40, r: "career", s: 7 },
  { x: 150, y: 70, r: "relationships", s: 10 },
  { x: 206, y: 34, r: "curiosity", s: 7 },
  { x: 232, y: 104, r: "security", s: 8 },
  { x: 120, y: 122, r: "creativity", s: 6 },
];
const CONSTELLATION_LINKS: [number, number][] = [[0, 1], [1, 2], [2, 3], [2, 4], [0, 5], [5, 2]];

export function PatternConstellation({ speed = 1, width = 272 }: { speed?: number; width?: number }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const t = (sec: number) => (reduce ? 0 : sec * speed);
  return (
    <svg aria-hidden viewBox="0 0 272 150" width={width} style={{ display: "block", overflow: "visible" }}>
      <defs>
        {CONSTELLATION_POINTS.map((p, i) => (
          <radialGradient key={i} id={`cg${id}${i}`}>
            <stop offset="0" stopColor="#FFFFFF" /><stop offset="0.35" stopColor={REGION_CONFIG[p.r].color} /><stop offset="1" stopColor={REGION_CONFIG[p.r].color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {CONSTELLATION_LINKS.map(([a, b], i) => {
        const A = CONSTELLATION_POINTS[a];
        const B = CONSTELLATION_POINTS[b];
        return (
          <motion.line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#2A2621" strokeOpacity="0.28" strokeWidth="1.2" strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: t(0.4), delay: t(0.75 + i * 0.12), ease: [0.22, 1, 0.36, 1] }} />
        );
      })}
      {CONSTELLATION_POINTS.map((p, i) => (
        <motion.g key={i} style={{ transformOrigin: `${p.x}px ${p.y}px` }}
          initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.4 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: t(0.45), delay: t(i * 0.1), ease: [0.22, 1, 0.36, 1] }}>
          <motion.circle cx={p.x} cy={p.y} r={p.s * 2.4} fill={`url(#cg${id}${i})`}
            animate={reduce ? undefined : { scale: [1, 1.15, 1] }} transition={reduce ? undefined : { duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 1.4 + i * 0.4 }}
            style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
          <circle cx={p.x} cy={p.y} r={p.s * 0.55} fill={REGION_CONFIG[p.r].color} />
        </motion.g>
      ))}
    </svg>
  );
}

// ── Screen 1 · Splash: the diary opening ──────────────────────────────────────
// The app opens as a diary: the closed "Mindscape" book, its cover
// swinging open (DiaryOpening.tsx), and this first page — the date, the
// pattern drawing itself, and the line the app is built on. Then the view
// falls into the page and the quote of the day follows on the same ivory.
export function ScreenSplash({ onDone }: { onDone?: () => void }) {
  const reduce = useReducedMotion();
  const dateline = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0 : 0.5, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] as const },
  });
  return (
    <DiaryOpening
      onDone={onDone}
      backdrop={<OpeningBackdrop variant="splash" />}
      page={
        <>
          <motion.div {...rise(0)} style={{ ...hand, fontSize: 19, fontWeight: 500, color: REGION_CONFIG.identity.ink }}>{dateline}</motion.div>
          <div style={{ marginTop: 22 }}><PatternConstellation speed={0.55} width={196} /></div>
          <motion.div {...rise(0.75)} style={{ ...display, fontSize: 25, lineHeight: 1.2, color: ivHeading, marginTop: 20 }}>
            There's a pattern in your thinking.
          </motion.div>
          <motion.div {...rise(1.05)} style={{ ...hand, fontSize: 20, lineHeight: 1.3, color: ivBody, marginTop: 10 }}>
            You just can't see it from the inside.
          </motion.div>
        </>
      }
    />
  );
}
