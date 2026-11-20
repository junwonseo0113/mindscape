import React from "react";
import { motion, AnimatePresence, MotionConfig, useReducedMotion, useTransform, useDragControls } from "motion/react";
import { animate, stagger } from "animejs";
// Every full-bleed screen photo this file used to import (home-hero/mind-
// scene/mind-notebook(-yellowknife)/analysis-dusk-coast/unconscious-
// patterns-bg/drift-arctic-dusk) is gone — see the ivory redesign pass.
// Nothing replaces them as background images; the node field/constellation
// itself (JarBrainPreview/NeuralBeliefGraph3D, both untouched — same real
// belief data, same buildActiveNodes/region colors/glow as the full Brain
// Map) and the shared ivory canvas (ivBackground, defined below) carry the
// screens instead. authorAnaisNinImg is the one image import that
// survives: the existing Literary Reflection author portrait, explicitly
// preserved as-is.
import { REGION_CONFIG, resolveRegion, recencyFromDate } from "./brainRegions";
import authorAnaisNinImg from "../assets/author-anais-nin.png";
import { CognitiveRegion, COGNITIVE_REGIONS } from "./neuralBrainLayout";
import {
  LanguageObservation,
  Store,
  StoredAccount,
  StoredAssumption,
  StoredBelief,
  StoredConnection,
  StoredEvidenceQuote,
  StoredGoal,
  StoredHistoryEntry,
  StoredHypothesis,
  StoredSettings,
  emptyStore,
} from "./types";
import { formatDateDots, mondayOfWeek, parseDotDate, relativeDayLabel, relativeInsightLabel, shortMonthDay, weekdayFromDotDate } from "./dateUtils";
import { appendMoodCheckIn, appendUnanalyzedEntry, isMoodCheckIn, mergeAnalysisIntoStore, recentMoodContext, type RecentMood } from "./realStore";
import { detectCrisisSignal } from "./crisisDetection";
import { isCloudSyncConfigured } from "./supabaseClient";
import { useScreenTransitionKind, screenVariants, canSwipeBack, type TransitionCustom, type TransitionKind } from "./screenTransitions";
import { useSwipeBack, useScrollMemory } from "./navGestures";
import { AnimatedNumber, Breathe, Collapse, MeterFill, RevealGroup, RevealItem, SETTLE } from "./motionPrimitives";
import { Node } from "./orb";
import { DiaryOpening } from "./DiaryOpening";
import { HomeOrbField } from "./HomeOrbField";
import { display, hand, mono, MONO_FAMILY, sans, serif } from "./typefaces";
// Icons: Phosphor (MIT) — one open-source set at one stroke weight in place
// of the hand-drawn SVGs that used to vary in grid and line width from
// screen to screen. Active nav icons use the "fill" weight, outlined when
// inactive, the way Material 3's navigation bar marks the current tab.
import {
  ArrowCounterClockwise, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, ArrowsClockwise, BellSimple, BookOpen, CalendarBlank, CaretDown, CaretRight, ChartLineUp, ChatCircleText, Check, Clock, Compass, EnvelopeSimple, EyeSlash, Key, PenNib, UserCircle, CreditCard, Minus,
  DownloadSimple, Eye, Feather, FileText, Flask, Footprints, Funnel, Graph, HandWaving, House, Lightbulb, Lightning, LockSimple, MagnifyingGlass, Microphone, PaintBrush, Path, Question, Quotes, ShareNetwork,
  ShieldCheck, Smiley, Sparkle, User, UsersThree, Waveform, X,
} from "@phosphor-icons/react";
import { cloudDeleteAccount, cloudSignIn, cloudSignOut, cloudSignUp } from "./cloudSync";
import { AI_CONSENT_COPY, AI_CONSENT_VERSION, AiConsentContext, hasAiConsent, isKoreanLocale, needsAiConsentDecision } from "./aiConsent";
import { hashLocalPassword, isHashedPassword, verifyLocalPassword } from "./localPassword";
import { useAppData } from "./dataProvider";
import { COGNITIVE_PATTERN_DESCRIPTIONS, COGNITIVE_PATTERN_REFLECTIONS, DISCLAIMER_NOTICE, GENERIC_PATTERN_REFLECTION, findBeliefClusters, findContradictionPairs, isLikelyRuminating, matchableCandidates } from "./analysisFramework";
import { eligiblePassages, resolveLiterarySelection, sanitizeLiterarySelections, buildWhyThisFoundYou, type LiteraryTarget } from "./literaryPassages";
import { comparePronounLean, compareCognitiveVerbTrend, extractCognitiveVerbExamples } from "./cognitiveLexicon";
import { pickInputGuidance } from "./inputGuidance";

// ── 3D, loaded off the startup path ──────────────────────────────────────────
// three.js + react-three-fiber, plus the brain-cloud generation that runs at
// module load, used to be in the one startup bundle — parsed and executed
// while the quote screen was trying to fade in. They're now separate chunks:
// the sky is fetched in the background shortly after launch (see preload3D
// in App); three.js loads only when a screen that still uses it opens.
const load3D = () => import("./NeuralBeliefGraph3D");
const loadBrainMap = () => import("./StarGazeMap");
// The swipe-back "screen underneath" (see peekContent in App) re-mounts a
// cached screen for the length of a gesture. Everything in a screen is
// cheap to re-mount except a WebGL canvas: creating a GL context and its
// textures mid-drag is exactly the kind of work that makes the first frames
// of a swipe stutter. So the 3D views render nothing while they're only
// being peeked at — the rest of the screen still shows through.
const PeekContext = React.createContext(false);
function skipWhilePeeking<P extends object>(Comp: React.LazyExoticComponent<React.ComponentType<P>>) {
  return function PeekAware(props: P) {
    return React.useContext(PeekContext) ? null : <Comp {...(props as any)} />;
  };
}
const NeuralBeliefGraph3D = skipWhilePeeking(React.lazy(load3D));
const BrainNodeMapScreen = skipWhilePeeking(React.lazy(loadBrainMap));
// Only the sky is preloaded now: Home's orbs are plain HTML (HomeOrbField),
// so three.js is fetched only when a screen that still uses it opens.
function preload3D() { void loadBrainMap(); }

// ── Launch config ────────────────────────────────────────────────────────────
// Off for the initial launch: gathering real usage/feedback matters more
// right now than revenue, so every screen behaves as if every account were
// Pro — full analysis, Brain Map, hypotheses, drift, all of it, for free.
// The entire Pro/paywall/checkout/subscription-management system underneath
// this flag is fully built and untouched (see ScreenPaywall, ScreenCheckout,
// ScreenManageSubscription, PRO_PLANS below, and appendUnanalyzedEntry in
// realStore.ts) — flipping this back to true is the only change needed to
// re-enable it later. Every gate below reads MONETIZATION_ENABLED, never
// store.isPro directly, specifically so this one flag is a real kill switch
// and not just one of several places that would need to change together.
const MONETIZATION_ENABLED = false;

const DAILY_REMINDER_LAST_FIRED_KEY = "mijeong.lastDailyReminderFiredDate";
const WEEKLY_SUMMARY_LAST_FIRED_KEY = "mijeong.lastWeeklySummaryFiredDate";

// ── Design tokens ─────────────────────────────────────────────────────────────
// A quiet, editorial palette — this app's job is to reveal patterns calmly,
// not to alarm or entertain. Warm paper background, plum as the single
// "insight" accent color (used only for AI-surfaced observations, nowhere
// else), so its appearance always means "the AI noticed something."
const ink = "#1C1B1F";
const inkSoft = "#403E45";
const mid = "#6E6B74";
const subtle = "#706c78"; // 4.5:1 on surface
const faint = "#C4C1C9";
const hair = "rgba(28,27,31,0.09)";
const surface = "#F4F1EC";
const page = "#FFFFFF";
const accent = "#5B4B8A";
const accentSoft = "#F0EDF8";
const tension = "#B5533C";
const tensionSoft = "rgba(181,83,60,0.08)";
// Apple-style "grouped list" elevation for cards sitting on the surface-tinted
// Analysis screen — a soft two-layer shadow instead of a border, so cards
// read as raised without needing a harder edge.
const cardShadow = "0 1px 2px rgba(28,27,31,0.05), 0 6px 18px rgba(28,27,31,0.045)";

// ── Dark theme — Home, Analysis, History, Profile, per the imported
// design spec (claude.ai/design project "Design spec for analysis page":
// Home/Analysis/History/Profile screens.dc.html). Every other screen
// (onboarding, login, think-out-loud, etc.) still uses the light palette above — those weren't
// part of this import.
const dkBg = "#0a0716";
const dkCard = "#14101f";
const dkCardBorder = "rgba(150,120,255,0.10)";
const dkCardShadow = "0 8px 24px rgba(0,0,0,0.35)";
const dkHeading = "#F2EEFA";
const dkBody = "#8b83a3";
const dkBodyLight = "#E8E3F5";
const dkAccent = "#7B5CF0";
const dkAccentLight = "#B39CFF";
const dkAccentSoft = "rgba(123,92,240,0.14)";
const dkAccentTag = "rgba(123,92,240,0.22)";
const dkAccentTagText = "#D6C8FF";
const dkTrack = "#241c38";
const dkWarn = "#D98A4A";
const dkWarnSoft = "rgba(224,138,74,0.14)";
const dkWarnTag = "rgba(224,138,74,0.22)";
const dkWarnTagText = "#F0B78A";
const dkWarnLabel = "#b9682f"; // 4.5:1 on dkCard
const dkDivider = "rgba(150,120,255,0.14)";
// History/Profile only — a faint scattered-star texture behind the flat dark
// background, straight from those two files' <style> block.
const dkStarfield: React.CSSProperties = {
  backgroundColor: dkBg,
  backgroundImage: [
    "radial-gradient(1.4px 1.4px at 12% 18%, rgba(255,255,255,.55), transparent 60%)",
    "radial-gradient(1px 1px at 32% 68%, rgba(255,255,255,.35), transparent 60%)",
    "radial-gradient(1.6px 1.6px at 55% 12%, rgba(200,180,255,.5), transparent 60%)",
    "radial-gradient(1px 1px at 72% 45%, rgba(255,255,255,.4), transparent 60%)",
    "radial-gradient(1.3px 1.3px at 88% 78%, rgba(180,150,255,.45), transparent 60%)",
    "radial-gradient(1px 1px at 8% 82%, rgba(255,255,255,.3), transparent 60%)",
    "radial-gradient(1.2px 1.2px at 95% 22%, rgba(255,255,255,.4), transparent 60%)",
  ].join(","),
  backgroundSize: "420px 420px",
  backgroundRepeat: "repeat",
};

// Type: see typefaces.ts for the five roles (display, hand, serif, sans, mono).
// Type scale — every fontSize in this file sits on one of these steps:
//   11  12  13  15  17  20  22  24  28  34
// They are iOS Dynamic Type's default sizes (caption2 → largeTitle), the
// scale a phone's own UI already uses around this app. Nothing renders
// below 11px. If a size you want isn't on the scale, the next step is;
// the half-point sizes that used to live here (11.5, 12.5, 13.5, 14.5)
// were tuning, not hierarchy.

// ── Modernist theme — per the imported claude.ai/design "Modernist" design
// system (project 18c81e97, Undecided - Modernist redesign.dc.html): a light,
// architectural mono-red-on-white palette replacing the dk* dark theme.
// Values are the design system's own CSS custom properties resolved to
// literal strings (styles.css: --color-bg/--color-text/--color-accent and
// their OKLCH tonal ramps) — this app has no external stylesheet, so every
// screen reads these as plain inline-style constants instead of `.tag`/
// `.btn` classes, same convention as the old dk* tokens.
const mdBg = "#f3f2f2";
const mdCard = "#ffffff";
const mdCardShadow = "0 1px 2px rgba(45,43,43,0.14)";
const mdCardShadowLg = "0 12px 32px rgba(45,43,43,0.22)";
const mdHeading = "#201e1d";
const mdBody = "rgba(32,30,29,0.62)";
const mdBodyLight = "rgba(32,30,29,0.85)";
const mdFaint = "rgba(32,30,29,0.48)"; // 3:1 on mdBg — large text and UI only
const mdAccent = "#ec3013";
const mdAccentHover = "#dd2b0f";
const mdAccentText = "#ae1800"; // deep ramp step — the design system's own rule for accent-colored body/paragraph text (the accent itself is only 3:1 against this ground, not enough for small text)
const mdAccentSoft = "#fff2ef";
const mdAccentTag = "#ffe0d9";
const mdAccentTagText = "#7c1405";
const mdTrack = "#d7d3d3";
const mdDivider = "rgba(32,30,29,0.14)";
const mdNeutralTag = "#f8f4f4";
const mdNeutralTagText = "#444141";
// Warn ramp — a distinct muted amber (not the red accent) for "conflicting
// evidence"/caution states, same relationship dkWarn has to dkAccent in the
// dark theme: a second, clearly different hue reserved for that one job,
// never competing with the mono-red accent everywhere else.
const mdWarn = "#a85a1a";
const mdWarnSoft = "rgba(168,90,26,0.10)";
const mdWarnTag = "rgba(168,90,26,0.14)";
// The Analysis tab's paper-and-desk redesign — ink colors for text that
// sits directly on the physical paper assets (discovery-paper/insight-card),
// deliberately warm brown rather than mdHeading's neutral near-black so it
// reads as actually written on old paper. mdAccentText (already the
// design system's own toned-down red ramp step, not the bright mdAccent)
// is reused as-is for the one restrained red accent this screen keeps.
const paperInk = "#2e2013";
const paperInkMuted = "rgba(46,32,19,0.68)";
const paperAccent = mdAccentText;
const mdWarnTagText = "#7a4310";
const mdWarnLabel = "#7a4310";

// ── Vintage theme — Home only, ported from a photographed-jar mockup: a
// warm sepia still life (an empty bell jar, dried flowers, old books) fills
// the whole top of the screen as one photo. Every value here was sampled
// directly from that photo (not invented) so the real text overlaid on top
// of it — date, headline, belief/connection counts — sits on colors that
// actually belong to the image behind it.
const vtgDusk = "#241a10"; // dark wood desk, bottom of the frame
const vtgInk = "#1c1108"; // headline/body text sitting on the photo's cream half
const vtgInkMuted = "#5c4c3a"; // secondary text on the photo's cream half
const vtgAccent = "#9c1c0e"; // date stamp, record icon, active nav item
const vtgCream = "#f3ead9"; // headings sitting on the dark half
const vtgCreamMuted = "rgba(243,234,217,0.62)"; // secondary text on the dark half
const vtgCard = "#ddccb7"; // the two floating tan cards (CTA + nav)
const vtgCardShadow = "0 10px 28px rgba(0,0,0,0.35)";

// ── Ivory design system ──────────────────────────────────────────────────────
// The one shared visual language for Home/Mind/Analysis/History/Profile,
// replacing the old per-screen photographic backdrops (the vintage jar/
// desk/night-study/arctic-dusk photos above, mind-scene.webp, the dark
// navy Premium surfaces, Profile's stark white-and-red Modernist theme)
// with a single quiet warm-ivory canvas. The principle this whole redesign
// pass follows: the interface is quiet, the user's own belief nodes (see
// the Node component) provide the color — so every token here stays
// deliberately restrained (warm neutrals, deep charcoal, muted taupe),
// with no accent color of its own. Where a screen still needs an "active/
// selected" indication (nav, toggles), it's ivHeading itself — charcoal,
// never a saturated hue — not a substitute accent color.
const ivBg2 = "#F2EEE6";
// Used to be a three-layer radial/linear gradient wash — the single most
// common tell of a generated page (a soft gradient ground behind every
// screen). One flat tone reads as decided; a gradient reads as a default
// nobody chose.
// Diary paper: a fine grain (fractal noise, tiled) and a faint warm
// darkening toward the edges, the way a page catches less light near its
// margins. Both are a few percent strong — felt more than seen.
const PAPER_GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.28 0 0 0 0 0.2 0 0 0 0.09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")";
const ivBackground: React.CSSProperties = {
  backgroundColor: ivBg2,
  backgroundImage: `${PAPER_GRAIN}, radial-gradient(ellipse 120% 90% at 50% 40%, rgba(255,252,245,0.55) 0%, rgba(255,252,245,0) 60%, rgba(160,130,90,0.10) 100%)`,
  backgroundSize: "180px 180px, 100% 100%",
};
const ivSurface = "rgba(255,253,248,0.66)"; // restrained translucent card fill over the ivory base
const ivSurfaceSolid = "#FBF8F2"; // for a card that needs to sit fully opaque above dense content
// Used to be a soft 28px/10%-opacity drop shadow on every resting card —
// another generated-page tell (shadows belong to things that float: a
// menu, a dialog, not a card sitting flush on the page). A zero-blur,
// zero-offset box-shadow reads as a crisp hairline border instead, without
// touching any of this token's ~15 call sites or their box layout.
const ivCardShadow = "0 0 0 1px rgba(42,38,33,0.08)";
// Material 3 shape scale (dp): small controls 12, cards 16, containers 20,
// sheets and the nav bar 28, chips full. Picking from a scale, not per
// element, is what makes a screen of boxes read as one family.
const shape = { xs: 8, sm: 12, md: 16, lg: 20, xl: 28, full: 999 } as const;
// M3 tonal surfaces for the ivory theme: things that float *over* the
// canvas (a chip, a popover card) sit one tier lighter than cards that
// rest on it — elevation by tone, not by heavier shadows.
const ivSurfaceHigh = "#FFFFFF";
const ivBorder = "rgba(42,38,33,0.08)";
const ivHeading = "#2A2621"; // deep charcoal — never pure black, never a saturated accent
const ivBody = "rgba(42,38,33,0.65)"; // muted taupe-gray — 4.5:1 on ivBg2, the floor for body text
const ivFaint = "rgba(42,38,33,0.5)"; // 3:1 on ivBg2 — large text, icons and chevrons only, never a sentence
const ivDivider = "rgba(42,38,33,0.1)";

// ── Shared primary-screen header system ─────────────────────────────────────
// Mind, Analysis, and History all position, size, and space their title and
// subtitle from these same values instead of each eyeballing its own — see
// the cross-screen consistency pass. Home keeps its own unique hero
// treatment (it's the landing screen, not part of this shared system).
// Kept as shared VALUES rather than a shared component: each screen's
// header sits in a structurally different context (Mind: absolute over a
// fixed scene; Analysis/History: the top of a flex/scroll column), so
// literally sharing a component risked restructuring more of each screen
// than this consistency pass calls for.
const PRIMARY_HEADER_TOP = 34; // px down from each screen's own full-bleed top edge
const PRIMARY_HEADER_SIDE = 30; // px — same left/right grid every primary screen's own body content already uses
// "Deep charcoal / muted taupe / quieter taupe" — the three text weights
// every primary screen's header should be drawn from, instead of each
// screen's header nudging its own slightly different shade. Was cream-on-
// photo with a drop shadow for legibility; now flat ivory needs neither —
// dark ink on a light ground reads on its own.
const HEADER_TEXT_PRIMARY = ivHeading;
const HEADER_TEXT_SECONDARY = ivBody;
const HEADER_TEXT_TERTIARY = ivFaint;
const primaryTitleStyle: React.CSSProperties = { ...display, fontSize: 34, lineHeight: 1.05, color: HEADER_TEXT_PRIMARY };
// whiteSpace/overflow/textOverflow is a safety net, not the primary fix —
// every subtitle string itself was shortened to comfortably fit one line;
// this just guarantees it can never wrap even if a header's control row
// leaves less room than expected.
const primaryTitleSubtitleStyle: React.CSSProperties = { ...hand, fontSize: 19, fontWeight: 500, color: HEADER_TEXT_SECONDARY, marginTop: 2, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

// ── Status bar ────────────────────────────────────────────────────────────────
function StatusBar({ modernist }: { modernist?: boolean }) {
  const color = modernist ? mdHeading : dkHeading;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 4px", flexShrink: 0 }}>
      <span style={{ ...sans, fontSize: 13, fontWeight: modernist ? 800 : 600, color }}>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 16, height: 10, border: `1px solid ${color}`, borderRadius: 2, position: "relative" }}>
          <div style={{ position: "absolute", inset: 1, right: 4, backgroundColor: color, borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

// Same parallel-session port as NavIcon below — a small waveform glyph for
// Home's "Speak your mind" button, replacing the plain dot with something that
// actually reads as "speak/record."
function WaveformIcon({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return <Waveform size={size} color={color} weight="bold" />;
}

// Real line icons for the bottom nav, ported from the friend's parallel
// session (odysseyof26's 8580f53) — a clear upgrade over the earlier
// colored-square/dot placeholders, with no functional conflict, so it's
// merged in on its own rather than picking one whole branch over the other.
function NavIcon({ id, color, size = 23, active = false }: { id: string; color: string; size?: number; active?: boolean }) {
  const weight = active ? "fill" : "regular";
  if (id === "home") return <House size={size} color={color} weight={weight} />;
  if (id === "analysis") return <Graph size={size} color={color} weight={weight} />;
  if (id === "history") return <BookOpen size={size} color={color} weight={weight} />;
  if (id === "discoveryAnalysis") return <Lightbulb size={size} color={color} weight={weight} />;
  return <User size={size} color={color} weight={weight} />;
}

// ── Bottom navigation ─────────────────────────────────────────────────────────
// `dark` matches the imported design spec's nav (blurred near-black bar) —
// only Home/Analysis pass it; every other screen keeps the light bar. Both
// variants share the ported NavIcon set and the animated sliding selection
// pill (also from the friend's parallel session) instead of each having
// their own placeholder indicator.
function BottomNav({ active, onSelect, dark, modernist, vintage }: { active: string; onSelect?: (id: string) => void; dark?: boolean; modernist?: boolean; vintage?: boolean }) {
  const items = [
    { id: "home", label: "Home" },
    { id: "analysis", label: "Mind" },
    // Split out of Mind — Mind itself is now just the belief-network graph
    // (see ScreenAnalysis), and everything that used to sit below it there
    // (today's discovery, evidence, evolution, reflection) moved here to
    // its own tab (see ScreenDiscoveryAnalysis and the App shell's
    // "discoveryAnalysis" case).
    { id: "discoveryAnalysis", label: "Analysis" },
    // The tab is the person's diary (entries by day, see JournalView); the
    // route id stays "history".
    { id: "history", label: "Diary" },
    // Profile used to live here, but Home's top-right icon already opens it
    // (see ScreenHome) — that's still true, and the slot that briefly held a
    // standalone Premium tab is gone too: Premium is no longer a separate
    // destination (see the "Premium as a layer, not a tab" pass) — its
    // features now live inside Mind/Analysis/History, gated by
    // store.isPro (toggled from Profile), and the bar goes back to exactly
    // Home/Mind/Analysis/History.
  ];
  const activeColor = vintage ? ivHeading : modernist ? mdAccentText : dark ? dkAccentLight : "#6B6EF6";
  const inactiveColor = vintage ? "#ADA290" : modernist ? "#8b8785" /* --color-neutral-600 */ : dark ? "#726A8A" : "#8B8A92";
  // `vintage` now means the ivory theme (Home/Mind/Analysis/History, all
  // sharing one floating nav bar) — kept the original prop name to avoid
  // rippling a rename through every call site, but the "vintage" tan photo
  // palette this branch used to draw from is gone; see ivHeading/ivSurface
  // etc. above. It still skips the sliding pill entirely — the reference
  // design marks the active tab with color + a small dot underneath
  // instead of a highlight chip.
  const pillColor = modernist ? mdAccentSoft : dark ? "rgba(123,92,240,0.16)" : "#F0EEFF";
  const themeKey = modernist ? "modernist" : dark ? "dark" : "light";
  // This ivory bar nests two layers instead of putting border-radius,
  // backdrop-blur, and box-shadow all on one element: a blurred backdrop
  // only reliably clips to a rounded corner when something with overflow:
  // hidden sits between it and the edge, but overflow:hidden on that same
  // element would just as reliably clip its OWN box-shadow (shadows render
  // outside the box, right where overflow:hidden cuts them off). Split in
  // two, each half only carries what it can render correctly: the outer
  // div is transparent and just places the shadow + margins; the inner
  // div is what actually has the ivory fill/blur, clipped clean by its own
  // overflow:hidden so the rounded corners never show a leftover square
  // corner of unclipped background/blur behind them. The other themes
  // don't combine backdrop-blur with a border-radius in the first place,
  // so they're unaffected and keep the single-div version.
  const barStyle: React.CSSProperties = {
    position: modernist || dark || vintage ? "sticky" : "static",
    bottom: modernist || dark || vintage ? 0 : undefined,
    display: "flex",
    // The floating ivory bar (this bar and Home's "Speak your mind" card
    // above it) sits free of the frame edge — a margin + full border-
    // radius instead of the other themes' edge-to-edge bar with just a
    // top hairline. Its own margin/shadow live on the outer wrapper below
    // instead of here — see the comment above.
    borderTop: vintage ? "none" : `1px solid ${modernist ? mdDivider : dark ? dkDivider : hair}`,
    borderRadius: vintage ? shape.xl : 0,
    // Opaque now, not a translucent glass panel over blurred content —
    // "no glass, no backdrop blur panels" (see the removed backdropFilter
    // here). A plain opaque bar reads as decided; a frosted floating one
    // reads as a default nobody chose.
    backgroundColor: vintage ? "#FBF8F2" : modernist ? "#ffffff" : dark ? "#0a0716" : "#ffffff",
    overflow: vintage ? "hidden" : "visible",
    padding: "8px 10px",
    // Real value on a notched/gesture-nav phone (clears the home
    // indicator so nothing renders under it), 0px everywhere else —
    // always safe to include unconditionally. The ivory bar already has
    // its own bottom margin standing in for that gap (on the outer wrapper).
    paddingBottom: vintage ? "8px" : "calc(8px + env(safe-area-inset-bottom))",
    flexShrink: vintage ? undefined : 0,
  };
  const bar = (
    <div style={barStyle}>
      {items.map((item) => {
        const isActive = active === item.id;
        const color = isActive ? activeColor : inactiveColor;
        return (
          <motion.div
            key={item.id}
            data-tutorial={`nav-${item.id}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(item.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect?.(item.id); }}
            whileTap={{ scale: 0.9, opacity: 0.8 }}
            transition={SETTLE}
            style={{ flex: 1, position: "relative", display: "flex", justifyContent: "center", padding: "2px 4px", cursor: "pointer" }}
          >
            {isActive && !vintage && (
              <motion.div
                layoutId={`navSelectedPill-${themeKey}`}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: "absolute", inset: "0 6px", borderRadius: 18, backgroundColor: pillColor, zIndex: 0 }}
              />
            )}
            <Breathe amount={1.06} style={{ position: "relative", zIndex: 1 }}>
            <div style={{ minWidth: 44, minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <NavIcon id={item.id} color={color} active={isActive} />
              <span style={{ ...sans, fontSize: 11, fontWeight: isActive ? (modernist ? 800 : 600) : (modernist ? 500 : 400), color }}>{item.label}</span>
              {/* The dot slides between tabs (layoutId) instead of blinking
              off one and on the next. */}
              {vintage && isActive && <motion.span layoutId="navDot-vintage" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: ivHeading }} />}
            </div>
            </Breathe>
          </motion.div>
        );
      })}
    </div>
  );
  if (!vintage) return bar;
  // Outer wrapper: transparent, carries only what needs to render outside
  // the inner div's overflow:hidden clip (the shadow) or outside its own
  // box entirely (the margins placing this pill free of the frame edge).
  return (
    <div
      style={{
        position: "sticky", bottom: 0, flexShrink: 0,
        margin: "0 20px", marginBottom: "calc(14px + env(safe-area-inset-bottom))",
        borderRadius: shape.xl, boxShadow: ivCardShadow,
      }}
    >
      {bar}
    </div>
  );
}

// `ivory` is the opening flow's own theme (quote/splash/auth/login/signup/
// onboarding — see OPENING_BG above): a solid ivHeading charcoal pill,
// matching how every other ivory screen marks its one "active" action
// (nav, toggles) with charcoal rather than a saturated accent color.
// ── InkButton ────────────────────────────────────────────────────────────────
// The buttons on the opening screens. The filled one is deep ink with a
// slow wash of the app's colors moving underneath and a band of light
// that sweeps across it every few seconds; the outlined one has a border
// that shades through the same colors. Both lift slightly under a finger,
// send a ripple out from exactly where they were pressed, and — while
// working — swap their label for three bouncing dots. All of it stops
// under reduced motion.
// Both now take the page's colour (`tone`). The filled one is a cloth tab in
// that colour's ink with a stitched edge, like the diary's cover; the
// outlined one is a slip of paper held on by washi tape. Labels are in hand.
function InkButton({ children, onClick, disabled, loading, ghost, icon, tone = "identity" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; ghost?: boolean; icon?: React.ReactNode; tone?: CognitiveRegion }) {
  const reduce = useReducedMotion();
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number }[]>([]);
  const off = disabled || loading;
  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (off || reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const rid = Date.now() + Math.random();
    setRipples((rs) => [...rs, { id: rid, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setRipples((rs) => rs.filter((x) => x.id !== rid)), 700);
  };
  const c = REGION_CONFIG[tone];
  const v = c.color, rose = REGION_CONFIG.relationships.color, gold = REGION_CONFIG.career.color;
  return (
    <Breathe active={!off} amount={1.02}>
      <motion.button
        type="button" disabled={disabled} aria-busy={loading || undefined} onClick={off ? undefined : onClick} onPointerDown={press}
        whileHover={off ? undefined : { y: -2 }} whileTap={off ? undefined : { scale: 0.97 }} transition={SETTLE}
        whileFocus={off ? undefined : { boxShadow: `0 0 0 3px ${v}40` }}
        style={{
          position: "relative", overflow: "hidden", width: "100%", minHeight: 52, padding: "14px 18px", borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: off ? "default" : "pointer",
          ...hand, fontSize: ghost ? 22 : 24, fontWeight: 700, lineHeight: 1, WebkitTapHighlightColor: "transparent",
          ...(ghost
            ? {
              color: c.ink, border: 0, backgroundColor: "#FFFCF6",
              backgroundImage: `linear-gradient(160deg, ${v}1f, transparent 60%)`,
              boxShadow: `0 0 0 1px ${v}40, 0 10px 20px -14px ${c.ink}`,
            }
            : {
              color: "#FFFFFF", border: 0, textShadow: "0 1px 1px rgba(0,0,0,.18)",
              backgroundColor: disabled ? "rgba(42,38,33,.24)" : c.ink,
              backgroundImage: disabled ? "none" : `linear-gradient(120deg, ${c.ink} 0%, ${c.ink} 45%, ${v} 140%)`,
              boxShadow: off ? "none" : `0 12px 24px -12px ${c.ink}, 0 4px 10px -6px rgba(42,38,33,.45), inset 0 1px 0 rgba(255,255,255,.22)`,
            }),
        }}
      >
        {/* Stitching around a filled tab, the same as the diary's cloth cover. */}
        {!ghost && (
          <span aria-hidden style={{ position: "absolute", inset: 4, borderRadius: 12, border: `1.5px dashed rgba(255,255,255,${disabled ? 0.35 : 0.5})`, pointerEvents: "none" }} />
        )}
        {/* A strip of washi tape holding the paper slip down. */}
        {ghost && (
          <span aria-hidden style={{
            position: "absolute", top: -2, left: 18, width: 46, height: 13, transform: "rotate(-5deg)", pointerEvents: "none", opacity: 0.85,
            backgroundImage: `repeating-linear-gradient(45deg, ${v}99 0 5px, ${v}55 5px 10px)`,
          }} />
        )}
        {!ghost && !disabled && (
          <>
            {/* The color wash moving under the ink. */}
            <span aria-hidden className={reduce ? undefined : "ink-wash"} style={{
              position: "absolute", inset: "-60% -20%", opacity: 0.35, pointerEvents: "none",
              backgroundImage: `radial-gradient(circle at 20% 50%, ${v}aa 0%, transparent 38%), radial-gradient(circle at 80% 40%, ${rose}88 0%, transparent 36%), radial-gradient(circle at 55% 90%, ${gold}77 0%, transparent 34%)`,
            }} />
            {/* The sweep of light. */}
            {!reduce && <span aria-hidden className="ink-sheen" style={{ position: "absolute", top: 0, bottom: 0, width: "40%", pointerEvents: "none",
              backgroundImage: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)" }} />}
          </>
        )}
        {ripples.map((r) => (
          <motion.span key={r.id} aria-hidden initial={{ scale: 0, opacity: 0.45 }} animate={{ scale: 9, opacity: 0 }} transition={{ duration: 0.65, ease: "easeOut" }}
            style={{ position: "absolute", left: r.x - 20, top: r.y - 20, width: 40, height: 40, borderRadius: "50%", pointerEvents: "none", backgroundColor: ghost ? `${v}55` : "rgba(255,255,255,0.55)" }} />
        ))}
        <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 9 }}>
          {loading ? (
            <span aria-label="Working" style={{ display: "inline-flex", gap: 5, padding: "4px 0" }}>
              {[0, 1, 2].map((i) => (
                <motion.span key={i} animate={reduce ? undefined : { y: [0, -5, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.13, ease: "easeInOut" }}
                  style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "currentColor", display: "block" }} />
              ))}
            </span>
          ) : (
            <>
              {icon}
              {children}
            </>
          )}
        </span>
      </motion.button>
    </Breathe>
  );
}

function PrimaryBtn({ children, onClick, disabled, modernist = false, ivory = false, loading = false, icon, tone }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; modernist?: boolean; ivory?: boolean; loading?: boolean; icon?: React.ReactNode; tone?: CognitiveRegion }) {
  if (ivory) return <InkButton onClick={onClick} disabled={disabled} loading={loading} icon={icon} tone={tone}>{children}</InkButton>;
  // Breathes while it waits (see Breathe); a disabled button holds still,
  // since there's nothing to invite.
  return (
    <Breathe active={!disabled} amount={1.03}>
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.975, opacity: 0.92 }}
      transition={SETTLE}
      whileFocus={disabled ? undefined : { boxShadow: `0 0 0 3px ${ivory ? "rgba(42,38,33,.16)" : modernist ? "rgba(91,77,130,.18)" : "rgba(255,255,255,.14)"}` }}
      style={{
        ...sans, width: "100%", minHeight: 48, padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: disabled ? (ivory ? "rgba(42,38,33,.14)" : modernist ? mdTrack : dkTrack) : (ivory ? ivHeading : modernist ? mdAccent : dkAccent),
        color: disabled ? (ivory ? "rgba(42,38,33,.4)" : modernist ? "#a29d9d" : "#6E6580") : "#fff",
        border: 0, borderRadius: 14, fontSize: 17, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.72 : 1,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </motion.button>
    </Breathe>
  );
}

function GhostBtn({ children, onClick, modernist = false, ivory = false, icon, tone }: { children: React.ReactNode; onClick?: () => void; modernist?: boolean; ivory?: boolean; icon?: React.ReactNode; tone?: CognitiveRegion }) {
  if (ivory) return <InkButton onClick={onClick} ghost icon={icon} tone={tone}>{children}</InkButton>;
  return (
    <Breathe amount={1.03}>
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ backgroundColor: ivory ? "rgba(42,38,33,.035)" : modernist ? "rgba(91,77,130,.045)" : "rgba(255,255,255,.035)" }}
      whileTap={{ scale: 0.975, opacity: 0.72 }}
      transition={SETTLE}
      whileFocus={{ boxShadow: `0 0 0 3px ${ivory ? "rgba(42,38,33,.12)" : modernist ? "rgba(91,77,130,.14)" : "rgba(255,255,255,.10)"}` }}
      style={{
        ...sans, width: "100%", minHeight: 48, padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "transparent", color: ivory ? ivBody : modernist ? mdBody : dkBody,
        border: `1px solid ${ivory ? ivBorder : modernist ? mdDivider : dkDivider}`, borderRadius: 14, fontSize: 15, fontWeight: 500, cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </motion.button>
    </Breathe>
  );
}

function BackButton({ onClick, color = mdBody }: { onClick?: () => void; color?: string }) {
  return (
    <Breathe inline amount={1.06}>
    <motion.button
      type="button" aria-label="Go back" onClick={onClick}
      whileTap={{ opacity: 0.58 }}
      whileFocus={{ boxShadow: "0 0 0 3px rgba(91,77,130,.12)" }}
      style={{ ...sans, display: "inline-flex", alignItems: "center", gap: 5, minHeight: 36, margin: "-8px -10px", padding: "8px 10px", border: 0, borderRadius: shape.sm, background: "transparent", fontSize: 13, color, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
    >
      <ArrowLeft size={13} weight="bold" aria-hidden /> Back
    </motion.button>
    </Breathe>
  );
}

// ── Confidence bar — the one recurring data visualization: always a real
// 0-100 number backing an AI hypothesis, never decorative. ───────────────────
function ConfidenceBar({ value, dark, modernist }: { value: number; dark?: boolean; modernist?: boolean }) {
  const labelColor = modernist ? mdBody : dark ? dkBody : subtle;
  const fillColor = modernist ? mdAccent : dark ? dkAccent : accent;
  const trackColor = modernist ? mdTrack : dark ? dkTrack : hair;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: labelColor, letterSpacing: "0.04em" }}>Confidence</span>
        <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: fillColor }}><AnimatedNumber value={value} />%</span>
      </div>
      <MeterFill value={value} color={fillColor} track={trackColor} height={5} radius={3} style={{ marginTop: 6 }} />
    </div>
  );
}

// A pacing/breather card between dense content — a lesson carried over from
// an earlier project: don't staple a bridging question onto the bottom of a
// content card. Give it its own quiet screen instead. No chart, no stat, no
// decoration competes with it; deliberately visual-free by design, not a
// placeholder for a chart that's missing.
// Only ever used by ScreenInvestigate below, which is fully Modernist —
// straight md* tokens, no dual-theme prop needed (see BeliefCard/etc. above
// for the pattern this would follow if a dark consumer ever showed up).
function ScreenPivot({ kicker, statement, counter, cta }: { kicker?: string; statement: React.ReactNode; counter?: string; cta?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 24px 14px", minHeight: 0 }}>
        <div style={{ flex: 1.4 }} />
        <div>
          {kicker && (
            <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em", wordBreak: "keep-all" }}>{kicker}</div>
          )}
          <div style={{ ...display, fontSize: 28, color: mdHeading, lineHeight: 1.45, marginTop: kicker ? 14 : 0, wordBreak: "keep-all" }}>{statement}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div>
          {cta}
          {counter && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: cta ? 14 : 0 }}>
              <span style={{ ...mono, fontSize: 12, color: mdBody }}>{counter}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared "current vs. actual" row grammar — arrow-connected steps kept at
// identical geometry across rows so alignment itself teaches the comparison,
// a hairline divider instead of a bordered card per row. Only ever used by
// ScreenInvestigate, which is fully Modernist — straight md* tokens.
function AlignedRowCompare({ rows }: { rows: { label: string; steps: string[]; accent?: boolean }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((row, ri) => (
        <div key={row.label} style={{ paddingTop: ri === 0 ? 0 : 16, paddingBottom: ri < rows.length - 1 ? 16 : 0, borderBottom: ri < rows.length - 1 ? `1px solid ${mdDivider}` : "none" }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 700, color: row.accent ? mdAccentText : mdBody, letterSpacing: "0.03em", marginBottom: 10 }}>{row.label}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {row.steps.map((step, i) => (
              <React.Fragment key={step}>
                <div style={{ ...sans, fontSize: 12, fontWeight: i % 2 === 1 ? 700 : 500, color: i % 2 === 1 ? (row.accent ? mdAccentText : mdHeading) : mdBody, textAlign: "center", lineHeight: 1.3, wordBreak: "keep-all" }}>{step}</div>
                {i < row.steps.length - 1 && (<div style={{ ...sans, fontSize: 12, color: row.accent ? mdAccentText : mdBody, flexShrink: 0, padding: "0 4px" }}>→</div>)}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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

function ScreenQuoteOfTheDay({ onDone }: { onDone?: () => void }) {
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
const OPENING_BG = ivBg2;
const OPENING_TEXT = ivHeading;
const OPENING_MUTED = ivBody;

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

function OpeningBackdrop({ variant }: { variant: OpeningVariant }) {
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

function PatternConstellation({ speed = 1, width = 272 }: { speed?: number; width?: number }) {
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
function ScreenSplash({ onDone }: { onDone?: () => void }) {
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

// ── Screen 2 · Auth ───────────────────────────────────────────────────────────
function ScreenAuth({ onEmailStart, onGuest }: { onEmailStart?: () => void; onGuest?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: OPENING_BG, position: "relative", overflow: "hidden" }}>
      <OpeningBackdrop variant="auth" />
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 28px" }}>
        <div style={{ marginBottom: 28 }}><PatternConstellation /></div>
        <DiaryHeading align="center" size={28} kicker="Mindscape" region="identity"
          title={"Not just a diary.\nA way to see how you think."} />
      </div>
      <div style={{ position: "relative", zIndex: 1, padding: "0 28px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        <PrimaryBtn ivory onClick={onEmailStart} icon={<EnvelopeSimple size={19} weight="fill" />}>Continue with email</PrimaryBtn>
        <GhostBtn ivory onClick={onGuest} icon={<BookOpen size={18} />}>Browse as a guest</GhostBtn>
        {/* Guest mode has no account behind it, so clearing this device's
        storage loses everything with nothing to recover from — this used
        to go unmentioned anywhere near the decision itself. Data &
        Privacy's own "Download my data" is the one way to get ahead of
        that, so it's worth naming right here rather than only discoverable
        after the fact in Settings. */}
        <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,.42)", textAlign: "center", marginTop: 2, lineHeight: 1.5, wordBreak: "keep-all" }}>
          Browsing as a guest keeps everything only on this device — nothing to restore if it's ever cleared. You can export a copy anytime from Settings.
        </div>
      </div>
    </div>
  );
}

// ── DiaryNotePaper ───────────────────────────────────────────────────────────
// The place you actually write, made to feel like your own diary page
// rather than a form field: pastel paper whose colors drift slowly, two
// strips of washi tape holding it down, soft colored ruled lines that
// scroll with the text (each line exactly one line of writing), a rose
// margin, and a pen nib in the corner that wiggles while you type and
// flicks out little drops of colored ink. A word count sits bottom-left.
// The ink drops and the drift stop under reduced motion.
const DIARY_INKS = [REGION_CONFIG.identity.color, REGION_CONFIG.relationships.color, REGION_CONFIG.career.color, REGION_CONFIG.curiosity.color, REGION_CONFIG.security.color, REGION_CONFIG.creativity.color];

function DiaryNotePaper({ value, onChange, placeholder, ariaLabel, autoFocus, fontSize = 25, lineHeight = 36, minHeight, fill, onEnter, style, header, children }: {
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
const SEAL_MS = 900;

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

function FutureSelfLetter({ value, onChange, sealed, autoFocus, fontSize = 23, lineHeight = 34 }: { value: string; onChange: (v: string) => void; sealed: boolean; autoFocus?: boolean; fontSize?: number; lineHeight?: number }) {
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

// ── DiaryPage ────────────────────────────────────────────────────────────────
// Login and sign-up as the first page of a diary: a sheet of paper resting
// on the drifting backdrop, today's date written at the top the way you'd
// head a page, a faint rose margin line down the left, and a ribbon
// bookmark hanging from the top edge that sways a little. The sheet rises
// into place when the screen opens.
function DiaryPage({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const dateline = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24, rotate: -1.2 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 20, delay: 0.05 }}
      style={{
        position: "relative", borderRadius: 18, padding: "26px 22px 22px 34px", marginTop: 8,
        backgroundColor: "#FDFBF6", backgroundImage: "linear-gradient(180deg, #FFFDF9 0%, #FBF7EF 100%)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.8) inset, 0 18px 40px -22px rgba(74,47,94,0.45), 0 0 0 1px rgba(42,38,33,0.06)",
      }}
    >
      {/* Margin line */}
      <span aria-hidden style={{ position: "absolute", left: 20, top: 14, bottom: 14, width: 1.5, borderRadius: 1, backgroundColor: `${REGION_CONFIG.relationships.color}66` }} />
      {/* Ribbon bookmark */}
      <motion.span aria-hidden
        animate={reduce ? undefined : { rotate: [0, 3, -2, 0] }} transition={reduce ? undefined : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", right: 26, top: -6, width: 16, height: 46, transformOrigin: "50% 0%",
          backgroundImage: `linear-gradient(180deg, ${REGION_CONFIG.identity.ink}, ${REGION_CONFIG.identity.color})`,
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)", boxShadow: "0 4px 8px rgba(0,0,0,0.15)" }} />
      <div style={{ ...hand, fontSize: 21, fontWeight: 500, color: REGION_CONFIG.identity.ink }}>{dateline}</div>
      <div style={{ ...display, fontSize: 28, color: ivHeading, lineHeight: 1.2, marginTop: 6 }}>{title}</div>
      {subtitle && <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>{subtitle}</div>}
      <div style={{ marginTop: 18 }}>{children}</div>
    </motion.div>
  );
}

// ── DiaryField ───────────────────────────────────────────────────────────────
// The sign-in and sign-up fields, as lines on a diary page instead of
// boxes: a small icon, the label sitting on the line until you start
// (then lifting up out of the way), and an ink line that draws in from
// the left in the app's colors while the field has focus. A quiet check
// pops in once an email or password is valid; the password has a
// show/hide eye; an error shakes the line once and turns it warm.
function DiaryField({ label, type = "text", value, onChange, icon, error, valid, autoComplete }: { label: string; type?: string; value: string; onChange: (v: string) => void; icon: React.ReactNode; error?: boolean; valid?: boolean; autoComplete?: string }) {
  const id = React.useId();
  const reduce = useReducedMotion();
  const [focused, setFocused] = React.useState(false);
  const [reveal, setReveal] = React.useState(false);
  const lifted = focused || value.length > 0;
  const isPassword = type === "password";
  const ink = error ? mdWarn : ivHeading;
  return (
    <motion.div
      animate={error && !reduce ? { x: [0, -7, 6, -4, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      style={{ position: "relative", paddingTop: 18, marginBottom: 18 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <motion.span
          animate={{ color: focused ? (error ? mdWarn : REGION_CONFIG.identity.ink) : ivFaint, scale: focused ? 1.08 : 1 }}
          transition={{ duration: 0.2 }}
          style={{ display: "flex", flexShrink: 0 }}
        >
          {icon}
        </motion.span>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <motion.label
            htmlFor={id}
            animate={lifted ? { y: -24, scale: 0.78, color: focused ? (error ? mdWarn : REGION_CONFIG.identity.ink) : ivBody } : { y: 0, scale: 1, color: ivFaint }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{ position: "absolute", left: 0, top: 10, transformOrigin: "0% 50%", pointerEvents: "none", ...sans, fontSize: 17, fontWeight: lifted ? 600 : 400, whiteSpace: "nowrap" }}
          >
            {label}
          </motion.label>
          <input
            id={id} type={isPassword && reveal ? "text" : type} value={value} autoComplete={autoComplete}
            onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            aria-invalid={error || undefined}
            // 17px keeps iOS from zooming the page on focus.
            style={{ width: "100%", border: 0, outline: "none", background: "transparent", padding: "10px 0 9px", ...display, fontSize: 20, color: ink, caretColor: REGION_CONFIG.identity.color }}
          />
        </div>
        <AnimatePresence>
          {valid && !error && (
            <motion.span key="ok" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}
              style={{ display: "flex", width: 20, height: 20, borderRadius: "50%", alignItems: "center", justifyContent: "center", backgroundColor: REGION_CONFIG.security.tint, color: REGION_CONFIG.security.ink, flexShrink: 0 }}>
              <Check size={12} weight="bold" />
            </motion.span>
          )}
        </AnimatePresence>
        {isPassword && (
          <motion.button type="button" aria-label={reveal ? "Hide password" : "Show password"} onClick={() => setReveal((v) => !v)} whileTap={{ scale: 0.85 }}
            style={{ border: 0, background: "transparent", padding: 6, margin: -6, color: ivFaint, cursor: "pointer", lineHeight: 0, flexShrink: 0 }}>
            {reveal ? <EyeSlash size={18} /> : <Eye size={18} />}
          </motion.button>
        )}
      </div>
      {/* The writing line, and the ink that draws over it on focus. */}
      <div style={{ position: "relative", height: 2, marginTop: 2, borderRadius: 1, backgroundColor: error ? `${mdWarn}55` : "rgba(42,38,33,0.16)" }}>
        <motion.div
          initial={false}
          animate={{ scaleX: focused || error ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute", inset: 0, transformOrigin: "0% 50%", borderRadius: 1,
            backgroundImage: error ? `linear-gradient(90deg, ${mdWarn}, ${REGION_CONFIG.creativity.color})` : `linear-gradient(90deg, ${REGION_CONFIG.identity.color}, ${REGION_CONFIG.relationships.color}, ${REGION_CONFIG.career.color})`,
          }}
        />
      </div>
    </motion.div>
  );
}

function TextField({ label, type = "text", value, onChange, placeholder, error, dark = false }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: boolean; dark?: boolean }) {
  // The caption above every input in the app (login, signup, aspiration,
  // checkout's card fields) was a plain styled div, never actually
  // associated with its input — a screen reader announced every one of
  // these as an unlabeled text box. A real <label htmlFor> fixes all call
  // sites from this one component; useId keeps it unique and stable
  // without callers having to pass their own id.
  const id = React.useId();
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={{ display: "block", ...sans, fontSize: 12, fontWeight: 600, color: dark ? OPENING_MUTED : mdBody, marginBottom: 6 }}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error || undefined}
        style={{
          ...sans, width: "100%", padding: "13px 14px", borderRadius: 12, boxSizing: "border-box",
          border: `1px solid ${error ? mdWarn : (dark ? "rgba(42,38,33,.18)" : mdDivider)}`,
          // 16px, not 15 — iOS Safari auto-zooms the whole page on focus for
          // any input under 16px, which then has to be manually pinched back
          // out. Below that threshold it's a real mobile bug, not a style nit.
          fontSize: 17, color: dark ? OPENING_TEXT : mdHeading,
          backgroundColor: dark ? "rgba(255,255,255,.055)" : mdCard, outline: "none",
          colorScheme: dark ? "dark" : "light",
        }}
      />
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Real Supabase auth when cloud sync is configured (see supabaseClient.ts);
// otherwise the original local-only mock — checking against the single
// account stored on this device (see StoredAccount) — so the app still
// works exactly as before wherever Supabase env vars aren't set.
function ScreenLogin({ account, onBack, onGoSignup, onLogin }: { account: StoredAccount | null; onBack?: () => void; onGoSignup?: () => void; onLogin?: (upgradedPasswordHash?: string) => void }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    if (loading) return;
    setError("");
    if (!email.trim() || !password) { setError("Please enter both an email and a password."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("That doesn't look like a valid email."); return; }
    setLoading(true);

    if (isCloudSyncConfigured) {
      try {
        await cloudSignIn(email.trim(), password);
        setLoading(false);
        onLogin?.();
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Couldn't log in.");
      }
      return;
    }

    // Local-only account (no Supabase): compare against the PBKDF2 hash —
    // see localPassword.ts. A store saved before hashing existed still has
    // plaintext here; that still logs in once, and is re-hashed on the spot.
    if (!account || typeof account.email !== "string" || typeof account.password !== "string") {
      setLoading(false);
      setError("No account found. Please sign up first.");
      return;
    }
    const ok = account.email.toLowerCase() === email.trim().toLowerCase() && (await verifyLocalPassword(password, account.password));
    setLoading(false);
    if (!ok) {
      setError("Email or password is incorrect.");
      return;
    }
    onLogin?.(isHashedPassword(account.password) ? undefined : await hashLocalPassword(password));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: OPENING_BG, position: "relative", overflow: "hidden" }}>
      <OpeningBackdrop variant="form" />
      <div style={{ padding: "16px 22px 0", position: "relative", zIndex: 1, flexShrink: 0 }}>
        <BackButton onClick={onBack} color={OPENING_MUTED} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative", zIndex: 1, padding: "20px 28px 24px" }}>
        <DiaryPage title="Welcome back" subtitle="Pick up where you left off.">
          {/* An error marks only the field it's about; wrong credentials mark both. */}
          <DiaryField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} icon={<EnvelopeSimple size={20} />} error={!!error && (!email.trim() || !/both/.test(error))} valid={EMAIL_RE.test(email.trim())} />
          <DiaryField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} icon={<Key size={20} />} error={!!error && (!/both|valid email/.test(error) || !password)} />
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ ...sans, fontSize: 13, color: mdWarn, marginTop: -4, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all", overflow: "hidden" }}>{error}</motion.div>
            )}
          </AnimatePresence>
          <PrimaryBtn ivory onClick={submit} loading={loading} icon={<PenNib size={18} weight="fill" />}>Log in</PrimaryBtn>
        </DiaryPage>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span style={{ ...sans, fontSize: 13, color: OPENING_MUTED }}>Don't have an account? </span>
          <Breathe inline amount={1.06}><motion.span role="button" tabIndex={0} onClick={onGoSignup} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onGoSignup)?.(); } }} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: ivHeading, fontWeight: 600, cursor: "pointer" }}>Sign up</motion.span></Breathe>
        </div>
      </div>
    </div>
  );
}

function ScreenSignup({ onBack, onGoLogin, onSignup }: { onBack?: () => void; onGoLogin?: () => void; onSignup?: (account: StoredAccount) => void }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  // Distinct from `error` — Supabase projects that require email
  // confirmation return a user with no active session yet, which isn't a
  // failure, just a "one more step" state that needs its own tone (not
  // red/warning-colored) and shouldn't advance past this screen.
  const [info, setInfo] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    if (loading) return;
    setError("");
    setInfo("");
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("That doesn't look like a valid email."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);

    if (isCloudSyncConfigured) {
      try {
        const data = await cloudSignUp(email.trim(), password, name.trim());
        setLoading(false);
        if (!data.session) {
          setInfo("Check your email for a confirmation link, then log in.");
          return;
        }
        // Real auth already has the password, hashed, in Supabase's own
        // auth.users table — never duplicated here in plaintext, since
        // this object is what gets synced to user_stores as part of the
        // Store (see cloudSync.ts / supabase/schema.sql).
        onSignup?.({ name: name.trim(), email: email.trim(), password: "" });
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Couldn't create an account.");
      }
      return;
    }

    // Local-only account: never keep the plaintext password — see localPassword.ts.
    const passwordHash = await hashLocalPassword(password);
    setLoading(false);
    onSignup?.({ name: name.trim(), email: email.trim(), password: passwordHash });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: OPENING_BG, position: "relative", overflow: "hidden" }}>
      <OpeningBackdrop variant="form" />
      <div style={{ padding: "16px 22px 0", position: "relative", zIndex: 1, flexShrink: 0 }}>
        <BackButton onClick={onBack} color={OPENING_MUTED} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative", zIndex: 1, padding: "20px 28px 24px" }}>
        <DiaryPage
          title="Start your diary"
          subtitle={isCloudSyncConfigured
            ? "Synced privately to your account, so it's there on any device you log into — never sold, never shared."
            : "It only lives on this device. Nothing is sent to any server."}
        >
          {/* An error marks only the field it's about. */}
          <DiaryField label="What should we call you?" autoComplete="name" value={name} onChange={setName} icon={<UserCircle size={20} />} error={/your name/.test(error)} valid={name.trim().length > 0} />
          <DiaryField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} icon={<EnvelopeSimple size={20} />} error={!!error && !/your name|Password must/.test(error)} valid={EMAIL_RE.test(email.trim())} />
          <DiaryField label="Password (6+ characters)" type="password" autoComplete="new-password" value={password} onChange={setPassword} icon={<Key size={20} />} error={/Password must/.test(error)} valid={password.length >= 6} />
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ ...sans, fontSize: 13, color: mdWarn, marginTop: -4, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all", overflow: "hidden" }}>{error}</motion.div>
            )}
          </AnimatePresence>
          {info && <div style={{ ...sans, fontSize: 13, color: ivHeading, marginTop: -4, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>{info}</div>}
          <PrimaryBtn ivory onClick={submit} loading={loading} icon={<PenNib size={18} weight="fill" />}>Sign up</PrimaryBtn>
        </DiaryPage>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span style={{ ...sans, fontSize: 13, color: OPENING_MUTED }}>Already have an account? </span>
          <Breathe inline amount={1.06}><motion.span role="button" tabIndex={0} onClick={onGoLogin} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onGoLogin)?.(); } }} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: ivHeading, fontWeight: 600, cursor: "pointer" }}>Log in</motion.span></Breathe>
        </div>
      </div>
    </div>
  );
}

// ── Screen 3 · Onboarding (3 short beats) ────────────────────────────────────
// Simple stroke-based glyphs, same style as WaveformIcon/the bottom-nav
// icons (24x24 viewBox, no fill, rounded strokes) — one per onboarding
// slide, Apple-onboarding-style (Health/Fitness+: a big glyph, a headline,
// one line of body copy, nothing busier than that).
function OnboardingIcon({ kind, size = 56 }: { kind: "welcome" | "speak" | "watch" | "pattern"; size?: number }) {
  // Phosphor's duotone weight: a tinted fill under the line, which reads
  // as an illustration at this size rather than a toolbar icon.
  const color = mdAccent;
  if (kind === "welcome") return <HandWaving size={size} color={color} weight="duotone" />;
  if (kind === "speak") return <Microphone size={size} color={color} weight="duotone" />;
  if (kind === "watch") return <Eye size={size} color={color} weight="duotone" />;
  return <Graph size={size} color={color} weight="duotone" />;
}

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
    // Reduced motion: jump straight to the lit state and back with no
    // propagating wave (delay 0) and no eased travel (duration 0) — the
    // same "duration: reducedMotion ? 0 : …" convention this file already
    // uses in ScreenQuoteOfTheDay/OpeningStars, just applied to an
    // imperative anime.js call instead of a declarative transition prop.
    animate(dots, {
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

function DiaryHeading({ kicker, title, body, region, align = "left", size = 30, delay = 0 }: {
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

// The onboarding sequence's last beat is a real question, not another
// slide: what kind of person do you want to become. It's optional (typing
// nothing just means "skip"), but asking it here — right when someone
// commits to using the app — is what actually seeds Identity Drift instead
// of leaving it undiscoverable inside Profile settings.
function ScreenOnboarding({ initialAspiration, onDone }: { initialAspiration?: string | null; onDone?: (aspiration: string | null) => void }) {
  const totalSteps = ONBOARDING_SLIDES.length + 1;
  const [i, setI] = React.useState(0);
  const [aspiration, setAspiration] = React.useState(initialAspiration ?? "");
  const [sealing, setSealing] = React.useState(false);
  const isAspirationStep = i === ONBOARDING_SLIDES.length;
  const isLast = i === totalSteps - 1;
  const slide = !isAspirationStep ? ONBOARDING_SLIDES[i] : null;

  const isWelcome = slide?.kicker == null;
  // The one slide that shows instead of just telling — see
  // OnboardingBrainDemo above for why this is worth a special case rather
  // than threading a demo prop through the generic slide template used by
  // the other three.
  const isInteractive = i === 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: OPENING_BG, overflow: "hidden", position: "relative", color: OPENING_TEXT }}>
      {/* The backdrop's palette shifts with each step (remounted per step
          so the blooms pick up the new colors). */}
      <OpeningBackdrop key={i} variant={(["welcome", "speak", "notice", "map", "aspire"] as const)[Math.min(i, 4)]} />
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
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 28px", position: "relative", zIndex: 1 }}>
          <div style={{ flexShrink: 0, paddingTop: 8 }}>
            <DiaryHeading kicker="The last page" title={"What kind of person\ndo you want to become?"} region="security"
              body="Optional. Write it down, and we'll keep showing you how far your thoughts are from it." />
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: 22, paddingBottom: 18 }}>
            <FutureSelfLetter autoFocus value={aspiration} onChange={setAspiration} sealed={sealing} />
          </div>
        </div>
      )}
      <div style={{ padding: "0 28px 40px", flexShrink: 0, position: "relative", zIndex: 1 }}>
        <PrimaryBtn ivory tone={isAspirationStep ? "security" : slide?.kicker ? SLIDE_TONES[slide.icon] ?? "identity" : "identity"} onClick={() => {
          if (!isLast) return setI((v) => v + 1);
          const value = aspiration.trim();
          if (!value) return onDone?.(null);
          if (sealing) return;
          // Seal the letter, then move on once the seal has landed.
          setSealing(true);
          setTimeout(() => onDone?.(value), SEAL_MS);
        }}>
          {isLast ? (aspiration.trim() ? "Seal it and start" : "Skip and start") : i === 0 ? "Get Started" : "Next"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

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

// A function of isPro, not a static list — free tier lands on ScreenPaywall
// instead of the real ScreenDiscoveryAnalysis for the "discoveryAnalysis"
// step, so that one step needs different copy pointing at the paywall's
// feature list instead of the (Pro-only) real discovery card. Same target
// key ("today-discovery") exists on both — see the paywall's own
// data-tutorial. Everything else is identical either way; recomputed via
// useMemo in the App shell whenever isPro changes so a mid-tour upgrade
// doesn't leave stale copy in place.
function buildTutorialSteps(isPro: boolean): TutorialStep[] {
  return [
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
    isPro
      ? {
          screen: "discoveryAnalysis",
          target: "today-discovery",
          title: "Today's discovery",
          body: "This is where we show you beliefs that keep repeating without you noticing. Not a diagnosis — just an observation, as-is.",
        }
      : {
          screen: "discoveryAnalysis",
          target: "today-discovery",
          title: "This is what Pro unlocks",
          body: "Recording is always free. Once you're subscribed, this is where your recorded thoughts turn into beliefs, connections, and hypotheses like these.",
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
}

// Re-measures on step/screen change and on resize, plus one short retry —
// the target it's looking for may not have mounted yet the instant a new
// screen's fade-in starts (AnimatePresence), so a single synchronous
// measurement on mount can legitimately come up empty.
function useTutorialTargetRect(target: string, frameRef: React.RefObject<HTMLDivElement>, screen: string) {
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number; height: number } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const frame = frameRef.current;
      const el = frame?.querySelector(`[data-tutorial="${target}"]`) as HTMLElement | null;
      if (!frame || !el) { setRect(null); return; }
      const f = frame.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - f.top, left: r.left - f.left, width: r.width, height: r.height });
    };
    measure();
    const retry = setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    return () => { cancelled = true; clearTimeout(retry); window.removeEventListener("resize", measure); };
  }, [target, frameRef, screen]);
  return rect;
}

function TutorialOverlay({
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
  React.useEffect(() => {
    titleRef.current?.focus();
  }, [step.target]);
  // Only render once the current real screen matches this step's screen —
  // otherwise we're mid-transition and the target genuinely isn't there
  // yet; useTutorialTargetRect's retry picks it back up a moment later.
  if (screen !== step.screen || !rect) return null;

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

      {/* Skip, always reachable. */}
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

// The one thing Today's Discovery can point at — either the freshest unreacted AI
// hypothesis (index into store.hypotheses) or, when there's no hypothesis
// yet, the strongest recurring belief (id into store.beliefs). Computed once
// here and reused by both Home (which only ever reads `.text`) and the
// Analysis tab (which renders the full body for whichever kind it is) —
// so the two places can never disagree about what "today's discovery" is.
type DiscoveryTarget = { kind: "hypothesis"; index: number; text: string } | { kind: "belief"; id: string; text: string };

function computeDiscovery(store: Store): DiscoveryTarget | null {
  const freshHypothesisIndex = store.hypotheses.findIndex((h) => h.reaction === null);
  if (freshHypothesisIndex >= 0) {
    return { kind: "hypothesis", index: freshHypothesisIndex, text: store.hypotheses[freshHypothesisIndex].title };
  }
  const topBelief = [...store.beliefs]
    .filter((b) => b.userReaction !== "rejected")
    .sort((a, b) => (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? "") || b.confidence - a.confidence)[0];
  return topBelief ? { kind: "belief", id: topBelief.id, text: topBelief.discoveryInterpretationOverride ?? topBelief.statement } : null;
}

// Re-derives a pinned DiscoveryTarget's display text from the live store
// (title/statement may have changed under a reinterpretation loop) without
// letting the identity itself drift — see ScreenAnalysis's `pinnedDiscovery`.
// Used so a discovery doesn't get silently swapped out mid-conversation the
// instant its reaction flips away from null (e.g. once reinterpretation is
// exhausted), which computeDiscovery's fresh-lookup alone would do.
function resolveDiscoveryTarget(store: Store, pinned: DiscoveryTarget): DiscoveryTarget | null {
  if (pinned.kind === "hypothesis") {
    const h = store.hypotheses[pinned.index];
    return h ? { kind: "hypothesis", index: pinned.index, text: h.title } : null;
  }
  const b = store.beliefs.find((x) => x.id === pinned.id);
  return b ? { kind: "belief", id: pinned.id, text: b.discoveryInterpretationOverride ?? b.statement } : null;
}

// One entry in the Analysis tab's "Recent Insights" list — everything
// that could have been "Today's Discovery" (see computeDiscovery) but
// isn't, so the list is real history, never invented copy. Both
// hypotheses and beliefs collapse into this one shape so the list can
// render them identically and open either back into ScreenDiscoveryAnalysis's
// Examine view via `target`.
type RecentInsightItem = {
  key: string;
  target: DiscoveryTarget;
  title: string;
  // The same short "defusion" noun-phrase Today's Discovery's own headline
  // uses when present (StoredBelief/StoredHypothesis.thoughtLabel, e.g.
  // "Perfectionism thought") — a genuine, already-generated semantic label,
  // distinct from `title`'s full sentence. Optional because not every
  // belief/hypothesis has one yet; InsightCard falls back to `title` as its
  // primary label when it's absent, same as Today's Discovery's own logic.
  thoughtLabel?: string;
  region: CognitiveRegion;
  date: string; // "YYYY.MM.DD" (formatDateDots), possibly "" if unknown
  thoughtCount: number;
  confidence: number;
};

function buildRecentInsights(store: Store, pinned: DiscoveryTarget | null): RecentInsightItem[] {
  const items: RecentInsightItem[] = [];

  store.hypotheses.forEach((h, index) => {
    if (pinned?.kind === "hypothesis" && pinned.index === index) return;
    const domain = h.domains[0] ?? "identity";
    items.push({
      key: `hyp:${index}`,
      target: { kind: "hypothesis", index, text: h.title },
      // The full sentence, same as what Today's Discovery itself would show
      // for this target.
      title: h.title,
      thoughtLabel: h.thoughtLabel,
      region: resolveRegion({ domain } as any),
      date: h.createdDate ?? "",
      thoughtCount: evidenceForHypothesis(h, store.beliefs).length,
      confidence: h.confidence,
    });
  });

  // A belief already folded into a hypothesis's own related set is that
  // hypothesis's supporting evidence, not a separate insight of its own —
  // skipping it here is what keeps this list from doubling up on the same
  // underlying pattern.
  const beliefIdsInHypotheses = new Set(store.hypotheses.flatMap((h) => h.relatedBeliefIds));
  store.beliefs.forEach((b) => {
    if (b.userReaction === "rejected") return;
    if (beliefIdsInHypotheses.has(b.id)) return;
    if (pinned?.kind === "belief" && pinned.id === b.id) return;
    items.push({
      key: `belief:${b.id}`,
      target: { kind: "belief", id: b.id, text: b.discoveryInterpretationOverride ?? b.statement },
      title: b.discoveryInterpretationOverride ?? b.statement,
      thoughtLabel: b.thoughtLabel,
      region: resolveRegion(b),
      date: b.lastUpdatedAt ?? "",
      thoughtCount: b.evidenceQuotes.length,
      confidence: b.confidence,
    });
  });

  return items.sort((x, y) => {
    const dx = x.date || "0000.00.00";
    const dy = y.date || "0000.00.00";
    return dx < dy ? 1 : dx > dy ? -1 : 0;
  });
}


function daysSinceLastEntry(history: StoredHistoryEntry[]): number | null {
  if (history.length === 0) return null;
  const dates = history.map((e) => parseDotDate(e.date)).filter((d): d is Date => !!d);
  if (dates.length === 0) return null;
  const mostRecent = new Date(Math.max(...dates.map((d) => d.getTime())));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  mostRecent.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - mostRecent.getTime()) / 86_400_000));
}

const QUICK_MOODS: { label: string; intensity: number }[] = [
  { label: "Calm", intensity: 35 },
  { label: "Happy", intensity: 65 },
  { label: "Anxious", intensity: 60 },
  { label: "Sad", intensity: 55 },
  { label: "Frustrated", intensity: 65 },
];

// ── Mood faces ───────────────────────────────────────────────────────────────
// Tapping a quick check-in answers with a small drawn face for that
// feeling, in its own color, popping up above the row for as long as
// "Logged: …" shows. Each face moves the way the feeling does: calm
// breathes slowly with closed eyes and a drifting leaf; happy bounces and
// throws sparkles; anxious jitters with a wavy mouth and a bead of sweat;
// sad droops while a tear falls; frustrated shakes under furrowed brows
// and puffs steam. Under reduced motion each face simply appears, still.
type MoodKey = "Calm" | "Happy" | "Anxious" | "Sad" | "Frustrated";
const MOOD_TONES: Record<MoodKey, CognitiveRegion> = {
  Calm: "security", Happy: "career", Anxious: "curiosity", Sad: "identity", Frustrated: "creativity",
};

function MoodFace({ mood, size = 72 }: { mood: MoodKey; size?: number }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const tone = REGION_CONFIG[MOOD_TONES[mood]];
  const ink = "#2E2547";
  const loop = (duration: number, extra: object = {}) => (reduce ? undefined : { duration, repeat: Infinity, ease: "easeInOut" as const, ...extra });
  // Whole-face motion per feeling.
  const body = reduce ? undefined : {
    Calm: { scale: [1, 1.05, 1] },
    Happy: { y: [0, -7, 0], rotate: [0, -4, 4, 0] },
    Anxious: { x: [0, -1.6, 1.6, -1.2, 1.2, 0] },
    Sad: { y: [0, 2.5, 0], rotate: [0, -2, 0] },
    Frustrated: { x: [0, -3, 3, -3, 3, 0], rotate: [0, -3, 3, -2, 2, 0] },
  }[mood];
  const bodyT = loop({ Calm: 3.2, Happy: 0.9, Anxious: 0.45, Sad: 2.6, Frustrated: 0.6 }[mood]);
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden style={{ overflow: "visible", display: "block" }}>
      <defs>
        <radialGradient id={`mf${id}`} cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="0.35" stopColor={tone.tint} />
          <stop offset="1" stopColor={tone.color} />
        </radialGradient>
      </defs>
      {/* Extras behind/around the face */}
      {mood === "Happy" && [0, 1, 2, 3, 4].map((i) => {
        const a = (-150 + i * 30) * (Math.PI / 180);
        return (
          <motion.path key={i} d="M0 -4 L1.2 -1.2 L4 0 L1.2 1.2 L0 4 L-1.2 1.2 L-4 0 L-1.2 -1.2 Z" fill={tone.color}
            initial={{ x: 40, y: 40, scale: 0, opacity: 0 }}
            animate={reduce ? { x: 40 + Math.cos(a) * 36, y: 40 + Math.sin(a) * 36, scale: 1, opacity: 1 } : { x: [40, 40 + Math.cos(a) * 38], y: [40, 40 + Math.sin(a) * 38], scale: [0, 1.4, 0.6], opacity: [0, 1, 0] }}
            transition={reduce ? undefined : { duration: 1.1, repeat: Infinity, repeatDelay: 0.3, delay: i * 0.08, ease: "easeOut" }} />
        );
      })}
      {mood === "Calm" && (
        <motion.path d="M0 0 C 4 -6, 12 -6, 14 0 C 10 4, 4 4, 0 0 Z" fill={REGION_CONFIG.security.color} opacity={0.85}
          initial={{ x: 62, y: 8 }} animate={reduce ? undefined : { x: [62, 70, 60, 68], y: [6, 14, 22, 30], rotate: [0, 25, -10, 30], opacity: [0, 1, 1, 0] }}
          transition={loop(3.6)} />
      )}
      {mood === "Frustrated" && [0, 1].map((i) => (
        <motion.circle key={i} r="5" fill="#B9B3C4"
          cx={i ? 64 : 16} cy={14}
          initial={{ cx: i ? 64 : 16, cy: 14, r: 3, opacity: 0 }}
          animate={reduce ? undefined : { cy: [14, 0], r: [3, 8], opacity: [0, 0.8, 0] }}
          transition={loop(1.1, { delay: i * 0.45, ease: "easeOut" })} />
      ))}

      <motion.g animate={body} transition={bodyT} style={{ transformBox: "view-box", transformOrigin: "40px 44px" }}>
        <circle cx="40" cy="42" r="28" fill={`url(#mf${id})`} />
        {/* Cheeks */}
        {(mood === "Happy" || mood === "Calm") && (
          <>
            <circle cx="25" cy="48" r="4.5" fill={REGION_CONFIG.relationships.color} opacity="0.45" />
            <circle cx="55" cy="48" r="4.5" fill={REGION_CONFIG.relationships.color} opacity="0.45" />
          </>
        )}
        {/* Eyes */}
        {mood === "Calm" && (
          <g fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round">
            <path d="M26 39 Q 30 43 34 39" /><path d="M46 39 Q 50 43 54 39" />
          </g>
        )}
        {mood === "Happy" && (
          <g fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round">
            <path d="M26 40 Q 30 34 34 40" /><path d="M46 40 Q 50 34 54 40" />
          </g>
        )}
        {(mood === "Anxious" || mood === "Sad") && (
          <motion.g animate={reduce || mood !== "Anxious" ? undefined : { scaleY: [1, 1, 0.15, 1] }} transition={loop(2.2, { times: [0, 0.85, 0.92, 1] })}
            style={{ transformBox: "view-box", transformOrigin: "40px 39px" }}>
            <circle cx="30" cy="39" r={mood === "Anxious" ? 3.6 : 3} fill={ink} />
            <circle cx="50" cy="39" r={mood === "Anxious" ? 3.6 : 3} fill={ink} />
            {mood === "Anxious" && (<><circle cx="31.2" cy="37.8" r="1.1" fill="#FFF" /><circle cx="51.2" cy="37.8" r="1.1" fill="#FFF" /></>)}
          </motion.g>
        )}
        {mood === "Frustrated" && (
          <g>
            <circle cx="30" cy="41" r="3" fill={ink} /><circle cx="50" cy="41" r="3" fill={ink} />
            <path d="M23 32 L35 36" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M57 32 L45 36" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          </g>
        )}
        {mood === "Sad" && (
          <g fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round">
            <path d="M24 32 L34 30" /><path d="M56 32 L46 30" />
          </g>
        )}
        {mood === "Anxious" && (
          <g fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round">
            {/* Worried brows: they rise toward the middle. */}
            <path d="M24 33 Q 29 31 34 29" /><path d="M56 33 Q 51 31 46 29" />
          </g>
        )}
        {/* Mouth */}
        {mood === "Calm" && <path d="M33 52 Q 40 56 47 52" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />}
        {mood === "Happy" && <path d="M29 49 Q 40 62 51 49 Z" fill={ink} />}
        {mood === "Anxious" && (
          <motion.path d="M30 54 Q 33 50 36 54 Q 39 58 42 54 Q 45 50 48 54 Q 50 57 51 55" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
        )}
        {mood === "Sad" && <path d="M31 57 Q 40 49 49 57" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />}
        {mood === "Frustrated" && <path d="M31 55 L49 55" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />}
        {/* Sweat bead and tear */}
        {mood === "Anxious" && (
          <motion.path d="M60 26 C 57 31, 57 34, 60 35 C 63 34, 63 31, 60 26 Z" fill={REGION_CONFIG.curiosity.color}
            animate={reduce ? undefined : { y: [0, 6], opacity: [0, 1, 0] }} transition={loop(1.4, { ease: "easeIn" })} />
        )}
        {mood === "Sad" && (
          <motion.path d="M30 44 C 27 49, 27 52, 30 53 C 33 52, 33 49, 30 44 Z" fill={REGION_CONFIG.curiosity.color}
            animate={reduce ? undefined : { y: [0, 16], opacity: [0, 1, 1, 0] }} transition={loop(1.8, { ease: "easeIn" })} />
        )}
      </motion.g>
    </svg>
  );
}

function QuickMoodCheckIn({ updateStore, onSayWhy }: { updateStore?: (updater: (prev: Store) => Store) => void; onSayWhy?: (mood: string) => void }) {
  const [justLogged, setJustLogged] = React.useState<string | null>(null);
  // The last feeling logged, kept a little longer than the face so "Say
  // why" stays around long enough to be read and tapped.
  const [askWhy, setAskWhy] = React.useState<string | null>(null);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const askTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const logMood = (label: string, intensity: number) => {
    if (justLogged) return;
    updateStore?.((prev) => appendMoodCheckIn(prev, label, intensity));
    setJustLogged(label);
    setAskWhy(label);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (askTimerRef.current) clearTimeout(askTimerRef.current);
    clearTimerRef.current = setTimeout(() => setJustLogged(null), 2200);
    askTimerRef.current = setTimeout(() => setAskWhy(null), 9000);
  };
  React.useEffect(() => () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (askTimerRef.current) clearTimeout(askTimerRef.current);
  }, []);
  const tone = askWhy && askWhy in MOOD_TONES ? REGION_CONFIG[MOOD_TONES[askWhy as MoodKey]] : null;
  return (
    <div style={{ width: "100%", padding: "0 2px", position: "relative" }}>
      {/* The feeling you just logged, as a face that pops up above the row. */}
      <AnimatePresence>
        {justLogged && (justLogged in MOOD_TONES) && (
          <motion.div
            key={justLogged} role="img" aria-label={`${justLogged}`}
            initial={{ opacity: 0, scale: 0.4, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6, y: -10, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            style={{
              position: "absolute", right: 6, bottom: "100%", marginBottom: 2, zIndex: 4, pointerEvents: "none",
              display: "flex", alignItems: "center", gap: 6, padding: "6px 14px 6px 6px", borderRadius: 999,
              backgroundColor: "#FFFCF6", boxShadow: `0 12px 26px -14px ${REGION_CONFIG[MOOD_TONES[justLogged as MoodKey]].ink}, 0 0 0 1px rgba(42,38,33,0.06)`,
            }}
          >
            <MoodFace mood={justLogged as MoodKey} size={58} />
            <span style={{ ...hand, fontSize: 22, fontWeight: 600, color: REGION_CONFIG[MOOD_TONES[justLogged as MoodKey]].ink }}>{justLogged}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ ...hand, fontSize: 20, fontWeight: 600, color: ivBody, marginBottom: 4, height: 26, position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {/* The label swaps with a small lift so "Logged" reads as a
        response to the tap, not a flicker of text. */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={askWhy ?? "idle"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {askWhy ? `Logged: ${askWhy}` : "How are you right now?"}
          </motion.span>
        </AnimatePresence>
        {/* A tap on its own only records the word. Writing a line about
        it is what lets the app see which thoughts come with which feeling. */}
        <AnimatePresence>
          {askWhy && onSayWhy && tone && (
            <motion.button
              key="why" type="button" onClick={() => onSayWhy(askWhy)}
              initial={{ opacity: 0, x: 10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.94 }} transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.35 }}
              style={{
                ...sans, fontSize: 12, fontWeight: 700, color: "#fff", border: 0, cursor: "pointer", flexShrink: 0,
                display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: shape.full,
                background: `linear-gradient(135deg, ${tone.color}, ${tone.ink})`, boxShadow: `0 6px 14px -8px ${tone.ink}`, WebkitTapHighlightColor: "transparent",
              }}
            >
              <PenNib size={12} weight="fill" /> Say why
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <div className="no-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
        {QUICK_MOODS.map((m) => {
          const chosen = justLogged === m.label;
          return (
            <Breathe key={m.label} inline amount={1.05} style={{ flexShrink: 0 }}>
            <motion.button
              type="button" aria-label={`Log mood: ${m.label}`} onClick={() => logMood(m.label, m.intensity)}
              whileTap={{ scale: 0.95, opacity: 0.82 }}
              // The chosen pill fills and gives one small pulse; the others
              // settle back without any motion of their own.
              animate={chosen ? { scale: [1, 1.08, 1], backgroundColor: ivHeading } : { scale: 1, backgroundColor: ivSurfaceSolid }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ flexShrink: 0, border: 0, padding: "7px 12px", borderRadius: shape.full, cursor: "pointer", boxShadow: ivCardShadow, WebkitTapHighlightColor: "transparent" }}
            >
              <span style={{ ...sans, fontSize: 12, fontWeight: 700, color: chosen ? "#fff" : ivHeading, transition: "color 0.2s" }}>{m.label}</span>
            </motion.button>
            </Breathe>
          );
        })}
      </div>
    </div>
  );
}

// What one point in Home's field is, read right there — the Brain Map is
// for exploring, not for finding out what you just tapped. Shows the same
// facts the map's own panel leads with (region, the belief, how sure and
// on how much evidence) and offers the map as a next step, never as the
// only way to learn what a dot means.
// ── RegionBadge ──────────────────────────────────────────────────────────────
// The category badge: the region's pale tint under its dark ink (the two
// text-safe steps in REGION_CONFIG). It replaces the 9–10px tracked-caps
// eyebrow in faint gray that used to name the region — the least legible
// text in the app at 2.3:1. Sentence case, because a badge is a label,
// not a heading.
function RegionBadge({ region, size = 11 }: { region: CognitiveRegion; size?: number }) {
  const r = REGION_CONFIG[region];
  return (
    <span style={{ ...sans, fontSize: size, fontWeight: 600, lineHeight: 1, color: r.ink, backgroundColor: r.tint, padding: "4px 7px", borderRadius: 6, whiteSpace: "nowrap", flexShrink: 0 }}>
      {r.label}
    </span>
  );
}

function HomeNodeCard({ belief, onClose, onOpenInMap }: { belief: StoredBelief; onClose: () => void; onOpenInMap: () => void }) {
  const region = resolveRegion(belief);
  const color = REGION_CONFIG[region].color;
  return (
    <motion.div
      role="dialog" aria-label={`About this belief: ${belief.statement}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      // Leaves fast so tapping a second point swaps cards instead of
      // briefly stacking two.
      exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.14, ease: "easeIn" } }}
      transition={SETTLE}
      style={{
        position: "absolute", left: 20, right: 20, top: "44%", zIndex: 3,
        backgroundColor: ivSurfaceHigh, border: `1px solid ${ivBorder}`, borderRadius: shape.lg, padding: "14px 16px 12px",
        boxShadow: "0 14px 36px rgba(120,105,80,0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Node color={color} size={12} intensity={Math.min(1, 0.45 + (belief.confidence / 100) * 0.4)} />
        <RegionBadge region={region} />
        <span style={{ ...sans, fontSize: 12, color: ivBody, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{belief.domain}</span>
        <Breathe inline amount={1.1} style={{ lineHeight: 0 }}>
          <motion.button type="button" aria-label="Close" onClick={onClose} whileTap={{ opacity: 0.6 }} style={{ border: 0, background: "transparent", padding: 4, margin: -4, cursor: "pointer", color: ivFaint, lineHeight: 0, WebkitTapHighlightColor: "transparent" }}><X size={14} weight="bold" /></motion.button>
        </Breathe>
      </div>
      {belief.thoughtLabel && (
        <div style={{ ...sans, fontSize: 11, fontStyle: "italic", color: ivBody, marginTop: 8 }}>The "{belief.thoughtLabel}" thought</div>
      )}
      <div style={{ ...display, fontSize: 20, lineHeight: 1.4, color: ivHeading, marginTop: belief.thoughtLabel ? 3 : 8, wordBreak: "keep-all" }}>{belief.statement}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <MeterFill value={belief.confidence} color={color} track="rgba(42,38,33,0.08)" style={{ flex: 1 }} />
        <span style={{ ...mono, fontSize: 11, color: ivBody, flexShrink: 0 }}><AnimatedNumber value={belief.confidence} />% · {belief.evidenceCount} entr{belief.evidenceCount === 1 ? "y" : "ies"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <Breathe inline amount={1.05}>
          <motion.button type="button" onClick={onOpenInMap} whileTap={{ scale: 0.96, opacity: 0.8 }} transition={SETTLE}
            style={{ ...sans, fontSize: 12, fontWeight: 700, color: ivHeading, border: `1px solid ${ivBorder}`, background: "transparent", borderRadius: 999, padding: "6px 12px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            See it in your sky →
          </motion.button>
        </Breathe>
      </div>
    </motion.div>
  );
}

// ── Screen 4 · Home ────────────────────────────────────────────────────────────
// Kept to what Home is for, top to bottom: the day's date and the profile
// icon; the question; your beliefs as orbs (tap one to read it in place,
// or "Your sky" to open the full night sky); "Speak your mind"; and the
// quick mood check-in. Everything else — today's discovery, counts by
// region, search — lives on its own tab (Analysis, the sky, Diary).
function ScreenHome({ onNavSelect, onStartThink, onOpenBrainMap, store, updateStore }: { onNavSelect?: (id: string) => void; onStartThink?: (mood?: string) => void; onOpenBrainMap?: (region?: CognitiveRegion, beliefId?: string) => void; store: Store; updateStore?: (updater: (prev: Store) => Store) => void }) {
  // Tapping a point explains it in place (HomeNodeCard); the Brain Map
  // itself is entered only through its own button — or from that card.
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const selectedBelief = selectedNodeId ? store.beliefs.find((b) => b.id === selectedNodeId) ?? null : null;
  const daysAway = daysSinceLastEntry(store.history);

  return (
    <div
      style={{
        position: "absolute", top: -30, left: 0, right: 0, bottom: 0, ...ivBackground, overflow: "hidden",
        // Inside, a plain column: header, headline, the node field taking
        // whatever height is left, its caption bar, the bottom stack, nav.
        // Percent-of-screen placement used to let the caption and the
        // stack collide on a short phone; in a column only the field
        // gives way.
        display: "flex", flexDirection: "column",
        // Every other screen just fills its slot (height: 100%) below the
        // App shell's fixed status-bar clearance. Home is the one screen
        // whose composition is meant to run edge-to-edge under the
        // transparent status bar overlay (see the App shell), so instead
        // of asking the shared frame to change shape for it — the actual
        // cause of an earlier bug where switching screens made the whole
        // frame visibly jump — Home extends itself 30px above its given
        // slot instead. Header, node field, mind summary, Speak-your-mind
        // card, and nav all sit on the one ivory canvas by percentage, all
        // visible at once with no overflow:auto anywhere (unchanged from
        // before — only the backdrop and every surface's styling changed).
      }}
    >
      {/* top is a fixed px, not a %, specifically so it stays clear of
      the real device status bar / the desktop preview's transparent
      "9:41" overlay (see the App shell) regardless of screen height. */}
      <div style={{ padding: "34px 24px 0", flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        {/* Today's date, written the way a diary heads a page. */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, ...hand, fontSize: 21, fontWeight: 500, color: ivBody }}>
          <PenNib size={14} weight="fill" color={REGION_CONFIG.identity.color} aria-hidden />
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Breathe inline amount={1.08} style={{ lineHeight: 0 }}>
          <motion.div
            role="button" tabIndex={0} aria-label="Open profile" onClick={() => onNavSelect?.("profile")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavSelect?.("profile"); } }}
            whileTap={{ opacity: 0.6 }} style={{ cursor: "pointer" }}
          >
            <User size={20} color={ivHeading} />
          </motion.div>
          </Breathe>
        </div>
      </div>

      <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
        <div style={{ ...display, fontSize: "clamp(26px, 7.5vw, 34px)", fontWeight: 400, lineHeight: 1.24, color: ivHeading, wordBreak: "keep-all" }}>
          What thought crossed<br />your mind today?
        </div>
      </div>

      {(!MONETIZATION_ENABLED || store.isPro) ? (
        <>
          {/* Your beliefs as orbs (HomeOrbField: plain HTML, the same 2D orb
          the sky and every list use — it replaced a three.js canvas that
          froze Home for ~0.5s on every mount).
          Tapping an orb opens HomeNodeCard for that belief right here;
          tapping empty space just dismisses the card. The field never
          opens the Brain Map by itself any more — that's the explicit
          button in the corner (or the card's own link). */}
          <div data-tutorial="brain-card" data-shared="brain-jar" style={{ position: "relative", flex: 1, minHeight: 120, margin: "4px 4% 0" }}>
            <HomeOrbField
              beliefs={store.beliefs}
              selectedId={selectedNodeId}
              onSelectNode={(id) => setSelectedNodeId((cur) => (cur === id ? null : id))}
              onBackgroundTap={() => setSelectedNodeId(null)}
            />
            {/* With zero beliefs the canvas has nothing to draw, so a
                single resting dot marks where the first belief will
                appear (pointerEvents: none — nothing here to open yet). */}
            {/* The one way into the full sky from Home: a small link on the
                field's own corner, with the count it opens onto. */}
            {store.beliefs.length > 0 && (
              <div style={{ position: "absolute", right: 12, bottom: 6, zIndex: 2 }}>
                <Breathe inline amount={1.05}>
                  <motion.button
                    type="button" aria-label="Open your sky" onClick={() => onOpenBrainMap?.()}
                    whileTap={{ scale: 0.95 }} transition={SETTLE}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, borderRadius: shape.full, padding: "6px 12px 6px 10px", cursor: "pointer",
                      backgroundColor: "rgba(255,252,246,0.85)", boxShadow: ivCardShadow, WebkitTapHighlightColor: "transparent" }}
                  >
                    <Sparkle size={13} weight="fill" color={REGION_CONFIG.identity.color} />
                    <span style={{ ...hand, fontSize: 19, fontWeight: 600, color: ivHeading, lineHeight: 1 }}>Your sky</span>
                    <span style={{ ...hand, fontSize: 17, fontWeight: 500, color: ivBody, lineHeight: 1 }}>· <AnimatedNumber value={store.beliefs.length} memoryKey="home.beliefs" /> {store.beliefs.length === 1 ? "star" : "stars"}</span>
                  </motion.button>
                </Breathe>
              </div>
            )}
            {store.beliefs.length === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, pointerEvents: "none" }}>
                <motion.div
                  animate={{ scale: [1, 1.04, 1], opacity: [0.5, 0.75, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: 14, height: 14, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #C9B48A 0%, #A68F5E 70%, #8A7647 100%)", boxShadow: "0 0 18px rgba(166,143,94,0.35)" }}
                />
                <div style={{ ...display, fontStyle: "italic", fontSize: 15, color: ivFaint, textAlign: "center" }}>Your first thought will appear here.</div>
              </div>
            )}
          </div>
          <AnimatePresence>
            {selectedBelief && (
              <HomeNodeCard
                key={selectedBelief.id}
                belief={selectedBelief}
                onClose={() => setSelectedNodeId(null)}
                onOpenInMap={() => { setSelectedNodeId(null); onOpenBrainMap?.(undefined, selectedBelief.id); }}
              />
            )}
          </AnimatePresence>

        </>
      ) : (
        // Locked teaser instead of quietly rendering an always-empty
        // field — a free store's beliefs/connections never populate
        // (see appendUnanalyzedEntry in realStore.ts), so without this
        // a free user would just see an empty field forever with no
        // explanation why. Routes through onOpenBrainMap/"brainmap"
        // rather than a separate handler — that route already renders
        // ScreenPaywall for a non-Pro store.
        <motion.div
          data-tutorial="brain-card"
          role="button" tabIndex={0} onClick={() => onOpenBrainMap?.()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenBrainMap?.(); } }} whileTap={{ scale: 0.98, opacity: 0.92 }}
          style={{
            flex: 1, minHeight: 160, margin: "20px 18% 8px",
            backgroundColor: ivSurface, border: `1px solid ${ivBorder}`, cursor: "pointer", borderRadius: 24,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center",
          }}
        >
          <span style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "rgba(42,38,33,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LockSimple size={20} color={ivHeading} />
          </span>
          <div style={{ ...sans, fontSize: 15, fontWeight: 700, color: ivHeading }}>See your Brain Map</div>
          <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.5, wordBreak: "keep-all", maxWidth: 240 }}>
            Upgrade to Pro to see your unconscious beliefs light up and connect.
          </div>
        </motion.div>
      )}


      {/* The bottom stack sits in the column above the nav, so on a short
          phone it's the node field above that gives way, never the three
          things a person came here to do. */}
      <div style={{ padding: "14px 20px 10px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <div data-tutorial="think-card">
          <Breathe amount={1.025}>
          <motion.div
            role="button" tabIndex={0} onClick={() => onStartThink?.()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onStartThink)?.(); } }} whileTap={{ scale: 0.98, opacity: 0.92 }} transition={SETTLE}
            style={{ display: "flex", alignItems: "center", gap: 14, backgroundColor: ivSurfaceSolid, borderRadius: shape.lg, padding: "14px 18px", cursor: "pointer", boxShadow: ivCardShadow }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: ivHeading, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <WaveformIcon color="#fff" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ ...display, fontSize: 20, color: ivHeading }}>Speak your mind</span>
              <span style={{ ...hand, fontSize: 18, fontWeight: 500, color: ivBody, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{daysAway !== null && daysAway >= 2 ? `It's been ${daysAway} days` : "It's okay if it's not organized"}</span>
            </div>
            <ArrowRight size={16} color={ivHeading} weight="bold" style={{ flexShrink: 0 }} />
          </motion.div>
          </Breathe>
        </div>
        <QuickMoodCheckIn updateStore={updateStore} onSayWhy={(mood) => onStartThink?.(mood)} />
      </div>

      <div style={{ flexShrink: 0 }}>
        <BottomNav active="home" onSelect={onNavSelect} vintage />
      </div>
    </div>
  );
}

// Per-region count of active beliefs, using the exact same region
// classification the 3D brain itself uses (resolveRegion, exported from
// NeuralBeliefGraph3D) — so this list can never disagree with what the
// brain above it is actually showing.
function RegionBreakdown({ beliefs }: { beliefs: StoredBelief[] }) {
  const counts = new Map<CognitiveRegion, number>();
  COGNITIVE_REGIONS.forEach((r) => counts.set(r, 0));
  beliefs.forEach((b) => counts.set(resolveRegion(b), (counts.get(resolveRegion(b)) ?? 0) + 1));
  const total = beliefs.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {COGNITIVE_REGIONS.map((region) => {
        const count = counts.get(region) ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={region} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: REGION_CONFIG[region].color, flexShrink: 0 }} />
            <span style={{ ...sans, fontSize: 13, color: mdBodyLight, flex: 1 }}>{REGION_CONFIG[region].label}</span>
            <span style={{ ...mono, fontSize: 12, color: mdBody }}>{count}</span>
            <span style={{ ...mono, fontSize: 12, color: mdAccentText, width: 36, textAlign: "right" }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// Fallback for "related active neurons" — the crimson glow on the brain above is
// subtle at this card's small embed size (a real point in a dense field,
// not a big obvious marker), so this gives a guaranteed-legible list of
// exactly which beliefs make up today's discovery, plus the relationship
// note between them when the graph itself would already be drawing a line
// there — reuses store.connections rather than inventing a second notion
// of "related."
function DiscoveryBeliefList({ beliefIds, store, modernist = false }: { beliefIds: string[]; store: Store; modernist?: boolean }) {
  const items = beliefIds.map((id) => store.beliefs.find((b) => b.id === id)).filter((b): b is StoredBelief => !!b);
  if (items.length === 0) return null;
  const notes = store.connections.filter((c) => beliefIds.includes(c.a) && beliefIds.includes(c.b) && c.note);
  const tagBg = modernist ? mdNeutralTag : dkTrack;
  const tagText = modernist ? mdNeutralTagText : dkBody;
  const heading = modernist ? mdHeading : dkHeading;
  const body = modernist ? mdBody : dkBody;
  const noteBg = modernist ? mdAccentSoft : dkAccentSoft;
  const noteText = modernist ? mdAccentText : dkAccentLight;
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${modernist ? mdDivider : dkDivider}` }}>
      <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: body, letterSpacing: "0.06em" }}>
        The beliefs behind this discovery · the spots glowing on your brain
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {items.map((belief) => (
          <div key={belief.id} style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: tagBg, borderRadius: 12, padding: "10px 12px" }}>
            <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: tagText, flexShrink: 0 }}>{belief.domain}</span>
            <span style={{ ...display, fontSize: 15, color: heading, flex: 1, lineHeight: 1.4, wordBreak: "keep-all" }}>{belief.statement}</span>
            <span style={{ ...mono, fontSize: 11, color: tagText, flexShrink: 0 }}>{belief.confidence}%</span>
          </div>
        ))}
      </div>
      {notes.map((c, i) => (
        <div key={i} style={{ ...sans, fontSize: 12, color: noteText, backgroundColor: noteBg, borderRadius: 10, padding: "10px 12px", marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all" }}>
          {c.note}
        </div>
      ))}
    </div>
  );
}

// ── How you've changed ───────────────────────────────────────────────────────
// Five lenses on the same entries. They used to be five identical gray bar
// lists with cryptic tails ("62 · 1×", "1 toward · 0 away"), so the only
// way to tell them apart was the title. Now each one:
//   · leads with a plain one-line takeaway — the same sentence the closed
//     row shows as its subtitle, so the list reads before anything opens;
//   · has its own tint (borrowed from the region palette, so nothing new
//     enters the app's colors) and its own picture, matched to what it
//     measures: magnitude bars for feelings, a two-sided bar for value
//     direction, short explained cards for thinking habits, a calendar for
//     consistency, then-and-now numbers for self-talk;
//   · says what its numbers mean in words, under the picture.
const CHANGE_TINT: Record<"emotions" | "values" | "patterns" | "consistency" | "selfTalk", CognitiveRegion> = {
  emotions: "relationships",
  values: "security",
  patterns: "career",
  consistency: "curiosity",
  selfTalk: "identity",
};

const PLEASANT_FEELINGS = new Set([
  "calm", "happy", "joy", "relief", "gratitude", "grateful", "hope", "hopeful", "anticipation", "excitement", "excited",
  "pride", "proud", "contentment", "content", "love", "curiosity", "curious", "peace", "peaceful", "relaxed", "satisfied",
]);
const isPleasantFeeling = (label: string) => PLEASANT_FEELINGS.has(label.trim().toLowerCase());

function aggregateEmotions(history: StoredHistoryEntry[]) {
  const totals = new Map<string, { sum: number; count: number }>();
  history.forEach((entry) => {
    entry.analysis?.observation.emotions.forEach((em) => {
      const cur = totals.get(em.label) ?? { sum: 0, count: 0 };
      cur.sum += em.intensity;
      cur.count += 1;
      totals.set(em.label, cur);
    });
  });
  return Array.from(totals.entries())
    .map(([label, { sum, count }]) => ({ label, avg: Math.round(sum / count), count, pleasant: isPleasantFeeling(label) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6);
}

function aggregateValues(history: StoredHistoryEntry[]) {
  const totals = new Map<string, { toward: number; away: number; unclear: number }>();
  history.forEach((entry) => {
    const vd = entry.analysis?.interpretation.valueDirection;
    if (!vd) return;
    vd.relatedValues.forEach((value) => {
      const cur = totals.get(value) ?? { toward: 0, away: 0, unclear: 0 };
      cur[vd.towardOrAway] += 1;
      totals.set(value, cur);
    });
  });
  return Array.from(totals.entries())
    .map(([label, t]) => ({ label, ...t, total: t.toward + t.away + t.unclear }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

function aggregatePatterns(history: StoredHistoryEntry[]) {
  const counts = new Map<string, number>();
  history.forEach((entry) => {
    entry.analysis?.interpretation.possibleCognitivePatterns.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1));
  });
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 6);
}

// "A common habit of mind that holds yourself to…" → "Holds yourself to…"
function plainPatternDescription(label: string): string {
  const d = COGNITIVE_PATTERN_DESCRIPTIONS[label as keyof typeof COGNITIVE_PATTERN_DESCRIPTIONS] ?? "";
  const s = d.replace(/^A common habit of mind that /, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const RECORDING_HEATMAP_WEEKS = 12;
type HeatmapDay = { date: Date; count: number; isFuture: boolean };

// Sun–Sat columns, the most recent week last, GitHub-contribution style.
// The window ends on the Saturday of the week of the *latest entry* (not
// of today), the same anchoring the Analysis tab's Recent weeks uses: a
// person who hasn't written this month still sees the shape of when they
// did write, instead of twelve weeks of empty squares. Days after that
// entry are marked isFuture and drawn as empty space.
function buildRecordingHeatmapWeeks(history: StoredHistoryEntry[], numWeeks = RECORDING_HEATMAP_WEEKS): { weeks: HeatmapDay[][]; anchor: Date } {
  const counts = new Map<string, number>();
  let latest: Date | null = null;
  history.forEach((e) => {
    const d = parseDotDate(e.date);
    if (!d) return;
    counts.set(d.toDateString(), (counts.get(d.toDateString()) ?? 0) + 1);
    if (!latest || d > latest) latest = d;
  });
  const anchor = new Date(latest ?? new Date());
  anchor.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(anchor);
  endOfWeek.setDate(anchor.getDate() + (6 - anchor.getDay()));
  const start = new Date(endOfWeek);
  start.setDate(endOfWeek.getDate() - numWeeks * 7 + 1);
  const weeks: HeatmapDay[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < numWeeks; w++) {
    const week: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(cursor);
      const isFuture = dayDate > anchor;
      week.push({ date: dayDate, count: isFuture ? 0 : counts.get(dayDate.toDateString()) ?? 0, isFuture });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return { weeks, anchor };
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The takeaway sentence for each lens — shown as the closed row's subtitle
// and again as the opened body's first line. null means "no data yet".
type ChangeSummaries = Record<keyof typeof CHANGE_TINT, string | null>;
function summarizeChanges(history: StoredHistoryEntry[]): ChangeSummaries {
  const emotions = aggregateEmotions(history);
  const values = aggregateValues(history);
  const patterns = aggregatePatterns(history);
  const { weeks, anchor } = buildRecordingHeatmapWeeks(history);
  const days = weeks.flat().filter((d) => !d.isFuture && d.count > 0);
  const selfTalk = buildSelfTalkWeeks(history);

  const toward = [...values].filter((v) => v.toward > 0).sort((a, b) => b.toward - a.toward)[0];
  const away = [...values].filter((v) => v.away > 0).sort((a, b) => b.away - a.away)[0];
  const allSameCount = patterns.length > 1 && patterns.every((p) => p.count === patterns[0].count);
  const weekdayCounts = new Array(7).fill(0);
  days.forEach((d) => { weekdayCounts[d.date.getDay()] += d.count; });
  const topWeekday = weekdayCounts.indexOf(Math.max(...weekdayCounts));
  const firstRate = selfTalk[0]?.cognitiveVerbPerHundredWords ?? 0;
  const lastRate = selfTalk[selfTalk.length - 1]?.cognitiveVerbPerHundredWords ?? 0;

  return {
    emotions: emotions.length ? `${emotions[0].label} has been the strongest feeling — ${emotions[0].avg} out of 100 on average.` : null,
    values: toward && away ? `Moving toward ${toward.label}, drifting from ${away.label}.`
      : toward ? `Mostly moving toward ${toward.label}.`
      : away ? `Drifting from ${away.label} more than toward anything.`
      : values.length ? "No clear direction yet — entries touch your values without leaning either way." : null,
    patterns: !patterns.length ? null
      : allSameCount ? `${patterns.length} habits of mind showed up, ${patterns[0].count === 1 ? "once each" : `${patterns[0].count} times each`}.`
      : `${patterns[0].label} comes up most — ${patterns[0].count} ${patterns[0].count === 1 ? "time" : "times"}.`,
    consistency: days.length
      ? `You wrote on ${days.length} ${days.length === 1 ? "day" : "days"} in the ${RECORDING_HEATMAP_WEEKS} weeks to ${shortMonthDay(formatDateDots(anchor))}${days.length > 1 ? `, most often on ${WEEKDAY_NAMES[topWeekday]}s` : ""}.`
      : null,
    selfTalk: selfTalk.length < 2 ? null
      : firstRate < 0.05 && lastRate >= 0.05 ? `You've started using reflective words — ${lastRate.toFixed(1)}% of what you wrote lately, none at first.`
      : lastRate > firstRate + 0.3 ? `You use more reflective words lately — ${firstRate.toFixed(1)}% then, ${lastRate.toFixed(1)}% now.`
      : lastRate < firstRate - 0.3 ? `You use fewer reflective words lately — ${firstRate.toFixed(1)}% then, ${lastRate.toFixed(1)}% now.`
      : `Your reflective language has held steady, around ${lastRate.toFixed(1)}% of your words.`,
  };
}

function ChangeEmpty({ children }: { children: React.ReactNode }) {
  return <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, wordBreak: "keep-all" }}>{children}</div>;
}
function ChangeNote({ children }: { children: React.ReactNode }) {
  return <div style={{ ...sans, fontSize: 12, color: ivBody, lineHeight: 1.55, marginTop: 12, wordBreak: "keep-all" }}>{children}</div>;
}

// Feelings: which ones, how strong. A balance bar first (lighter vs.
// heavier feelings, weighted by strength), then one bar per feeling in its
// tone. The tone is a second, quieter cue beside the label — the words do
// the identifying.
function ChangeEmotions({ history }: { history: StoredHistoryEntry[] }) {
  const rows = aggregateEmotions(history);
  if (rows.length === 0) return <ChangeEmpty>No feelings recorded yet. They show up here after a few entries.</ChangeEmpty>;
  const light = REGION_CONFIG.security;
  const heavy = REGION_CONFIG.relationships;
  const weight = (pleasant: boolean) => rows.filter((r) => r.pleasant === pleasant).reduce((s, r) => s + r.avg * r.count, 0);
  const lightShare = Math.round((weight(true) / Math.max(1, weight(true) + weight(false))) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", ...sans, fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: light.ink, fontWeight: 600 }}>Lighter {lightShare}%</span>
        <span style={{ color: heavy.ink, fontWeight: 600 }}>Heavier {100 - lightShare}%</span>
      </div>
      <div
        role="img" aria-label={`Lighter feelings ${lightShare} percent, heavier feelings ${100 - lightShare} percent.`}
        style={{ height: 10, borderRadius: 5, backgroundImage: `linear-gradient(90deg, ${light.color} 0%, ${light.color} ${Math.max(0, lightShare - 6)}%, ${heavy.color} ${Math.min(100, lightShare + 6)}%, ${heavy.color} 100%)` }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ ...sans, fontSize: 14, fontWeight: 500, color: ivHeading }}>{r.label}</span>
              <span style={{ ...mono, fontSize: 12, color: ivBody }}>{r.avg}<span style={{ color: ivFaint }}> / 100</span></span>
            </div>
            <MeterFill value={r.avg} color={(r.pleasant ? light : heavy).color} track="rgba(42,38,33,0.07)" height={6} radius={3} />
          </div>
        ))}
      </div>
      <ChangeNote>Each bar is how strong that feeling was, on average, on the days it came up. Green leans light, rose leans heavy.</ChangeNote>
    </div>
  );
}

// Values: a two-sided bar per value — away to the left of the center line,
// toward to the right — so direction is the first thing the eye gets.
function ChangeValues({ history }: { history: StoredHistoryEntry[] }) {
  const rows = aggregateValues(history);
  if (rows.length === 0) return <ChangeEmpty>No value directions yet. They show up here after a few entries.</ChangeEmpty>;
  const toward = REGION_CONFIG.security;
  const away = REGION_CONFIG.creativity;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.toward, r.away)));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", ...sans, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
        <span style={{ color: away.ink }}>← Away from it</span>
        <span style={{ color: toward.ink }}>Toward it →</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((r) => (
          <div key={r.label} role="img" aria-label={`${r.label}: ${r.toward} toward, ${r.away} away.`}>
            <div style={{ ...sans, fontSize: 14, fontWeight: 500, color: ivHeading, textAlign: "center", marginBottom: 5 }}>{r.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...mono, fontSize: 12, color: r.away ? away.ink : ivFaint, width: 14, textAlign: "right" }}>{r.away}</span>
              <div style={{ flex: 1, height: 8, borderRadius: "4px 0 0 4px", backgroundColor: "rgba(42,38,33,0.06)", display: "flex", justifyContent: "flex-end", overflow: "hidden" }}>
                <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: `${(r.away / max) * 100}%`, height: "100%", transformOrigin: "right", backgroundImage: `linear-gradient(270deg, ${away.color}66, ${away.color})` }} />
              </div>
              <span aria-hidden style={{ width: 2, height: 16, borderRadius: 1, backgroundColor: ivFaint, flexShrink: 0 }} />
              <div style={{ flex: 1, height: 8, borderRadius: "0 4px 4px 0", backgroundColor: "rgba(42,38,33,0.06)", overflow: "hidden" }}>
                <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: `${(r.toward / max) * 100}%`, height: "100%", transformOrigin: "left", backgroundImage: `linear-gradient(90deg, ${toward.color}66, ${toward.color})` }} />
              </div>
              <span style={{ ...mono, fontSize: 12, color: r.toward ? toward.ink : ivFaint, width: 14 }}>{r.toward}</span>
            </div>
          </div>
        ))}
      </div>
      <ChangeNote>The numbers are entries. "Toward" means what you did that day moved you closer to something you care about; "away" means it pulled you from it.</ChangeNote>
    </div>
  );
}

// Thinking habits: each one named, counted, and explained in a sentence —
// the explanation is what makes "Mental filtering" mean something.
function ChangePatterns({ history }: { history: StoredHistoryEntry[] }) {
  const rows = aggregatePatterns(history);
  if (rows.length === 0) return <ChangeEmpty>No thinking habits spotted yet. They show up here after a few entries.</ChangeEmpty>;
  const tone = REGION_CONFIG.career;
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ borderRadius: shape.sm, backgroundImage: `linear-gradient(135deg, ${tone.tint} 0%, rgba(255,255,255,0.6) 100%)`, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ ...sans, fontSize: 14, fontWeight: 600, color: tone.ink }}>{r.label}</span>
              <span style={{ ...mono, fontSize: 12, color: tone.ink, flexShrink: 0 }}>{r.count}×</span>
            </div>
            <div style={{ ...sans, fontSize: 12.5, color: ivHeading, opacity: 0.8, lineHeight: 1.5, marginTop: 4, wordBreak: "keep-all" }}>{plainPatternDescription(r.label)}</div>
          </div>
        ))}
      </div>
      <ChangeNote>These are common habits of mind from CBT, not diagnoses. Noticing one is the point — it isn't something to fix.</ChangeNote>
    </div>
  );
}

// Consistency: a twelve-week calendar in the module's blue, with month
// labels across the top and weekday initials down the side.
function ChangeConsistency({ history }: { history: StoredHistoryEntry[] }) {
  const { weeks } = React.useMemo(() => buildRecordingHeatmapWeeks(history), [history]);
  const tone = REGION_CONFIG.curiosity;
  const recorded = weeks.flat().filter((d) => !d.isFuture && d.count > 0);
  if (recorded.length === 0) return <ChangeEmpty>No entries yet. Each day you write fills in a square here.</ChangeEmpty>;
  const cellColor = (d: HeatmapDay) => (d.isFuture ? "transparent" : d.count === 0 ? "rgba(42,38,33,0.06)" : d.count === 1 ? `${tone.color}99` : tone.ink);
  const cell = 20;
  const gap = 4;
  const label = `Days written in the last ${RECORDING_HEATMAP_WEEKS} weeks: ${recorded.map((d) => shortMonthDay(formatDateDots(d.date))).join(", ")}.`;
  return (
    <div>
      <div role="img" aria-label={label} style={{ display: "flex", gap: 6 }}>
        <div aria-hidden style={{ display: "flex", flexDirection: "column", gap, paddingTop: 13 + gap }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} style={{ ...sans, fontSize: 10, lineHeight: `${cell}px`, height: cell, color: i % 2 ? ivBody : "transparent" }}>{d}</span>
          ))}
        </div>
        <div aria-hidden style={{ display: "flex", gap, overflowX: "auto" }} className="no-scrollbar">
          {weeks.map((week, wi) => {
            const first = week[0].date;
            const showMonth = wi === 0 || first.getDate() <= 7;
            return (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap, flexShrink: 0 }}>
                <span style={{ ...sans, fontSize: 10, height: 13, color: ivBody, whiteSpace: "nowrap", width: cell, overflow: "visible" }}>
                  {showMonth ? first.toLocaleDateString("en-US", { month: "short" }) : ""}
                </span>
                {week.map((day, di) => (
                  <div key={di} title={day.isFuture ? undefined : `${formatDateDots(day.date)} · ${day.count} ${day.count === 1 ? "entry" : "entries"}`}
                    style={{ width: cell, height: cell, borderRadius: 5, backgroundColor: cellColor(day) }} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, ...sans, fontSize: 11, color: ivBody }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: "rgba(42,38,33,0.06)" }} /> none
        <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: `${tone.color}99`, marginLeft: 6 }} /> one entry
        <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: tone.ink, marginLeft: 6 }} /> more
      </div>
    </div>
  );
}

// Self-talk: two then-and-now numbers instead of a per-week bar list —
// how much reflective language ("think", "realize", "notice"), and how
// much the writing is about "I" versus other people.
function ChangeSelfTalk({ history }: { history: StoredHistoryEntry[] }) {
  const weeks = buildSelfTalkWeeks(history);
  if (weeks.length < 2) return <ChangeEmpty>This needs entries from at least two different weeks to compare.</ChangeEmpty>;
  const tone = REGION_CONFIG.identity;
  const other = REGION_CONFIG.curiosity;
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const delta = last.cognitiveVerbPerHundredWords - first.cognitiveVerbPerHundredWords;
  const TrendIcon = delta > 0.3 ? ArrowUpRight : delta < -0.3 ? ArrowDownRight : Minus;
  const iShare = (w: SelfTalkWeek) => {
    const t = w.firstPersonSingularCount + w.collectiveOrOtherCount;
    return t > 0 ? Math.round((w.firstPersonSingularCount / t) * 100) : null;
  };
  const lastShare = iShare(last);
  const firstShare = iShare(first);
  const tile: React.CSSProperties = { flex: 1, minWidth: 140, borderRadius: shape.sm, padding: "12px 13px", backgroundImage: `linear-gradient(150deg, ${tone.tint} 0%, rgba(255,255,255,0.65) 100%)` };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={tile}>
          <div style={{ ...sans, fontSize: 12, color: tone.ink, fontWeight: 600 }}>Reflective words</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{ ...mono, fontSize: 24, fontWeight: 700, color: ivHeading }}>{last.cognitiveVerbPerHundredWords.toFixed(1)}%</span>
            <TrendIcon size={18} weight="bold" color={tone.ink} />
          </div>
          <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 2 }}>{first.cognitiveVerbPerHundredWords < 0.05 ? "none" : `was ${first.cognitiveVerbPerHundredWords.toFixed(1)}%`} the week of {shortMonthDay(first.weekStart)}</div>
        </div>
        <div style={tile}>
          <div style={{ ...sans, fontSize: 12, color: tone.ink, fontWeight: 600 }}>About you vs. others</div>
          {lastShare === null ? (
            <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 8 }}>No pronouns counted yet.</div>
          ) : (
            <>
              <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginTop: 10, backgroundImage: `linear-gradient(90deg, ${tone.color} 0%, ${tone.color} ${Math.max(0, lastShare - 5)}%, ${other.color} ${Math.min(100, lastShare + 5)}%, ${other.color} 100%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", ...sans, fontSize: 12, marginTop: 5 }}>
                <span style={{ color: tone.ink, fontWeight: 600 }}>"I" {lastShare}%</span>
                <span style={{ color: other.ink, fontWeight: 600 }}>"we/they" {100 - lastShare}%</span>
              </div>
              {firstShare !== null && firstShare !== lastShare && (
                <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 2 }}>"I" was {firstShare}% at first</div>
              )}
            </>
          )}
        </div>
      </div>
      <ChangeNote>Reflective words — "think", "realize", "notice" — as a share of everything you wrote that week. More of them often means stepping back from a feeling to look at it.</ChangeNote>
    </div>
  );
}

// A reserved, clearly-labeled slot for an analysis module that doesn't
// exist yet — honest about what it is instead of shipping a fake chart
// with no real data behind it.
function ComingSoonRow({ label, last }: { label: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 2px", borderBottom: last ? "none" : `1px solid ${mdDivider}` }}>
      <span style={{ ...sans, fontSize: 13, color: mdFaint }}>{label}</span>
      <span style={{ ...sans, fontSize: 11, fontWeight: 700, color: mdBody, backgroundColor: mdNeutralTag, padding: "3px 9px", borderRadius: 999 }}>Coming soon</span>
    </div>
  );
}



// Powers the weekly-summary Notification (see App()'s effect near the
// daily-reminder one) — not a component, just the same kind of real
// aggregation CognitivePatternFrequency does above, scoped to the last 7
// days instead of all-time. Returns null when there's nothing to report
// (no entries this week) so the caller can skip firing an empty
// notification rather than sending "0 thoughts this week."
function computeWeeklySummary(history: StoredHistoryEntry[]): { entryCount: number; topPattern: string | null } | null {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recent = history.filter((e) => {
    const d = parseDotDate(e.date);
    return !!d && d >= sevenDaysAgo && d <= now;
  });
  if (recent.length === 0) return null;

  const patternCounts = new Map<string, number>();
  recent.forEach((e) => {
    e.analysis?.interpretation.possibleCognitivePatterns.forEach((p) => {
      patternCounts.set(p, (patternCounts.get(p) ?? 0) + 1);
    });
  });
  const topPattern = Array.from(patternCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { entryCount: recent.length, topPattern };
}


type SelfTalkWeek = {
  weekStart: string;
  cognitiveVerbPerHundredWords: number;
  firstPersonSingularCount: number;
  collectiveOrOtherCount: number;
};

// Only entries that actually carry languageObservation contribute (older
// entries from before Feature 2 existed won't) — weeks with real entries
// but zero observation data simply don't produce a bucket, rather than a
// misleading zero-rate week.
function buildSelfTalkWeeks(history: StoredHistoryEntry[], maxWeeks = 8): SelfTalkWeek[] {
  const buckets = new Map<string, { words: number; verbs: number; firstPerson: number; collective: number }>();
  history.forEach((e) => {
    const obs = e.languageObservation;
    const d = parseDotDate(e.date);
    if (!obs || !d) return;
    const key = formatDateDots(mondayOfWeek(d));
    const cur = buckets.get(key) ?? { words: 0, verbs: 0, firstPerson: 0, collective: 0 };
    cur.words += obs.wordCount;
    cur.verbs += obs.cognitiveVerbCount;
    cur.firstPerson += obs.firstPersonSingularCount;
    cur.collective += obs.collectiveOrOtherCount;
    buckets.set(key, cur);
  });
  return Array.from(buckets.entries())
    .map(([weekStart, b]) => ({
      weekStart,
      cognitiveVerbPerHundredWords: b.words > 0 ? (b.verbs / b.words) * 100 : 0,
      firstPersonSingularCount: b.firstPerson,
      collectiveOrOtherCount: b.collective,
    }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)) // lexicographic sort is safe: fixed-width zero-padded "YYYY.MM.DD"
    .slice(-maxWeeks);
}



// The one shared agree/disagree control — used compactly in the hero (a
// quick read, available before the user has even scrolled) and again in
// the Reflection section further down (where disagreeing also asks what
// specifically didn't land). Both touchpoints read/write the exact same
// reaction, so they can never contradict each other about what the user
// actually said.
function ReactionButtons({ reaction, onReact, disabled, dark, modernist, night }: { reaction: "agree" | "disagree" | null | undefined; onReact?: (r: "agree" | "disagree") => void; disabled?: boolean; dark?: boolean; modernist?: boolean; night?: boolean }) {
  // "night" — Examine/Analysis's own quiet ivory reaction pair, distinct
  // from "dark"/"modernist" below.
  if (night) {
    return (
      <div style={{ display: "flex", gap: 10, opacity: disabled ? 0.55 : 1 }}>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("agree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, border: `1px solid ${ivHeading}`, backgroundColor: ivHeading, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 13, fontWeight: 700, color: "#fff" }}>I agree</span>
        </motion.div></Breathe>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("disagree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, border: `1px solid ${ivBorder}`, backgroundColor: "transparent", cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 13, fontWeight: 700, color: ivBody }}>Doesn't feel right</span>
        </motion.div></Breathe>
      </div>
    );
  }
  if (modernist) {
    return (
      <div style={{ display: "flex", gap: 8, opacity: disabled ? 0.55 : 1 }}>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("agree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 14, backgroundColor: mdHeading, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 13, fontWeight: 800, color: "#fff" }}>I agree</span>
        </motion.div></Breathe>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("disagree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 14, border: `1px solid ${mdDivider}`, backgroundColor: "transparent", cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 13, fontWeight: 800, color: mdHeading }}>Doesn't feel right</span>
        </motion.div></Breathe>
      </div>
    );
  }
  if (dark) {
    return (
      <div style={{ display: "flex", gap: 10, opacity: disabled ? 0.55 : 1 }}>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("agree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, backgroundColor: dkAccent, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 15, fontWeight: 600, color: "#fff" }}>I agree</span>
        </motion.div></Breathe>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("disagree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, border: `1px solid ${dkCardBorder}`, backgroundColor: dkTrack, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 15, fontWeight: 600, color: dkBodyLight }}>Doesn't feel right</span>
        </motion.div></Breathe>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 10, opacity: disabled ? 0.55 : 1 }}>
      <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
        role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("agree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
        style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, border: `1px solid ${reaction === "agree" ? ink : hair}`, backgroundColor: reaction === "agree" ? ink : "transparent", cursor: disabled ? "default" : "pointer" }}
      >
        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: reaction === "agree" ? "#fff" : ink }}>I agree</span>
      </motion.div></Breathe>
      <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
        role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("disagree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
        style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, border: `1px solid ${reaction === "disagree" ? tension : hair}`, backgroundColor: reaction === "disagree" ? tension : "transparent", cursor: disabled ? "default" : "pointer" }}
      >
        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: reaction === "disagree" ? "#fff" : ink }}>Doesn't feel right</span>
      </motion.div></Breathe>
    </div>
  );
}

// The single interactive agree/disagree point for a discovery (the hero
// above just shows a static preview — see ScreenAnalysis). Disagreeing
// doesn't just record a reason anymore: it asks the model for a genuinely
// different reading of the same evidence and swaps the discovery's text
// in place, looping until the user agrees or the model has nothing more to
// offer (reinterpreting/exhausted, driven by rejectedStatements/
// rejectedTitles — see analysisFramework's /api/reinterpret).
function DiscoveryReflection({
  reaction,
  reinterpreting,
  exhausted,
  onReact,
}: {
  reaction: "agree" | "disagree" | null | undefined;
  reinterpreting?: boolean;
  exhausted?: boolean;
  onReact?: (r: "agree" | "disagree") => void;
}) {
  // Once a discovery is settled — agreed with, or reinterpretation
  // exhausted — there's nothing left to press, so the buttons themselves
  // go away instead of sitting there disabled. Only the still-open states
  // (fresh, or a reinterpretation in flight that might still land on
  // something to react to) keep showing them.
  const settled = reaction === "agree" || exhausted;
  return (
    <div>
      <p style={{ ...sans, fontSize: 15, color: ivHeading, margin: "0 0 6px", lineHeight: 1.5 }}>Does this observation match your experience right now?</p>
      {/* Observer-self framing (ACT: self-as-context) — agree/disagree here
          isn't a verdict on whether the thought is true, just whether this
          reading of it matches what was actually noticed. */}
      <p style={{ ...display, fontStyle: "italic", fontSize: 15, color: ivBody, margin: "0 0 16px", lineHeight: 1.5, wordBreak: "keep-all" }}>
        This isn't about deciding whether to believe this thought. It's just about whether it fits who you are right now.
      </p>
      {reinterpreting && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0" }}>
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: ivHeading }}
          />
          <span style={{ ...sans, fontSize: 13, color: ivBody }}>Reconsidering...</span>
        </div>
      )}
      {!settled && !reinterpreting && <ReactionButtons reaction={reaction} onReact={onReact} night />}
      {settled && exhausted && (
        <p style={{ ...sans, fontSize: 13, color: ivBody, margin: "0 0 12px" }}>We can't come up with a new interpretation right now. We'll take another look next time.</p>
      )}
      {settled && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${ivHeading}`, color: ivHeading, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</span>
          <span style={{ ...sans, fontSize: 13, color: ivBody }}>{exhausted ? "That's as far as we've gotten for now." : "You accepted this observation."}</span>
        </div>
      )}
    </div>
  );
}

// ── Examine, sectioned ───────────────────────────────────────────────────────
// Examine used to be one column of ivory serif under identical tracked-caps
// labels, so every section looked like the one before it and nothing said
// where you were on the page. Each section now has its own header (a
// tinted icon tile and a sentence-case title, the same grammar as History's
// "How you've changed"), and its content takes the form of what it is: the
// discovery as a card in its region's color with a confidence ring, your
// own words as speech bubbles, the history of the thought as a lit trail.
function ExamineSectionHeader({ region, icon, title, subtitle }: { region: CognitiveRegion; icon: React.ReactNode; title: string; subtitle?: string }) {
  const tone = REGION_CONFIG[region];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
      <span style={{ ...settingsTile, width: 32, height: 32, borderRadius: 9, backgroundColor: tone.tint, color: tone.ink }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...display, fontSize: 20, color: ivHeading, lineHeight: 1.25 }}>{title}</div>
        {subtitle && <div style={{ ...hand, fontSize: 19, fontWeight: 500, color: ivBody, marginTop: 1, lineHeight: 1.2, wordBreak: "keep-all" }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function ExamineSection({ region, icon, title, subtitle, children, style }: { region: CognitiveRegion; icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ marginTop: 36, ...style }}>
      <ExamineSectionHeader region={region} icon={icon} title={title} subtitle={subtitle} />
      {children}
    </section>
  );
}

// A ring that fills to the confidence value when it scrolls into view.
function ConfidenceRing({ value, color, size = 64 }: { value: number; color: string; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}% confidence`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(42,38,33,0.08)" strokeWidth="5" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - pct) }} viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
      />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={size * 0.25} fontWeight="700" fontFamily={MONO_FAMILY} fill="#2A2621">{value}%</text>
    </svg>
  );
}

// The discovery itself: a card washed in its region's color, the region's
// orb glowing in the corner, the statement, and the confidence ring.
function ExamineHero({ kicker, thoughtLabel, text, confidence, entries, region }: { kicker: string; thoughtLabel?: string; text: string; confidence: number; entries: number; region: CognitiveRegion }) {
  const tone = REGION_CONFIG[region];
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: shape.lg, padding: "18px 18px 16px", boxShadow: ivCardShadow, backgroundImage: `linear-gradient(155deg, ${tone.tint} 0%, #FBF8F2 62%, #FBF8F2 100%)` }}>
      <div aria-hidden style={{ position: "absolute", top: -6, right: -6 }}>
        <Node color={tone.color} size={34} intensity={0.85} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...sans, fontSize: 12, fontWeight: 600, color: ivHeading, backgroundColor: "rgba(255,255,255,0.7)", padding: "4px 9px", borderRadius: shape.full }}>
          <Sparkle size={12} weight="fill" color={tone.ink} /> {kicker}
        </span>
        <RegionBadge region={region} />
      </div>
      {thoughtLabel && (
        <p style={{ ...display, fontStyle: "italic", fontSize: 17, color: tone.ink, margin: "14px 0 0" }}>The "{thoughtLabel}" thought showed up again</p>
      )}
      <p style={{ ...display, fontSize: 22, lineHeight: 1.38, color: ivHeading, margin: "8px 0 0", paddingRight: 24, wordBreak: "keep-all" }}>{text}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${ivDivider}` }}>
        <ConfidenceRing value={confidence} color={tone.color} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...sans, fontSize: 14, fontWeight: 500, color: ivHeading }}>How sure the AI is</div>
          <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 2, lineHeight: 1.45 }}>
            Based on {entries} {entries === 1 ? "thing you said" : "things you said"}. It never reaches 100%.
          </div>
        </div>
      </div>
    </div>
  );
}

// One thing you actually said, as a speech bubble in the color of the
// area of life it came from. Entries pointing the other way sit on the
// right in a warm tone, so for and against read apart at a glance.
function EvidenceBubble({ date, quote, domain, against, index }: { date: string; quote: string; domain?: string; against?: boolean; index: number }) {
  const region = domain ? resolveRegion({ domain } as StoredBelief) : "identity";
  const tone = against ? REGION_CONFIG.creativity : REGION_CONFIG[region];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
      style={{ display: "flex", flexDirection: "column", alignItems: against ? "flex-end" : "flex-start" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, padding: "0 6px" }}>
        <span style={{ ...mono, fontSize: 11, color: ivBody }}>{date}</span>
        {domain && <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: tone.ink }}>{domain}</span>}
      </div>
      <div style={{
        position: "relative", maxWidth: "88%", padding: "11px 14px", ...display, fontStyle: "italic", fontSize: 17, lineHeight: 1.5, color: ivHeading, wordBreak: "keep-all",
        backgroundImage: `linear-gradient(140deg, ${tone.tint} 0%, rgba(255,255,255,0.85) 100%)`,
        borderRadius: against ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
      }}>
        "{quote}"
      </div>
    </motion.div>
  );
}

// A vertical "watch it develop" chain — origin, current understanding, and
// (when there's a real recorded one) an outcome. Only ever built from
// points that trace back to something actually recorded; never a
// fabricated midpoint. Drawn as a trail that warms from faint to the
// region's color, each point a small orb, the outcome as its own card.
function EvolutionTimeline({ points, color = ivHeading }: { points: { label: string; text: string; accent?: boolean }[]; color?: string }) {
  return (
    <div style={{ position: "relative" }}>
      {points.length > 1 && (
        <span aria-hidden style={{ position: "absolute", left: 13, top: 14, bottom: 26, width: 2, borderRadius: 1, backgroundImage: `linear-gradient(180deg, ${color}22 0%, ${color} 100%)` }} />
      )}
      {points.map((p, i) => (
        <motion.div
          key={i} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.12 }}
          style={{ display: "flex", gap: 10, paddingBottom: i < points.length - 1 ? 16 : 0 }}
        >
          <span style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Node color={color} size={p.accent ? 14 : 9} intensity={p.accent ? 0.95 : 0.35 + (i / Math.max(1, points.length - 1)) * 0.4} />
          </span>
          <div style={{
            flex: 1, minWidth: 0, paddingTop: 3,
            ...(p.accent ? { padding: "10px 12px", borderRadius: shape.sm, backgroundImage: `linear-gradient(140deg, ${color}26 0%, rgba(255,255,255,0.7) 100%)` } : {}),
          }}>
            <div style={{ ...mono, fontSize: 11, color: p.accent ? ivHeading : ivBody, marginBottom: 3 }}>{p.label}</div>
            <p style={{ ...display, fontStyle: "italic", fontSize: 17, color: p.accent ? ivHeading : ivBody, margin: 0, lineHeight: 1.45, wordBreak: "keep-all" }}>{p.text}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}



// The Analysis tab's one layout primitive — a raised white card on the
// screen's surface-tinted background (see ScreenAnalysis), Apple grouped-
// list style: elevation instead of a border does the work a thin `hair`
// divider used to (and couldn't, since surface-on-page is barely visible).
// Every section from "why" onward is one of these, so the page reads as
// distinct, scannable groups rather than one continuous flow of text.
function SectionCard({ title, subtitle, children, dataTutorial }: { title?: string; subtitle?: string; children: React.ReactNode; dataTutorial?: string }) {
  return (
    <div data-tutorial={dataTutorial} style={{ backgroundColor: mdCard, borderRadius: 20, padding: "22px 20px", boxShadow: mdCardShadow }}>
      {title && <div style={{ ...display, fontSize: 20, color: mdHeading, marginBottom: subtitle ? 4 : 18 }}>{title}</div>}
      {subtitle && <div style={{ ...sans, fontSize: 13, color: mdBody, marginBottom: 16, lineHeight: 1.5, wordBreak: "keep-all" }}>{subtitle}</div>}
      {children}
    </div>
  );
}

// ── Screen 4.5 · Mind ──────────────────────────────────────────────────────────
// Just the belief network now — the discovery/evidence/evolution/reflection
// conversation that used to share this screen with it moved out to its own
// "Analysis" tab (see ScreenDiscoveryAnalysis and the "discoveryAnalysis"
// case in the App shell below), leaving this one to answer a single
// question: "what does my confirmed belief network actually look like?"
// ── ConnectionThread ─────────────────────────────────────────────────────────
// Two beliefs and what joins them, drawn: each belief a glowing orb in its
// own color, a woven thread between them that shades from one color to the
// other, and light traveling along it both ways — each orb flaring as the
// light reaches it, because the two keep feeding each other. The note
// that explains the connection sits under the picture as a quote, its
// first clause set larger, so the idea lands before the sentence does.
function ConnectionThread({ a, b, note, tension, night }: { a: StoredBelief; b: StoredBelief; note: string; tension?: boolean; night?: boolean }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const ra = REGION_CONFIG[resolveRegion(a)], rb = REGION_CONFIG[resolveRegion(b)];
  const label = (x: StoredBelief) => x.thoughtLabel || x.statement;
  const CYCLE = 2.6;
  // The thread: two strands braided around the line between the orbs.
  const strand = (phase: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const x = 82 + t * 156;
      const y = 62 + Math.sin(t * Math.PI * 3 + phase) * 9 * Math.sin(t * Math.PI);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  };
  const flare = (delay: number) => (reduce ? undefined : { duration: CYCLE, repeat: Infinity, delay, ease: "easeOut" as const, times: [0, 0.12, 0.5, 1] });
  // The split: the clause before "seems"/"connects"/"," leads, larger.
  const cut = note.search(/\s(seems|seem|connects?|is linked|ties|because)\s|,\s/);
  const lead = cut > 12 ? note.slice(0, cut) : "";
  const rest = cut > 12 ? note.slice(cut) : note;
  const font = "'Pretendard Variable', Pretendard, sans-serif";
  return (
    <div>
      <svg role="img" aria-label={`"${a.statement}" and "${b.statement}" are joined${tension ? ", pulling against each other" : " and feed each other"}.`}
        viewBox="0 0 320 128" style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id={`cbg${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={ra.tint} /><stop offset="1" stopColor={rb.tint} /></linearGradient>
          <linearGradient id={`cth${id}`} x1="82" y1="0" x2="238" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={ra.color} /><stop offset="1" stopColor={rb.color} /></linearGradient>
          {[["a", ra], ["b", rb]].map(([k, t]) => (
            <radialGradient key={k as string} id={`co${k}${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.35" stopColor={(t as typeof ra).color} /><stop offset="1" stopColor={(t as typeof ra).color} stopOpacity="0" /></radialGradient>
          ))}
        </defs>
        {!night && <rect width="320" height="128" rx="16" fill={`url(#cbg${id})`} opacity="0.75" />}
        {/* The braided thread, its strands slowly turning. */}
        {[0, Math.PI].map((ph, i) => (
          <motion.polyline key={i} points={strand(ph)} fill="none" stroke={`url(#cth${id})`} strokeWidth="2.2" strokeLinecap="round"
            strokeDasharray={tension ? "5 6" : undefined} opacity={0.75}
            initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 1, delay: 0.2 + i * 0.15, ease: [0.22, 1, 0.36, 1] }} />
        ))}
        {/* Light traveling both ways. */}
        {!reduce && (
          <>
            <motion.circle r="4.5" fill="#FFFFFF" cy={62} cx={82} initial={{ cx: 82, opacity: 0 }}
              animate={{ cx: [82, 238], opacity: [0, 1, 1, 0] }} transition={{ duration: CYCLE * 0.55, repeat: Infinity, repeatDelay: CYCLE * 0.45, ease: "easeInOut" }}
              style={{ filter: `drop-shadow(0 0 6px ${ra.color})` }} />
            <motion.circle r="4.5" fill="#FFFFFF" cy={62} cx={238} initial={{ cx: 238, opacity: 0 }}
              animate={{ cx: [238, 82], opacity: [0, 1, 1, 0] }} transition={{ duration: CYCLE * 0.55, repeat: Infinity, repeatDelay: CYCLE * 0.45, delay: CYCLE * 0.5, ease: "easeInOut" }}
              style={{ filter: `drop-shadow(0 0 6px ${rb.color})` }} />
          </>
        )}
        {/* The two beliefs, flaring as the light arrives. */}
        {[{ x: 62, g: `coa${id}`, c: ra.color, d: CYCLE * 0.98 }, { x: 258, g: `cob${id}`, c: rb.color, d: CYCLE * 0.48 }].map((o, i) => (
          <g key={i}>
            {/* Flares by growing its radius (scaling an SVG node around a
                point is unreliable across browsers). */}
            <motion.circle cx={o.x} cy={62} r={26} fill={`url(#${o.g})`}
              initial={{ r: 26 }} animate={reduce ? undefined : { r: [26, 36, 29, 26] }} transition={flare(o.d)} />
            <circle cx={o.x} cy={62} r="8" fill={o.c} />
            <circle cx={o.x - 2.4} cy={59.6} r="2.6" fill="#FFFFFF" opacity="0.9" />
          </g>
        ))}
        <text x="16" y="112" textAnchor="start" fontSize="11" fontWeight="600" fontFamily={font} fill={night ? ra.color : ra.ink}>{label(a).length > 24 ? `${label(a).slice(0, 23)}…` : label(a)}</text>
        <text x="304" y="112" textAnchor="end" fontSize="11" fontWeight="600" fontFamily={font} fill={night ? rb.color : rb.ink}>{label(b).length > 24 ? `${label(b).slice(0, 23)}…` : label(b)}</text>
      </svg>
      <div style={{ position: "relative", marginTop: 12, padding: "2px 0 0 18px" }}>
        <span aria-hidden style={{ position: "absolute", left: 0, top: -6, ...display, fontSize: 44, lineHeight: 1, color: ra.color, opacity: 0.55 }}>“</span>
        {lead && (
          <div style={{ ...display, fontSize: 24, lineHeight: 1.2, wordBreak: "keep-all",
            backgroundImage: night ? `linear-gradient(90deg, ${ra.color}, ${rb.color})` : `linear-gradient(90deg, ${ra.ink}, ${rb.ink})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            {lead}
          </div>
        )}
        <div style={{ ...display, fontStyle: "italic", fontSize: lead ? 18 : 20, lineHeight: 1.45, color: night ? "rgba(244,239,255,0.72)" : ivBody, marginTop: lead ? 4 : 0, wordBreak: "keep-all" }}>{rest.trim()}</div>
      </div>
    </div>
  );
}

// How often a thought comes up, said in words instead of a percentage:
// the confidence score behind it, read as "a lot / often / now and then",
// with five small dots in the thought's colour. Used wherever a belief's
// strength is shown to the person (Mind, Patterns, the sky's star sheet).
function howOften(confidence: number) {
  return {
    label: confidence >= 75 ? "Comes up a lot" : confidence >= 50 ? "Comes up often" : "Comes up now and then",
    dots: Math.max(1, Math.round(confidence / 20)),
  };
}

function OftenDots({ confidence, region, extra, night }: { confidence: number; region: CognitiveRegion; extra?: string; night?: boolean }) {
  const c = REGION_CONFIG[region];
  const { label, dots } = howOften(confidence);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span aria-hidden style={{ display: "inline-flex", gap: 3 }}>
        {Array.from({ length: 5 }, (_, k) => (
          <span key={k} style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: k < dots ? c.color : night ? "rgba(255,255,255,0.16)" : "rgba(42,38,33,0.12)", boxShadow: k < dots ? `0 0 ${night ? 8 : 5}px ${c.color}${night ? "cc" : "88"}` : undefined }} />
        ))}
      </span>
      <span style={{ ...hand, fontSize: 18, fontWeight: 600, color: night ? c.color : c.ink }}>{label}</span>
      {extra && <span style={{ ...sans, fontSize: 12, color: night ? "rgba(244,239,255,0.6)" : ivBody }}>{extra}</span>}
    </div>
  );
}

// The paper Mind's cards are written on: diary paper with a wash of two
// colours, a strip of washi tape, and a few small star stickers scattered
// in the margins (fixed positions, a third of them twinkling on the same
// .twinkle CSS the sky uses). Both of Mind's cards use it, so the page reads
// as one diary spread rather than a dark card next to light ones.
const PAPER_STARS = Array.from({ length: 9 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  // Kept to the outer edges, where they won't sit under text.
  const side = i % 3;
  const x = side === 0 ? 2 + r(1) * 6 : side === 1 ? 92 + r(1) * 6 : 10 + r(1) * 80;
  const y = side === 2 ? (r(2) < 0.5 ? 2 + r(3) * 4 : 94 + r(3) * 4) : 8 + r(2) * 84;
  return { x, y, s: 7 + Math.round(r(4) * 5), tone: (["identity", "career", "relationships"] as CognitiveRegion[])[i % 3], tw: i % 3 === 0, d: 2.5 + r(5) * 3, dl: r(6) * 4 };
});

function StarPaperCard({ children, a = "identity", b = "relationships", tapeLeft = false, style }: {
  children: React.ReactNode; a?: CognitiveRegion; b?: CognitiveRegion; tapeLeft?: boolean; style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  const ca = REGION_CONFIG[a], cb = REGION_CONFIG[b];
  return (
    <div style={{
      position: "relative", borderRadius: shape.md, backgroundColor: "#FFFCF6",
      backgroundImage: `radial-gradient(110% 70% at 100% 0%, ${ca.color}26, transparent 60%), radial-gradient(100% 70% at 0% 100%, ${cb.color}22, transparent 60%)`,
      border: `1px solid ${ca.color}2e`, boxShadow: `0 14px 28px -20px ${ca.ink}`,
      ...style,
    }}>
      <span aria-hidden style={{ position: "absolute", top: -7, ...(tapeLeft ? { left: 26 } : { right: 30 }), width: 58, height: 16, zIndex: 2,
        transform: `rotate(${tapeLeft ? -4 : 4}deg)`, opacity: 0.85, pointerEvents: "none",
        backgroundImage: `repeating-linear-gradient(45deg, ${ca.color}99 0 6px, ${ca.tint} 6px 12px)` }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: shape.md, pointerEvents: "none" }}>
        {PAPER_STARS.map((st, i) => (
          <span key={i} className={st.tw && !reduce ? "twinkle" : undefined}
            style={{ position: "absolute", left: `${st.x}%`, top: `${st.y}%`, lineHeight: 0, color: REGION_CONFIG[st.tone].color, opacity: 0.55,
              ["--tw-dur" as string]: `${st.d}s`, ["--tw-delay" as string]: `-${st.dl}s` } as React.CSSProperties}>
            <Sparkle size={st.s} weight="fill" />
          </span>
        ))}
      </div>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

function ScreenAnalysis({ onNavSelect, onOpenArtifact, onOpenBrainMap, store }: { onNavSelect?: (id: string) => void; onOpenArtifact?: (id: string) => void; onOpenBrainMap?: (region?: CognitiveRegion) => void; store: Store }) {
  const reduceMotion = useReducedMotion();
  // Same "pin today's discovery, scope the network to it" logic
  // ScreenDiscoveryAnalysis uses (see there for the fuller machinery this
  // mirrors) — the thoughts and the thread shown here are the ones behind
  // the pinned discovery.
  const [pinnedDiscovery] = React.useState<DiscoveryTarget | null>(() => computeDiscovery(store));
  const discovery = pinnedDiscovery ? resolveDiscoveryTarget(store, pinnedDiscovery) : null;
  const hIndex = discovery?.kind === "hypothesis" ? discovery.index : null;
  const h = hIndex !== null ? store.hypotheses[hIndex] : null;
  const b = discovery?.kind === "belief" ? store.beliefs.find((x) => x.id === discovery.id) ?? null : null;

  // Exactly the discovery itself —
  // a hypothesis IS the relationship between several beliefs, so all of
  // them are the discovery; a belief-kind discovery is just that one
  // belief, not everything connected to it. Used by DiscoveryBeliefList
  // below to call out which of the constellation's stars is the actual
  // discovery vs. supporting context.
  const discoveryBeliefIds = React.useMemo(() => {
    if (h) return h.relatedBeliefIds;
    if (b) return [b.id];
    return [];
  }, [h, b]);

  // Discovery beliefs, resolved to full records — same source
  // DiscoveryBeliefList used (discoveryBeliefIds -> store.beliefs).
  const notebookBeliefs = React.useMemo(
    () => discoveryBeliefIds.map((id) => store.beliefs.find((x) => x.id === id)).filter((x): x is StoredBelief => !!x),
    [discoveryBeliefIds, store.beliefs]
  );
  // The connection note(s) between this discovery's own beliefs — same
  // source DiscoveryBeliefList used for its "note" callout.
  const notebookNotes = React.useMemo(
    () => store.connections.filter((c) => discoveryBeliefIds.includes(c.a) && discoveryBeliefIds.includes(c.b) && c.note),
    [discoveryBeliefIds, store.connections]
  );

  return (
    <div style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, ...ivBackground, overflow: "hidden" }}>
      {/* Mind now opens straight onto what used to be the "My Mind"
      notebook you had to tap into from a separate landing scene — that
      landing scene (the embedded constellation preview + the "My Mind"
      entry card) is gone; this content IS the Mind tab now. Home already
      owns "a glimpse of your mind" (its own node field, tap-to-open-the-
      real-Brain-Map), so nothing here is lost, just no longer duplicated
      behind an extra tap. Same header+scroll+BottomNav flex-column
      structure History uses (see PRIMARY_HEADER_TOP/SIDE) rather than the
      old fixed-viewport "single immersive scene" this replaces — this
      content was always meant to scroll. */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: `${PRIMARY_HEADER_TOP}px ${PRIMARY_HEADER_SIDE}px 8px`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={primaryTitleStyle}>Mind</div>
            <div style={primaryTitleSubtitleStyle}>
              What's going on underneath, in plain words.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
            <motion.div
              role="button" tabIndex={0} aria-label="Search your history" onClick={() => onNavSelect?.("history")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavSelect?.("history"); } }}
              whileTap={{ opacity: 0.6 }} style={{ cursor: "pointer" }}
            >
              <MagnifyingGlass size={19} color={ivHeading} />
            </motion.div>
            <motion.div
              role="button" tabIndex={0} aria-label="Open profile" onClick={() => onNavSelect?.("profile")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavSelect?.("profile"); } }}
              whileTap={{ opacity: 0.6 }} style={{ cursor: "pointer" }}
            >
              <User size={19} color={ivHeading} />
            </motion.div>
          </div>
        </div>

        {/* ── The notebook content itself — reads the exact same discovery
        data DiscoveryBeliefList/RegionBreakdown compute elsewhere (see
        notebookBeliefs/notebookNotes above); neither
        shared component was touched, and DiscoveryBeliefList is still used
        verbatim by ScreenHypothesisDetail. Same PRIMARY_HEADER_SIDE grid as
        the header above so sections line up under "Mind" instead of
        starting at their own separate inset (same fix History's own
        catalogue applies below its header). Keeps the "mind-neurons"
        data-tutorial target (see buildTutorialSteps) pointed at this
        section — always rendered regardless of whether there's a discovery
        yet, unlike the belief list below it, so the tutorial step never
        aims at something that may not exist. ── */}
        <div data-tutorial="mind-neurons" className="no-scrollbar edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 16px 28px" }}>
          {/* The one bold card on this page: today's thoughts, joined by
              their thread when there is one, each with how often it comes
              up. Everything after it is a plain list of places to go. */}
          {(() => {
            const note = notebookNotes[0];
            const A = note ? store.beliefs.find((x) => x.id === note.a) : undefined;
            const B = note ? store.beliefs.find((x) => x.id === note.b) : undefined;
            const joined = !!(note && A && B);
            return (
              <section style={{ marginTop: 10 }}>
                <SectionHeading>{joined ? "How your thoughts fit together" : notebookBeliefs.length === 1 ? "The thought behind it" : "The thoughts behind it"}</SectionHeading>
                <StarPaperCard a={A ? resolveRegion(A) : "identity"} b={B ? resolveRegion(B) : "relationships"} style={{ padding: notebookBeliefs.length > 0 ? "16px 16px 6px" : "16px" }}>
                  {joined && <ConnectionThread a={A!} b={B!} note={note.note} tension={note.type === "contradiction"} />}
                  {notebookBeliefs.length > 0 ? (
                    <div style={{ marginTop: joined ? 14 : 0 }}>
                      {notebookBeliefs.map((belief, i) => {
                        const region = resolveRegion(belief);
                        return (
                          <div key={belief.id} style={{ display: "flex", gap: 10, padding: "11px 2px", borderTop: i > 0 || joined ? `1px solid ${ivDivider}` : undefined }}>
                            <span style={{ width: 18, display: "flex", justifyContent: "center", flexShrink: 0, paddingTop: 5 }}>
                              <Node color={REGION_CONFIG[region].color} size={12} intensity={0.6 + (belief.confidence / 100) * 0.4} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ ...display, fontSize: 18, lineHeight: 1.3, color: ivHeading, wordBreak: "keep-all" }}>“{belief.statement}”</div>
                              <div style={{ marginTop: 5 }}><OftenDots confidence={belief.confidence} region={region} /></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ ...sans, fontSize: 14, color: ivBody, lineHeight: 1.6, wordBreak: "keep-all" }}>Nothing yet. Write a few times, and the thoughts that keep coming back will show up here.</div>
                  )}
                </StarPaperCard>
              </section>
            );
          })()}

          {/* Places to go from here, as one list. "Look closer" pages are
              Premium (store.isPro, toggled from Profile). */}
          {(onOpenBrainMap || store.isPro) && (
            <section style={{ marginTop: 30 }}>
              <SectionHeading>Look closer</SectionHeading>
              <StarPaperCard a="curiosity" b="career" tapeLeft style={{ overflow: "visible" }}>
                {onOpenBrainMap && (
                  <DiaryLinkCard plain accent="curiosity" icon={<Sparkle size={17} weight="fill" />} title="See all your thoughts as stars"
                    note="Every thought that keeps coming back, in one sky" badge={`${store.beliefs.length}`} onClick={() => onOpenBrainMap()} />
                )}
                {store.isPro && (
                  <>
                    <DiaryLinkCard plain divider={!!onOpenBrainMap} accent="relationships" icon={<ShareNetwork size={17} weight="bold" />} title="Patterns you might not notice"
                      note={store.beliefs.length > 0 ? "What keeps coming back, and what pulls against what" : "Nothing yet. Keep writing and they'll show up here"} onClick={() => onOpenArtifact?.("beliefs")} />
                    <DiaryLinkCard plain divider accent="career" icon={<Footprints size={17} weight="fill" />} title="How close you are to who you want to be"
                      note="Your thoughts next to the person you said you want to be" onClick={() => onOpenArtifact?.("drift")} />
                  </>
                )}
              </StarPaperCard>
            </section>
          )}
        </div>

        <BottomNav active="analysis" onSelect={onNavSelect} vintage />
      </div>
    </div>
  );
}

// A small page-of-notes glyph — "N thoughts" — matching the supplied
// concept reference's document icon (not a speech bubble).
function ThoughtGlyph({ color }: { color: string }) {
  return <FileText size={12} color={color} />;
}
// A shield-check glyph — "NN% confidence" — matching the reference in
// place of the earlier clock icon.
function ConfidenceGlyph({ color }: { color: string }) {
  return <ShieldCheck size={12} color={color} />;
}
// The small four-point sparkle before "TODAY'S DISCOVERY" in the reference —
// a plain "✦" reads one weight heavier/rounder than the reference's crisp
// diamond mark, so this draws it directly instead of relying on a font glyph.
function SparkleGlyph({ color, size = 11 }: { color: string; size?: number }) {
  return <Sparkle size={size} color={color} weight="fill" />;
}
// A vertical "|" separator between the two footer stats — matching the
// reference's metadata row, drawn rather than relying on a literal pipe
// character's inconsistent glyph metrics across fonts.
function MetaDivider({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 1, height: 12, backgroundColor: color, opacity: 0.4, flexShrink: 0 }} />;
}

// One simple monoline glyph per cognitive region, for Recent Insights'
// circular icon badge — the reference marks each insight with an icon
// instead of a domain-name tag, so this is what stands in for that per the
// app's own six real regions (see REGION_CONFIG/CognitiveRegion) rather
// than inventing a separate icon set unrelated to the actual data.
function RegionIconGlyph({ region, color }: { region: CognitiveRegion; color: string }) {
  const size = 15;
  switch (region) {
    case "identity": return <User size={size} color={color} />;
    case "security": return <ShieldCheck size={size} color={color} />;
    case "career": return <ChartLineUp size={size} color={color} />;
    case "relationships": return <UsersThree size={size} color={color} />;
    case "curiosity": return <MagnifyingGlass size={size} color={color} />;
    case "creativity":
    default: return <PaintBrush size={size} color={color} />;
  }
}

// Today's Discovery — the one dominant content object on the Analysis
// landing scene, inside a single restrained ivory SurfaceCard rather than
// sitting directly on the canvas (that read as a feed/dashboard, weak
// hierarchy). No dark navy card, no photographic backdrop — see the ivory
// redesign pass. `interpretation` is only shown when it's genuinely
// distinct from `title` (see ScreenDiscoveryAnalysis) so the card never
// repeats the same sentence twice.
function DiscoveryCard({
  title,
  interpretation,
  thoughtCount,
  confidence,
  region = "identity",
  onExamine,
}: {
  title: string;
  interpretation: string;
  thoughtCount: number;
  confidence: number;
  region?: CognitiveRegion;
  onExamine?: () => void;
}) {
  // Today's discovery as the page's one bright object: the paper washed in
  // the discovery's own colour, a strip of washi tape holding it to the
  // page, and its star in the corner with two small lights circling it.
  const reduce = useReducedMotion();
  const c = REGION_CONFIG[region];
  const second = REGION_CONFIG[region === "relationships" ? "identity" : "relationships"];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14, rotate: -0.6 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 150, damping: 20 }}
      style={{
        position: "relative", boxSizing: "border-box", padding: "26px 22px 20px", borderRadius: 22,
        backgroundColor: "#FFFDF8",
        backgroundImage: `radial-gradient(80% 70% at 100% 0%, ${c.color}40, transparent 60%), radial-gradient(70% 60% at 0% 100%, ${second.color}26, transparent 65%), linear-gradient(180deg, #FFFDF8, #FBF6EE)`,
        border: `1px solid ${c.color}33`,
        boxShadow: `0 18px 36px -22px ${c.color}, 0 1px 0 rgba(255,255,255,0.9) inset`,
      }}
    >
      {/* Washi tape */}
      <span aria-hidden style={{ position: "absolute", top: -9, left: 26, width: 70, height: 20, borderRadius: 2, transform: "rotate(-5deg)", opacity: 0.9,
        backgroundImage: `repeating-linear-gradient(45deg, ${c.color}aa 0 7px, ${c.tint} 7px 14px)`, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }} />
      {/* The discovery's star, with two lights orbiting it */}
      <div aria-hidden style={{ position: "absolute", top: 16, right: 18, width: 64, height: 64 }}>
        <motion.div animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          style={{ position: "absolute", inset: 0 }}>
          <span style={{ position: "absolute", left: "50%", top: -2, width: 6, height: 6, marginLeft: -3, borderRadius: "50%", backgroundColor: second.color, boxShadow: `0 0 8px ${second.color}` }} />
          <span style={{ position: "absolute", left: 4, bottom: 6, width: 4, height: 4, borderRadius: "50%", backgroundColor: REGION_CONFIG.career.color, boxShadow: `0 0 6px ${REGION_CONFIG.career.color}` }} />
        </motion.div>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Breathe amount={1.1}><Node color={c.color} size={30} intensity={0.95} /></Breathe>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 70 }}>
        <Sparkle size={15} weight="fill" color={c.color} aria-hidden />
        <div style={{ ...hand, fontSize: 22, fontWeight: 600, color: c.ink, lineHeight: 1 }}>Today's discovery</div>
      </div>

      <p style={{
        ...display, fontSize: 25, fontWeight: 400, lineHeight: 1.2, color: ivHeading, margin: "14px 0 0", paddingRight: 54, wordBreak: "keep-all",
        overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3,
      }}>
        {title}
      </p>

      {interpretation && (
        <p style={{
          ...sans, fontSize: 13, color: ivBody, lineHeight: 1.55, margin: "8px 0 0", wordBreak: "keep-all",
          overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
        }}>
          {interpretation}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, ...sans, fontSize: 11, fontWeight: 600, color: c.ink, backgroundColor: `${c.color}1f`, border: `1px solid ${c.color}33`, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
            <ThoughtGlyph color={c.ink} /> {thoughtCount} thought{thoughtCount === 1 ? "" : "s"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, ...sans, fontSize: 11, fontWeight: 600, color: second.ink, backgroundColor: `${second.color}1a`, border: `1px solid ${second.color}33`, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
            <ConfidenceGlyph color={second.ink} /> {confidence}%
          </span>
        </div>

        <motion.button
          type="button" aria-label="Examine today's discovery" onClick={onExamine}
          whileTap={{ scale: 0.94 }} whileHover={reduce ? undefined : { scale: 1.03 }}
          className={reduce ? undefined : "lens-current"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, border: 0, cursor: "pointer", flexShrink: 0,
            ...sans, fontSize: 13, fontWeight: 700, color: "#FFFFFF", padding: "9px 15px", borderRadius: 999,
            backgroundImage: `linear-gradient(110deg, ${c.ink}, ${c.color}, ${second.color}, ${c.ink})`,
            boxShadow: `0 8px 18px -8px ${c.color}`,
          }}
        >
          Examine <ArrowRight size={13} weight="bold" aria-hidden />
        </motion.button>
      </div>
    </motion.div>
  );
}

// One "Further Insights" card — a small, quiet ivory SurfaceCard in a
// horizontally-scrolling row. Every field is still real (see
// RecentInsightItem/buildRecentInsights) and nothing here is invented
// per-card copy — tapping a card still opens the exact same Examine view a
// row used to. The card's node (the shared Node component, same one
// History's catalogue and Home's node field use) sits directly beside that
// region's own name, so its color reads as this insight's actual identity
// rather than a decorative dot. The primary label is the short semantic
// thoughtLabel when one exists (the same "defusion" noun-phrase Today's
// Discovery's own headline uses, e.g. "Perfectionism thought") — a
// genuinely more legible heading than a full sentence at this size — with
// the fuller statement demoted to quiet supporting text under it, and the
// relative date folded into one small, muted metadata line at the bottom
// instead of a bold colored badge up top.
// ── Quiet pieces for Mind and Analysis ─────────────────────────────────────
// Each of those pages has one bold card at the top (today's discovery, the
// two thoughts joined by a thread). Everything below it sits in this same
// plain paper card with the same section heading, so the page reads as one
// notebook instead of a scrapbook of differently decorated boxes.
const quietCard: React.CSSProperties = {
  backgroundColor: "#FFFDF8", borderRadius: shape.md, border: "1px solid rgba(42,38,33,0.08)",
  boxShadow: "0 10px 22px -18px rgba(42,38,33,0.5)", overflow: "hidden",
};

function SectionHeading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "0 4px 8px" }}>
      <div style={{ ...hand, fontSize: 21, fontWeight: 600, color: ivHeading, opacity: 0.82, lineHeight: 1.15 }}>{children}</div>
      {aside && <div style={{ ...hand, fontSize: 17, color: ivBody, flexShrink: 0 }}>{aside}</div>}
    </div>
  );
}

// One insight as a line in a list: its orb, its name, the fuller sentence
// on one line under it, and how many entries it rests on.
function InsightRow({ item, onOpen, divider }: { item: RecentInsightItem; onOpen?: () => void; divider?: boolean }) {
  const c = REGION_CONFIG[item.region];
  const primary = item.thoughtLabel || item.title;
  const supporting = item.thoughtLabel && item.title !== item.thoughtLabel ? item.title : null;
  return (
    <motion.div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(); } }}
      whileTap={{ backgroundColor: `${c.color}14` }} transition={{ duration: 0.12 }}
      style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px 13px 16px", cursor: "pointer", backgroundColor: "rgba(0,0,0,0)", WebkitTapHighlightColor: "transparent" }}>
      {divider && <span aria-hidden style={{ position: "absolute", top: 0, left: 50, right: 0, height: 1, backgroundColor: ivDivider }} />}
      <span style={{ width: 22, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <Node color={c.color} size={14} intensity={Math.min(1, 0.45 + (item.confidence / 100) * 0.4)} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", ...display, fontSize: 18, color: ivHeading, lineHeight: 1.25, wordBreak: "keep-all" }}>{primary}</span>
        {supporting && <span style={{ display: "block", ...sans, fontSize: 13, color: ivBody, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{supporting}</span>}
      </span>
      {item.thoughtCount > 0 && <span style={{ ...hand, fontSize: 17, color: c.ink, flexShrink: 0 }}>{item.thoughtCount} {item.thoughtCount === 1 ? "entry" : "entries"}</span>}
      <CaretRight size={14} color={ivBody} weight="bold" style={{ flexShrink: 0 }} />
    </motion.div>
  );
}


// ── Screen 4.6 · Analysis ──────────────────────────────────────────────────────
// Brought fully into the Mind screen's own design system: the same full-
// bleed dusk-coast photo (analysisDuskCoastImg — a moonlit shoreline at
// blue hour, swapped in for the earlier indoor night-study scene) bled up
// behind the status bar (the "top:-30" trick ScreenAnalysis uses). An earlier pass
// put Today's Discovery and Recent Insights directly on that photo with no
// containing surface at all, which — with enough real content on screen —
// started reading as a feed/dashboard rather than a considered composition.
// This pass reintroduces restrained "dark glass" cards (the same
// rgba(8,8,9,0.4)-family translucent-panel language ArtifactTile/BeliefCard/
// CatalogueCell already use elsewhere) for exactly two things: Today's
// Discovery as one dominant hero card (DiscoveryCard), and Further Insights
// — renamed from Recent Insights — as a compact horizontally-scrolling row
// of smaller cards (InsightCard) instead of a vertically-stacked list, each
// marked with a small glowing, region-colored node (Node, the same
// one History's own catalogue uses) rather than a text label. The header
// above both stays uncarded, open on the photo. The old single long page
// (Discovery → Evidence → Evolution → Reflection, all inline) is still two
// states of the same component: this landing scene, and — unchanged in
// substance/styling — the Examine sub-view below, which still holds all of
// that guided-conversation content for whichever target (today's discovery,
// or any further insight) it was opened on. Mind's belief network moved out
// the other direction (see ScreenAnalysis above) — no AI interpretation
// lives anywhere else in the app now, this tab is its one home.

// "Where you might be headed" — growth directions inferred from the
// recurring unconscious beliefs the Brain Map has already surfaced.
// Distinct from `aspiration` (which the user types themselves during
// onboarding/Distance from Goal): this is AI-inferred from what they've
// actually written, never something they stated. Lives on the Analysis tab
// (Examine view) rather than Home or Profile — it's an interpretation of
// the same belief evidence Examine is already walking through, not a
// dashboard tile. Only recomputes when the belief set has changed size
// since the last computation (goalsBeliefSnapshot), so it's not re-calling
// the AI on every visit — and never below MIN_BELIEFS_FOR_GOALS, since one
// or two beliefs isn't enough to infer a direction from.
const MIN_BELIEFS_FOR_GOALS = 3;
function GoalDirectionsPanel({ store, updateStore }: { store: Store; updateStore: (updater: (prev: Store) => Store) => void }) {
  const fetchingRef = React.useRef(false);
  // Inferring goals sends belief statements to the AI, so it needs the same
  // consent as analysis itself — see aiConsent.ts.
  const aiAllowed = React.useContext(AiConsentContext);
  const needsRefresh = aiAllowed && store.beliefs.length >= MIN_BELIEFS_FOR_GOALS && store.goalsBeliefSnapshot !== store.beliefs.length;
  React.useEffect(() => {
    if (!needsRefresh || fetchingRef.current) return;
    fetchingRef.current = true;
    const payload = store.beliefs.map((b) => ({ domain: b.domain, statement: b.statement, evidenceCount: b.evidenceCount }));
    fetch("/api/infer-goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ beliefs: payload }) })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data?.error || "Couldn't infer goals."); return data; })
      .then((data) => {
        const today = formatDateDots(new Date());
        const nextGoals: StoredGoal[] = (data.goals as { statement: string; basedOnDomains: string[] }[]).map((g, i) => ({ id: `goal-${Date.now()}-${i}`, statement: g.statement, basedOnDomains: g.basedOnDomains, createdDate: today }));
        updateStore((prev) => ({ ...prev, goals: nextGoals, goalsBeliefSnapshot: store.beliefs.length }));
      })
      .catch(() => {})
      .finally(() => { fetchingRef.current = false; });
  }, [needsRefresh, store.beliefs, updateStore]);
  if (!store.goals.length) return null;
  // Suggestions, not steps — so no 01/02/03; each gets its own tint and a
  // small icon instead, and arrives in turn as it scrolls into view.
  const tones: CognitiveRegion[] = ["security", "career", "curiosity"];
  return (
    <ExamineSection region="security" icon={<Compass size={17} weight="duotone" />} title="Where you might be headed" subtitle="Directions suggested by the beliefs that keep coming back.">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {store.goals.slice(0, 3).map((g, i) => {
          const tone = REGION_CONFIG[tones[i % tones.length]];
          return (
            <motion.div
              key={g.id} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 14px", borderRadius: shape.md, backgroundImage: `linear-gradient(135deg, ${tone.tint} 0%, rgba(255,255,255,0.75) 100%)`, boxShadow: ivCardShadow }}
            >
              <span style={{ ...settingsTile, backgroundColor: "rgba(255,255,255,0.8)", color: tone.ink }}><Footprints size={16} weight="duotone" /></span>
              <span style={{ ...display, fontSize: 17, lineHeight: 1.45, color: ivHeading, wordBreak: "keep-all", paddingTop: 2 }}>{g.statement}</span>
            </motion.div>
          );
        })}
      </div>
    </ExamineSection>
  );
}

// ── Analysis · Recent weeks ──────────────────────────────────────────────────
// A KPI row in the dashboard-template sense (TailAdmin and its kin: label,
// value, signed delta, a sparkline of the periods behind it), scaled to a
// phone and this palette. It answers the one question Today's Discovery
// can't — "how much have I actually been doing this?" — with numbers the
// store already has, bucketed into real Monday-to-Sunday weeks. The window
// is anchored to the most recent entry's week, not the calendar's: someone
// who hasn't written this week still sees their last active week instead
// of a row of zeros. Deltas are signed but never colored good/bad — writing
// less is not a failure, and the rest of the app doesn't grade people.
type WeekActivity = { weekStart: string; entries: number; words: number; verbs: number };

function buildWeekActivity(history: StoredHistoryEntry[], maxWeeks = 8): WeekActivity[] {
  // Written entries only: a mood tap is not a thought logged.
  const dated = history.filter((e) => !isMoodCheckIn(e)).flatMap((e) => { const d = parseDotDate(e.date); return d ? [{ e, monday: mondayOfWeek(d) }] : []; });
  if (dated.length === 0) return [];
  const buckets = new Map<string, WeekActivity>();
  dated.forEach(({ e, monday }) => {
    const key = formatDateDots(monday);
    const cur = buckets.get(key) ?? { weekStart: key, entries: 0, words: 0, verbs: 0 };
    cur.entries += 1;
    cur.words += e.languageObservation?.wordCount ?? 0;
    cur.verbs += e.languageObservation?.cognitiveVerbCount ?? 0;
    buckets.set(key, cur);
  });
  const last = new Date(Math.max(...dated.map((x) => x.monday.getTime())));
  // Always a fixed window of `maxWeeks` ending at the latest active week.
  // Quiet weeks — before the first entry or between busy ones — get an
  // explicit zero, so a gap reads as a gap and a two-week-old habit reads
  // as two weeks old, not as a full chart.
  const weeks: WeekActivity[] = [];
  for (let i = maxWeeks - 1; i >= 0; i -= 1) {
    const d = new Date(last);
    d.setDate(d.getDate() - i * 7);
    const key = formatDateDots(d);
    weeks.push(buckets.get(key) ?? { weekStart: key, entries: 0, words: 0, verbs: 0 });
  }
  return weeks;
}

const signedDelta = (n: number, digits = 0) => (n > 0 ? `+${n.toFixed(digits)}` : n < 0 ? `−${Math.abs(n).toFixed(digits)}` : "±0");


// The last seven days as seven small stars, lit for each day of the
// current streak (counting back from today), popping on one after another.
function StreakStars({ streak }: { streak: number }) {
  const reduce = useReducedMotion();
  const lit = Math.min(streak, 7);
  const c = REGION_CONFIG.career;
  return (
    <div role="img" aria-label={`${streak} ${streak === 1 ? "day" : "days"} in a row`} style={{ display: "flex", gap: 3, marginTop: 8 }}>
      {Array.from({ length: 7 }, (_, i) => {
        const on = i >= 7 - lit;
        return (
          <motion.span key={i}
            initial={reduce ? false : { scale: 0.3, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 380, damping: 16, delay: reduce ? 0 : 0.1 + i * 0.06 }}
            style={{ lineHeight: 0, color: on ? c.color : "rgba(42,38,33,0.16)", filter: on ? `drop-shadow(0 0 3px ${c.color})` : undefined }}>
            <Sparkle size={12} weight="fill" />
          </motion.span>
        );
      })}
    </div>
  );
}

// ── Analysis · Moods and thoughts ────────────────────────────────────────────
// Where Home's one-tap check-ins come back. A check-in is only a word, so on
// its own it says nothing about thinking; what it can show is which of
// someone's recurring thoughts turn up in what they wrote on the same day
// they tapped a feeling. A pair needs two separate days before it's shown,
// so one coincidence never reads as a pattern.
type MoodThoughtLink = { mood: string; belief: StoredBelief; days: number };

function moodThoughtLinks(store: Store): MoodThoughtLink[] {
  const moodsByDay = new Map<string, Set<string>>();
  store.history.forEach((e) => {
    const label = isMoodCheckIn(e) ? e.analysis?.observation.emotions[0]?.label : undefined;
    if (!label) return;
    moodsByDay.set(e.date, (moodsByDay.get(e.date) ?? new Set()).add(label));
  });
  const entryDay = new Map(store.history.filter((e) => !isMoodCheckIn(e)).map((e) => [e.id, e.date]));
  const links: MoodThoughtLink[] = [];
  store.beliefs.filter((b) => b.userReaction !== "rejected").forEach((belief) => {
    const daysByMood = new Map<string, Set<string>>();
    (belief.supportingEntryIds ?? []).forEach((id) => {
      const day = entryDay.get(id);
      if (!day) return;
      moodsByDay.get(day)?.forEach((mood) => daysByMood.set(mood, (daysByMood.get(mood) ?? new Set()).add(day)));
    });
    daysByMood.forEach((days, mood) => { if (days.size >= 2) links.push({ mood, belief, days: days.size }); });
  });
  return links.sort((a, b) => b.days - a.days || b.belief.confidence - a.belief.confidence).slice(0, 3);
}

function MoodThoughtsPanel({ store }: { store: Store }) {
  const checkIns = React.useMemo(() => store.history.filter(isMoodCheckIn), [store.history]);
  const links = React.useMemo(() => moodThoughtLinks(store), [store]);
  if (checkIns.length === 0) return null;
  const counts = new Map<string, number>();
  checkIns.forEach((e) => { const l = e.analysis?.observation.emotions[0]?.label; if (l) counts.set(l, (counts.get(l) ?? 0) + 1); });
  const tally = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const toneOf = (mood: string) => REGION_CONFIG[MOOD_TONES[mood as MoodKey] ?? "identity"];
  return (
    <div>
      <SectionHeading aside={`${checkIns.length} check-in${checkIns.length === 1 ? "" : "s"}`}>Moods and thoughts</SectionHeading>
      <div style={{ ...quietCard, padding: "14px 16px" }}>
        {/* How often each feeling was tapped, as chips in that feeling's colour. */}
        <div role="list" aria-label="How often you checked in with each feeling" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tally.map(([mood, n]) => {
            const t = toneOf(mood);
            return (
              <span key={mood} role="listitem" style={{ ...sans, fontSize: 12, fontWeight: 700, color: t.ink, backgroundColor: `${t.color}26`, border: `1px solid ${t.color}55`, borderRadius: shape.full, padding: "4px 10px" }}>
                {mood} <span style={{ fontWeight: 500, opacity: 0.8 }}>×{n}</span>
              </span>
            );
          })}
        </div>
        {links.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            {links.map((l) => {
              const t = toneOf(l.mood);
              return (
                <div key={`${l.mood}-${l.belief.id}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span aria-hidden style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: t.color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...hand, fontSize: 18, fontWeight: 600, color: t.ink, lineHeight: 1.15 }}>On days you felt {l.mood.toLowerCase()}</div>
                    <div style={{ ...display, fontSize: 17, color: ivHeading, lineHeight: 1.35, marginTop: 2, wordBreak: "keep-all" }}>“{l.belief.statement}”</div>
                    <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 3 }}>came up in what you wrote, on {l.days} different days</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, margin: "12px 0 0" }}>
            When you check in and also write something on the same day, this will show which of your thoughts tend to come with which feeling.
          </p>
        )}
      </div>
    </div>
  );
}

function RecentWeeksPanel({ history }: { history: StoredHistoryEntry[] }) {
  const weeks = React.useMemo(() => buildWeekActivity(history), [history]);
  if (weeks.length === 0) return null;
  const latest = weeks[weeks.length - 1];
  const prev = weeks.length > 1 ? weeks[weeks.length - 2] : null;
  const streak = computeStreak(history);
  const maxEntries = Math.max(...weeks.map((w) => w.entries), 1);
  const sparkLabel = `Thoughts per week, ${shortMonthDay(weeks[0].weekStart)} to ${shortMonthDay(latest.weekStart)}: ${weeks.map((w) => w.entries).join(", ")}.`;
  const I = REGION_CONFIG.identity;
  return (
    <div>
      <SectionHeading aside={`Week of ${shortMonthDay(latest.weekStart)}`}>Recent weeks</SectionHeading>
      <div style={{ ...quietCard, display: "flex" }}>
        {/* This week's count, with a small bar per week behind it. */}
        <div style={{ flex: 1.4, minWidth: 0, padding: "14px 16px" }}>
          <div style={{ ...hand, fontSize: 18, fontWeight: 600, color: I.ink }}>Written this week</div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
            <div>
              <div style={{ ...display, fontSize: 34, color: ivHeading, lineHeight: 1 }}><AnimatedNumber value={latest.entries} memoryKey="analysis.weekEntries" /></div>
              <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 6 }}>{prev ? `${signedDelta(latest.entries - prev.entries)} vs the week before` : "First week"}</div>
            </div>
            <div role="img" aria-label={sparkLabel} style={{ display: "flex", alignItems: "flex-end", gap: 3, width: 84, height: 40, flexShrink: 0 }}>
              {weeks.map((w, i) => {
                const isLatest = i === weeks.length - 1;
                return (
                  <motion.div key={w.weekStart} title={`Week of ${shortMonthDay(w.weekStart)}: ${w.entries} ${w.entries === 1 ? "entry" : "entries"}`}
                    initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.6 }}
                    transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.08 + i * 0.05 }}
                    style={{
                      flex: 1, transformOrigin: "bottom", height: `${Math.max((w.entries / maxEntries) * 100, 6)}%`, borderRadius: "3px 3px 1px 1px",
                      backgroundColor: w.entries === 0 ? "rgba(42,38,33,0.08)" : isLatest ? I.color : `${I.color}55`,
                    }} />
                );
              })}
            </div>
          </div>
        </div>
        <span aria-hidden style={{ width: 1, margin: "14px 0", backgroundColor: ivDivider }} />
        {/* Days in a row with something written. */}
        <div style={{ flex: 1, minWidth: 0, padding: "14px 16px" }}>
          <div style={{ ...hand, fontSize: 18, fontWeight: 600, color: REGION_CONFIG.career.ink }}>Days in a row</div>
          <div style={{ ...display, fontSize: 34, color: ivHeading, lineHeight: 1, marginTop: 4 }}><AnimatedNumber value={streak} memoryKey="analysis.streak" /></div>
          <StreakStars streak={streak} />
        </div>
      </div>
    </div>
  );
}

function ScreenDiscoveryAnalysis({
  onNavSelect,
  store,
  updateStore,
  onAgreeHypothesis,
  onDisagreeHypothesis,
  onInvestigateHypothesis,
  onAgreeBeliefDiscovery,
  onDisagreeBeliefDiscovery,
  reinterpretingKey,
}: {
  onNavSelect?: (id: string) => void;
  store: Store;
  updateStore: (updater: (prev: Store) => Store) => void;
  onAgreeHypothesis?: (index: number) => void;
  onDisagreeHypothesis?: (index: number) => void;
  onInvestigateHypothesis?: (index: number) => void;
  onAgreeBeliefDiscovery?: (beliefId: string) => void;
  onDisagreeBeliefDiscovery?: (beliefId: string) => void;
  reinterpretingKey?: string | null;
}) {
  const reduceMotion = useReducedMotion();
  // Pinned once per visit to this screen so the discovery being discussed
  // never gets silently swapped out mid-conversation — see
  // resolveDiscoveryTarget. This is Today's Discovery specifically — the
  // one thing the landing paper shows — independent of whichever target
  // Examine is currently open on below.
  const [pinnedDiscovery] = React.useState<DiscoveryTarget | null>(() => computeDiscovery(store));
  const discovery = pinnedDiscovery ? resolveDiscoveryTarget(store, pinnedDiscovery) : null;
  const discH = discovery?.kind === "hypothesis" ? store.hypotheses[discovery.index] : null;
  const discB = discovery?.kind === "belief" ? store.beliefs.find((x) => x.id === discovery.id) ?? null : null;
  // The paper's headline is the framing sentence ("The '__' showed up
  // again.") built from the short thoughtLabel when there is one, with the
  // fuller reasoning underneath as `discInterpretation`; when there's no
  // thoughtLabel, the one real sentence IS the headline and there's nothing
  // distinct left to show underneath it — never the same sentence twice.
  const discThoughtLabel = discH?.thoughtLabel || discB?.thoughtLabel || "";
  const discTitle = discThoughtLabel ? `The "${discThoughtLabel}" showed up again.` : discovery?.text || "";
  const discInterpretation = discThoughtLabel ? discovery?.text ?? "" : "";
  const discThoughtCount = discH ? evidenceForHypothesis(discH, store.beliefs).length : discB ? discB.evidenceQuotes.length : 0;
  const discConfidence = discH ? discH.confidence : discB ? discB.confidence : 0;
  // This discovery's own constellation-node color — the same region
  // resolution buildRecentInsights uses for Further Insights below — for
  // DiscoveryCard's one small, quiet node next to its eyebrow label (see
  // the redesign brief: "the relevant node can appear subtly inside or
  // near this card").
  const discRegion: CognitiveRegion | undefined = discH
    ? resolveRegion({ domain: discH.domains[0] ?? "identity" } as any)
    : discB
      ? resolveRegion(discB)
      : undefined;
  const discRegionColor = discRegion ? REGION_CONFIG[discRegion].color : undefined;

  // Everything that could have been Today's Discovery but isn't — see
  // buildRecentInsights. Shown as one horizontally-scrolling row (see
  // "Further Insights" below) rather than a capped list with a "View all"
  // expand — scrolling itself is what preserves access to every insight
  // here, so nothing is hidden behind an extra tap by default.
  const recentInsights = React.useMemo(() => buildRecentInsights(store, pinnedDiscovery), [store, pinnedDiscovery]);

  // The Examine sub-view: null means the landing scene; set means the full
  // guided-conversation content below (evidence → evolution → reflection →
  // Dig deeper) is open for that specific target, which may be Today's
  // Discovery or any Recent Insight — same shape, same component, so both
  // entry points share one implementation.
  const [examineTarget, setExamineTarget] = React.useState<DiscoveryTarget | null>(null);
  const examine = examineTarget ? resolveDiscoveryTarget(store, examineTarget) : null;
  const hIndex = examineTarget?.kind === "hypothesis" ? examineTarget.index : null;
  const h = hIndex !== null ? store.hypotheses[hIndex] : null;
  const b = examineTarget?.kind === "belief" ? store.beliefs.find((x) => x.id === examineTarget.id) ?? null : null;
  // The area of life it lives in — drives the hero's wash, the ring, and
  // the timeline's color.
  const examineRegion: CognitiveRegion = h ? resolveRegion({ domain: h.domains?.[0] ?? "identity" } as StoredBelief) : b ? resolveRegion(b) : "identity";

  // SECTION 2 — the strongest (most recent) three, shown chronologically.
  const rawEvidence: (StoredEvidenceQuote & { domain?: string })[] = h ? evidenceForHypothesis(h, store.beliefs) : b ? b.evidenceQuotes : [];
  const evidence = [...rawEvidence]
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .slice(0, 3)
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));

  // SECTION 2, secondary — still part of "why": honest about conflicting signal.
  const contradictoryEntries: { belief: StoredBelief; entry: StoredHistoryEntry }[] = h
    ? h.relatedBeliefIds
        .map((id) => store.beliefs.find((x) => x.id === id))
        .filter((x): x is StoredBelief => !!x)
        .flatMap((belief) => (belief.contradictoryEntryIds ?? []).map((id) => ({ belief, entry: store.history.find((e) => e.id === id) })))
        .filter((x): x is { belief: StoredBelief; entry: StoredHistoryEntry } => !!x.entry)
    : b
      ? (b.contradictoryEntryIds ?? [])
          .map((id) => store.history.find((e) => e.id === id))
          .filter((e): e is StoredHistoryEntry => !!e)
          .map((entry) => ({ belief: b, entry }))
      : [];

  // SECTION 3 — a real timeline: origin → today → outcome for a hypothesis
  // with an investigate trail; earliest → latest evidence for a belief.
  // Never invents a midpoint that isn't actually in the data.
  const evolutionPoints: { label: string; text: string; accent?: boolean }[] = h?.investigate
    ? [
        { label: h.investigate.origin.date, text: h.investigate.origin.quote },
        { label: "Today", text: evidence[evidence.length - 1]?.quote ?? h.title },
        { label: h.investigate.compareLabel2, text: h.investigate.compareSteps2.join(" · "), accent: true },
      ]
    : b && b.evidenceQuotes.length >= 2
      ? (() => {
          const quotes = [...b.evidenceQuotes].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
          return [
            { label: quotes[0].date, text: quotes[0].quote },
            { label: quotes[quotes.length - 1].date, text: quotes[quotes.length - 1].quote, accent: true },
          ];
        })()
      : [];

  const reaction = h ? h.reaction : b ? b.discoveryReaction ?? null : null;
  const exhausted = h ? !!h.exhausted : b ? !!b.discoveryExhausted : false;
  const thisKey = hIndex !== null ? `hyp:${hIndex}` : b ? `belief:${b.id}` : null;
  const reinterpreting = !!thisKey && reinterpretingKey === thisKey;
  const handleReact = (r: "agree" | "disagree") => {
    if (r === "agree") {
      if (hIndex !== null) onAgreeHypothesis?.(hIndex);
      else if (b) onAgreeBeliefDiscovery?.(b.id);
    } else {
      if (hIndex !== null) onDisagreeHypothesis?.(hIndex);
      else if (b) onDisagreeBeliefDiscovery?.(b.id);
    }
  };

  return (
    <div style={{ position: "relative", height: "100%", backgroundColor: ivBg2 }}>
      {/* No overflowX:"hidden" here (deliberately — see below): setting
      only one axis to a non-visible value makes the CSS overflow spec
      compute the OTHER axis's used value as "auto" too, which would clip
      either branch's negative "top:-30" bleed against the status bar right
      at this box's own top edge — invisibly reintroducing the exact gap
      that trick exists to remove. Neither branch below actually needs
      horizontal clipping from this ancestor: Examine's own scroll
      container and the landing scene's own scroll region can each own that
      locally if they ever need it.

      Both Examine and the landing scene now sit on the same shared ivory
      canvas (ivBackground) rather than a photo — see the ivory redesign
      pass — so the two still read as one continuous environment, just two
      different depths into it. ── */}

      <AnimatePresence mode="sync" initial={false}>
        {examineTarget ? (
          <motion.div
            key="examine"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }} transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: "easeOut" }}
            // Same full-bleed treatment as the landing scene right below —
            // its own copy of the ivory canvas, bled up behind the status
            // bar, so switching between the two never reveals a mismatched
            // fallback strip either way.
            style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...ivBackground }}
          >
            {/* One scrolling column, edge to edge with the same 30px page
            grid the landing scene uses — everything (Back, the heading,
            every section label, every line of body text) starts at that
            same left edge. className="no-scrollbar" hides the native
            scrollbar (same mechanism Recent Insights/My Mind use) while
            scrolling still works normally. */}
            <div className="no-scrollbar edge-fade" style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, overflowY: "auto", padding: "34px 30px calc(28px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
              <span
                role="button" tabIndex={0} aria-label="Back to Analysis" onClick={() => setExamineTarget(null)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExamineTarget(null); } }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, ...sans, fontSize: 13, fontWeight: 700, color: ivBody, cursor: "pointer" }}
              >
                <ArrowLeft size={13} weight="bold" aria-hidden /> Back
              </span>
              <div style={{ ...display, fontSize: 28, fontWeight: 400, color: ivHeading, marginTop: 14 }}>Examine</div>
              <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 4, lineHeight: 1.4 }}>
                What the AI has learned about you across your thoughts.
              </div>

              {/* ── The discovery (or a recent insight) as the hero card. ── */}
              <div data-tutorial="today-discovery" style={{ marginTop: 24 }}>
                {examine ? (
                  <ExamineHero
                    kicker={examineTarget === pinnedDiscovery ? "Today's discovery" : "Recent insight"}
                    thoughtLabel={h?.thoughtLabel || b?.thoughtLabel}
                    text={examine.text}
                    confidence={h ? h.confidence : b?.confidence ?? 0}
                    entries={evidence.length}
                    region={examineRegion}
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <svg width="72" height="72" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="44" fill="rgba(42,38,33,0.05)" />
                      <circle cx="34" cy="44" r="5" fill={ivFaint} />
                      <circle cx="62" cy="44" r="5" fill={ivFaint} />
                      <path d="M36 60 Q48 68 60 60" stroke={ivFaint} strokeWidth="3" fill="none" strokeLinecap="round" />
                    </svg>
                    <p style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, margin: 0, maxWidth: 280 }}>Nothing discovered yet. It'll show up here after you leave a few thoughts.</p>
                  </div>
                )}
              </div>

              {examine && (
                <>
                  {/* ── Why this reading: your own words, as bubbles. ── */}
                  <ExamineSection region="career" icon={<Quotes size={17} weight="duotone" />} title="Why this reading" subtitle="Things you actually said that point to it.">
                    {evidence.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {evidence.map((e, i) => <EvidenceBubble key={i} index={i} date={e.date} quote={e.quote} domain={e.domain} />)}
                      </div>
                    ) : (
                      <div style={{ ...sans, fontSize: 13, color: ivBody }}>No entries to cite as evidence yet.</div>
                    )}
                    {contradictoryEntries.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: REGION_CONFIG.creativity.ink, textAlign: "right", marginBottom: 8 }}>And some that point the other way</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {contradictoryEntries.map(({ belief, entry }, i) => <EvidenceBubble key={i} index={i} date={entry.date} quote={entry.text} domain={belief.domain} against />)}
                        </div>
                      </div>
                    )}
                  </ExamineSection>

                  {/* ── How it has changed — only when there's a real trail. ── */}
                  {evolutionPoints.length > 0 && (
                    <ExamineSection region="curiosity" icon={<Path size={17} weight="duotone" />} title="How it has changed" subtitle="From the first time it showed up to now.">
                      <EvolutionTimeline points={evolutionPoints} color={REGION_CONFIG[examineRegion].color} />
                    </ExamineSection>
                  )}
                </>
              )}

              {/* ── Where you might be headed — independent of which
              discovery is pinned (inferred from the whole belief set);
              renders nothing until there are enough beliefs. ── */}
              <GoalDirectionsPanel store={store} updateStore={updateStore} />

              {/* ── For where you are now — Premium's literary match. ── */}
              {store.isPro && (
                <LiteraryReflectionPanel
                  store={store}
                  updateStore={updateStore}
                  target={b ? { kind: "belief", id: b.id } : hIndex !== null && store.hypotheses[hIndex] ? { kind: "hypothesis", id: store.hypotheses[hIndex].id } : null}
                />
              )}

              {/* ── Reflection — does this reading fit? (The "Dig deeper"
              button that used to follow it is gone.) ── */}
              {examine && (
                <div style={{ marginTop: 36, borderRadius: shape.lg, padding: "18px 18px 16px", boxShadow: ivCardShadow, backgroundImage: `linear-gradient(160deg, ${REGION_CONFIG.identity.tint} 0%, #FBF8F2 70%)` }}>
                  <DiscoveryReflection
                    reaction={reaction}
                    reinterpreting={reinterpreting}
                    exhausted={exhausted}
                    onReact={handleReact}
                  />
                </div>
              )}
            </div>
            <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
              <BottomNav active="discoveryAnalysis" onSelect={onNavSelect} vintage />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="landing"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }} transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: "easeOut" }}
            // Bled up by the same 30px the frame's fake status bar reserves
            // — exactly the trick ScreenAnalysis/Mind uses — so the
            // background below reaches all the way to the top of the
            // screen instead of leaving the frame's own fallback color
            // showing through as a strip above the header.
            style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...ivBackground }}
          >
            {/* Header — stationary, over the scene, never scrolls, and
            deliberately not inside a card: the background stays visible
            around it. Shared position/size/spacing with Mind and History's
            own headers (see PRIMARY_HEADER_TOP/SIDE and primaryTitleStyle/
            primaryTitleSubtitleStyle) so "Analysis" carries the same
            visual presence "Mind" and "History" do. */}
            <div style={{ position: "relative", zIndex: 2, flexShrink: 0, padding: `${PRIMARY_HEADER_TOP}px ${PRIMARY_HEADER_SIDE}px 6px`, boxSizing: "border-box" }}>
              <div style={primaryTitleStyle}>Analysis</div>
              <div style={primaryTitleSubtitleStyle}>
                AI interprets your mind, revealing what's really going on.
              </div>
            </div>

            {/* One scrolling composition beneath the header — Today's
            Discovery (the hero card), then Further Insights, in that
            weight, with the background still showing through between them.
            Merging what used to be a pinned discovery panel above an
            independently-scrolling insights list into one shared scroll
            region is also what leaves room for a future Premium
            longitudinal-intelligence section below Further Insights (see
            the brief) without restructuring this again — a new section is
            just another child appended here. */}
            <div className="no-scrollbar edge-fade" style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: `10px ${PRIMARY_HEADER_SIDE}px calc(20px + env(safe-area-inset-bottom))`, boxSizing: "border-box" }}>
              {/* ── Today's Discovery — the dominant object on this screen,
              inside one large ivory SurfaceCard (see DiscoveryCard). ── */}
              <div data-tutorial="today-discovery">
                {discovery ? (
                  <DiscoveryCard
                    title={discTitle}
                    interpretation={discInterpretation}
                    thoughtCount={discThoughtCount}
                    confidence={discConfidence}
                    region={discRegion}
                    onExamine={() => setExamineTarget(pinnedDiscovery)}
                  />
                ) : (
                  <div style={{ padding: "20px 0", boxSizing: "border-box" }}>
                    <p style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, margin: 0 }}>Nothing discovered yet. It'll show up here after you leave a few thoughts.</p>
                  </div>
                )}
              </div>

              {/* ── Further Insights — secondary to Today's Discovery, a
              compact horizontal row of small ivory SurfaceCards (InsightCard)
              instead of the old vertically-stacked feed, so the screen
              reads as one deliberate composition rather than a long list of
              equally-weighted results. Every insight stays reachable —
              horizontally scrollable rather than capped, so nothing here is
              hidden behind an extra tap (see recentInsights above). The
              label itself is nudged right by InsightCard's own left padding
              (14px) so it lines up with each card's actual content start
              (its node) rather than just the card's own outer edge — the
              two read as flush at a glance, not merely close. ── */}
              <div style={{ marginTop: 32 }}>
                <SectionHeading>Further insights</SectionHeading>
                {recentInsights.length === 0 ? (
                  <div style={{ ...quietCard, ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, padding: "14px 16px" }}>No other insights yet. They'll show up here as more come into focus.</div>
                ) : (
                  <div style={quietCard}>
                    {recentInsights.slice(0, 4).map((item, idx) => (
                      <InsightRow key={item.key} item={item} divider={idx > 0} onOpen={() => setExamineTarget(item.target)} />
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 32 }}>
                <RecentWeeksPanel history={store.history} />
              </div>

              <div style={{ marginTop: 28 }}>
                <MoodThoughtsPanel store={store} />
              </div>

              {/* Structural room for Premium's longitudinal-intelligence
              layer (see the brief's "Today's Discovery → Further Insights →
              Premium deeper interpretation" hierarchy) — intentionally not
              implemented here; a future section drops in below Recent
              Weeks without touching the layout above it. */}
            </div>
            <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
              <BottomNav active="discoveryAnalysis" onSelect={onNavSelect} vintage />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Premium's section header — the gold-caps label + quiet subtitle pattern
// Analysis/Examine already established (see e.g. "WHY THIS INTERPRETATION"),
// reused here instead of SectionCard's white box so every section sits
// directly in the environment. Local to this screen since nowhere else in
// Premium needs a fifth near-identical copy of the same three lines.
// Author portrait registry — author_id (see LiteraryPassage.authorId) →
// imported illustration asset. Only Anaïs Nin has one right now; every
// other author simply has no entry, so LiteraryReflectionPanel quietly
// renders text-only for them instead of needing a special case anywhere.
// Adding a new author's portrait later is one line here, nothing else.
const AUTHOR_PORTRAITS: Record<string, string> = {
  "anais-nin": authorAnaisNinImg,
};

// "For where you are now" — Premium's literary-match feature. The passage
// itself always comes straight from LITERARY_PASSAGES (see
// literaryPassages.ts) — this component's own job is just: compute the
// match when there's meaningfully new data (recompute gated on
// literaryMatchSnapshot, same pattern GoalDirectionsPanel uses for goals,
// so opening Premium repeatedly never reshuffles the passage on its own —
// see the brief's "not: app opened → random new quote"), persist it, and
// render it as a page from a book, not another analytics row.
// The reading is chosen per discovery (belief or hypothesis) and cached
// under that discovery's key with a content signature, so it changes only
// when that discovery's own material changes — see resolveLiterarySelection.
function LiteraryReflectionPanel({ store, updateStore, target }: { store: Store; updateStore: (updater: (prev: Store) => Store) => void; target: LiteraryTarget | null }) {
  const reduceMotion = useReducedMotion();
  const today = formatDateDots(new Date());
  const resolved = target ? resolveLiterarySelection(store, target, today) : null;
  React.useEffect(() => {
    if (!target || (!resolved?.needsSave && !store.literaryMatch)) return;
    updateStore((prev) => {
      const current = resolveLiterarySelection(prev, target, today);
      if (!current.needsSave && !prev.literaryMatch) return prev;
      return { ...prev, literaryMatch: null, literaryMatchSnapshot: undefined, literarySelections: { ...sanitizeLiterarySelections(prev.literarySelections), [current.key]: current.selection } };
    });
  }, [resolved?.key, resolved?.selection.signature, resolved?.needsSave, store.literaryMatch, target, updateStore, today]);

  const match = resolved?.selection.match ?? null;
  // Eligibility is re-checked at display time, old saved selections included.
  const passage = match ? eligiblePassages().find((p) => p.id === match.passageId) ?? null : null;
  const portraitSrc = passage ? AUTHOR_PORTRAITS[passage.authorId] : undefined;
  const fade = { duration: reduceMotion ? 0.01 : 0.6, ease: "easeOut" as const };

  return (
    <div style={{ marginTop: 36 }}>
      {/* Toned down from a full-strength label — smaller, lighter weight,
      slightly dimmed — so it reads as a quiet editorial eyebrow rather
      than a bold warning-style tag. Same horizontal grid as every other
      section here (this div has no side padding/margin of its own,
      inheriting Premium's shared content column). */}
      <ExamineSectionHeader region="relationships" icon={<Feather size={17} weight="duotone" />} title="For where you are now" subtitle="A passage matched to what you've been writing." />
      {/* mode="wait" + a slow fade — this is meant to feel like turning to
      a new page, not a UI state flipping; see the brief's "no flashy
      animation... contemplative." */}
      <AnimatePresence mode="wait" initial={false}>
        {!passage || !match ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            <p style={{ ...display, fontStyle: "italic", fontSize: 20, color: ivBody, lineHeight: 1.55, margin: "18px 0 0", wordBreak: "keep-all" }}>
              Keep writing.
            </p>
            <p style={{ ...sans, fontSize: 13, color: ivFaint, lineHeight: 1.6, margin: "8px 0 0", wordBreak: "keep-all" }}>
              As your mind takes shape here, we'll find something worth reading alongside it.
            </p>
          </motion.div>
        ) : (
          <motion.div key={passage.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}
            style={{ position: "relative", overflow: "hidden", borderRadius: shape.lg, padding: "24px 18px 18px", boxShadow: ivCardShadow, backgroundImage: `linear-gradient(160deg, ${REGION_CONFIG.relationships.tint} 0%, #FBF8F2 55%, #F7EFE3 100%)` }}>
            {/* A large, faint opening quote mark — the page's one ornament. */}
            <span aria-hidden style={{ position: "absolute", top: 4, left: 12, ...display, fontSize: 84, lineHeight: 0.8, color: REGION_CONFIG.relationships.color, opacity: 0.22, pointerEvents: "none" }}>“</span>
            {/* The passage itself — short (every LITERARY_PASSAGES entry is
            excerpt-length, not a paragraph — see literaryPassages.ts),
            smaller and tighter than a pull-quote, no surrounding box, no
            decorative quotation-mark glyphs (italics alone signal "this is
            quoted," the same convention a literary journal uses). */}
            <p style={{ position: "relative", ...display, fontStyle: "italic", fontSize: 20, lineHeight: 1.55, color: ivHeading, margin: "18px 0 0", wordBreak: "keep-all" }}>
              {passage.exactText}
            </p>

            {/* Attribution + a small, quiet portrait sharing one row — the
            portrait no longer has its own footprint in the passage column;
            it just sits beside the author's name, the way a journal might
            set a tiny engraving beside a byline. pointerEvents:"none" and
            no card/circle/border/glow — a bare, softly-masked illustration
            at low opacity, present only when this author has one (see
            AUTHOR_PORTRAITS). Preserved verbatim — no constellation-author
            redesign here, per the brief. */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...display, fontSize: 15, color: ivBody }}>— {passage.author}</div>
                {passage.work && (
                  <div style={{ ...sans, fontSize: 11, color: ivFaint, marginTop: 2 }}>{passage.work}</div>
                )}
              </div>
              {portraitSrc && (
                <img
                  src={portraitSrc}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{
                    width: 46, height: 46, objectFit: "cover", objectPosition: "50% 15%", flexShrink: 0,
                    opacity: 0.85, pointerEvents: "none",
                    WebkitMaskImage: "radial-gradient(circle at 50% 40%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 78%)",
                    maskImage: "radial-gradient(circle at 50% 40%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 78%)",
                  }}
                />
              )}
            </div>

            {/* "Why this found you" — always present, not a disclosure to
            tap open. A quiet ambient observation sitting under the
            attribution, not an interactive "AI explained itself" affordance
            — see the redesign brief. No divider line; the generous margin
            alone separates it from the passage above. */}
            <p style={{ ...sans, fontStyle: "italic", fontSize: 12, color: ivFaint, lineHeight: 1.6, margin: "24px 0 0", wordBreak: "keep-all" }}>
              {buildWhyThisFoundYou(match.themes)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Screen 4.7 · Premium (retired as a standalone tab) ─────────────────────────
// This used to be its own bottom-nav tab, rendering ArtifactTile entry
// points to Unconscious Patterns/Distance from Your Aspiration,
// LiteraryReflectionPanel, and the five EditorialSection-wrapped
// longitudinal charts (EmotionDistribution/ValueDirectionShifts/
// CognitivePatternFrequency/RecordingHeatmap/SelfTalkTrend) below them.
// Premium is no longer a separate destination — every one of those pieces
// is still here, reused verbatim, just redistributed to where it
// conceptually belongs and gated by store.isPro (Profile's "Premium Mode"
// toggle) instead of by its own tab:
//   - Unconscious Patterns / Distance from Your Aspiration (ArtifactTile
//     entry points into ScreenBeliefMap/ScreenDrift, unchanged) now live
//     in Mind's notebook — see ScreenAnalysis's "Go deeper" section.
//   - LiteraryReflectionPanel now lives in Analysis's Examine view — see
//     ScreenDiscoveryAnalysis.
//   - The five longitudinal charts now live in History, below the star
//     catalogue — see ScreenHistory's "Go deeper" section.
// ArtifactTile/EditorialSection/LiteraryReflectionPanel and the five chart
// components are still defined above, just called from their new homes.

// ── Screen 5 · Think (record) ─────────────────────────────────────────────────
// The browser's own speech recognizer — no extra API key, but Chrome/Edge/
// Safari only (no Firefox), and audio goes through the browser vendor's
// servers to come back as text. Good enough to make voice input real for a
// minimal version instead of the decorative waveform-only mock it used to be.
function getSpeechRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// A small pool of open reflective questions — one is picked at random each
// time this screen opens, instead of a single fixed prompt. Purely a
// client-side placeholder for now ("do not hardcode any example question"
// as the long-term goal): later this pool should come from the backend so
// it can adapt to what someone's actually been thinking about, but picking
// randomly + never repeating the immediately-prior one is what keeps it
// from feeling like a static form label in the meantime.
const THINK_PROMPTS = [
  "What thought stuck with you the longest today?",
  "Is there a thought that keeps circling in your head?",
  "What was on your mind the most today?",
  "What did you say to yourself the most today?",
  "What's the thought you can't quite resolve right now?",
  "When did your emotions shift the most today?",
];

let lastThinkPromptIndex = -1;
function pickThinkPrompt() {
  if (THINK_PROMPTS.length <= 1) return THINK_PROMPTS[0];
  let idx = Math.floor(Math.random() * THINK_PROMPTS.length);
  if (idx === lastThinkPromptIndex) idx = (idx + 1) % THINK_PROMPTS.length;
  lastThinkPromptIndex = idx;
  return THINK_PROMPTS[idx];
}

// Live mic volume (0..1), sampled via Web Audio while `active`, driven
// entirely through a ref rather than React state — the waveform reads it
// 60x/sec and state updates at that rate would just cause needless
// re-renders. Fails silently (waveform stays calm/flat) if mic access is
// denied or unavailable; speech recognition itself has its own separate
// permission flow and keeps working either way.
function useMicLevel(active: boolean) {
  const levelRef = React.useRef(0);
  React.useEffect(() => {
    if (!active) {
      levelRef.current = 0;
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i += 1) {
            const v = (data[i] - 128) / 128;
            sumSquares += v * v;
          }
          const rms = Math.sqrt(sumSquares / data.length);
          levelRef.current = Math.min(1, rms * 4);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Mic permission denied/unavailable — leave levelRef at 0 (calm/flat).
      }
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [active]);
  return levelRef;
}

// Apple Voice Memos-style: thin, soft, single-color bars nudged by the
// live mic level plus a gentle per-bar phase offset so they ripple instead
// of moving in lockstep — never a colorful/equalizer look. Heights are
// written straight to the DOM every frame (not through React state) to
// stay smooth at 60fps.
const WAVEFORM_BAR_COUNT = 26;
function VoiceWaveform({ levelRef }: { levelRef: React.MutableRefObject<number> }) {
  const barsRef = React.useRef<(HTMLDivElement | null)[]>([]);
  const smoothedRef = React.useRef<number[]>(Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0));
  const phasesRef = React.useRef<number[]>(Array.from({ length: WAVEFORM_BAR_COUNT }, () => Math.random() * Math.PI * 2));

  React.useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.05;
      const level = levelRef.current;
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        const jitter = Math.sin(t * 2 + phasesRef.current[i]) * 0.15 + 0.85;
        const target = 0.1 + level * jitter * 0.9;
        smoothedRef.current[i] += (target - smoothedRef.current[i]) * 0.22;
        el.style.height = `${3 + smoothedRef.current[i] * 20}px`;
        el.style.opacity = String(0.3 + smoothedRef.current[i] * 0.55);
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 24 }}>
      {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          style={{ width: 2, borderRadius: 1, backgroundColor: "#F4F1EC", height: 3, opacity: 0.3 }}
        />
      ))}
    </div>
  );
}

// The mic button, redesigned to feel like a quiet living thing rather than
// a UI control: a soft glowing orb that breathes on its own (scale
// 1.00→1.04 every ~2.5s) so it never needs a "tap to start" caption to
// explain itself. Recording shifts the same breathing to a warmer glow and
// a slightly quicker pulse — still smooth, never flashy.
function NeuronOrb({ recording, onClick }: { recording: boolean; onClick: () => void }) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      whileTap={{ scale: 0.94 }}
      animate={{ scale: recording ? [1, 1.06, 1] : [1, 1.04, 1] }}
      transition={{ duration: recording ? 1.7 : 2.5, repeat: Infinity, ease: "easeInOut" }}
      style={{
        width: 76,
        height: 76,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        // Flat fills, not a gradient sphere — and ivHeading's own charcoal
        // for the idle state rather than a violet one, same "charcoal is
        // the one active color, not a substitute accent" rule every other
        // primary action in the app already follows (see ivHeading above).
        backgroundColor: recording ? "#8A4A34" : ivHeading,
        // A faint light ring: charcoal on the dark think screen needs an edge to read as a control.
        boxShadow: "0 0 0 1px rgba(255,255,255,0.14)",
      }}
    >
      <motion.div
        animate={{
          opacity: recording ? [0.6, 1, 0.6] : [0.4, 0.7, 0.4],
          scale: [0.9, 1.05, 0.9],
        }}
        transition={{ duration: recording ? 1.4 : 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: recording ? "#FFD9C7" : "#E8E3F5",
        }}
      />
    </motion.div>
  );
}

function ScreenThink({ onDone, onBack, mood }: { onDone?: (text: string) => void; onBack?: () => void; mood?: string | null }) {
  const [recording, setRecording] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  // Text-first: voice self-reports lower self-disclosure than text at the
  // same response length (perceived anonymity drops with voice) — text is
  // the default, voice is the opt-in via the toggle below, not the other
  // way around.
  const [textMode, setTextMode] = React.useState(true);
  const [text, setText] = React.useState("");
  // Coming from Home's "Say why" after a check-in, the first prompt is about
  // that feeling; "Another prompt" goes back to the usual ones.
  const [promptHint, setPromptHint] = React.useState(() => (mood ? `You said you feel ${mood.toLowerCase()}. What's behind it?` : pickThinkPrompt()));
  const [transcript, setTranscript] = React.useState("");
  const [interim, setInterim] = React.useState("");
  const [micError, setMicError] = React.useState<string | null>(null);
  const voiceSupportedRef = React.useRef(!!getSpeechRecognitionCtor());
  const recognitionRef = React.useRef<any>(null);
  const micLevelRef = useMicLevel(recording);
  const manualStopRef = React.useRef(false);
  // Guards the transition out of this screen — without it, a fast double
  // tap on "Next" (or on the orb to stop recording) before the parent's
  // setScreen("processing") actually commits could fire onDone twice,
  // queuing the same entry for analysis twice. Once tripped, both submit
  // paths below are inert and the button renders disabled.
  const [submitted, setSubmitted] = React.useState(false);
  // Authoritative running transcript, mirrors the `transcript` state but
  // read synchronously (state set via a functional updater isn't
  // guaranteed to be visible in the same tick, and the silence-watcher
  // below needs the current value the instant it fires).
  const finalTranscriptRef = React.useRef("");

  // INPUT-role silence guidance (see inputGuidance.ts) — a few seconds of
  // no new input fades in one short line. `lastActivityAt`/`latestText` are
  // refs, not state, so the watcher interval below never closes over a
  // stale value; `inputGuidance` itself is the only piece that needs to
  // trigger a render.
  const [inputGuidance, setInputGuidance] = React.useState<string | null>(null);
  const lastActivityRef = React.useRef(Date.now());
  const latestTextRef = React.useRef("");
  const guidanceShownRef = React.useRef(false);
  const guidanceDelayRef = React.useRef<any>(null);

  const noteActivity = (currentText: string) => {
    latestTextRef.current = currentText;
    lastActivityRef.current = Date.now();
    guidanceShownRef.current = false;
    setInputGuidance(null);
    if (guidanceDelayRef.current) { clearTimeout(guidanceDelayRef.current); guidanceDelayRef.current = null; }
  };

  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  React.useEffect(() => () => { manualStopRef.current = true; recognitionRef.current?.stop?.(); }, []);

  // Guidance only applies while input is actually expected — typing (text
  // mode, whether or not anything's written yet) or actively recording.
  // Switching modes or starting a fresh recording resets the silence clock.
  React.useEffect(() => {
    lastActivityRef.current = Date.now();
    guidanceShownRef.current = false;
    setInputGuidance(null);
  }, [textMode, recording]);

  React.useEffect(() => {
    const active = textMode || recording;
    if (!active) return;
    const watcher = setInterval(() => {
      if (guidanceShownRef.current) return;
      if (Date.now() - lastActivityRef.current >= 5000) {
        guidanceShownRef.current = true;
        // Async fade-in delay — the prompt doesn't snap in the instant the
        // threshold crosses, so it never reads as a timer going off.
        guidanceDelayRef.current = setTimeout(() => {
          setInputGuidance(pickInputGuidance(latestTextRef.current));
        }, 700);
      }
    }, 1000);
    return () => { clearInterval(watcher); if (guidanceDelayRef.current) clearTimeout(guidanceDelayRef.current); };
  }, [textMode, recording]);

  const startRecording = () => {
    setTranscript("");
    setInterim("");
    setSeconds(0);
    setMicError(null);
    finalTranscriptRef.current = "";
    const SR = getSpeechRecognitionCtor();
    if (SR) {
      manualStopRef.current = false;
      const recognition = new SR();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (e: any) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalChunk += r[0].transcript;
          else interimChunk += r[0].transcript;
        }
        if (finalChunk) {
          finalTranscriptRef.current = (finalTranscriptRef.current ? finalTranscriptRef.current + " " : "") + finalChunk.trim();
          setTranscript(finalTranscriptRef.current);
        }
        setInterim(interimChunk);
        noteActivity((finalTranscriptRef.current + (interimChunk ? " " + interimChunk : "")).trim());
      };
      recognition.onerror = (e: any) => {
        // Fatal errors (mic denied, no mic, offline): stop retrying instead
        // of looping start/stop forever. "no-speech" is not fatal — it just
        // means a silent gap, so let onend's restart handle that one.
        if (["not-allowed", "audio-capture", "network", "service-not-allowed"].includes(e?.error)) {
          manualStopRef.current = true;
          setRecording(false);
          setMicError(
            e.error === "not-allowed" || e.error === "service-not-allowed"
              ? "Microphone access was denied. Allow it in your browser's settings, or use \"Write instead.\""
              : e.error === "audio-capture"
              ? "No microphone was found. Please use \"Write instead.\""
              : "A network issue interrupted voice recognition. Please try again or use \"Write instead.\""
          );
        }
      };
      recognition.onend = () => {
        if (!manualStopRef.current) {
          try { recognition.start(); } catch { /* already stopped for good */ }
        }
      };
      recognitionRef.current = recognition;
      try { recognition.start(); } catch { /* ignore */ }
    }
    setRecording(true);
  };

  const stopRecording = () => {
    if (submitted) return;
    setSubmitted(true);
    manualStopRef.current = true;
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setRecording(false);
    const finalText = (transcript + (interim ? " " + interim : "")).trim();
    setInterim("");
    onDone?.(finalText);
  };

  // Compose pattern after Apple Journal / Day One: the entry's primary
  // action lives in the header, where the keyboard can never cover it —
  // a bottom button on a phone is hidden the moment you start typing.
  const canSubmit = !!text.trim() && !submitted;
  const submitText = () => { if (!canSubmit) return; setSubmitted(true); onDone?.(text.trim()); };
  const entryStamp = React.useMemo(() => new Date().toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), []);
  const iconBtn: React.CSSProperties = { border: 0, background: "transparent", padding: 6, margin: -6, cursor: "pointer", lineHeight: 0, WebkitTapHighlightColor: "transparent" };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px 0", minHeight: 46 }}>
        <Breathe inline amount={1.08} style={{ lineHeight: 0 }}>
          <motion.button type="button" aria-label={recording ? "Stop and discard" : "Cancel"} onClick={onBack} whileTap={{ opacity: 0.6 }} style={{ ...iconBtn, color: dkBodyLight }}>
            <X size={18} />
          </motion.button>
        </Breathe>
        {/* When this was said — quiet, like a journal's dateline. */}
        <span style={{ ...mono, fontSize: 11, letterSpacing: "0.04em", color: dkBody }}>{entryStamp}</span>
        {textMode ? (
          <Breathe inline amount={1.05} active={canSubmit}>
            <motion.button
              type="button" disabled={!canSubmit} onClick={submitText}
              whileTap={canSubmit ? { scale: 0.95, opacity: 0.85 } : undefined} transition={SETTLE}
              style={{ ...sans, fontSize: 13, fontWeight: 700, color: canSubmit ? "#fff" : dkBody, backgroundColor: canSubmit ? dkAccent : dkTrack, border: 0, borderRadius: shape.full, padding: "7px 14px", minHeight: 32, cursor: canSubmit ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}
            >
              Done
            </motion.button>
          </Breathe>
        ) : !recording ? (
          <Breathe inline amount={1.06}>
            <motion.span role="button" tabIndex={0} onClick={() => { setTextMode(true); setMicError(null); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTextMode(true); setMicError(null); } }} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: dkBodyLight, cursor: "pointer" }}>
              Write instead
            </motion.span>
          </Breathe>
        ) : (
          <span style={{ width: 32 }} />
        )}
      </div>

      {textMode ? (
        <>
          <div style={{ flex: 1, minHeight: 0, padding: "18px 20px 16px", display: "flex", flexDirection: "column" }}>
            {/* The prompt is its own object above the entry, not a
            placeholder that vanishes at the first keystroke — it stays
            while you write, and can be swapped for another. */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: shape.md, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
              <Sparkle size={14} color={dkAccentLight} weight="fill" style={{ marginTop: 3, flexShrink: 0 }} />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={promptHint} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} style={{ ...display, fontSize: 17, lineHeight: 1.5, color: dkBodyLight, flex: 1, wordBreak: "keep-all" }}>
                  {promptHint}
                </motion.div>
              </AnimatePresence>
              <Breathe inline amount={1.1} style={{ lineHeight: 0 }}>
                <motion.button type="button" aria-label="Another prompt" onClick={() => setPromptHint(pickThinkPrompt())} whileTap={{ rotate: 180, opacity: 0.7 }} transition={{ duration: 0.3 }} style={{ ...iconBtn, color: dkBody, marginTop: -3 }}>
                  <ArrowsClockwise size={15} />
                </motion.button>
              </Breathe>
            </div>
            {/* Your page — an open diary on the night desk. */}
            <DiaryNotePaper
              autoFocus fill value={text} onChange={(v) => { setText(v); noteActivity(v); }}
              placeholder="Write whatever feels natural." ariaLabel="Speak your mind"
              style={{ marginTop: 22 }}
            />
            <AnimatePresence>
              {inputGuidance && (
                <motion.div
                  key={inputGuidance}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ ...sans, fontSize: 13, color: dkBody, marginTop: 10, marginBottom: 4, lineHeight: 1.6, wordBreak: "keep-all" }}
                >
                  {inputGuidance}
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{ display: "flex", paddingTop: 10, flexShrink: 0 }}>
              <Breathe inline amount={1.05}>
                <motion.button
                  type="button" onClick={() => { setTextMode(false); setMicError(null); }} whileTap={{ scale: 0.95, opacity: 0.8 }} transition={SETTLE}
                  style={{ ...sans, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: dkBodyLight, background: "transparent", border: `1px solid ${dkDivider}`, borderRadius: shape.full, padding: "7px 12px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                >
                  <Microphone size={14} /> Use voice instead
                </motion.button>
              </Breathe>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px" }}>
            <AnimatePresence mode="wait">
              {!recording ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  // Fast exit: this runs right after tapping record, and
                  // the recording UI can't appear until it's done.
                  exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                >
                  <div style={{ ...display, fontSize: 22, color: dkHeading, textAlign: "center", lineHeight: 1.6, wordBreak: "keep-all" }}>
                    Speak freely.<br />You don't need to organize your thoughts.
                  </div>
                  <div style={{ ...sans, fontSize: 13, color: dkBody, textAlign: "center", marginTop: 14, lineHeight: 1.6, wordBreak: "keep-all", minHeight: 20 }}>
                    {promptHint}
                  </div>
                  {!voiceSupportedRef.current && (
                    <div style={{ ...sans, fontSize: 12, color: dkWarn, textAlign: "center", marginTop: 18, lineHeight: 1.6, wordBreak: "keep-all" }}>
                      This browser doesn't support speech recognition. Please use "Write instead."
                    </div>
                  )}
                  {micError && (
                    <div style={{ ...sans, fontSize: 12, color: dkWarn, textAlign: "center", marginTop: 18, lineHeight: 1.6, wordBreak: "keep-all" }}>
                      {micError}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="recording"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                >
                  {/* No mm:ss countup here on purpose — a visible timer reads as
                      "this is being measured," which raises self-censorship the
                      same way a visible recording light does. `seconds` is still
                      tracked internally (silence/auto-stop timing), just not shown. */}
                  <div style={{ ...display, fontSize: 20, color: dkBodyLight, textAlign: "center" }}>Listening</div>
                  <div style={{ ...sans, fontSize: 13, color: dkBody, textAlign: "center", marginTop: 12, lineHeight: 1.6, wordBreak: "keep-all" }}>
                    Say whatever comes to mind.
                  </div>
                  {/* No live transcript here on purpose — watching your own
                      words appear in real time is its own kind of self-
                      editing pressure (perceived anonymity drops sharply
                      once you can see exactly what's being captured).
                      `transcript`/`interim` are still tracked and used once
                      recording stops; they're just not rendered while it's
                      running. */}
                  <AnimatePresence>
                    {inputGuidance && (
                      <motion.div
                        key={inputGuidance}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        style={{ ...sans, fontSize: 13, color: dkBodyLight, textAlign: "center", marginTop: 22, lineHeight: 1.6, wordBreak: "keep-all", maxWidth: 260 }}
                      >
                        {inputGuidance}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div style={{ padding: "0 32px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            {recording && <VoiceWaveform levelRef={micLevelRef} />}
            <NeuronOrb recording={recording} onClick={() => (recording ? stopRecording() : startRecording())} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Screen 6 · Processing ─────────────────────────────────────────────────────
// When real typed text is present, this screen actually calls the analysis
// endpoint (server-side LLM call) instead of just running a fixed timer —
// the timer stays as pacing for the still-unimplemented voice/STT path.
// A hung /api/analyze call (slow model, a network stall that never
// actually errors) used to strand the user here indefinitely — no
// AbortController/timeout anywhere in the request, and this screen had no
// back button or cancel affordance. ANALYZE_TIMEOUT_MS bounds the wait;
// past that, the request is aborted and routed through the same onError
// path a real failure already uses. CANCEL_AFFORDANCE_DELAY_MS is
// separate and shorter — gives an impatient (not necessarily stuck) user
// a way out well before the hard timeout, without asserting anything is
// actually wrong.
const ANALYZE_TIMEOUT_MS = 25000;
const CANCEL_AFFORDANCE_DELAY_MS = 6000;

// A small, deterministic node-and-link cluster around a center "seed" —
// the same visual grammar as the Brain Map's own star field and the
// onboarding ripple (MINI_BRAIN_DOTS), scaled down to a single focal
// moment. Not decoration: the processing screen's own copy says
// "Connecting it to past conversations" — this animates that literal
// claim instead of showing an unrelated generic spinner.
const PROCESSING_SATELLITES = [
  { x: 27, y: 37 },
  { x: 73, y: 34 },
  { x: 33, y: 73 },
  { x: 70, y: 71 },
];

function ProcessingConstellation({ step, reducedMotion }: { step: number; reducedMotion: boolean }) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const seedRef = React.useRef<SVGCircleElement>(null);

  // Step 0 "Listening": just the seed, breathing — nothing to connect to
  // yet. Declarative Motion loop, consistent with how the rest of this
  // file handles simple infinite idle states.
  React.useEffect(() => {
    if (!seedRef.current) return;
    if (reducedMotion) {
      seedRef.current.style.opacity = "1";
      return;
    }
    const controls = animate(seedRef.current, {
      scale: [{ to: 1.25, duration: 900, ease: "inOutSine" }, { to: 1, duration: 900, ease: "inOutSine" }],
      loop: true,
    });
    return () => { controls.pause(); };
  }, [reducedMotion]);

  // Step 1 "Connecting it to past conversations": satellites and their
  // links to the seed draw in together, staggered outward — the one-shot
  // authored moment this screen earns. pathLength=1 on each <line> lets
  // the dash animation work without computing real pixel lengths.
  React.useEffect(() => {
    if (step !== 1 || !svgRef.current) return;
    const links = svgRef.current.querySelectorAll<SVGLineElement>(".link");
    const satellites = svgRef.current.querySelectorAll<SVGCircleElement>(".satellite");
    if (reducedMotion) {
      links.forEach((l) => { l.style.opacity = "1"; l.style.strokeDashoffset = "0"; });
      satellites.forEach((s) => { s.style.opacity = "1"; });
      return;
    }
    animate(links, {
      opacity: [0, 1],
      strokeDashoffset: [1, 0],
      duration: 500,
      delay: stagger(90),
      ease: "outQuad",
    });
    animate(satellites, {
      opacity: [0, 1],
      scale: [0.4, 1],
      duration: 400,
      delay: stagger(90, { start: 120 }),
      ease: "outBack",
    });
  }, [step, reducedMotion]);

  // Step 2 "Double-checking the pattern": everything that's now connected
  // settles into one synchronized soft pulse — "the pattern is confirmed,"
  // not a new idle state fighting the step-0 seed breathing above.
  React.useEffect(() => {
    if (step !== 2 || !svgRef.current || reducedMotion) return;
    const all = svgRef.current.querySelectorAll<SVGElement>(".seed, .satellite");
    animate(all, {
      opacity: [{ to: 1, duration: 260 }, { to: 0.75, duration: 500 }, { to: 1, duration: 500 }],
      ease: "inOutSine",
    });
  }, [step, reducedMotion]);

  return (
    <svg ref={svgRef} width="68" height="68" viewBox="0 0 100 100" aria-hidden="true">
      {PROCESSING_SATELLITES.map((p, i) => (
        <line key={i} className="link" x1={50} y1={50} x2={p.x} y2={p.y} stroke={dkAccent} strokeWidth="1.5" opacity={step >= 1 ? 1 : 0} pathLength={1} strokeDasharray={1} strokeDashoffset={step >= 1 ? 0 : 1} />
      ))}
      {PROCESSING_SATELLITES.map((p, i) => (
        <circle key={i} className="satellite" cx={p.x} cy={p.y} r={3.2} fill={dkAccent} opacity={step >= 1 ? 1 : 0} />
      ))}
      <circle ref={seedRef} className="seed" cx={50} cy={50} r={5} fill={dkAccent} style={{ filter: `drop-shadow(0 0 6px ${dkAccentSoft})`, transformOrigin: "50px 50px" }} />
    </svg>
  );
}

function ScreenProcessing({
  text,
  matchableBeliefs,
  matchablePending,
  priorAssumptions,
  priorConnections,
  aspiration,
  name,
  recentMoods,
  onDone,
  onError,
  onCancel,
}: {
  text?: string;
  matchableBeliefs?: Pick<StoredBelief, "id" | "domain" | "statement" | "confidence">[];
  matchablePending?: { id: string; domain: string; statement: string }[];
  priorAssumptions?: StoredAssumption[];
  priorConnections?: { aStatement: string; bStatement: string; note: string }[];
  aspiration?: string | null;
  // Distanced self-talk (Kross & Ayduk) needs a name or "you" to reframe
  // toward — undefined for guests, who get the 2nd-person fallback server-side.
  name?: string;
  // Check-ins from the last few hours (see recentMoodContext), sent as
  // background for reading this entry's feelings.
  recentMoods?: RecentMood[];
  // sessionSummary is undefined whenever /api/summarize-session didn't
  // return one (no key, network error, bad response) — a missing summary
  // never blocks or fails the main analysis, per Feature 3's own spec.
  onDone?: (result: any | null, sessionSummary?: string) => void;
  onError?: (message: string) => void;
  // Distinct from onError: canceling is a decision, not a failure — no
  // error message, just back to Home.
  onCancel?: () => void;
}) {
  const STEPS = ["Listening", "Connecting it to past conversations", "Double-checking the pattern"];
  const [step, setStep] = React.useState(0);
  const [showCancel, setShowCancel] = React.useState(false);
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    if (text) return;
    if (step >= STEPS.length - 1) {
      const t = setTimeout(() => onDone?.(null), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [text, step]);

  React.useEffect(() => {
    const t = setTimeout(() => setShowCancel(true), CANCEL_AFFORDANCE_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!text) return;
    let cancelled = false;
    const stepTimer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);
    const analyzeAbort = new AbortController();
    const timeoutId = setTimeout(() => analyzeAbort.abort(), ANALYZE_TIMEOUT_MS);

    // Feature 3 — fired alongside /api/analyze, not chained after it, so
    // the summary doesn't add extra wait time on top of the main analysis.
    // Deliberately swallows its own errors to undefined: a missing summary
    // just means the session-summary card skips that paragraph, never a
    // reason to fail the session. Not worth its own timeout — it's already
    // bounded by however long /api/analyze itself takes below.
    const summaryPromise = fetch("/api/summarize-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || typeof data?.summary !== "string") return undefined;
        return data.summary as string;
      })
      .catch(() => undefined);

    fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, matchableBeliefs, matchablePending, priorAssumptions, priorConnections, aspiration, name, recentMoods }),
      signal: analyzeAbort.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Analysis failed.");
        return data;
      })
      .then(async (data) => {
        const sessionSummary = await summaryPromise;
        if (cancelled) return;
        clearTimeout(timeoutId);
        clearInterval(stepTimer);
        setStep(STEPS.length - 1);
        setTimeout(() => { if (!cancelled) onDone?.(data, sessionSummary); }, 500);
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        clearInterval(stepTimer);
        const isTimeout = err instanceof DOMException && err.name === "AbortError";
        onError?.(isTimeout ? "This is taking longer than expected. Please try again." : err instanceof Error ? err.message : "Analysis failed.");
      });
    return () => { cancelled = true; clearInterval(stepTimer); clearTimeout(timeoutId); analyzeAbort.abort(); };
  }, [text]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", backgroundColor: dkBg, padding: 32 }}>
      <ProcessingConstellation step={step} reducedMotion={!!reducedMotion} />
      <div style={{ ...sans, fontSize: 15, color: dkBodyLight, marginTop: 22 }}>{STEPS[step]}</div>
      {showCancel && (
        <motion.span
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
          role="button" tabIndex={0} onClick={onCancel}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCancel?.(); } }}
          style={{ ...sans, fontSize: 13, color: dkBody, marginTop: 28, cursor: "pointer" }}
        >
          Cancel
        </motion.span>
      )}
    </div>
  );
}

// ── Screen 7 · Think complete ─────────────────────────────────────────────────
// Reached two ways now: a Pro entry where the model itself found nothing new
// to report, or any free-tier entry (recording is the entire free feature —
// see appendUnanalyzedEntry in realStore.ts and the "think" case's onDone).
// showUpsell distinguishes the two only by adding one extra line and a CTA;
// the core "Got it" acknowledgment is identical either way, since a free
// entry isn't a lesser version of a Pro one, just an unanalyzed one.
// ── Screen 5.0 · AI-analysis consent ──────────────────────────────────────────
// Two independent checkboxes, each with the disclosures PIPA requires at the
// moment of asking (items / purpose / retention, plus recipient / country /
// timing for the overseas transfer), and an equally prominent way to say no.
// See aiConsent.ts for why it's two consents and what declining does.
function ScreenAiConsent({
  current,
  onBack,
  onDecide,
}: {
  current: import("./aiConsent").AiConsent | null;
  onBack?: () => void;
  onDecide: (granted: boolean) => void;
}) {
  const copy = AI_CONSENT_COPY[isKoreanLocale() ? "ko" : "en"];
  const wasGranted = !!current && current.version === AI_CONSENT_VERSION && current.sensitive && current.overseas;
  // Never pre-checked on a first ask — consent has to be an affirmative act.
  // Pre-filled only when reviewing a consent that's already in force.
  const [sensitive, setSensitive] = React.useState(wasGranted);
  const [overseas, setOverseas] = React.useState(wasGranted);
  const both = sensitive && overseas;
  const block = (part: { label: string; rows: [string, string][] }, checked: boolean, set: (v: boolean) => void) => (
    <div style={{ marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: ivSurfaceSolid, boxShadow: ivCardShadow }}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: ivHeading, flexShrink: 0 }} />
        <span style={{ ...sans, fontSize: 15, fontWeight: 600, color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all" }}>{part.label}</span>
      </label>
      <dl style={{ margin: "12px 0 0 28px", display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 6 }}>
        {part.rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt style={{ ...sans, fontSize: 12, fontWeight: 600, color: ivBody, whiteSpace: "nowrap" }}>{k}</dt>
            <dd style={{ ...sans, fontSize: 12, color: ivBody, margin: 0, lineHeight: 1.5, wordBreak: "keep-all" }}>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ivBg2 }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: ivHeading, marginTop: 10, lineHeight: 1.3, wordBreak: "keep-all" }}>{copy.title}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {/* What agreeing changes, drawn: the trip to Anthropic only runs
            once both boxes are ticked. The legal text below is unchanged. */}
        <div style={{ backgroundColor: ivSurfaceSolid, borderRadius: shape.md, boxShadow: ivCardShadow, padding: 12, marginBottom: 16 }}>
          <DataPathIllustration aiOn={both} lang={isKoreanLocale() ? "ko" : "en"} />
        </div>
        <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.7, wordBreak: "keep-all" }}>{copy.intro}</div>
        {block(copy.sensitive, sensitive, setSensitive)}
        {block(copy.overseas, overseas, setOverseas)}
        <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 16, lineHeight: 1.6, wordBreak: "keep-all" }}>{copy.refuse}</div>
        <a href={`/legal/privacy${isKoreanLocale() ? ".ko" : ""}.html`} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-block", ...sans, fontSize: 13, fontWeight: 600, color: ivHeading, marginTop: 10, textDecoration: "underline" }}>
          {copy.policyLink} ↗
        </a>
      </div>
      <div style={{ padding: "12px 22px 22px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <motion.button
          type="button" disabled={!both} onClick={() => onDecide(true)} whileTap={both ? { scale: 0.99 } : undefined}
          style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: "none", backgroundColor: ivHeading, color: ivSurfaceSolid, opacity: both ? 1 : 0.35, cursor: both ? "pointer" : "not-allowed", ...sans, fontSize: 15, fontWeight: 600 }}
        >
          {copy.agree}
        </motion.button>
        <motion.button
          type="button" onClick={() => onDecide(false)} whileTap={{ scale: 0.99 }}
          style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: `1px solid ${ivDivider}`, backgroundColor: "transparent", color: ivHeading, cursor: "pointer", ...sans, fontSize: 15, fontWeight: 600 }}
        >
          {copy.decline}
        </motion.button>
      </div>
    </div>
  );
}

function ScreenThinkComplete({ error, showUpsell, onDone, onUpgrade }: { error?: string; showUpsell?: boolean; onDone?: () => void; onUpgrade?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <RevealGroup style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        {error ? (
          <>
            <RevealItem>
              <div style={{ ...display, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
                Couldn't analyze that.
              </div>
            </RevealItem>
            <RevealItem>
              <div style={{ ...sans, fontSize: 13, color: dkWarn, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
                {error}
              </div>
            </RevealItem>
          </>
        ) : (
          <>
            <RevealItem>
              <div style={{ ...display, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
                Got it.
              </div>
            </RevealItem>
            <RevealItem>
              <div style={{ ...sans, fontSize: 15, color: dkBody, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
                Today's thoughts have been added to your record. Nothing is judged or organized — it's just quietly kept.
              </div>
            </RevealItem>
            {showUpsell && (
              <RevealItem>
                <Breathe amount={1.02}><motion.div
                  role="button" tabIndex={0} onClick={onUpgrade} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onUpgrade)?.(); } }}
                  whileTap={{ scale: 0.98, opacity: 0.9 }} transition={SETTLE}
                  style={{ marginTop: 20, padding: 16, borderRadius: 14, backgroundColor: dkAccentSoft, borderLeft: `2px solid ${dkAccent}`, cursor: "pointer" }}
                >
                  <div style={{ ...sans, fontSize: 13, fontWeight: 700, color: dkAccentLight }}>Curious what pattern this is part of?</div>
                  <div style={{ ...sans, fontSize: 13, color: dkBodyLight, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>Upgrade to Pro to turn your record into unconscious beliefs, connections, and hypotheses.</div>
                </motion.div></Breathe>
              </RevealItem>
            )}
          </>
        )}
      </RevealGroup>
      <RevealGroup delay={0.4} style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <RevealItem><PrimaryBtn onClick={onDone}>Go home</PrimaryBtn></RevealItem>
      </RevealGroup>
    </div>
  );
}

// ── Screen 6.6 · Soft paywall (one-time nudge) ────────────────────────────────
// Fires exactly once, replacing the usual "Got it" beat right after the free
// tier's 3rd recorded entry (see UPSELL_PROMPT_AT_ENTRY_COUNT and the
// "think" case's onDone in the App shell) — a deliberate, one-time ask
// rather than the quiet recurring footnote ScreenThinkComplete's showUpsell
// already adds to every free entry. Never repeats after this: the App shell
// marks hasSeenUpgradePrompt true the instant this screen is shown, whether
// the person taps through to plans or dismisses with "Not now."
function ScreenSoftPaywall({ onSeePlans, onDismiss }: { onSeePlans?: () => void; onDismiss?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <RevealGroup style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        <RevealItem>
          <div style={{ ...display, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
            You've recorded three thoughts now.
          </div>
        </RevealItem>
        <RevealItem>
          <div style={{ ...sans, fontSize: 15, color: dkBody, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
            That's usually enough for the first patterns to start showing. Want Pro to show you what's underneath them?
          </div>
        </RevealItem>
      </RevealGroup>
      <RevealGroup delay={0.4} style={{ padding: "0 28px 40px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <RevealItem><PrimaryBtn onClick={onSeePlans}>See Pro plans</PrimaryBtn></RevealItem>
        <RevealItem><GhostBtn onClick={onDismiss}>Not now</GhostBtn></RevealItem>
      </RevealGroup>
    </div>
  );
}

// ── Screen 6.7 · Crisis support ───────────────────────────────────────────────
// The one deliberate exception to "observe, don't judge" — see
// crisisDetection.ts for why this exists and why it's keyword-based rather
// than a model call. Reached instead of processing/thinkComplete/the soft
// paywall/anything else the "think" case's onDone would otherwise route to
// — checked first, before the isPro branch, so a crisis-flagged entry never
// reaches /api/analyze or the belief/hypothesis pipeline regardless of tier.
// The entry itself is still saved (see appendUnanalyzedEntry in the App
// shell's onDone) — this is about response routing, not about withholding
// or hiding what someone wrote. Real tel:/sms: links, not styled buttons
// wired to JS, so the OS's own dialer/messages app opens directly.
function CrisisResourceCard({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <a
      href={href}
      style={{
        display: "block", textDecoration: "none", padding: "16px 18px", borderRadius: 14,
        backgroundColor: dkCard, border: `1px solid ${dkDivider}`,
      }}
    >
      <div style={{ ...sans, fontSize: 15, fontWeight: 700, color: dkHeading }}>{title}</div>
      <div style={{ ...sans, fontSize: 13, color: dkBody, marginTop: 3, lineHeight: 1.5 }}>{subtitle}</div>
    </a>
  );
}

function ScreenCrisisSupport({ onContinue }: { onContinue?: () => void }) {
  // This is the one screen in the app where a screen-reader user silently
  // missing that anything changed is unacceptable — everywhere else, a
  // missed transition just means re-exploring the page; here it means the
  // 988/Crisis Text Line resources go unnoticed. Moving focus to the
  // heading is the standard SPA route-change fix: most screen readers
  // announce whatever receives focus, so this reads immediately instead
  // of requiring the person to blindly find it. tabIndex={-1} makes a
  // plain div programmatically focusable without adding it to the normal
  // Tab order (it's not an interactive element itself).
  const headingRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "48px 28px 24px" }}>
        <div ref={headingRef} tabIndex={-1} style={{ ...display, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all", outline: "none" }}>
          It sounds like you might be going through something really hard right now.
        </div>
        <div style={{ ...sans, fontSize: 15, color: dkBody, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
          If that's true, you don't have to go through it alone. These are free, confidential, and available right now — not just for emergencies, for whatever this is too.
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <CrisisResourceCard
            title="988 Suicide & Crisis Lifeline"
            subtitle="Call or text 988 — free, confidential, 24/7"
            href="tel:988"
          />
          <CrisisResourceCard
            title="Crisis Text Line"
            subtitle="Text HOME to 741741 — a real person, by text"
            href="sms:741741&body=HOME"
          />
          <CrisisResourceCard
            title="Outside the US"
            subtitle="Find a local helpline at findahelpline.com"
            href="https://findahelpline.com"
          />
        </div>

        <div style={{ ...sans, fontSize: 12, color: dkBody, marginTop: 24, lineHeight: 1.6, wordBreak: "keep-all" }}>
          What you wrote is still saved, just like always — nothing else about it changes. Mindscape isn't a substitute for real support, which is exactly why these are here.
        </div>
      </div>
      <div style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <GhostBtn onClick={onContinue}>Continue</GhostBtn>
      </div>
    </div>
  );
}

// ── Screen 6.5 · Session summary (Feature 2) ─────────────────────────────────
// Shown once, right after a successful analysis, before landing on the
// Analysis tab — a quiet "here's what was just observed about how you
// talked" beat, purely descriptive (see cognitiveLexicon.ts). Feature 3
// will add an AI-written recap paragraph above this same card later; this
// screen already reads entry.sessionSummary so nothing else needs to
// change when that lands.
// Feature: emotional granularity (Note 2) — how many *distinct* emotion
// labels this session's analysis surfaced, compared to the last 3
// sessions' average. A raw unique-label count, not the "unique / total"
// ratio the note describes: within a single entry the model's own
// emotions list essentially never repeats a label, so that ratio would
// trivially read ~1.0 on every entry and say nothing — comparing the
// count itself across sessions is what this data can actually show.
// Never surfaced as a number anywhere in the UI — emotional-granularity
// scores are associated with clinical instruments in the literature (see
// the gap-analysis doc's BPD caution), so this only ever becomes a plain
// observational sentence, same rule as the cognitive-verb trend above.
function countUniqueEmotions(entry: StoredHistoryEntry): number | null {
  const emotions = entry.analysis?.observation.emotions;
  if (!emotions || emotions.length === 0) return null;
  return new Set(emotions.map((e) => e.label)).size;
}

// Same underlying signal as countUniqueEmotions/buildEmotionVarietyLine
// above, averaged over one belief's last few supporting entries instead of
// compared session-to-session. Unlike that line, this never becomes text —
// it only ever drives the 3D neuron's surface geometry (see
// NeuralBeliefGraph3D's facetDetail), so the "never surface a number"
// caution above doesn't apply the same way: nothing here is labeled,
// scored, or shown as a figure, just a texture a viewer can't put a value on.
function beliefEmotionGranularity(belief: StoredBelief, history: StoredHistoryEntry[]): number | undefined {
  const counts = (belief.supportingEntryIds ?? [])
    .map((id) => history.find((e) => e.id === id))
    .filter((e): e is StoredHistoryEntry => !!e)
    .slice(-3)
    .map((e) => countUniqueEmotions(e))
    .filter((n): n is number => n !== null);
  if (counts.length === 0) return undefined;
  return counts.reduce((sum, n) => sum + n, 0) / counts.length;
}

function buildEmotionVarietyLine(entry: StoredHistoryEntry, priorEntries: StoredHistoryEntry[]): string | null {
  const current = countUniqueEmotions(entry);
  if (current === null) return null;
  const priorCounts = priorEntries
    .slice(-3)
    .map((e) => countUniqueEmotions(e))
    .filter((n): n is number => n !== null);
  if (priorCounts.length === 0) return null;
  const avgPrior = priorCounts.reduce((sum, n) => sum + n, 0) / priorCounts.length;
  const delta = current - avgPrior;
  // Flat comparisons aren't reported — unlike the cognitive-verb trend,
  // where "about the same as usual" is still worth saying, a near-equal
  // emotion count says little on its own and would just add a third
  // near-identical trend line to every card.
  if (Math.abs(delta) < 0.5) return null;
  return delta > 0
    ? "You used a wider range of emotion words today than in recent sessions."
    : "You used a narrower range of emotion words today than in recent sessions.";
}

function buildLanguageObservationLines(entry: StoredHistoryEntry, priorObservations: LanguageObservation[]): string[] {
  const obs = entry.languageObservation;
  if (!obs) return [];
  const lines: string[] = [];

  const trend = compareCognitiveVerbTrend(obs, priorObservations);
  if (trend && obs.cognitiveVerbCount > 0) {
    const examples = extractCognitiveVerbExamples(entry.text, 2);
    const examplePhrase = examples.length > 0 ? `words like ${examples.map((e) => `"${e}"`).join(", ")} ` : "";
    if (trend === "increased") lines.push(`Today you used ${examplePhrase}more than in recent sessions.`);
    else if (trend === "decreased") lines.push(`Today you used ${examplePhrase}less than in recent sessions.`);
    else lines.push(`Today you used ${examplePhrase}about as much as in recent sessions.`);
  }

  const lean = comparePronounLean(obs);
  if (lean === "firstPerson") lines.push("Today you used the word \"I\" a lot.");
  else if (lean === "collectiveOrOther") lines.push("Today you used words like \"we\" and \"they\" more than \"I.\"");

  return lines;
}

function ScreenSessionSummary({ store, onDone }: { store: Store; onDone?: () => void }) {
  const entry = store.history[store.history.length - 1] ?? null;
  const priorEntries = store.history.slice(0, -1);
  const priorObservations = priorEntries
    .map((e) => e.languageObservation)
    .filter((o): o is LanguageObservation => !!o);
  const lines = entry ? buildLanguageObservationLines(entry, priorObservations) : [];
  const emotionVarietyLine = entry ? buildEmotionVarietyLine(entry, priorEntries) : null;
  if (emotionVarietyLine) lines.push(emotionVarietyLine);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      {/* This screen is the result of what the person just did, so its
      parts arrive in reading order — acknowledgment, then what was heard,
      then each observation — rather than all at once. */}
      <RevealGroup style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        <RevealItem>
          <div style={{ ...display, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
            Got it.
          </div>
        </RevealItem>
        {entry?.sessionSummary && (
          <RevealItem>
            <div style={{ ...sans, fontSize: 15, color: dkBodyLight, marginTop: 16, lineHeight: 1.7, wordBreak: "keep-all" }}>
              {entry.sessionSummary}
            </div>
          </RevealItem>
        )}
        {lines.length > 0 && (
          <div style={{ marginTop: entry?.sessionSummary ? 18 : 12, display: "flex", flexDirection: "column", gap: 8, paddingTop: entry?.sessionSummary ? 16 : 0, borderTop: entry?.sessionSummary ? `1px solid ${dkDivider}` : "none" }}>
            {lines.map((line, i) => (
              <RevealItem key={i}>
                <div style={{ ...sans, fontSize: 13, color: dkBody, lineHeight: 1.65, wordBreak: "keep-all" }}>{line}</div>
              </RevealItem>
            ))}
          </div>
        )}
        {!entry?.sessionSummary && lines.length === 0 && (
          <RevealItem>
            <div style={{ ...sans, fontSize: 15, color: dkBody, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
              Today's thoughts have been added to your record. Nothing is judged or organized — it's just quietly kept.
            </div>
          </RevealItem>
        )}
      </RevealGroup>
      {/* The summary can run to five or six lines; the button waits until
      the last of them is well underway rather than racing them. */}
      <RevealGroup delay={0.55} style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <RevealItem><PrimaryBtn onClick={onDone}>Got it</PrimaryBtn></RevealItem>
      </RevealGroup>
    </div>
  );
}


// ── Screen 8 · Belief Map ─────────────────────────────────────────────────────
// Radius encodes real evidence count, not a hand-picked size — r ∝ √value so
// circle AREA (which is what the eye actually compares) reads proportionally
// correct, the same lesson as an earlier project's GDP bubble chart. Domain
// tags stay inside the circle (short enough to fit at any radius); the full
// belief sentence lives in the list below, same split BRICS used (chart
// carries magnitude, list carries the actual claim).
// Generic layout for a live, arbitrary-length belief graph (the demo chart
// above uses 5 hand-placed positions; real data grows one node at a time,
// so this needs a rule instead of fixed coordinates). Radius still encodes
// evidenceCount via sqrt — same "area, not radius, is what the eye compares"
// rule as the demo chart.
function layoutBeliefNodes(items: { evidenceCount: number }[]) {
  const cx = 150, cy = 132;
  const maxV = Math.max(1, ...items.map((it) => it.evidenceCount || 1));
  const maxR = 50, minR = 26;
  const sizeOf = (v: number) => minR + (maxR - minR) * Math.sqrt((v || 1) / maxV);
  if (items.length === 1) return [{ x: cx, y: cy, r: sizeOf(items[0].evidenceCount) }];
  const ringR = items.length <= 3 ? 68 : items.length <= 5 ? 92 : 108;
  return items.map((it, i) => {
    const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * ringR, y: cy + Math.sin(angle) * ringR, r: sizeOf(it.evidenceCount) };
  });
}

// The "brain network" view: same bubbles, plus lines wherever the model
// found two beliefs share a root cause. Lines render first so bubbles sit
// on top of them.
// Synapses, not just lines: each connection draws itself in on mount, then a
// small pulse keeps traveling along it — a standing "signal" between the two
// beliefs it links, instead of a static diagram.
function BeliefNetworkChart({ beliefs, connections }: { beliefs: StoredBelief[]; connections: StoredConnection[] }) {
  const positioned = layoutBeliefNodes(beliefs).map((pos, i) => ({ ...beliefs[i], ...pos }));
  const byId = new Map(positioned.map((b) => [b.id, b]));
  return (
    <svg viewBox="6 6 288 248" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {connections.map((c, i) => {
        const a = byId.get(c.a);
        const b = byId.get(c.b);
        if (!a || !b) return null;
        return (
          <React.Fragment key={i}>
            <motion.line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={accent} strokeWidth={1.4}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.4 }}
              transition={{ duration: 0.9, delay: 0.15 * i, ease: "easeOut" }}
            />
            <motion.circle
              r={2.6} fill={accent}
              initial={{ opacity: 0, cx: a.x, cy: a.y }}
              animate={{ opacity: [0, 1, 1, 0], cx: [a.x, a.x, b.x, b.x], cy: [a.y, a.y, b.y, b.y] }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.1, delay: 1 + 0.15 * i, ease: "easeInOut", times: [0, 0.08, 0.92, 1] }}
            />
          </React.Fragment>
        );
      })}
      {positioned.map((b) => (
        <circle key={b.id} cx={b.x} cy={b.y} r={b.r} fill={accentSoft} stroke={accent} strokeOpacity={0.4} strokeWidth={1.2} />
      ))}
      {positioned.map((b) => (
        <React.Fragment key={`${b.id}-text`}>
          <text x={b.x} y={b.y - 3} textAnchor="middle" dominantBaseline="central" style={{ ...sans, fontSize: Math.max(b.r * 0.24, 9), fontWeight: 700, fill: ink }}>{b.domain}</text>
          <text x={b.x} y={b.y + Math.max(b.r * 0.3, 12)} textAnchor="middle" dominantBaseline="central" style={{ ...mono, fontSize: Math.max(b.r * 0.16, 7.5), fontWeight: 600, fill: mid }}>{b.evidenceCount}</text>
        </React.Fragment>
      ))}
    </svg>
  );
}

// Affect labeling — naming an emotion is itself the intervention (Lieberman
// et al.: putting a feeling into words measurably calms the reaction to it),
// so this just surfaces whichever emotion showed up most, weighted by
// intensity, across the entries that actually support this belief. Not a
// claim that the belief "causes" the emotion — just what tended to be
// nearby when it did.
function dominantEmotion(entryIds: string[] | undefined, history: StoredHistoryEntry[]): string | null {
  if (!entryIds || entryIds.length === 0) return null;
  const totals = new Map<string, number>();
  entryIds.forEach((id) => {
    const entry = history.find((e) => e.id === id);
    entry?.analysis?.observation.emotions.forEach((em) => {
      totals.set(em.label, (totals.get(em.label) ?? 0) + em.intensity);
    });
  });
  if (totals.size === 0) return null;
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

// Whether at least one of a belief's own supporting entries carries a full
// situation→thought→emotion→action chain — powers BeliefCard's "see why
// this pattern repeats" toggle.
function hasFunctionalLoopData(belief: Pick<StoredBelief, "supportingEntryIds">, history: StoredHistoryEntry[]): boolean {
  return (belief.supportingEntryIds ?? []).some((id) => history.find((e) => e.id === id)?.analysis?.observation.situation);
}

// Longitudinal drift (Level 4) — a plain sparkline over confidenceHistory,
// purely descriptive ("this is how it's moved"), never a forecast. Only
// renders once there are at least two points; a single point is just the
// belief's current confidence, already shown by the bar above it.
function ConfidenceTrend({ history }: { history: { date: string; value: number }[] }) {
  if (history.length < 2) return null;
  const w = 240;
  const h = 32;
  const pad = 3;
  const values = history.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = history
    .map((p, i) => {
      const x = pad + (i / (history.length - 1)) * (w - pad * 2);
      const y = h - pad - ((p.value - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const delta = history[history.length - 1].value - history[0].value;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: "rgba(42,38,33,0.65)" }}>Confidence over time · {history.length} entries</span>
        <span style={{ ...mono, fontSize: 11, color: delta > 0 ? "#2A2621" : delta < 0 ? "rgba(42,38,33,0.4)" : "rgba(42,38,33,0.42)" }}>{delta > 0 ? "+" : ""}{delta}</span>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 4, display: "block" }}>
        <polyline points={points} fill="none" stroke={"#2A2621"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// Functional analysis (Level 2) — reads the situation → automatic thought →
// emotion → action chain straight off the belief's own supporting entries
// (already recorded per-entry, see ThoughtObservation) and closes the loop
// with a plain-language note about the action feeding back into a similar
// situation. No new extraction, no claim beyond what one real entry already
// showed — just naming the cycle instead of leaving it implicit.
function FunctionalLoopDiagram({ belief, history }: { belief: StoredBelief; history: StoredHistoryEntry[] }) {
  const candidateEntries = (belief.supportingEntryIds ?? [])
    .map((id) => history.find((e) => e.id === id))
    .filter((e): e is StoredHistoryEntry => !!e && !!e.analysis?.observation.situation);
  const entry = candidateEntries[candidateEntries.length - 1];
  if (!entry?.analysis) {
    return <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.5)" }}>There isn't a detailed enough entry yet to show this belief's cycle.</div>;
  }
  const obs = entry.analysis.observation;
  const topEmotion = [...obs.emotions].sort((a, b) => b.intensity - a.intensity)[0];
  const steps = [
    { label: "Situation", text: obs.situation },
    { label: "Automatic thought", text: obs.automaticThought },
    { label: "Emotion", text: topEmotion ? `${topEmotion.label} (intensity ${topEmotion.intensity})` : "No record" },
    { label: "Action", text: obs.actionUrge },
  ];
  return (
    <div>
      <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)", marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>
        From your entry on {entry.date}, here's how this belief actually played out, step by step.
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "rgba(42,38,33,0.06)", color: "#2A2621", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, paddingBottom: 4 }}>
                <div style={{ ...sans, fontSize: 11, fontWeight: 700, color: "rgba(42,38,33,0.65)", letterSpacing: "0.04em" }}>{s.label}</div>
                <div style={{ ...display, fontSize: 17, color: "#2A2621", marginTop: 2, lineHeight: 1.5, wordBreak: "keep-all" }}>{s.text}</div>
              </div>
            </div>
            {i < steps.length - 1 && <div style={{ marginLeft: 9, width: 1, height: 14, backgroundColor: "rgba(42,38,33,0.09)" }} />}
          </React.Fragment>
        ))}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, marginLeft: 32 }}>
          <span style={{ ...sans, fontSize: 15, color: "#2A2621", lineHeight: 1 }}>↺</span>
          <span style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)", fontStyle: "italic", lineHeight: 1.5, wordBreak: "keep-all" }}>
            It looks like this action tends to create a similar situation again, and the same thought shows back up.
          </span>
        </div>
      </div>
    </div>
  );
}

// One belief's full card — its own component (rather than inlined in the
// map below) so each can hold its own "which pattern tag is expanded" state
// without the cards interfering with each other.
function BeliefCard({ belief, history, connections, onReject, first }: { belief: StoredBelief; history: StoredHistoryEntry[]; connections: StoredConnection[]; onReject?: (id: string) => void; first?: boolean }) {
  const [openPattern, setOpenPattern] = React.useState<string | null>(null);
  const [showLoop, setShowLoop] = React.useState(false);
  // The card is three lines — badge row, statement, meter — until asked
  // for more: everything else (the thought label, the trend, chips,
  // quotes, the loop diagram, the reject link) sits behind one "Details"
  // row. Legibility first; the depth is still all there.
  const [showDetails, setShowDetails] = React.useState(false);
  const region = resolveRegion(belief);
  const color = REGION_CONFIG[region].color;
  const emotion = dominantEmotion(belief.supportingEntryIds, history);
  const patterns = belief.possibleCognitivePatterns ?? [];
  const hasLoopData = hasFunctionalLoopData(belief, history);
  // Rumination-vs-reflection (Trapnell & Campbell): rising confidence with no
  // new connection and no widening emotional register reads as circling, not
  // moving. The line stays purely observational — a frequency fact, not a
  // suggestion to stop or a diagnostic label — same principle as every other
  // card element here.
  const ruminationLikely = isLikelyRuminating(belief, connections, history);
  // Distanced self-talk (Kross & Ayduk) — a literal card-flip metaphor for
  // the reframe itself, not just an expand/collapse: the statement is a
  // fact-in-1st-person on one face, the same meaning at 2nd-person distance
  // on the other.
  const [reframeFlipped, setReframeFlipped] = React.useState(false);
  const statementStyle: React.CSSProperties = { ...display, fontSize: 20, color: ivHeading, lineHeight: 1.35, wordBreak: "keep-all" };
  return (
    <div style={{ position: "relative", padding: "14px 16px 4px" }}>
      {!first && <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 24 }}>
        <Node color={color} size={12} intensity={0.75} />
        <span style={{ ...sans, fontSize: 12, color: ivBody, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{belief.domain}</span>
        <span style={{ flex: 1 }} />
        {belief.status === "conflicted" && <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdWarnLabel, flexShrink: 0 }}>Mixed signals</span>}
        {belief.status === "supported" && <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: ivBody, flexShrink: 0 }}>Keeps showing up</span>}
      </div>
      {belief.distancedReframe ? (
        <div style={{ marginTop: 8, perspective: 800 }}>
          {/* Distanced self-talk flip: both faces share one grid cell so the
              block sizes to whichever face wraps to more lines. */}
          <motion.div animate={{ rotateY: reframeFlipped ? 180 : 0 }} transition={{ duration: 0.2, ease: "easeInOut" }} style={{ display: "grid", transformStyle: "preserve-3d" }}>
            <div style={{ ...statementStyle, gridArea: "1 / 1", backfaceVisibility: "hidden" }}>{belief.statement}</div>
            <div style={{ ...statementStyle, gridArea: "1 / 1", backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>{belief.distancedReframe}</div>
          </motion.div>
        </div>
      ) : (
        <div style={{ ...statementStyle, marginTop: 8 }}>{belief.statement}</div>
      )}
      <div style={{ marginTop: 10 }}>
        <OftenDots confidence={belief.confidence} region={region} extra={`· in ${belief.evidenceCount} ${belief.evidenceCount === 1 ? "entry" : "entries"}`} />
      </div>
      <motion.button
        type="button" aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)} whileTap={{ opacity: 0.6 }}
        style={{ display: "flex", alignItems: "center", gap: 6, border: 0, background: "transparent", padding: "10px 0 8px", margin: 0, ...sans, fontSize: 13, fontWeight: 500, color: ivHeading, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      >
        {showDetails ? "Less" : "Details"}
        <motion.span animate={{ rotate: showDetails ? 180 : 0 }} transition={SETTLE} style={{ display: "flex" }}><CaretDown size={13} color={ivFaint} weight="bold" /></motion.span>
      </motion.button>
      <Collapse open={showDetails}>
      <div style={{ paddingBottom: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Defusion reframe (ACT: "naming the thought") — a recurring
          visitor, not a fact about the person. */}
      {belief.thoughtLabel && (
        <div style={{ ...sans, fontSize: 13, fontStyle: "italic", color: ivBody }}>The "{belief.thoughtLabel}" thought keeps showing up</div>
      )}
      {belief.distancedReframe && (
        <motion.span
          role="button" tabIndex={0} whileTap={{ opacity: 0.6 }}
          onClick={() => setReframeFlipped((v) => !v)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setReframeFlipped((v) => !v); }}
          style={{ ...sans, fontSize: 13, fontWeight: 500, color: ivHeading, display: "inline-block", cursor: "pointer" }}
        >
          {reframeFlipped ? "Back to the original" : "See it from a distance"}
        </motion.span>
      )}
      {/* Longitudinal drift (Level 4) — how this belief's confidence has
          actually moved, not just where it stands right now. */}
      {belief.confidenceHistory && <ConfidenceTrend history={belief.confidenceHistory} />}
      {ruminationLikely && (
        <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.5, wordBreak: "keep-all" }}>
          This thought has come back often in recent sessions.
        </div>
      )}
      {(patterns.length > 0 || emotion) && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {emotion && (
            <span style={{ ...sans, fontSize: 11, color: "rgba(42,38,33,0.65)", backgroundColor: "rgba(42,38,33,0.08)", padding: "3px 8px", borderRadius: 999 }}>Predominant emotion · {emotion}</span>
          )}
          {patterns.map((p) => {
            const active = openPattern === p;
            return (
              <motion.span
                key={p} role="button" tabIndex={0} whileTap={{ opacity: 0.6 }}
                onClick={() => setOpenPattern(active ? null : p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => setOpenPattern(active ? null : p))?.(); } }}
                style={{ ...sans, fontSize: 11, fontWeight: active ? 700 : 500, color: active ? "#fff" : "#2A2621", backgroundColor: active ? "rgba(42,38,33,0.5)" : "rgba(42,38,33,0.06)", padding: "3px 8px", borderRadius: 999, cursor: "pointer" }}
              >
                {p}
              </motion.span>
            );
          })}
        </div>
      )}
      {openPattern && (
        <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.75)", marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all", padding: 10, borderRadius: 10, backgroundColor: "rgba(42,38,33,0.06)" }}>
          <div>{COGNITIVE_PATTERN_DESCRIPTIONS[openPattern as keyof typeof COGNITIVE_PATTERN_DESCRIPTIONS] ?? ""}</div>
          {/* Balanced reframe (ported from a parallel session) — most
              cognitive habits started as adaptive, not just a flaw. */}
          {(() => {
            const r = COGNITIVE_PATTERN_REFLECTIONS[openPattern as keyof typeof COGNITIVE_PATTERN_REFLECTIONS] ?? GENERIC_PATTERN_REFLECTION;
            return (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${"rgba(42,38,33,0.09)"}`, display: "flex", flexDirection: "column", gap: 4 }}>
                <div><span style={{ fontWeight: 700, color: "#2A2621" }}>What helps</span> · {r.benefit}</div>
                <div><span style={{ fontWeight: 700, color: "rgba(42,38,33,0.5)" }}>What to watch for</span> · {r.caution}</div>
              </div>
            );
          })()}
        </div>
      )}
      {belief.evidenceQuotes.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {[...belief.evidenceQuotes].reverse().slice(0, 2).map((q: StoredEvidenceQuote, qi: number) => (
            <div key={qi} style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)", lineHeight: 1.5, wordBreak: "keep-all" }}>
              <span style={{ ...mono, fontSize: 11, color: "rgba(42,38,33,0.5)" }}>{q.date}</span> · "{q.quote}"
            </div>
          ))}
        </div>
      )}
      {hasLoopData && (
        <div style={{ marginTop: 10 }}>
          <motion.span
            role="button" tabIndex={0} whileTap={{ opacity: 0.6 }} onClick={() => setShowLoop((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => setShowLoop((v) => !v))?.(); } }}
            style={{ ...sans, fontSize: 12, color: "#2A2621", fontWeight: 600, cursor: "pointer", display: "inline-block" }}
          >
            {showLoop ? "Collapse repeat structure ↑" : "See why this pattern repeats ↓"}
          </motion.span>
          <Collapse open={showLoop}>
            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: "rgba(42,38,33,0.08)" }}>
              <FunctionalLoopDiagram belief={belief} history={history} />
            </div>
          </Collapse>
        </div>
      )}
      {onReject && (
        <motion.span
          role="button" tabIndex={0} onClick={() => onReject(belief.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => onReject(belief.id))?.(); } }} whileTap={{ opacity: 0.6 }}
          style={{ ...sans, fontSize: 13, color: ivBody, display: "inline-block", cursor: "pointer" }}
        >
          This observation doesn't match how I see it
        </motion.span>
      )}
      </div>
      </Collapse>
    </div>
  );
}

// A small circular node/edge diagram for one cluster — deliberately not
// force-directed (that needs real layout math for a payoff mainly visible
// with many nodes; a 3-6 node cluster reads just as clearly evenly spaced
// on a circle) so every pair gets a visible edge with no overlap.
function BeliefClusterDiagram({ count }: { count: number }) {
  const size = 96;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const positions = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {positions.map((p1, i) =>
        positions.slice(i + 1).map((p2, j) => (
          <line key={`${i}-${i + 1 + j}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={"#2A2621"} strokeOpacity={0.3} strokeWidth={1} />
        ))
      )}
      {positions.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={8} fill={"rgba(42,38,33,0.06)"} stroke={"#2A2621"} strokeWidth={1.4} />
      ))}
    </svg>
  );
}

// Belief network mapping (Level 3) — a core belief rarely stands alone;
// this surfaces the connected clusters findBeliefClusters finds among
// "root" connections (3+ mutually-reinforcing beliefs), which the flat
// pairwise "Discovered Connections" list elsewhere never states as a single structure.
function BeliefNetworkSection({ beliefs, connections }: { beliefs: StoredBelief[]; connections: StoredConnection[] }) {
  const clusters = findBeliefClusters(beliefs, connections);
  if (clusters.length === 0) return null;
  const byId = new Map(beliefs.map((b) => [b.id, b]));
  return (
    <SettingsGroup header="Thoughts that hold each other up" footer="Thoughts like these rarely come alone. They tend to show up together, each one making the others feel more true.">
      {clusters.map((clusterIds, ci) => {
        const clusterBeliefs = clusterIds.map((id) => byId.get(id)).filter((b): b is StoredBelief => !!b);
        if (clusterBeliefs.length === 0) return null;
        return (
          <div key={ci} style={{ position: "relative", display: "flex", gap: 14, alignItems: "center", padding: "14px 16px" }}>
            {ci > 0 && <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />}
            <BeliefClusterDiagram count={clusterBeliefs.length} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...sans, fontSize: 15, fontWeight: 500, color: ivHeading }}>These {clusterBeliefs.length} hold each other up</div>
              <ul style={{ margin: "6px 0 0", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                {clusterBeliefs.map((b) => (
                  <li key={b.id} style={{ ...display, fontSize: 15, color: ivBody, lineHeight: 1.4, wordBreak: "keep-all" }}>{b.statement}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </SettingsGroup>
  );
}

// Contradiction detection (Level 5) — just lays the two statements side by
// side and stops there; no verdict on which one is "true." This is the
// motivational-interviewing "discrepancy" technique — naming the tension
// out loud is the entire intervention.
// ── Lower Unconscious-patterns illustrations ─────────────────────────────────
// One drawing per section, each showing the relationship that section is
// about rather than decorating it: tension as a balance that tips toward
// the belief with more behind it, an interpretation as a spark that sets
// off a ripple, a connection as two plants that turn out to share a root.

const regionOfBelief = (b: { domain: string }) => REGION_CONFIG[resolveRegion(b as StoredBelief)];
const shortBelief = (b: StoredBelief) => b.thoughtLabel || (b.statement.length > 26 ? `${b.statement.slice(0, 25)}…` : b.statement);

// A balance with one belief on each pan. It settles tipped toward the one
// with more confidence behind it (real values, at most ±11°), and rocks
// gently around that, the way a scale does before it comes to rest.
function TensionScale({ a, b }: { a: StoredBelief; b: StoredBelief }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const ra = regionOfBelief(a), rb = regionOfBelief(b);
  // Degrees, clockwise-positive: the heavier side drops. Rocks ±1.9° around
  // its resting tilt on a 5s period. The beam ends are computed from the
  // angle each frame and the pans hang straight down from them, so they
  // stay attached however far it tips.
  const tilt = Math.max(-11, Math.min(11, (b.confidence - a.confidence) * 0.35));
  const [angle, setAngle] = React.useState(tilt);
  React.useEffect(() => {
    if (reduce) { setAngle(tilt); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      setAngle(tilt + Math.sin(((now - t0) / 5000) * Math.PI * 2) * 1.9);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [tilt, reduce]);
  const rad = (angle * Math.PI) / 180;
  const half = 92;
  const L: RoadPoint = [160 - half * Math.cos(rad), 40 - half * Math.sin(rad)];
  const R: RoadPoint = [160 + half * Math.cos(rad), 40 + half * Math.sin(rad)];
  const heavier = a.confidence === b.confidence ? null : a.confidence > b.confidence ? a : b;
  const pan = ([x, y]: RoadPoint, tone: typeof ra, gid: string) => (
    <g>
      <line x1={x} y1={y} x2={x - 22} y2={y + 24} stroke="#8A6A4A" strokeOpacity="0.6" strokeWidth="1.2" />
      <line x1={x} y1={y} x2={x + 22} y2={y + 24} stroke="#8A6A4A" strokeOpacity="0.6" strokeWidth="1.2" />
      <path d={`M${x - 26} ${y + 24} Q ${x} ${y + 38} ${x + 26} ${y + 24} Z`} fill={tone.tint} stroke={tone.ink} strokeOpacity="0.35" />
      <circle cx={x} cy={y + 14} r="13" fill={`url(#${gid})`} />
      <circle cx={x} cy={y + 14} r="4.5" fill={tone.color} />
    </g>
  );
  return (
    <div>
      <svg role="img" aria-label={`A balance between "${a.statement}" and "${b.statement}". ${heavier ? `It tips toward "${heavier.statement}", which has more behind it.` : "It sits level."}`}
        viewBox="0 0 320 118" style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id={`tbg${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={ra.tint} /><stop offset="1" stopColor={rb.tint} /></linearGradient>
          <radialGradient id={`ta${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.4" stopColor={ra.color} /><stop offset="1" stopColor={ra.color} stopOpacity="0" /></radialGradient>
          <radialGradient id={`tb${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.4" stopColor={rb.color} /><stop offset="1" stopColor={rb.color} stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="320" height="118" rx="14" fill={`url(#tbg${id})`} opacity="0.7" />
        <path d="M160 40 L148 104 L172 104 Z" fill="#8A6A4A" opacity="0.75" />
        <rect x="128" y="102" width="64" height="5" rx="2.5" fill="#8A6A4A" opacity="0.75" />
        <line x1={L[0]} y1={L[1]} x2={R[0]} y2={R[1]} stroke="#6B4E37" strokeWidth="5" strokeLinecap="round" />
        {pan(L, ra, `ta${id}`)}
        {pan(R, rb, `tb${id}`)}
        <circle cx="160" cy="40" r="5" fill="#6B4E37" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6, ...sans, fontSize: 12 }}>
        <span style={{ color: ra.ink, fontWeight: 600, maxWidth: "46%" }}>{shortBelief(a)}</span>
        <span style={{ color: rb.ink, fontWeight: 600, maxWidth: "46%", textAlign: "right" }}>{shortBelief(b)}</span>
      </div>
    </div>
  );
}

// A trigger and the reading it sets off: a spark leaves the trigger, lands
// in still water, and the ripple spreads — the automatic part.
function TriggerRipple({ region }: { region: CognitiveRegion }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const tone = REGION_CONFIG[region];
  const gold = REGION_CONFIG.career;
  const path = bezierSamples([62, 54], [120, 6], [190, 10], [232, 64], 14);
  const CYCLE = 3.6;
  const font = "'Pretendard Variable', Pretendard, sans-serif";
  return (
    <svg role="img" aria-label="A trigger sends a spark into still water and a ripple spreads out: the situation, then the reading that follows it automatically." viewBox="0 0 320 120" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`rbg${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={gold.tint} /><stop offset="1" stopColor={tone.tint} /></linearGradient>
        <radialGradient id={`pond${id}`}><stop offset="0" stopColor={tone.color} stopOpacity="0.35" /><stop offset="1" stopColor={tone.color} stopOpacity="0.08" /></radialGradient>
      </defs>
      <rect width="320" height="120" rx="14" fill={`url(#rbg${id})`} />
      {/* The trigger */}
      <g transform="translate(46 54)">
        <circle r="22" fill="#FFFFFF" opacity="0.85" />
        <path d="M3 -14 L-8 2 L-1 2 L-4 14 L8 -3 L1 -3 Z" fill={gold.ink} />
      </g>
      <text x="46" y="96" textAnchor="middle" fontSize="10.5" fontWeight="600" fontFamily={font} fill={gold.ink}>The situation</text>
      {/* Spark flight */}
      <path d={`M62 54 C 120 6, 190 10, 232 64`} fill="none" stroke={gold.ink} strokeOpacity="0.25" strokeWidth="1.2" strokeDasharray="3 5" />
      {!reduce && (
        <motion.circle r="4" fill={gold.color} cx={path.xs[0]} cy={path.ys[0]}
          initial={{ cx: path.xs[0], cy: path.ys[0], opacity: 0 }}
          animate={{ cx: path.xs, cy: path.ys, opacity: [0, 1, 1, 1, 1, 0] }}
          transition={{ duration: CYCLE * 0.45, repeat: Infinity, repeatDelay: CYCLE * 0.55, ease: "easeIn" }} />
      )}
      {/* The water and its ripples */}
      <ellipse cx="248" cy="70" rx="58" ry="20" fill={`url(#pond${id})`} />
      {[0, 1, 2].map((i) => (
        <motion.ellipse key={i} cx="248" cy="70" rx="12" ry="4" fill="none" stroke={tone.color} strokeWidth="1.6"
          initial={{ scale: reduce ? 1.6 + i : 0.3, opacity: reduce ? 0.5 - i * 0.12 : 0 }}
          animate={reduce ? undefined : { scale: [0.3, 4.2], opacity: [0, 0.8, 0] }}
          transition={reduce ? undefined : { duration: CYCLE * 0.6, repeat: Infinity, repeatDelay: CYCLE * 0.4, delay: CYCLE * 0.45 + i * 0.28, ease: "easeOut" }}
          style={{ transformBox: "view-box", transformOrigin: "248px 70px" }} />
      ))}
      <text x="248" y="106" textAnchor="middle" fontSize="10.5" fontWeight="600" fontFamily={font} fill={tone.ink}>The reading that follows</text>
    </svg>
  );
}

// Two beliefs that looked unrelated, as two plants above the soil whose
// roots meet at one glowing seed below — and light travels up from that
// shared root to both.
function SharedRoot({ a, b }: { a: StoredBelief; b: StoredBelief }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const ra = regionOfBelief(a), rb = regionOfBelief(b);
  const gold = REGION_CONFIG.career;
  const upA = bezierSamples([150, 96], [120, 94], [72, 80], [72, 44], 12);
  const upB = bezierSamples([150, 96], [180, 94], [228, 80], [228, 44], 12);
  const font = "'Pretendard Variable', Pretendard, sans-serif";
  const climb = (s: { xs: number[]; ys: number[] }, color: string, delay: number) => !reduce && (
    <motion.circle r="3.4" fill={color} cx={s.xs[0]} cy={s.ys[0]}
      initial={{ cx: s.xs[0], cy: s.ys[0], opacity: 0 }}
      animate={{ cx: s.xs, cy: s.ys, opacity: [0, 1, 1, 1, 0] }}
      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2, delay, ease: "easeInOut" }} />
  );
  return (
    <svg role="img" aria-label={`"${a.statement}" and "${b.statement}" grow from the same root.`} viewBox="0 0 300 116" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={ra.tint} /><stop offset="1" stopColor={rb.tint} /></linearGradient>
        <linearGradient id={`soil${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E6D6BF" /><stop offset="1" stopColor="#CDB797" /></linearGradient>
        <radialGradient id={`seed${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.35" stopColor={gold.color} /><stop offset="1" stopColor={gold.color} stopOpacity="0" /></radialGradient>
        {[["a", ra], ["b", rb]].map(([k, t]) => (
          <radialGradient key={k as string} id={`o${k}${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.4" stopColor={(t as typeof ra).color} /><stop offset="1" stopColor={(t as typeof ra).color} stopOpacity="0" /></radialGradient>
        ))}
      </defs>
      <rect width="300" height="116" rx="14" fill={`url(#sky${id})`} />
      <path d="M0 60 C 80 56, 220 64, 300 58 L300 102 A14 14 0 0 1 286 116 L14 116 A14 14 0 0 1 0 102 Z" fill={`url(#soil${id})`} />
      {/* Roots meeting at one seed */}
      <path d="M72 60 C 72 80, 120 94, 150 96" fill="none" stroke="#8A6A4A" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M228 60 C 228 80, 180 94, 150 96" fill="none" stroke="#8A6A4A" strokeWidth="1.8" strokeLinecap="round" />
      <motion.circle cx="150" cy="96" r="13" fill={`url(#seed${id})`}
        animate={reduce ? undefined : { scale: [1, 1.18, 1] }} transition={reduce ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformBox: "view-box", transformOrigin: "150px 96px" }} />
      {/* Stems and the two beliefs */}
      <path d="M72 60 L72 40" stroke={REGION_CONFIG.security.ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M228 60 L228 40" stroke={REGION_CONFIG.security.ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="72" cy="30" r="15" fill={`url(#oa${id})`} /><circle cx="72" cy="30" r="5" fill={ra.color} />
      <circle cx="228" cy="30" r="15" fill={`url(#ob${id})`} /><circle cx="228" cy="30" r="5" fill={rb.color} />
      {climb(upA, ra.color, 0)}
      {climb(upB, rb.color, 0.5)}
      <text x="150" y="80" textAnchor="middle" fontSize="10" fontWeight="600" fontFamily={font} fill="#6B4E37">same root</text>
    </svg>
  );
}

function ContradictionSection({ beliefs, connections }: { beliefs: StoredBelief[]; connections: StoredConnection[] }) {
  const pairs = findContradictionPairs(beliefs, connections);
  if (pairs.length === 0) return null;
  return (
    <SettingsGroup header="Where you pull two ways" footer="Two things you've said that don't quite fit together. This doesn't decide which one is right; it just puts them side by side.">
      {pairs.map((p, i) => (
        <div key={i} style={{ position: "relative", padding: "14px 16px" }}>
          {i > 0 && <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />}
          <TensionScale a={p.a} b={p.b} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
            <div style={{ ...display, fontSize: 17, fontStyle: "italic", color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all", paddingLeft: 10, borderLeft: `3px solid ${regionOfBelief(p.a).color}` }}>"{p.a.statement}"</div>
            <div style={{ ...display, fontSize: 17, fontStyle: "italic", color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all", paddingLeft: 10, borderLeft: `3px solid ${regionOfBelief(p.b).color}` }}>"{p.b.statement}"</div>
          </div>
          {p.note && (
            <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${ivDivider}`, lineHeight: 1.55, wordBreak: "keep-all" }}>{p.note}</div>
          )}
        </div>
      ))}
    </SettingsGroup>
  );
}

// Belief Map and Recurring Assumptions used to be two separate screens, but
// a belief ("Safety comes first") and an assumption ("When uncertain →
// waiting is safer") are the same kind of thing at different specificity — one
// screen now, sectioned, instead of two nearly-redundant ones.
function ScreenBeliefMap({ onBack, store, onRejectBelief }: { onBack?: () => void; store: Store; onRejectBelief?: (beliefId: string) => void }) {
  const hasBeliefs = store.beliefs.length > 0;
  const hasAssumptions = store.assumptions.length > 0;
  const visibleBeliefs = store.beliefs.filter((b) => b.userReaction !== "rejected");
  const divider = <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />;
  return (
    // Same full-bleed pattern the rest of Premium's deeper layers use —
    // top:-30 on the root, one merged scroll region (Back/title scroll away
    // with the rest), .no-scrollbar hides the native scrollbar. The page is
    // a stack of grouped cards: each section's explanation is its footer,
    // one or two sentences, instead of a paragraph above every list.
    <div style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...ivBackground }}>
      <div className="no-scrollbar edge-fade" style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, overflowY: "auto", padding: `${PRIMARY_HEADER_TOP}px 16px calc(24px + env(safe-area-inset-bottom))`, boxSizing: "border-box" }}>
        <div style={{ padding: "0 6px" }}>
          <BackButton onClick={onBack} color={ivBody} />
          <div style={{ ...display, fontSize: 28, fontWeight: 400, lineHeight: 1.15, color: ivHeading, marginTop: 14 }}>Patterns you might not notice</div>
          <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
            {hasBeliefs ? "What keeps showing up in your words and choices without your noticing." : "No patterns yet. Log a first thought with \"Speak your mind\" and they'll start to surface here."}
          </div>
        </div>

        {/* How to read this page, as a picture: beliefs run underneath,
            interpretations are the moments they surface. Replaces the long
            "difference between a belief and an interpretation" card. */}
        {hasBeliefs && (
          <div style={{ backgroundColor: ivSurfaceSolid, borderRadius: shape.md, boxShadow: ivCardShadow, padding: 12, marginTop: 20 }}>
            <BeliefRootsIllustration />
            <div style={{ padding: "0 4px 4px" }}>
              <IllustrationKey items={[
                { tone: REGION_CONFIG.identity.color, text: <><b style={{ fontWeight: 600 }}>A belief</b> runs underneath — "Safety comes first."</> },
                { tone: REGION_CONFIG.security.color, text: <><b style={{ fontWeight: 600 }}>An interpretation</b> is a moment it shows — "When I start something new, I tell myself I'm not ready."</> },
              ]} />
            </div>
          </div>
        )}

        <SettingsGroup
          header="Thoughts that keep coming back"
          style={{ marginTop: 24 }}
          footer="The dots show how often each one comes up in what you write. A thought appears here once it has shown up three times."
        >
          {visibleBeliefs.length === 0 ? (
            <div style={{ ...sans, fontSize: 13, color: ivBody, padding: "13px 16px" }}>No unconscious beliefs discovered yet.</div>
          ) : (
            visibleBeliefs.map((b, i) => (
              <BeliefCard key={b.id} belief={b} history={store.history} connections={store.connections} onReject={onRejectBelief} first={i === 0} />
            ))
          )}
        </SettingsGroup>

        <BeliefNetworkSection beliefs={visibleBeliefs} connections={store.connections} />
        <ContradictionSection beliefs={visibleBeliefs} connections={store.connections} />

        <SettingsGroup header="How you tend to read moments" footer="Specific moments: when this happens, you tend to read it this way. Smaller and more concrete than the thoughts above.">
          {!hasAssumptions ? (
            <div style={{ ...sans, fontSize: 13, color: ivBody, padding: "13px 16px" }}>Nothing like this has shown up yet.</div>
          ) : (
            [
              <div key="ripple" style={{ padding: "12px 12px 4px" }}>
                <TriggerRipple region={resolveRegion({ domain: store.assumptions[0].domains?.[0] ?? "identity" } as StoredBelief)} />
              </div>,
              ...store.assumptions.map((a, i) => {
              const tone = regionOfBelief({ domain: a.domains?.[0] ?? "identity" });
              return (
              <div key={a.id} style={{ position: "relative", padding: "13px 16px 13px 22px" }}>
                {divider}
                <span aria-hidden style={{ position: "absolute", left: 10, top: 14, bottom: 14, width: 3, borderRadius: 2, backgroundImage: `linear-gradient(180deg, ${REGION_CONFIG.career.color}, ${tone.color})` }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...sans, fontSize: 12, color: REGION_CONFIG.career.ink, fontWeight: 600, wordBreak: "keep-all" }}>
                  <Lightning size={13} weight="fill" aria-hidden style={{ flexShrink: 0 }} />{a.trigger}
                </div>
                <div style={{ ...display, fontSize: 20, color: tone.ink, lineHeight: 1.4, marginTop: 4, wordBreak: "keep-all" }}>{a.interpretation}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {(a.domains ?? []).map((d: string) => (
                    <span key={d} style={{ ...sans, fontSize: 11, fontWeight: 600, color: ivBody, backgroundColor: "rgba(42,38,33,0.06)", padding: "3px 8px", borderRadius: 6 }}>{d}</span>
                  ))}
                  <span style={{ flex: 1 }} />
                  <span style={{ ...mono, fontSize: 11, color: ivFaint }}>{a.count === 1 ? "once" : `${a.count} times`}</span>
                </div>
              </div>
              );
            }),
            ]
          )}
        </SettingsGroup>

        {store.connections.length > 0 && (
          <SettingsGroup header="Same root, different thoughts" footer="Two thoughts that look different on the surface but grow from the same place.">
            {store.connections.map((c, i) => {
              const from = visibleBeliefs.find((b) => b.id === c.a);
              const to = visibleBeliefs.find((b) => b.id === c.b);
              if (!from || !to) return null;
              return (
                <div key={i} style={{ position: "relative", padding: "14px 16px" }}>
                  {i > 0 && divider}
                  <SharedRoot a={from} b={to} />
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ ...display, fontSize: 17, color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all" }}>{from.statement}</div>
                    <div style={{ ...display, fontSize: 17, color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all" }}>{to.statement}</div>
                  </div>
                  <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>{c.note}</div>
                </div>
              );
            })}
          </SettingsGroup>
        )}



        <div style={{ ...sans, fontSize: 12, color: ivFaint, lineHeight: 1.5, padding: "0 6px", wordBreak: "keep-all" }}>{DISCLAIMER_NOTICE}</div>
      </div>
    </div>
  );
}

// ── Screen 10 · Identity Drift ────────────────────────────────────────────────
// Identity Drift isn't a before/after mood chart — it's a gap between a
// stated aspiration and the pattern actually observed since. The quote is
// something the person said about who they wanted to become; the bar below
// it is how close recent behavior actually tracks that, not a vague mood
// score. This is the one screen most tied to the mission line "helps you
// consciously become the person you want to be" — it has to show the gap
// plainly, not soften it into a neutral-sounding statistic.
// ── GoalRoad ─────────────────────────────────────────────────────────────────
// Distance from a goal, drawn as a road: a winding lane runs from the
// bottom of the scene to a flag on the far hill, and a glowing orb — the
// same light the app uses for a belief — stands on it where the person is.
// The stretch already walked glows; what's left is plain road. The scene
// lives a little (clouds drift, the lane's center dashes roll forward, the
// pennant flutters, the sun breathes) and the orb walks out to its spot
// when the card appears. All of it stops under reduced motion.
//
// `progress` is 0..1 (start → flag). `milestones` (also 0..1) are posts
// along the way — check-ins, when the distance itself isn't measured.
type RoadPoint = [number, number];
// Control points chosen so the lane's edges never fold over at its tightest
// bend: the curve's radius stays above the road's half-width all the way
// (checked numerically, ≥ 1.6× at the worst point).
const ROAD = { p0: [170, 240] as RoadPoint, p1: [100, 150] as RoadPoint, p2: [320, 104] as RoadPoint, p3: [252, 76] as RoadPoint };
function roadAt(t: number): RoadPoint {
  const { p0, p1, p2, p3 } = ROAD;
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}
function roadTangent(t: number): RoadPoint {
  const { p0, p1, p2, p3 } = ROAD;
  const u = 1 - t;
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}
// Perspective: the lane is wide in front and narrows to a thread at the flag.
const roadWidth = (t: number) => 66 * Math.pow(1 - t, 1.35) + 4;
const ROAD_SHAPE = (() => {
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const [x, y] = roadAt(t);
    const [dx, dy] = roadTangent(t);
    const w = roadWidth(t) / 2;
    left.push(`${(x - dy * w).toFixed(1)} ${(y + dx * w).toFixed(1)}`);
    right.unshift(`${(x + dy * w).toFixed(1)} ${(y - dx * w).toFixed(1)}`);
  }
  return `M${left.join(" L")} L${right.join(" L")} Z`;
})();
const ROAD_CENTER = `M${ROAD.p0.join(" ")} C${ROAD.p1.join(" ")} ${ROAD.p2.join(" ")} ${ROAD.p3.join(" ")}`;

// Three skies so a page of roads isn't one picture repeated: dawn, day, dusk.
const ROAD_SKIES = [
  { top: "#FDE6D3", mid: "#F6D9E8", horizon: "#E7E0FA", sun: "#FFC98A" },
  { top: "#D7ECFB", mid: "#E4F2F6", horizon: "#F3F1E2", sun: "#FFE29A" },
  { top: "#E9D9F7", mid: "#F7D7DF", horizon: "#FCE5CF", sun: "#FFB48A" },
];

function GoalRoad({ progress, milestones = [], variant = 0, label }: { progress: number; milestones?: number[]; variant?: number; label: string }) {
  const reduce = useReducedMotion();
  const target = Math.max(0.02, Math.min(0.97, progress));
  const [t, setT] = React.useState(reduce ? target : 0);
  const id = React.useId().replace(/:/g, "");
  const sky = ROAD_SKIES[variant % ROAD_SKIES.length];
  // Walk out to the spot: ease-out over 1.6s, starting once on mount and
  // again only if the value itself changes.
  React.useEffect(() => {
    if (reduce) { setT(target); return; }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1600);
      const e = 1 - Math.pow(1 - k, 3);
      setT(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);
  const [wx, wy] = roadAt(t);
  const scale = 1.15 - 0.7 * t; // nearer is bigger
  const walked = Array.from({ length: 33 }, (_, i) => roadAt((t * i) / 32)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const loop = (duration: number) => (reduce ? undefined : { duration, repeat: Infinity, ease: "linear" as const });
  return (
    <svg role="img" aria-label={label} viewBox="0 0 360 220" style={{ width: "100%", height: "auto", display: "block", borderRadius: shape.md }}>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} /><stop offset="0.55" stopColor={sky.mid} /><stop offset="1" stopColor={sky.horizon} />
        </linearGradient>
        <radialGradient id={`sun${id}`}>
          <stop offset="0" stopColor={sky.sun} stopOpacity="0.95" /><stop offset="0.45" stopColor={sky.sun} stopOpacity="0.45" /><stop offset="1" stopColor={sky.sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`farHill${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#CDE7D6" /><stop offset="1" stopColor="#B7DCC6" /></linearGradient>
        <linearGradient id={`midHill${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A9DABB" /><stop offset="1" stopColor="#8FCCA6" /></linearGradient>
        <linearGradient id={`nearHill${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#86C79C" /><stop offset="1" stopColor="#6DB98A" /></linearGradient>
        <linearGradient id={`road${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#EADFCC" /><stop offset="1" stopColor="#D8CBB4" /></linearGradient>
        <linearGradient id={`walked${id}`} gradientUnits="userSpaceOnUse" x1="170" y1="240" x2="252" y2="76">
          <stop offset="0" stopColor="#8B7CFF" /><stop offset="0.5" stopColor="#E88AAE" /><stop offset="1" stopColor="#F4A261" />
        </linearGradient>
        <radialGradient id={`orb${id}`}>
          <stop offset="0" stopColor="#FFFFFF" /><stop offset="0.25" stopColor="#B9AEFF" /><stop offset="0.6" stopColor="#8B7CFF" stopOpacity="0.55" /><stop offset="1" stopColor="#8B7CFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="360" height="220" fill={`url(#sky${id})`} />
      <motion.circle cx="262" cy="60" r="30" fill={`url(#sun${id})`}
        animate={reduce ? undefined : { scale: [1, 1.12, 1] }} transition={reduce ? undefined : { duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "262px 60px" }} />
      {/* Clouds drift across, two speeds. */}
      <motion.g animate={reduce ? undefined : { x: [-90, 420] }} transition={loop(46)} opacity={0.85}>
        <ellipse cx="40" cy="34" rx="26" ry="8" fill="#FFFFFF" /><ellipse cx="58" cy="29" rx="16" ry="8" fill="#FFFFFF" />
      </motion.g>
      <motion.g animate={reduce ? undefined : { x: [-200, 380] }} transition={loop(64)} opacity={0.7}>
        <ellipse cx="120" cy="52" rx="20" ry="6" fill="#FFFFFF" /><ellipse cx="133" cy="48" rx="12" ry="6" fill="#FFFFFF" />
      </motion.g>

      <path d="M0 96 C 60 72, 130 86, 190 78 S 300 62, 360 84 L360 220 L0 220 Z" fill={`url(#farHill${id})`} />
      <path d="M0 132 C 80 108, 150 130, 222 114 S 330 98, 360 110 L360 220 L0 220 Z" fill={`url(#midHill${id})`} />
      <path d="M0 170 C 90 152, 200 176, 360 152 L360 220 L0 220 Z" fill={`url(#nearHill${id})`} />

      <path d={ROAD_SHAPE} fill={`url(#road${id})`} />
      {/* The lane's center dashes roll toward the flag. */}
      <motion.path d={ROAD_CENTER} fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" strokeDasharray="7 10"
        animate={reduce ? undefined : { strokeDashoffset: [0, -34] }} transition={loop(1.8)} />
      {/* The stretch already walked. */}
      <polyline points={walked} fill="none" stroke={`url(#walked${id})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />

      {milestones.map((m, i) => {
        const [x, y] = roadAt(m);
        const s = 1.1 - 0.6 * m;
        return (
          <g key={i} transform={`translate(${x + roadWidth(m) / 2 + 3} ${y}) scale(${s})`} opacity={m <= t ? 1 : 0.45}>
            <line x1="0" y1="0" x2="0" y2="-12" stroke="#8A6A4A" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="0" cy="-13" r="3" fill={m <= t ? "#F4A261" : "#E8DCCB"} />
          </g>
        );
      })}

      {/* The goal: a pennant on the far hill. */}
      <g>
        <line x1="252" y1="77" x2="252" y2="47" stroke="#6B4E37" strokeWidth="1.8" strokeLinecap="round" />
        {/* Flutter as a transform pinned at the pole (scale + skew), not
            path morphing — motion hands an SVG `d` keyframe `undefined`
            for a frame, which the browser rejects. */}
        <motion.path fill="#EF6F5E"
          d="M252 47 L271 52 L252 58 Z"
          animate={reduce ? undefined : { scaleX: [1, 0.84, 1], skewY: [0, 5, 0] }}
          transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformBox: "fill-box", transformOrigin: "0% 50%" }} />
      </g>

      {/* You: the app's own orb of light, standing on the road. */}
      <g transform={`translate(${wx.toFixed(1)} ${wy.toFixed(1)}) scale(${scale.toFixed(3)})`}>
        <motion.g animate={reduce ? undefined : { y: [0, -2.5, 0] }} transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
          <circle r="20" fill={`url(#orb${id})`} />
          <circle r="6.5" fill="#8B7CFF" />
          <circle r="2.6" cx="-1.4" cy="-1.6" fill="#FFFFFF" opacity="0.9" />
          <g transform="translate(0 -26)">
            <rect x="-15" y="-9" width="30" height="16" rx="8" fill="#FFFFFF" opacity="0.92" />
            <text x="0" y="3" textAnchor="middle" fontSize="10" fontWeight="600" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621">You</text>
          </g>
        </motion.g>
      </g>
    </svg>
  );
}

function ScreenDrift({ onBack, store, onSetupAspiration }: { onBack?: () => void; store: Store; onSetupAspiration?: () => void }) {
  const hasAspiration = !!store.aspiration;
  const examples = store.aspirationExamples ?? [];
  const divider = <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />;
  return (
    // Same full-bleed ivory canvas and grouped-card page as Unconscious
    // Patterns: what you said, then where you stand, each a card with its
    // explanation as the footer.
    <div style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...ivBackground }}>
      <div className="no-scrollbar edge-fade" style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, overflowY: "auto", padding: `${PRIMARY_HEADER_TOP}px 16px calc(24px + env(safe-area-inset-bottom))`, boxSizing: "border-box" }}>
        <div style={{ padding: "0 6px" }}>
          <BackButton onClick={onBack} color={ivBody} />
          <div style={{ ...display, fontSize: 28, fontWeight: 400, lineHeight: 1.15, color: ivHeading, marginTop: 14 }}>How close you are to who you want to be</div>
          <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
            Who you said you want to be, next to what you've actually been doing.
          </div>
        </div>
        {hasAspiration ? (
          <>
            <SettingsGroup header="What you said" style={{ marginTop: 24 }} footer={store.aspirationSetDate ? `Set on ${store.aspirationSetDate}.` : undefined}>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ ...display, fontSize: 20, fontStyle: "italic", color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all" }}>"{store.aspiration}"</div>
              </div>
              <SettingsRow icon={<ArrowsClockwise size={17} />} label="Set it again" onClick={onSetupAspiration} />
            </SettingsGroup>
            <SettingsGroup
              header="Where you stand"
              footer={store.driftNotes.length === 0
                ? "Not enough entries yet to compare. Log a few more thoughts and the gap between this and your actual patterns shows up here."
                : "Each post on the road is a check-in. The road shows the way you've come, not a measured distance — that arrives with more entries."}
            >
              {/* A real aspiration has check-in notes but no number yet, so
                  the road marks the notes as posts passed and stops short of
                  claiming a distance. */}
              <div style={{ padding: "14px 16px 4px" }}>
                <GoalRoad
                  progress={Math.min(0.6, 0.12 + store.driftNotes.length * 0.09)}
                  milestones={store.driftNotes.map((_, i) => Math.min(0.58, 0.12 + (i + 1) * 0.09) - 0.04)}
                  label={`The road toward "${store.aspiration}": ${store.driftNotes.length} ${store.driftNotes.length === 1 ? "check-in" : "check-ins"} along the way so far.`}
                />
              </div>
              {store.driftNotes.length === 0 ? (
                <div style={{ ...sans, fontSize: 13, color: ivBody, padding: "13px 16px" }}>Nothing to compare yet.</div>
              ) : (
                [...store.driftNotes].reverse().map((d, i) => (
                  <div key={i} style={{ position: "relative", padding: "13px 16px" }}>
                    {i > 0 && divider}
                    <div style={{ ...mono, fontSize: 11, color: ivFaint }}>{d.date}</div>
                    <div style={{ ...sans, fontSize: 15, color: ivHeading, marginTop: 4, lineHeight: 1.55, wordBreak: "keep-all" }}>{d.note}</div>
                  </div>
                ))
              )}
            </SettingsGroup>
          </>
        ) : (
          <>
            <SettingsGroup style={{ marginTop: 24 }} footer="One sentence is enough. We'll keep showing the gap between it and what you actually log.">
              <SettingsRow icon={<Footprints size={17} />} label="Tell us who you want to become" onClick={onSetupAspiration} />
            </SettingsGroup>
            {examples.length > 0 && (
              <SettingsGroup header="What it could look like" footer="Examples, until you write your own.">
                {examples.map((a, i) => {
                  const gap = Math.abs(a.target - a.actual);
                  return (
                    <div key={a.said} style={{ position: "relative", padding: "14px 16px" }}>
                      {i > 0 && divider}
                      <div style={{ ...mono, fontSize: 11, color: ivFaint }}>{a.saidDate}</div>
                      <div style={{ ...display, fontSize: 20, fontStyle: "italic", color: ivHeading, marginTop: 4, lineHeight: 1.45, wordBreak: "keep-all" }}>"{a.said}"</div>
                      {/* How close: 100 minus the gap, so a goal of "less
                          often" (target 0) walks the same road as one of
                          "more often" (target 100). */}
                      <div style={{ marginTop: 12 }}>
                        <GoalRoad
                          progress={(100 - gap) / 100} variant={i}
                          label={`${a.label}: you're ${100 - gap}% of the way to the goal, ${gap} points to go.`}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
                        <span style={{ ...sans, fontSize: 13, color: ivBody, wordBreak: "keep-all" }}>{a.label}</span>
                        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: ivHeading, flexShrink: 0 }}>{gap} to go</span>
                      </div>
                      <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 3 }}>
                        Now {a.actual} out of 100 · aiming for {a.target}
                      </div>
                      <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 10, lineHeight: 1.55, wordBreak: "keep-all" }}>{a.note}</div>
                    </div>
                  );
                })}
              </SettingsGroup>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Screen 10.5 · Aspiration setup ────────────────────────────────────────────
function ScreenAspirationSetup({ initialValue, onBack, onSave }: { initialValue?: string | null; onBack?: () => void; onSave?: (value: string) => void }) {
  const [value, setValue] = React.useState(initialValue ?? "");
  const [sealing, setSealing] = React.useState(false);
  const save = () => {
    const v = value.trim();
    if (!v || sealing) return;
    setSealing(true);
    setTimeout(() => onSave?.(v), SEAL_MS);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...ivBackground, position: "relative", overflow: "hidden" }}>
      <OpeningBackdrop variant="aspire" />
      <div style={{ padding: "16px 22px 12px", flexShrink: 0, position: "relative", zIndex: 1 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 30, color: ivHeading, marginTop: 10, lineHeight: 1.2, wordBreak: "keep-all" }}>Who do you want to become?</div>
        <div style={{ ...hand, fontSize: 19, color: ivBody, marginTop: 8, lineHeight: 1.3, wordBreak: "keep-all" }}>
          We'll keep comparing it with the thoughts you write here.
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "18px 22px 18px", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        <FutureSelfLetter autoFocus value={value} onChange={setValue} sealed={sealing} />
      </div>
      <div style={{ padding: "0 22px 32px", flexShrink: 0, position: "relative", zIndex: 1 }}>
        <PrimaryBtn ivory tone="security" disabled={!value.trim()} onClick={save}>{initialValue ? "Seal the new version" : "Seal it"}</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Screen 10.6 · Journey Map ─────────────────────────────────────────────────
// A standing figure, tiny and plain — charcoal silhouette, two pale eye
// dots, nothing a saturated "mascot" color could clash with. Reused at two
// sizes: small inline next to the current waypoint, larger standing alone
// in the empty state.
function JourneyCharacter({ size = 34 }: { size?: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      animate={reducedMotion ? undefined : { y: [0, -2, 0] }}
      transition={reducedMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx="12" cy="8" r="4.4" fill={ivHeading} />
      <circle cx="10.3" cy="7.6" r="0.8" fill={ivSurfaceSolid} />
      <circle cx="13.7" cy="7.6" r="0.8" fill={ivSurfaceSolid} />
      <path d="M7 23c.3-6.4 2.2-9.6 5-9.6s4.7 3.2 5 9.6" fill={ivHeading} />
    </motion.svg>
  );
}

// One stop on the path — the dot plus the line segment reaching down to
// whatever comes after it, so each node owns its own connector instead of
// one shared line needing to line up with variable-height text next to it.
function JourneyNode({ dot, dotFilled, connector = "solid", last, children }: { dot?: React.ReactNode; dotFilled: boolean; connector?: "solid" | "dashed"; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 22, flexShrink: 0 }}>
        {dot ?? (
          <div style={{
            width: 11, height: 11, borderRadius: "50%", flexShrink: 0,
            backgroundColor: dotFilled ? ivHeading : ivBackground.backgroundColor,
            border: `2px solid ${ivHeading}`, boxSizing: "border-box",
          }} />
        )}
        {!last && (
          <div style={{
            flex: 1, width: 2, minHeight: 30, marginTop: 4,
            backgroundColor: connector === "solid" ? ivHeading : "transparent",
            backgroundImage: connector === "dashed" ? `repeating-linear-gradient(to bottom, rgba(42,38,33,0.3) 0 4px, transparent 4px 9px)` : undefined,
          }} />
        )}
      </div>
      <div style={{ flex: 1, paddingBottom: 28, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// Identity Drift reframed as a map instead of a list: the same aspiration/
// driftNotes data ScreenDrift already reads (see above), just walked top
// to bottom as waypoints with the character standing at the most recent
// one — "where you started," what's been noticed since, and the stated
// goal still further down the path. Deliberately doesn't invent a 0-100
// score driftNotes was never designed to produce (see ScreenDrift's own
// comment on that) — distance is shown as how far down the path you've
// actually walked, not a fabricated percentage.
function ScreenJourneyMap({ onBack, store, onSetupAspiration }: { onBack?: () => void; store: Store; onSetupAspiration?: () => void }) {
  const hasAspiration = !!store.aspiration;
  const notes = store.driftNotes;

  return (
    <div style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...ivBackground }}>
      <div className="no-scrollbar edge-fade" style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, overflowY: "auto", padding: `${PRIMARY_HEADER_TOP}px ${PRIMARY_HEADER_SIDE}px calc(40px + env(safe-area-inset-bottom))`, boxSizing: "border-box" }}>
        <Breathe inline amount={1.06}><span
          role="button" tabIndex={0} aria-label="Back to Profile" onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack?.(); } }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, ...sans, fontSize: 13, fontWeight: 700, color: ivBody, cursor: "pointer" }}
        >
          <ArrowLeft size={13} weight="bold" aria-hidden /> Back
        </span></Breathe>
        <div style={{ ...display, fontSize: 28, fontWeight: 400, lineHeight: 1.15, color: ivHeading, marginTop: 14 }}>Your Journey</div>
        <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 6, lineHeight: 1.4, wordBreak: "keep-all" }}>
          Where you started, what's changed since, and how far the goal still is.
        </div>

        <div style={{ marginTop: 32 }}>
          {hasAspiration ? (
            <>
              <JourneyNode dotFilled connector={notes.length > 0 ? "solid" : "dashed"}>
                <div style={{ ...mono, fontSize: 11, color: ivFaint }}>{store.aspirationSetDate}</div>
                <div style={{ ...sans, fontSize: 13, fontWeight: 700, color: ivHeading, marginTop: 4 }}>Where you started</div>
              </JourneyNode>

              {notes.map((n, i) => {
                const isCurrent = i === notes.length - 1;
                return (
                  <JourneyNode
                    key={i}
                    connector="dashed"
                    dotFilled={!isCurrent}
                    dot={isCurrent ? <JourneyCharacter size={30} /> : undefined}
                  >
                    <div style={{ ...mono, fontSize: 11, color: ivFaint }}>{n.date}</div>
                    {isCurrent && (
                      <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: ivHeading, marginTop: 2, textTransform: "uppercase" }}>
                        You are here
                      </div>
                    )}
                    <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 4, lineHeight: 1.55, wordBreak: "keep-all" }}>{n.note}</div>
                  </JourneyNode>
                );
              })}

              {notes.length === 0 && (
                <JourneyNode connector="dashed" dotFilled={false} dot={<JourneyCharacter size={30} />}>
                  <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: ivHeading, marginTop: 2, textTransform: "uppercase" }}>
                    You are here
                  </div>
                  <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 4, lineHeight: 1.55, wordBreak: "keep-all" }}>
                    Not enough entries yet to place a waypoint. Keep logging thoughts and this fills in with what's actually changed.
                  </div>
                </JourneyNode>
              )}

              <JourneyNode last dotFilled={false}>
                <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: ivFaint, textTransform: "uppercase" }}>Goal</div>
                <div style={{ ...display, fontSize: 20, fontStyle: "italic", color: ivHeading, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
                  "{store.aspiration}"
                </div>
                <motion.span
                  role="button" tabIndex={0} onClick={onSetupAspiration} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onSetupAspiration)?.(); } }} whileTap={{ opacity: 0.6 }}
                  style={{ ...sans, fontSize: 12, color: ivBody, cursor: "pointer", display: "inline-block", marginTop: 10 }}
                >
                  Set a different goal
                </motion.span>
              </JourneyNode>
            </>
          ) : (
            <>
              <JourneyNode last={false} connector="dashed" dotFilled={false} dot={<JourneyCharacter size={30} />}>
                <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: ivHeading, marginTop: 2, textTransform: "uppercase" }}>
                  You are here
                </div>
                <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 4, lineHeight: 1.6, wordBreak: "keep-all" }}>
                  No destination set yet — the path has a start, but nowhere marked to walk toward.
                </div>
              </JourneyNode>
              <JourneyNode last dotFilled={false}>
                <div
                  role="button" tabIndex={0} onClick={onSetupAspiration} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onSetupAspiration)?.(); } }}
                  style={{ padding: 16, borderRadius: 14, backgroundColor: "rgba(42,38,33,0.06)", borderLeft: `2px solid ${ivHeading}`, cursor: "pointer" }}
                >
                  <div style={{ ...sans, fontSize: 13, fontWeight: 700, color: ivHeading }}>Tell us who you want to become</div>
                  <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 6, lineHeight: 1.6, wordBreak: "keep-all" }}>
                    One sentence is enough — we'll mark it as the goal and start tracking the walk toward it.
                  </div>
                </div>
              </JourneyNode>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Screen 11 · Active Hypotheses ─────────────────────────────────────────────
// Falls back to a generic reflective question when a hypothesis doesn't
// carry its own (real hypotheses don't yet) — same wording either way, so
// the detail screen never has to know why a question is showing.
const GENERIC_HYPOTHESIS_QUESTION = "Is this insight helping you right now, or holding you back?";

// A hypothesis's evidence quotes come from one of two places: its own
// explicit `evidence` field if it has one, or — for real hypotheses, which
// don't — derived from the beliefs it's linked to via relatedBeliefIds.
function evidenceForHypothesis(h: StoredHypothesis, beliefs: StoredBelief[]): (StoredEvidenceQuote & { domain?: string })[] {
  if (h.evidence && h.evidence.length > 0) return h.evidence;
  return h.relatedBeliefIds
    .map((id) => beliefs.find((b) => b.id === id))
    .filter((b): b is StoredBelief => !!b)
    .flatMap((b) => b.evidenceQuotes.map((q) => ({ ...q, domain: b.domain })))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);
}

function ScreenHypotheses({ onBack, onOpen, store }: { onBack?: () => void; onOpen?: (i: number) => void; store: Store }) {
  const items = store.hypotheses;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: mdHeading, marginTop: 10 }}>AI's Hypotheses</div>
        <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 6, lineHeight: 1.5 }}>Not certain. Agree or push back to help refine it together.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {items.length === 0 ? (
          <div style={{ ...sans, fontSize: 13, color: mdBody, lineHeight: 1.7, wordBreak: "keep-all", padding: "12px 0" }}>
            Once enough thoughts build up, the AI's higher-level theories spanning multiple unconscious beliefs will show up here.
          </div>
        ) : (
          items.map((h, i) => (
            <motion.div
              key={h.id} role="button" tabIndex={0} onClick={() => onOpen?.(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => onOpen?.(i))?.(); } }} whileTap={{ scale: 0.99, opacity: 0.9 }}
              style={{ padding: "18px 0", borderBottom: i < items.length - 1 ? `1px solid ${mdDivider}` : "none", cursor: "pointer" }}
            >
              <div style={{ ...display, fontSize: 20, color: mdHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{h.title}</div>
              <div style={{ marginTop: 12 }}>
                <ConfidenceBar value={h.confidence} modernist />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {h.domains.map((d: string) => (
                  <span key={d} style={{ ...sans, fontSize: 11, color: mdBody, backgroundColor: mdTrack, padding: "3px 9px", borderRadius: 999 }}>{d}</span>
                ))}
              </div>
              {h.reaction && (
                <div style={{ ...sans, fontSize: 11, color: h.reaction === "agree" ? mdAccentText : mdWarn, marginTop: 8 }}>
                  {h.reaction === "agree" ? "Agreed" : "Said no"}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Screen 12 · Hypothesis detail ─────────────────────────────────────────────
// The full "Today's Discovery" experience for a hypothesis-sourced discovery —
// everything the old standalone "AI's Hypotheses" detail page showed, plus the
// related-neurons/contradictory-evidence/evolution sections. Extracted so
// it can render identically whether it's reached through the legacy
// ScreenHypothesisDetail wrapper (back button + this body) or embedded
// inline as Analysis's first section (no wrapper, no back button — it's
// already inside a tab).
function HypothesisDiscoveryBody({
  h,
  store,
  onAgree,
  onDisagree,
  reinterpreting,
  onInvestigate,
}: {
  h: StoredHypothesis;
  store: Store;
  onAgree?: () => void;
  onDisagree?: () => void;
  reinterpreting?: boolean;
  onInvestigate?: () => void;
}) {
  const reaction = h.reaction;
  const exhausted = !!h.exhausted;
  const settled = reaction === "agree" || exhausted;
  const question = h.question ?? GENERIC_HYPOTHESIS_QUESTION;
  const evidence = evidenceForHypothesis(h, store.beliefs);

  // The beliefs this hypothesis actually crosses — reused for both the
  // "related activated neurons" mini-brain and the contradictory-evidence
  // list below, so both sections stay honest to the same underlying data
  // instead of inventing a separate notion of "related."
  const relatedBeliefs = h.relatedBeliefIds
    .map((id) => store.beliefs.find((b) => b.id === id))
    .filter((b): b is StoredBelief => !!b)
    .map((belief) => ({
      ...belief,
      emotionGranularity: beliefEmotionGranularity(belief, store.history),
      ruminationLikely: isLikelyRuminating(belief, store.connections, store.history),
    }));
  const relatedBeliefIds = new Set(relatedBeliefs.map((b) => b.id));
  const relatedConnections = store.connections.filter((c) => relatedBeliefIds.has(c.a) && relatedBeliefIds.has(c.b));
  const contradictoryEntries = relatedBeliefs
    .flatMap((b) => (b.contradictoryEntryIds ?? []).map((id) => ({ belief: b, entry: store.history.find((e) => e.id === id) })))
    .filter((x): x is typeof x & { entry: StoredHistoryEntry } => !!x.entry);

  return (
    <div>
      <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em" }}>Today's Discovery</div>
      <div style={{ ...display, fontSize: 22, color: mdHeading, marginTop: 10, lineHeight: 1.5, wordBreak: "keep-all" }}>{h.title}</div>
      <div style={{ marginTop: 18 }}><ConfidenceBar value={h.confidence} modernist /></div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {h.domains.map((d: string) => (<span key={d} style={{ ...sans, fontSize: 11, color: mdBody, backgroundColor: mdTrack, padding: "3px 9px", borderRadius: 999 }}>{d}</span>))}
      </div>

      {evidence.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Conversations Behind This</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {evidence.map((e, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 12, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...mono, fontSize: 11, color: mdFaint }}>{e.date}</span>
                  {e.domain && <span style={{ ...sans, fontSize: 11, color: mdAccentText, backgroundColor: mdAccentSoft, padding: "2px 8px", borderRadius: 999 }}>{e.domain}</span>}
                </div>
                <div style={{ ...display, fontSize: 17, fontStyle: "italic", color: mdBodyLight, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{e.quote}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {relatedBeliefs.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Related Active Neurons</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            These are the actual places in the brain where the unconscious beliefs behind this discovery are activated.
          </div>
          <div style={{ marginTop: 12 }}>
            <React.Suspense fallback={<div style={{ height: 200 }} />}>
              <NeuralBeliefGraph3D beliefs={relatedBeliefs} connections={relatedConnections} height={200} defaultStructureMode />
            </React.Suspense>
          </div>
          <DiscoveryBeliefList beliefIds={h.relatedBeliefIds} store={store} />
        </div>
      )}

      {contradictoryEntries.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Conflicting Entries</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            There are entries that pointed a different way from this conclusion — the confidence score reflects that.
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {contradictoryEntries.map(({ belief, entry }, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 12, backgroundColor: mdWarnSoft, borderLeft: `2px solid ${mdWarn}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...mono, fontSize: 11, color: mdFaint }}>{entry.date}</span>
                  <span style={{ ...sans, fontSize: 11, color: mdWarnTagText, backgroundColor: mdWarnTag, padding: "2px 8px", borderRadius: 999 }}>{belief.domain}</span>
                </div>
                <div style={{ ...display, fontSize: 17, fontStyle: "italic", color: mdBodyLight, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{entry.text}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {h.investigate && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>How This Belief Has Changed</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            {h.investigate.originNote}
          </div>
          <div style={{ marginTop: 14 }}>
            <AlignedRowCompare
              rows={[
                { label: h.investigate.compareLabel1, steps: h.investigate.compareSteps1 },
                { label: h.investigate.compareLabel2, steps: h.investigate.compareSteps2, accent: true },
              ]}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: mdAccentSoft, borderLeft: `2px solid ${mdAccent}` }}>
        <div style={{ ...display, fontSize: 17, fontStyle: "italic", color: mdHeading, lineHeight: 1.65, wordBreak: "keep-all" }}>{question}</div>
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em", marginBottom: 12 }}>What do you think of this hypothesis?</div>
        {!settled && (
          <>
            <ReactionButtons
              reaction={reaction}
              onReact={(r) => (r === "agree" ? onAgree?.() : onDisagree?.())}
              disabled={reinterpreting}
              dark
            />
            {reinterpreting && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 12, textAlign: "center" }}>
                Looking for another interpretation…
              </motion.div>
            )}
          </>
        )}
        {settled && exhausted && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 12, lineHeight: 1.5, wordBreak: "keep-all", textAlign: "center" }}>
            There doesn't seem to be another way to read the same evidence. We'll take another look once new entries come in.
          </motion.div>
        )}
        {settled && !exhausted && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: mdAccent, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, lineHeight: 1 }}>✓</span>
            <span style={{ ...sans, fontSize: 12, color: mdBody }}>Logged. This hypothesis's confidence goes up a bit.</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Legacy standalone route (reached only via the still-intact ScreenHypotheses
// list, no longer linked from Home) — same body, just wrapped with its own
// back button and page chrome.
function ScreenHypothesisDetail({
  index,
  onBack,
  onInvestigate,
  onAgree,
  onDisagree,
  reinterpreting,
  store,
}: {
  index: number;
  onBack?: () => void;
  onInvestigate?: () => void;
  onAgree?: () => void;
  onDisagree?: () => void;
  reinterpreting?: boolean;
  store: Store;
}) {
  const h = store.hypotheses[index] ?? store.hypotheses[0];
  if (!h) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <HypothesisDiscoveryBody h={h} store={store} onAgree={onAgree} onDisagree={onDisagree} reinterpreting={reinterpreting} onInvestigate={onInvestigate} />
      </div>
    </div>
  );
}

// ── Screen 12.5 · Investigate (deep dive into one hypothesis) ────────────────
// A short guided walk through the evidence trail: where the pattern first
// appeared, what changed between then and now, and how it connects to other
// patterns already surfaced — closing on the same reflective question grammar
// as the hypothesis card itself, not a new one. Takes the investigation
// content directly (rather than looking a hypothesis up itself) since the
// caller already knows exactly which one is open.
function ScreenInvestigate({ investigate, onBack }: { investigate: NonNullable<StoredHypothesis["investigate"]>; onBack?: () => void }) {
  const inv = investigate;
  const [step, setStep] = React.useState(0);
  const steps = 4;

  let body: React.ReactNode;
  if (step === 0) {
    body = (
      <ScreenPivot
        kicker="Dig deeper"
        statement={<>Let's find out<br />where this pattern<br />first started.</>}
        cta={<PrimaryBtn onClick={() => setStep(1)} modernist>Start</PrimaryBtn>}
      />
    );
  } else if (step === 1) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "52px 22px 90px" }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em" }}>The First Time This Showed Up</div>
          <div style={{ marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
            <div style={{ ...mono, fontSize: 11, color: mdFaint }}>{inv.origin.date}</div>
            <div style={{ ...display, fontSize: 20, fontStyle: "italic", color: mdBodyLight, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>"{inv.origin.quote}"</div>
          </div>
          <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 18, lineHeight: 1.75, wordBreak: "keep-all" }}>{inv.originNote}</div>
        </div>
      </div>
    );
  } else if (step === 2) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "52px 22px 90px" }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em" }}>Then and Now, Side by Side</div>
          <div style={{ marginTop: 18 }}>
            <AlignedRowCompare
              rows={[
                { label: inv.compareLabel1, steps: inv.compareSteps1 },
                { label: inv.compareLabel2, steps: inv.compareSteps2, accent: true },
              ]}
            />
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <ScreenPivot
        kicker="Connection to another pattern"
        statement={inv.related}
        cta={<PrimaryBtn onClick={onBack} modernist>Back to the hypothesis</PrimaryBtn>}
      />
    );
  }

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px 0", zIndex: 2 }}>
        <BackButton onClick={step === 0 ? onBack : () => setStep(step - 1)} />
        <span style={{ ...mono, fontSize: 11, color: mdFaint }}>{step + 1} / {steps}</span>
      </div>
      <div style={{ height: "100%" }}>{body}</div>
      {step > 0 && step < steps - 1 && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 22px 24px" }}>
          <PrimaryBtn onClick={() => setStep(step + 1)} modernist>Next</PrimaryBtn>
        </div>
      )}
    </div>
  );
}

// The design spec colors each history entry by domain, which this app's
// entries don't carry directly (only beliefs have a domain) — so this
// looks up whichever belief this entry actually supported, and borrows
// its domain + region color. Entries that never matched a pattern (most
// early ones) simply render without a domain badge, never a fabricated one.
function findEntryDomain(entryId: string, beliefs: StoredBelief[]): { domain: string; color: string } | null {
  const match = beliefs.find((b) => (b.supportingEntryIds ?? []).includes(entryId));
  if (!match) return null;
  return { domain: match.domain, color: REGION_CONFIG[resolveRegion(match)].color };
}

// Longest run of consecutive calendar days (ending at the most recent
// entry, not necessarily today — a real gap shouldn't quietly read as an
// active streak) with at least one entry — real data only, no rounding up.
function computeStreak(history: StoredHistoryEntry[]): number {
  const days = new Set<string>();
  // Days with something written. A mood tap alone doesn't keep a streak going.
  history.forEach((e) => {
    if (isMoodCheckIn(e)) return;
    const d = parseDotDate(e.date);
    if (d) days.add(d.toDateString());
  });
  if (days.size === 0) return 0;
  const sorted = Array.from(days)
    .map((s) => new Date(s))
    .sort((a, b) => b.getTime() - a.getTime());
  let streak = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const diff = Math.round((sorted[i - 1].getTime() - sorted[i].getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) streak += 1;
    else break;
  }
  return streak;
}

// ── History icons ────────────────────────────────────────────────────────────
function MicGlyph({ color }: { color: string }) {
  return <Microphone size={12} color={color} />;
}
function MoodGlyph({ color }: { color: string }) {
  return <Smiley size={12} color={color} />;
}

// ── History helpers ───────────────────────────────────────────────────────────

// A small stable (not re-randomized every render) tilt for the margin
// annotation — same id always yields the same angle, so it doesn't jitter
// as the journal re-renders.
function hashRotationDeg(id: string, spread = 4): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return (h / 999) * spread * 2 - spread;
}

// One honest margin note per entry, priority-ordered by how much the real
// data actually supports it — never a decorative placeholder (see the
// redesign brief: "Only show annotations when actual Analysis data supports
// them"). Reuses the exact same fields the old list view's "Recurring
// thought" tag and findEntryDomain already relied on.
function entryAnnotation(entry: StoredHistoryEntry, beliefs: StoredBelief[]): string | null {
  if (beliefs.some((b) => (b.contradictoryEntryIds ?? []).includes(entry.id))) return "Contradicts earlier belief";
  const status = entry.analysis?.hypothesis?.status;
  if (status === "supported" || status === "emerging") return "Recurring thought";
  if (beliefs.some((b) => (b.supportingEntryIds ?? [])[0] === entry.id)) return "First appearance";
  const domainInfo = findEntryDomain(entry.id, beliefs);
  if (domainInfo) return `Connected to ${domainInfo.domain}`;
  return null;
}

// The belief this entry actually helped establish, if any — the same match
// findEntryDomain uses, just returning the whole belief so its statement can
// be shown as the journal's "Related Discovery" line.
function relatedBeliefForEntry(entry: StoredHistoryEntry, beliefs: StoredBelief[]): StoredBelief | null {
  return beliefs.find((b) => (b.supportingEntryIds ?? []).includes(entry.id)) ?? null;
}

// ── History star catalogue ──────────────────────────────────────────────────
// A belief has no explicit "discovered" field; the two real signals that
// exist are confidenceHistory (first point = first tracked confidence) and
// supportingEntryIds (resolved against store.history for a real date).
// Combines both and falls back to null — never a fabricated date — when
// neither is present; catalogue-number assignment below stays fully
// deterministic regardless, via the id tiebreak.
function beliefFirstDiscoveredDate(belief: StoredBelief, history: StoredHistoryEntry[]): Date | null {
  const times: number[] = [];
  (belief.confidenceHistory ?? []).forEach((p) => {
    const d = parseDotDate(p.date);
    if (d) times.push(d.getTime());
  });
  (belief.supportingEntryIds ?? []).forEach((id) => {
    const entry = history.find((e) => e.id === id);
    const d = entry ? parseDotDate(entry.date) : null;
    if (d) times.push(d.getTime());
  });
  if (times.length === 0) return null;
  return new Date(Math.min(...times));
}

// One catalogued star — a persistent, non-rejected belief plus everything
// its cell/detail view need, computed once per store change rather than
// re-derived per cell. `region`/`vitality` are the exact same
// resolveRegion/recencyFromDate the Brain Map itself uses (the latter now
// exported from NeuralBeliefGraph3D for this reuse), so a star here can
// never silently disagree with what Mind is showing for the same belief.
type CatalogueStar = {
  belief: StoredBelief;
  region: CognitiveRegion;
  catalogueNumber: number;
  firstDiscovered: Date | null;
  vitality: number;
  appearances: number;
};

function buildCatalogueStars(store: Store): CatalogueStar[] {
  // A rejected belief is one the user explicitly said isn't accurate —
  // excluded from the live Brain Map (see ScreenBeliefMap's own
  // visibleBeliefs filter) and so excluded here too, for the same reason.
  const base = store.beliefs
    .filter((b) => b.userReaction !== "rejected")
    .map((belief) => ({
      belief,
      region: resolveRegion(belief),
      firstDiscovered: beliefFirstDiscoveredDate(belief, store.history),
      vitality: recencyFromDate(belief.lastUpdatedAt) ?? 0.4,
      appearances: belief.evidenceCount || (belief.supportingEntryIds ?? []).length || 1,
    }));
  const ordered = [...base].sort((x, y) => {
    const xt = x.firstDiscovered ? x.firstDiscovered.getTime() : Infinity;
    const yt = y.firstDiscovered ? y.firstDiscovered.getTime() : Infinity;
    if (xt !== yt) return xt - yt;
    return x.belief.id < y.belief.id ? -1 : x.belief.id > y.belief.id ? 1 : 0;
  });
  return ordered.map((c, i) => ({ ...c, catalogueNumber: i + 1 }));
}

// The header's icon buttons (Search / Rewind / Filter): the same bare
// 19px glyphs Mind and Analysis put in their headers, so the three tabs
// share one header grammar. A sheet that's open, or a search/filter/date
// that's still applied, shows as Material 3's tonal icon-button state — a
// soft filled circle — instead of a caption under the icon.
function HistoryControlButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <Breathe inline amount={1.08}>
      <motion.button
        type="button" aria-label={label} aria-pressed={active || undefined} onClick={onClick}
        whileTap={{ scale: 0.9 }} transition={SETTLE}
        whileFocus={{ boxShadow: "0 0 0 3px rgba(42,38,33,.14)" }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: shape.full, border: 0,
          backgroundColor: active ? "rgba(42,38,33,0.08)" : "transparent", cursor: "pointer", WebkitTapHighlightColor: "transparent",
        }}
      >
        <span style={{ display: "flex", opacity: active ? 1 : 0.72 }}>{icon}</span>
      </motion.button>
    </Breathe>
  );
}

// The shared bottom-sheet chrome for Search/Calendar/Filter — restyled dark
// (frosted charcoal, not the warm paper card) to match the archive; scoped
// only to History, so this doesn't touch any other screen's sheets.
// ── Bottom-sheet panel ────────────────────────────────────────────────────────
// Shared by every bottom sheet: rises from below on a spring (not a fixed
// 0.25s tween), and can be dragged down by its grab handle to dismiss —
// past ~90px or on a downward flick it closes, otherwise it settles back.
// Only the handle starts a drag (dragListener off), so the sheet's own
// scrolling content keeps scrolling normally.
function SheetPanel({ onClose, style, children }: { onClose?: () => void; style: React.CSSProperties; children: React.ReactNode }) {
  const controls = useDragControls();
  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
      drag="y" dragListener={false} dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.04, bottom: 0.8 }}
      onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) onClose?.(); }}
      onClick={(e) => e.stopPropagation()}
      style={style}
    >
      <div
        aria-hidden
        onPointerDown={(e) => controls.start(e)}
        style={{ alignSelf: "stretch", display: "flex", justifyContent: "center", padding: "2px 0 12px", margin: "-10px 0 0", touchAction: "none", cursor: "grab", flexShrink: 0 }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(42,38,33,0.18)" }} />
      </div>
      {children}
    </motion.div>
  );
}

function HistorySheet({ title, onClose, children }: { title: string; onClose?: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      role="button" tabIndex={-1} onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 20, backgroundColor: "rgba(42,38,33,0.24)", display: "flex", alignItems: "flex-end" }}
    >
      <SheetPanel onClose={onClose} style={{
          width: "100%", maxHeight: "74%", backgroundColor: "#FBF8F2",
          borderTop: "1px solid rgba(42,38,33,0.08)", borderRadius: "20px 20px 0 0", padding: "18px 20px 26px", boxShadow: "0 -16px 40px rgba(120,105,80,0.14)",
          display: "flex", flexDirection: "column",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
          <span style={{ ...display, fontSize: 20, color: "#2A2621" }}>{title}</span>
          <Breathe inline amount={1.08}><motion.span role="button" tabIndex={0} aria-label="Close" onClick={onClose} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose?.(); } }} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: "rgba(42,38,33,0.5)", cursor: "pointer" }}>Close</motion.span></Breathe>
        </div>
        <div style={{ overflowY: "auto", minHeight: 0 }}>{children}</div>
      </SheetPanel>
    </motion.div>
  );
}

function CatalogueFilterChip({ label, color, active, disabled, onClick }: { label: string; color?: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button" onClick={disabled ? undefined : onClick} whileTap={disabled ? undefined : { opacity: 0.6 }} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 6, ...sans, fontSize: 12, fontWeight: 700, padding: "7px 13px", borderRadius: 999,
        cursor: disabled ? "default" : "pointer", border: `1px solid ${active ? "rgba(42,38,33,0.45)" : "rgba(42,38,33,0.14)"}`,
        backgroundColor: active ? "rgba(42,38,33,0.08)" : "transparent",
        color: disabled ? "rgba(42,38,33,0.22)" : active ? "#2A2621" : "rgba(42,38,33,0.65)",
      }}
    >
      {color && <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color, opacity: disabled ? 0.3 : 0.85, flexShrink: 0 }} />}
      {label}
    </motion.button>
  );
}

function CatalogueFilterRow({ label, note, active, onClick }: { label: string; note: string; active: boolean; onClick: () => void }) {
  return (
    <motion.div
      role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      whileTap={{ opacity: 0.6 }}
      style={{ padding: "11px 4px", borderBottom: "1px solid rgba(42,38,33,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
    >
      <div>
        <div style={{ ...display, fontSize: 17, color: active ? "#2A2621" : "#2A2621" }}>{label}</div>
        <div style={{ ...sans, fontSize: 11, color: "rgba(42,38,33,0.5)", marginTop: 2 }}>{note}</div>
      </div>
      {active && <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#2A2621", flexShrink: 0 }} />}
    </motion.div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: ivBody, marginBottom: 3 }}>{label}</div>
      <div style={{ ...display, fontSize: 17, color: "#2A2621", lineHeight: 1.42, wordBreak: "keep-all" }}>{value}</div>
    </div>
  );
}


// A star's orb size/intensity, in one place so the grid cell and the
// detail sheet (which renders the same star larger) can never compute it
// two different ways.
function catalogueOrbSize(star: CatalogueStar): number {
  return 12 + Math.round((star.belief.confidence / 100) * 8);
}
function catalogueOrbIntensity(star: CatalogueStar): number {
  return Math.min(1, 0.35 + (star.belief.confidence / 100) * 0.35 + star.vitality * 0.35);
}

// One catalogue row — node, title, and light metadata (date + how many
// times it's appeared) — a spacious list row now, not a boxed database
// cell. The node is the specimen being catalogued; the statement and
// metadata describe it, and neither the internal catalogueNumber nor any
// other database-style id is shown — per the redesign brief, an id like
// that reads as inventory, and a personal thought pattern shouldn't. Node
// color still carries the category, exactly as it did in the old grid,
// just without a bounding box competing with it. `dimmed` (search/filter/
// as-of-date mismatch) fades the whole row rather than removing it, so the
// list's overall shape never jumps. `isLast` drops this row's own divider
// so a family section doesn't end with a trailing hairline.
// One area of life in the Patterns catalogue, drawn as its own page of the
// diary: a heading with that area's orb and name in its ink, and a card
// with a coloured spine down the left and a wash of the same colour.
function CatalogueFamily({ region, count, children }: { region: CognitiveRegion; count: number; children: React.ReactNode }) {
  const c = REGION_CONFIG[region];
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 8px" }}>
        <Node color={c.color} size={14} intensity={0.9} />
        <span style={{ ...hand, fontSize: 22, fontWeight: 600, color: c.ink, lineHeight: 1 }}>{c.label}</span>
        <span style={{ ...hand, fontSize: 17, color: ivBody, lineHeight: 1 }}>· {count} {count === 1 ? "thought" : "thoughts"}</span>
      </div>
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: shape.md, paddingLeft: 5,
        backgroundColor: "#FFFDF8", backgroundImage: `linear-gradient(100deg, ${c.color}22 0%, ${c.color}0a 50%, transparent 85%)`,
        border: `1px solid ${c.color}33`, boxShadow: `0 10px 22px -18px ${c.ink}`,
      }}>
        <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundImage: `linear-gradient(180deg, ${c.color}, ${c.ink})` }} />
        {children}
      </div>
    </section>
  );
}

function CatalogueCell({ star, dimmed, first, onOpen }: { star: CatalogueStar; dimmed: boolean; first?: boolean; onOpen: () => void }) {
  const tone = REGION_CONFIG[star.region];
  const color = tone.color;
  const since = star.firstDiscovered ? star.firstDiscovered.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  const metaParts = [
    `came up ${star.appearances} time${star.appearances === 1 ? "" : "s"}`,
    since ? `since ${since}` : null,
  ].filter((p): p is string => !!p);
  return (
    <motion.div
      role="button" tabIndex={0}
      aria-label={`${REGION_CONFIG[star.region].label} pattern: ${star.belief.statement}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      whileTap={{ backgroundColor: `${color}1a` }}
      animate={{ opacity: dimmed ? 0.3 : 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px 11px 16px", minHeight: 56,
        cursor: "pointer", backgroundColor: "rgba(42,38,33,0)", WebkitTapHighlightColor: "transparent",
      }}
    >
      {!first && <span aria-hidden style={{ position: "absolute", top: 0, left: 16 + 28 + 12, right: 0, height: 1, backgroundColor: `${color}2e` }} />}
      {/* A fixed 28px column keeps every title flush regardless of how
          big the star itself is. */}
      <span style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Node color={color} size={catalogueOrbSize(star)} intensity={catalogueOrbIntensity(star)} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...display, fontSize: 17, lineHeight: 1.32, color: ivHeading, wordBreak: "keep-all", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {star.belief.statement}
        </div>
        <div style={{ ...hand, fontSize: 17, fontWeight: 500, color: tone.ink, marginTop: 2 }}>
          {metaParts.join(", ")}
        </div>
      </div>
      <Breathe inline amount={1.3}><CaretRight size={14} color={tone.ink} weight="bold" style={{ display: "block", opacity: 0.7 }} /></Breathe>
    </motion.div>
  );
}

// ── Screen 13 · History ───────────────────────────────────────────────────────
// Redesigned around a "star catalogue" concept: every persistent
// (non-rejected) belief is the same conceptual node the Brain Map (Mind)
// already renders, catalogued here by discovery order and grouped into the
// same six cognitive-region families Mind/Analysis use — never a second,
// competing notion of what a "pattern" is. The old per-entry journal
// becomes a star's provenance instead of the primary interface: tap a star,
// then "View its story" to see the actual recorded thoughts/check-ins
// behind it, still reachable in full via the pre-existing ScreenHistoryDetail
// (onOpenEntry) — nothing about that screen or its data changed.
// ── Segmented control ────────────────────────────────────────────────────────
// iOS's segmented control / Material 3's segmented button: one pill track,
// the selected segment carried by a sliding indicator (layoutId), so a
// switch reads as one control moving, not two buttons swapping.
function SegmentedControl<T extends string>({ options, value, onChange, layoutId }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; layoutId: string }) {
  return (
    <div role="tablist" style={{ display: "flex", padding: 3, borderRadius: shape.full, backgroundColor: "rgba(42,38,33,0.07)" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={o.value} role="tab" aria-selected={active} type="button" onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.97 }} transition={SETTLE}
            style={{ position: "relative", flex: 1, border: 0, background: "transparent", padding: "7px 12px", borderRadius: shape.full, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
          >
            {active && <motion.span layoutId={layoutId} transition={SETTLE} style={{ position: "absolute", inset: 0, borderRadius: shape.full, backgroundColor: ivSurfaceHigh, boxShadow: ivCardShadow }} />}
            <span style={{ position: "relative", ...sans, fontSize: 13, fontWeight: active ? 600 : 500, color: active ? ivHeading : ivBody }}>{o.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Journal view ─────────────────────────────────────────────────────────────
// History's first page is the journal itself: every entry, newest first,
// grouped by month, each one a sheet of ruled paper with the day printed in
// the margin — the Day One / Apple Journal timeline, drawn with this app's
// own paper (ivory card, serif, faint rules at the text's own line height).
// A mood check-in is a line on the timeline rather than a page: it's a
// word, not a thought. Tapping a page opens the same ScreenHistoryDetail
// the star sheet's "View its story" always led to.

function journalMonthLabel(dateStr: string): string {
  const d = parseDotDate(dateStr);
  return d ? d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : dateStr;
}

function JournalEntryRow({ entry, beliefs, onOpen }: { entry: StoredHistoryEntry; beliefs: StoredBelief[]; onOpen: () => void }) {
  const d = parseDotDate(entry.date);
  const rel = relativeDayLabel(entry.date);
  const dayLabel = rel === "Today" || rel === "Yesterday" ? rel : d ? d.toLocaleDateString("en-US", { weekday: "short" }) : "";
  const dayNumber = d ? d.getDate() : "";
  const emotion = entry.analysis?.observation.emotions[0]?.label;
  const regions = Array.from(new Set(beliefs.map((b) => resolveRegion(b)))).slice(0, 2);
  const mood = isMoodCheckIn(entry);
  // Each entry is a small page pasted into the diary: paper tinted by the
  // area of life it touched, a strip of washi tape, colored ruling, and a
  // slight tilt that varies from page to page (stable per entry).
  const tone = REGION_CONFIG[regions[0] ?? (["identity", "relationships", "career", "curiosity", "security", "creativity"] as CognitiveRegion[])[entry.id.length % 6]];
  const seed = Array.from(entry.id).reduce((a, c) => a + c.charCodeAt(0), 0);
  const tilt = ((seed % 5) - 2) * 0.35;
  const LINE = 30;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {/* The margin: day and weekday, the way a diary prints them. */}
      <div style={{ width: 40, flexShrink: 0, textAlign: "center", paddingTop: mood ? 2 : 10 }}>
        <div style={{ ...display, fontSize: mood ? 20 : 32, lineHeight: 1, color: mood ? ivBody : ivHeading, fontVariantNumeric: "lining-nums" }}>{dayNumber}</div>
        <div style={{ ...hand, fontSize: 17, fontWeight: 600, color: ivBody, marginTop: 2 }}>{dayLabel}</div>
      </div>
      {mood ? (
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7, padding: "5px 0", ...hand, fontSize: 20, fontWeight: 500, color: ivBody }}>
          <Smiley size={16} color={REGION_CONFIG.security.ink} weight="duotone" /> <span>{entry.text.replace(/\.$/, "")}</span>
        </div>
      ) : (
        <motion.div
          role="button" tabIndex={0} aria-label={`Entry from ${entry.date}`} onClick={onOpen}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
          initial={{ rotate: tilt }} whileTap={{ scale: 0.985, rotate: 0 }} transition={SETTLE}
          style={{
            position: "relative", flex: 1, minWidth: 0, borderRadius: 12, padding: "16px 16px 12px 26px", cursor: "pointer", WebkitTapHighlightColor: "transparent",
            backgroundColor: "#FFFCF6", backgroundImage: `linear-gradient(150deg, ${tone.color}2e 0%, ${tone.color}12 55%, #FFFCF6 100%)`,
            boxShadow: `0 0 0 1px rgba(42,38,33,0.06), 0 10px 22px -16px ${tone.ink}`,
          }}
        >
          {/* Washi tape and the margin line. */}
          <span aria-hidden style={{ position: "absolute", top: -8, left: 18, width: 52, height: 16, borderRadius: 2, opacity: 0.85, transform: `rotate(${-4 - tilt * 2}deg)`,
            backgroundImage: `repeating-linear-gradient(45deg, ${tone.color}aa 0 6px, ${tone.tint} 6px 12px)`, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }} />
          <span aria-hidden style={{ position: "absolute", left: 14, top: 10, bottom: 10, width: 1.5, borderRadius: 1, backgroundColor: `${REGION_CONFIG.relationships.color}77` }} />
          {/* Ruled paper: one hairline per text line, drawn behind the
              text at exactly its line height, so the rules only ever sit
              under written lines — never under the margin or the meta. */}
          <div
            style={{
              ...hand, fontSize: 22, fontWeight: 500, lineHeight: `${LINE}px`, color: "#2E2547", wordBreak: "keep-all",
              display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE - 1}px, ${tone.color}40 ${LINE - 1}px, ${tone.color}40 ${LINE}px)`,
            }}
          >
            {entry.text}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {entry.duration && <span style={{ ...mono, fontSize: 11, color: ivFaint }}>{entry.duration}</span>}
            {emotion && <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: ivBody, backgroundColor: "rgba(42,38,33,0.06)", padding: "4px 7px", borderRadius: 6, lineHeight: 1 }}>{emotion}</span>}
            {regions.map((r) => <RegionBadge key={r} region={r} />)}
            <span style={{ flex: 1 }} />
            <Breathe inline amount={1.3}><CaretRight size={14} color={ivFaint} weight="bold" style={{ display: "block" }} /></Breathe>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function JournalView({ store, query, onOpenEntry }: { store: Store; query: string; onOpenEntry?: (index: number) => void }) {
  // Newest first, and `detailIndex` is the position ScreenHistoryDetail
  // expects (it reverses store.history the same way).
  const items = React.useMemo(
    () => [...store.history].reverse().map((entry, detailIndex) => ({ entry, detailIndex }))
      // A journal reads by date, whatever order the entries were stored in
      // (a check-in logged after a backfilled thought still files under its
      // own day). Fixed-width "YYYY.MM.DD" sorts lexicographically.
      .sort((a, b) => (a.entry.date < b.entry.date ? 1 : a.entry.date > b.entry.date ? -1 : 0)),
    [store.history]
  );
  const beliefsByEntry = React.useMemo(() => {
    const m = new Map<string, StoredBelief[]>();
    store.beliefs.forEach((b) => (b.supportingEntryIds ?? []).forEach((id) => m.set(id, [...(m.get(id) ?? []), b])));
    return m;
  }, [store.beliefs]);
  const visible = query ? items.filter(({ entry }) => entry.text.toLowerCase().includes(query)) : items;
  const months: { label: string; items: typeof items }[] = [];
  visible.forEach((it) => {
    const label = journalMonthLabel(it.entry.date);
    const last = months[months.length - 1];
    if (last && last.label === label) last.items.push(it); else months.push({ label, items: [it] });
  });
  if (items.length === 0) {
    return <div style={{ marginTop: 20, ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, padding: "0 6px" }}>Nothing written yet. Your first entry goes here.</div>;
  }
  if (visible.length === 0) {
    return <div style={{ marginTop: 20, ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, padding: "0 6px" }}>No entries mention that.</div>;
  }
  return (
    <>
      {months.map((m) => (
        <section key={m.label} style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 2px 10px" }}>
            <span style={{ ...display, fontSize: 20, color: ivHeading }}>{m.label}</span>
            <span style={{ ...hand, fontSize: 19, fontWeight: 500, color: ivBody }}>{m.items.length} {m.items.length === 1 ? "entry" : "entries"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {m.items.map((it) => (
              <JournalEntryRow key={it.entry.id} entry={it.entry} beliefs={beliefsByEntry.get(it.entry.id) ?? []} onOpen={() => onOpenEntry?.(it.detailIndex)} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function ScreenHistory({ onNavSelect, store, onOpenEntry }: { onNavSelect?: (id: string) => void; store: Store; onOpenEntry?: (index: number) => void }) {
  // Two pages in one tab: the journal (entries, by day) and the patterns
  // catalogue (beliefs, by family). The journal is first because it's the
  // thing the person actually wrote.
  const [view, setView] = React.useState<"entries" | "patterns">("entries");
  const catalogue = React.useMemo(() => buildCatalogueStars(store), [store]);
  const families = React.useMemo(() => {
    const map = new Map<CognitiveRegion, CatalogueStar[]>();
    COGNITIVE_REGIONS.forEach((r) => map.set(r, []));
    catalogue.forEach((star) => map.get(star.region)!.push(star));
    return map;
  }, [catalogue]);

  const [search, setSearch] = React.useState("");
  const [sheet, setSheet] = React.useState<"search" | "calendar" | "filter" | null>(null);
  const [filterMode, setFilterMode] = React.useState<
    { type: "region"; region: CognitiveRegion } | { type: "active" } | { type: "dormant" } | { type: "recent" } | { type: "recurrent" } | null
  >(null);
  const [asOfDate, setAsOfDate] = React.useState<string | null>(null);
  const [selectedStarId, setSelectedStarId] = React.useState<string | null>(null);
  const [storyOpen, setStoryOpen] = React.useState(false);
  // Which of Premium's "how you've changed" modules is unfolded — one at a
  // time, closed by default, so the catalogue above stays the screen.
  const [openDeeper, setOpenDeeper] = React.useState<number | null>(null);
  const changeSummaries = React.useMemo(() => summarizeChanges(store.history), [store.history]);

  const query = search.trim().toLowerCase();
  const matchesSearch = React.useCallback(
    (star: CatalogueStar) => {
      if (!query) return true;
      if (star.belief.statement.toLowerCase().includes(query)) return true;
      if (star.belief.domain.toLowerCase().includes(query)) return true;
      if (REGION_CONFIG[star.region].label.toLowerCase().includes(query)) return true;
      return (star.belief.supportingEntryIds ?? []).some((id) => {
        const e = store.history.find((x) => x.id === id);
        return e ? e.text.toLowerCase().includes(query) : false;
      });
    },
    [query, store.history]
  );

  const recurrentThreshold = React.useMemo(() => {
    if (catalogue.length === 0) return Infinity;
    const sorted = [...catalogue].sort((a, b) => b.appearances - a.appearances);
    const cut = Math.max(1, Math.ceil(sorted.length * 0.3));
    return sorted[cut - 1].appearances;
  }, [catalogue]);

  const matchesFilter = React.useCallback(
    (star: CatalogueStar) => {
      if (!filterMode) return true;
      if (filterMode.type === "region") return star.region === filterMode.region;
      if (filterMode.type === "active") return star.vitality > 0.5;
      if (filterMode.type === "dormant") return star.vitality <= 0.5;
      if (filterMode.type === "recent") {
        if (!star.firstDiscovered) return false;
        return (Date.now() - star.firstDiscovered.getTime()) / 86_400_000 <= 30;
      }
      return star.appearances >= recurrentThreshold; // "recurrent"
    },
    [filterMode, recurrentThreshold]
  );

  const asOfCutoff = asOfDate ? parseDotDate(asOfDate) : null;
  const isAfterCutoff = React.useCallback(
    (star: CatalogueStar) => (asOfCutoff && star.firstDiscovered ? star.firstDiscovered.getTime() > asOfCutoff.getTime() : false),
    [asOfCutoff]
  );
  const isDimmed = React.useCallback(
    (star: CatalogueStar) => !matchesSearch(star) || !matchesFilter(star) || isAfterCutoff(star),
    [matchesSearch, matchesFilter, isAfterCutoff]
  );

  const calendarMilestones = React.useMemo(() => {
    const map = new Map<string, number>();
    catalogue.forEach((star) => {
      if (!star.firstDiscovered) return;
      const key = formatDateDots(star.firstDiscovered);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }, [catalogue]);

  const selectedStar = catalogue.find((s) => s.belief.id === selectedStarId) ?? null;
  const selectedConnection = selectedStar
    ? store.connections.find((c) => c.a === selectedStar.belief.id || c.b === selectedStar.belief.id)
    : null;
  const selectedConnectedBelief =
    selectedConnection && selectedStar
      ? store.beliefs.find((b) => b.id === (selectedConnection.a === selectedStar.belief.id ? selectedConnection.b : selectedConnection.a))
      : null;
  const selectedEntries = React.useMemo(() => {
    if (!selectedStar) return [];
    return (selectedStar.belief.supportingEntryIds ?? [])
      .map((id) => store.history.find((e) => e.id === id))
      .filter((e): e is StoredHistoryEntry => !!e)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [selectedStar, store.history]);

  const closeStarSheet = () => { setSelectedStarId(null); setStoryOpen(false); };
  const openEntryFromStory = (entryId: string) => {
    const detailItems = [...store.history].reverse();
    const idx = detailItems.findIndex((e) => e.id === entryId);
    if (idx >= 0) onOpenEntry?.(idx);
  };

  return (
    // top: -30 (same as Home/Mind above) so the archive backdrop runs
    // behind the status-bar safe area instead of showing a flat fallback
    // color there — see those screens for the pattern this reuses.
    <div style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, ...ivBackground, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        {/* ── Header + controls — same shared position/size/spacing as
        Mind and Analysis's own headers (see PRIMARY_HEADER_TOP/SIDE and
        primaryTitleStyle/primaryTitleSubtitleStyle); the sentence-style
        subtitle replaces the old small-caps label so all three read as
        the same typographic system, not three different ones. flex:1/
        minWidth:0 + the shared subtitle style's built-in truncation is
        what keeps it to one line next to History's own three-button
        control row, same technique Mind uses next to its two. ── */}
        <div style={{ padding: `${PRIMARY_HEADER_TOP}px ${PRIMARY_HEADER_SIDE}px 8px`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={primaryTitleStyle}>Diary</div>
            <div style={primaryTitleSubtitleStyle}>
              {view === "entries" ? "Every entry, in the order you lived it." : "Catalogued over time."}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginRight: -8 }}>
            <HistoryControlButton icon={<MagnifyingGlass size={19} color={ivHeading} />} label="Search" active={sheet === "search" || !!query} onClick={() => setSheet(sheet === "search" ? null : "search")} />
            {view === "patterns" && (
              <>
                <HistoryControlButton icon={<CalendarBlank size={19} color={ivHeading} />} label="Rewind to a date" active={sheet === "calendar" || !!asOfDate} onClick={() => setSheet(sheet === "calendar" ? null : "calendar")} />
                <HistoryControlButton icon={<Funnel size={19} color={ivHeading} weight={filterMode ? "fill" : "regular"} />} label="Filter" active={sheet === "filter" || !!filterMode} onClick={() => setSheet(sheet === "filter" ? null : "filter")} />
              </>
            )}
          </div>
        </div>
        <div style={{ padding: "2px 16px 4px", flexShrink: 0 }}>
          <SegmentedControl layoutId="history-view" value={view} onChange={(v) => { setView(v); setSheet(null); }} options={[{ value: "entries", label: "Entries" }, { value: "patterns", label: "Patterns" }]} />
        </div>

        {/* ── The catalogue: one grouped card per family that actually has
        a star in it. Empty families don't render — "Nothing here yet"
        three times over was most of what made this screen feel busy — and
        come back the moment a star lands in them, or when the filter
        sheet asks for that family by name. ── */}
        <div className="no-scrollbar edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 16px 28px" }}>
          {view === "entries" ? (
            <JournalView store={store} query={query} onOpenEntry={onOpenEntry} />
          ) : (
          <>
          {catalogue.length === 0 && (
            <div style={{ marginTop: 20, ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, padding: "0 6px" }}>
              Nothing catalogued yet. Speak your mind, and your first star will appear here.
            </div>
          )}
          {asOfDate && (
            <div style={{ margin: "12px 0 4px", padding: "0 6px", display: "flex", alignItems: "center", justifyContent: "space-between", ...sans, fontSize: 12, color: ivBody }}>
              <span>As catalogued by {asOfDate}</span>
              <Breathe inline amount={1.08}><motion.span role="button" tabIndex={0} onClick={() => setAsOfDate(null)} whileTap={{ opacity: 0.6 }} style={{ cursor: "pointer", fontWeight: 700, color: ivHeading }}>Reset</motion.span></Breathe>
            </div>
          )}
          {COGNITIVE_REGIONS.filter((region) => (filterMode?.type === "region" ? filterMode.region === region : (families.get(region)?.length ?? 0) > 0)).map((region) => {
            const stars = families.get(region) ?? [];
            return (
              <CatalogueFamily key={region} region={region} count={stars.length}>
                {stars.length > 0 ? (
                  stars.map((star, i) => (
                    <CatalogueCell
                      key={star.belief.id} star={star} dimmed={isDimmed(star)} first={i === 0}
                      onOpen={() => { setSelectedStarId(star.belief.id); setStoryOpen(false); }}
                    />
                  ))
                ) : (
                  <div style={{ ...sans, fontSize: 13, color: ivBody, padding: "13px 16px" }}>Nothing here yet.</div>
                )}
              </CatalogueFamily>
            );
          })}

          {/* ── How you've changed — Premium's longitudinal layer (see
          ChangeEmotions and its siblings). Each closed row already says
          its takeaway; opening one shows the picture behind it. Only when
          Premium Mode is on (store.isPro, toggled from Profile). ── */}
          {store.isPro && (
            <SettingsGroup header="How you've changed" footer="Built from every entry so far. Tap a row to see what's behind the sentence." style={{ marginTop: 28, marginBottom: 0 }}>
              {[
                { key: "emotions" as const, title: "Your feelings", Icon: Smiley, body: <ChangeEmotions history={store.history} /> },
                { key: "values" as const, title: "What you're moving toward", Icon: Compass, body: <ChangeValues history={store.history} /> },
                { key: "patterns" as const, title: "Thinking habits", Icon: Lightbulb, body: <ChangePatterns history={store.history} /> },
                { key: "consistency" as const, title: "When you write", Icon: CalendarBlank, body: <ChangeConsistency history={store.history} /> },
                { key: "selfTalk" as const, title: "How you talk to yourself", Icon: ChatCircleText, body: <ChangeSelfTalk history={store.history} /> },
              ].map((d, i) => {
                const tone = REGION_CONFIG[CHANGE_TINT[d.key]];
                return (
                  <DisclosureRow
                    key={d.key} title={d.title} subtitle={changeSummaries[d.key] ?? "Fills in after a few entries."}
                    icon={<span style={{ ...settingsTile, backgroundColor: tone.tint, color: tone.ink }}><d.Icon size={17} weight="duotone" /></span>}
                    open={openDeeper === i} onToggle={() => setOpenDeeper((cur) => (cur === i ? null : i))} first={i === 0}
                  >
                    {d.body}
                  </DisclosureRow>
                );
              })}
            </SettingsGroup>
          )}
          </>
          )}
        </div>

        {/* Same vintage/cream bar as Home, Mind, and Analysis — nav chrome
        stays identical across tabs even though this screen's own theme is
        the dark archive; same shared BottomNav component and active-state
        system either way. */}
        <BottomNav active="history" onSelect={onNavSelect} vintage />
      </div>

      {/* ── Star detail / story sheet ── */}
      <AnimatePresence>
        {selectedStar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            role="button" tabIndex={-1} onClick={closeStarSheet}
            style={{ position: "absolute", inset: 0, zIndex: 25, backgroundColor: "rgba(42,38,33,0.28)", display: "flex", alignItems: "flex-end" }}
          >
            <SheetPanel onClose={closeStarSheet} style={{
                width: "100%", maxHeight: "82%", backgroundColor: "#FBF8F2",
                borderTop: "1px solid rgba(42,38,33,0.09)", borderRadius: "22px 22px 0 0", padding: "22px 22px 28px",
                display: "flex", flexDirection: "column", minHeight: 0, boxShadow: "0 -20px 50px rgba(120,105,80,0.16)",
              }}>
              {!storyOpen ? (
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, flexShrink: 0 }}>
                    <div>
                      <div style={{ ...mono, fontSize: 11, color: "rgba(42,38,33,0.5)", letterSpacing: "0.05em" }}>{String(selectedStar.catalogueNumber).padStart(3, "0")}</div>
                      <div style={{ marginTop: 6 }}><RegionBadge region={selectedStar.region} /></div>
                    </div>
                    <Breathe inline amount={1.08}><motion.span role="button" tabIndex={0} aria-label="Close" onClick={closeStarSheet} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: "rgba(42,38,33,0.5)", cursor: "pointer" }}>Close</motion.span></Breathe>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 18px", flexShrink: 0 }}>
                    <Node color={REGION_CONFIG[selectedStar.region].color} size={34} intensity={catalogueOrbIntensity(selectedStar)} />
                  </div>
                  <div style={{ ...display, fontSize: 22, lineHeight: 1.42, color: "#2A2621", textAlign: "center", wordBreak: "keep-all", marginBottom: 24, flexShrink: 0 }}>
                    {selectedStar.belief.statement}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 15, overflowY: "auto", minHeight: 0 }}>
                    <StatRow
                      label="First observed"
                      value={selectedStar.firstDiscovered ? `${formatDateDots(selectedStar.firstDiscovered)} · ${weekdayFromDotDate(formatDateDots(selectedStar.firstDiscovered))}` : "Unknown"}
                    />
                    <StatRow label="Appeared" value={`${selectedStar.appearances} time${selectedStar.appearances === 1 ? "" : "s"}`} />
                    <StatRow label="Current strength" value={`${selectedStar.belief.confidence}%`} />
                    {selectedConnectedBelief && <StatRow label="Strongly connected with" value={selectedConnectedBelief.statement} />}
                  </div>
                  {selectedEntries.length > 0 && (
                    <motion.div
                      role="button" tabIndex={0} onClick={() => setStoryOpen(true)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setStoryOpen(true); } }}
                      whileTap={{ opacity: 0.7 }}
                      style={{ marginTop: 22, ...sans, fontSize: 13, fontWeight: 700, color: "#2A2621", cursor: "pointer", textAlign: "center", flexShrink: 0 }}
                    >
                      View its story →
                    </motion.div>
                  )}
                </>
              ) : (
                <>
                  <motion.span
                    role="button" tabIndex={0} onClick={() => setStoryOpen(false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setStoryOpen(false); } }}
                    whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: "rgba(42,38,33,0.65)", cursor: "pointer", marginBottom: 14, flexShrink: 0 }}
                  >
                    <ArrowLeft size={13} weight="bold" aria-hidden /> Back
                  </motion.span>
                  <div style={{ ...display, fontSize: 20, color: "#2A2621", marginBottom: 4, wordBreak: "keep-all", flexShrink: 0 }}>{selectedStar.belief.statement}</div>
                  <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.5)", marginBottom: 18, flexShrink: 0 }}>Its story, in the order it happened.</div>
                  <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                    {(selectedStar.belief.confidenceHistory?.length ?? 0) > 1 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: ivBody, marginBottom: 8 }}>Strength over time</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {selectedStar.belief.confidenceHistory!.map((p, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)" }}>
                              <span>{p.date}</span><span style={{ ...mono, color: "#2A2621" }}>{p.value}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: ivBody }}>Appearances</div>
                    {selectedEntries.map((entry) => (
                      <motion.div
                        key={entry.id} role="button" tabIndex={0} onClick={() => openEntryFromStory(entry.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEntryFromStory(entry.id); } }}
                        whileTap={{ opacity: 0.6 }}
                        style={{ padding: "12px 14px", borderRadius: 12, backgroundColor: "rgba(42,38,33,0.045)", border: "1px solid rgba(42,38,33,0.07)", cursor: "pointer" }}
                      >
                        <div style={{ ...mono, fontSize: 11, color: "rgba(42,38,33,0.5)" }}>{entry.date}</div>
                        <div style={{ ...display, fontStyle: "italic", fontSize: 15, color: "#2A2621", marginTop: 4, lineHeight: 1.45, wordBreak: "keep-all", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          "{entry.text}"
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </SheetPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search / Calendar / Filter sheets ── */}
      <AnimatePresence>
        {sheet === "search" && (
          <HistorySheet title={view === "entries" ? "Search your entries" : "Search the catalogue"} onClose={() => setSheet(null)}>
            <input
              autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={view === "entries" ? "A word you remember writing…" : "Search beliefs, categories, or thoughts…"}
              aria-label={view === "entries" ? "Search your entries" : "Search the star catalogue"}
              style={{ ...sans, fontSize: 15, color: "#2A2621", backgroundColor: "rgba(42,38,33,0.06)", border: "1.5px solid rgba(42,38,33,0.14)", borderRadius: 12, padding: "10px 14px", outline: "none", width: "100%", boxSizing: "border-box" }}
            />
            <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.5)", marginTop: 14, lineHeight: 1.5 }}>
              {query
                ? (view === "entries"
                  ? `${store.history.filter((e) => e.text.toLowerCase().includes(query)).length} of ${store.history.length} entries mention "${search.trim()}".`
                  : `${catalogue.filter(matchesSearch).length} of ${catalogue.length} stars match "${search.trim()}".`)
                : view === "entries" ? "Only entries that mention it stay on the page." : "Matching stars stay bright on the catalogue; the rest dim."}
            </div>
          </HistorySheet>
        )}
        {sheet === "calendar" && (
          <HistorySheet title="Rewind the catalogue" onClose={() => setSheet(null)}>
            <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)", lineHeight: 1.6, marginBottom: 14 }}>
              See which stars had already been discovered by a given date.
            </div>
            <div
              role="button" tabIndex={0} onClick={() => { setAsOfDate(null); setSheet(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAsOfDate(null); setSheet(null); } }}
              style={{ padding: "10px 8px", borderRadius: 10, backgroundColor: !asOfDate ? "rgba(42,38,33,0.08)" : "transparent", cursor: "pointer", marginBottom: 6 }}
            >
              <span style={{ ...display, fontSize: 17, color: "#2A2621" }}>Show the whole catalogue</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto" }}>
              {calendarMilestones.map(([date, count]) => (
                <div
                  key={date} role="button" tabIndex={0} onClick={() => { setAsOfDate(date); setSheet(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAsOfDate(date); setSheet(null); } }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 8px", borderBottom: "1px solid rgba(42,38,33,0.06)", cursor: "pointer", backgroundColor: asOfDate === date ? "rgba(42,38,33,0.08)" : "transparent", borderRadius: 8 }}
                >
                  <span style={{ ...display, fontSize: 17, color: "#2A2621" }}>{date} <span style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.5)" }}>· {weekdayFromDotDate(date)}</span></span>
                  <span style={{ ...mono, fontSize: 11, color: "rgba(42,38,33,0.5)" }}>{count} discovered</span>
                </div>
              ))}
              {calendarMilestones.length === 0 && <div style={{ ...sans, fontSize: 13, color: "rgba(42,38,33,0.5)" }}>No dated stars yet.</div>}
            </div>
          </HistorySheet>
        )}
        {sheet === "filter" && (
          <HistorySheet title="Filter the catalogue" onClose={() => setSheet(null)}>
            <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: ivBody, marginBottom: 10 }}>By category</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
              <CatalogueFilterChip label="All" active={!filterMode} onClick={() => { setFilterMode(null); setSheet(null); }} />
              {COGNITIVE_REGIONS.map((region) => (
                <CatalogueFilterChip
                  key={region} label={REGION_CONFIG[region].label} color={REGION_CONFIG[region].color}
                  active={filterMode?.type === "region" && filterMode.region === region}
                  disabled={(families.get(region)?.length ?? 0) === 0}
                  onClick={() => { setFilterMode({ type: "region", region }); setSheet(null); }}
                />
              ))}
            </div>
            <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: ivBody, marginBottom: 4 }}>By pattern</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <CatalogueFilterRow label="Active" note="Recently reinforced" active={filterMode?.type === "active"} onClick={() => { setFilterMode({ type: "active" }); setSheet(null); }} />
              <CatalogueFilterRow label="Dormant" note="Quieter, not recently reinforced" active={filterMode?.type === "dormant"} onClick={() => { setFilterMode({ type: "dormant" }); setSheet(null); }} />
              <CatalogueFilterRow label="Recently discovered" note="First observed in the last 30 days" active={filterMode?.type === "recent"} onClick={() => { setFilterMode({ type: "recent" }); setSheet(null); }} />
              <CatalogueFilterRow label="Most recurrent" note="Appeared the most often" active={filterMode?.type === "recurrent"} onClick={() => { setFilterMode({ type: "recurrent" }); setSheet(null); }} />
            </div>
          </HistorySheet>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Screen 13.5 · History entry detail ────────────────────────────────────────
// Previously showed only the raw date/duration/text and threw away
// everything else already sitting on the entry — entry.analysis (situation,
// automatic thought, emotions, cognitive patterns, the belief it fed into)
// and entry.sessionSummary (Feature 3's AI recap, otherwise only ever seen
// once, on ScreenSessionSummary, right after recording — never revisitable
// anywhere else). A tap into any entry landed on a screen with a wall of
// empty space below one paragraph, which read as unfinished rather than
// deliberately minimal. Free-tier entries (see appendUnanalyzedEntry in
// realStore.ts) genuinely have no `analysis`, so those sections just don't
// render — never a fabricated "nothing to see" placeholder for them.
function ScreenHistoryDetail({ index, store, onBack }: { index: number; store: Store; onBack?: () => void }) {
  const items = [...store.history].reverse();
  const entry = items[index] ?? items[0];
  if (!entry) return null;
  const analysis = entry.analysis;
  // The page's dateline, the way a diary heads a page: weekday, then the
  // full date. relativeDayLabel gives Today/Yesterday when it applies.
  const d = parseDotDate(entry.date);
  const rel = relativeDayLabel(entry.date);
  const dateline = d
    ? `${rel === "Today" || rel === "Yesterday" ? rel : d.toLocaleDateString("en-US", { weekday: "long" })} · ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
    : entry.date;
  // The belief this entry fed, resolved to its region for the badge.
  const fedBelief = analysis?.hypothesis.candidateBelief ? store.beliefs.find((b) => b.statement === analysis.hypothesis.candidateBelief) : undefined;
  const PAGE_LINE = 36; // px — the page body's line height and ruling pitch
  const field: React.CSSProperties = { padding: "12px 16px", position: "relative" };
  const fieldLabel: React.CSSProperties = { ...sans, fontSize: 12, color: ivBody, marginBottom: 3 };
  const divider = <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ivBg2 }}>
      <div style={{ padding: "16px 22px 10px", flexShrink: 0 }}>
        <BackButton onClick={onBack} color={ivBody} />
      </div>
      <div className="edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 16px 32px" }}>
        {/* The page itself: dateline, then the entry on ruled paper. */}
        <div style={{ backgroundColor: ivSurfaceSolid, borderRadius: shape.lg, boxShadow: ivCardShadow, padding: "16px 20px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <span style={{ ...hand, fontSize: 21, fontWeight: 600, color: REGION_CONFIG.identity.ink }}>{dateline}</span>
            {entry.duration && <span style={{ ...mono, fontSize: 11, color: ivFaint, flexShrink: 0 }}>{entry.duration}</span>}
          </div>
          <div
            style={{
              ...hand, fontSize: 26, fontWeight: 500, lineHeight: `${PAGE_LINE}px`, color: "#2E2547", wordBreak: "keep-all",
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${PAGE_LINE - 1}px, rgba(42,38,33,0.1) ${PAGE_LINE - 1}px, rgba(42,38,33,0.1) ${PAGE_LINE}px)`,
            }}
          >
            {entry.text}
          </div>
        </div>

        {entry.sessionSummary && (
          <SettingsGroup header="Recap" style={{ marginTop: 22, marginBottom: 0 }}>
            <div style={{ ...sans, fontSize: 13, color: ivHeading, padding: "13px 16px", lineHeight: 1.65, wordBreak: "keep-all" }}>{entry.sessionSummary}</div>
          </SettingsGroup>
        )}

        {analysis && (
          <>
            {(analysis.observation.situation || analysis.observation.automaticThought || analysis.observation.actionUrge) && (
              <SettingsGroup
                header="What stood out"
                style={{ marginTop: 22, marginBottom: 0 }}
                footer={analysis.interpretation.valueDirection.explanation || undefined}
              >
                {analysis.observation.situation && (
                  <div style={field}>
                    <div style={fieldLabel}>Situation</div>
                    <div style={{ ...sans, fontSize: 15, color: ivHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{analysis.observation.situation}</div>
                  </div>
                )}
                {analysis.observation.automaticThought && (
                  <div style={field}>
                    {analysis.observation.situation && divider}
                    <div style={fieldLabel}>Automatic thought</div>
                    <div style={{ ...display, fontStyle: "italic", fontSize: 20, color: ivHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>"{analysis.observation.automaticThought}"</div>
                  </div>
                )}
                {analysis.observation.actionUrge && (
                  <div style={field}>
                    {(analysis.observation.situation || analysis.observation.automaticThought) && divider}
                    <div style={fieldLabel}>What it made you want to do</div>
                    <div style={{ ...sans, fontSize: 15, color: ivHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{analysis.observation.actionUrge}</div>
                  </div>
                )}
                {(analysis.observation.emotions.length > 0 || analysis.interpretation.possibleCognitivePatterns.length > 0) && (
                  <div style={{ ...field, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {divider}
                    {analysis.observation.emotions.map((e, i) => (
                      <span key={`e-${i}`} style={{ ...sans, fontSize: 12, fontWeight: 600, color: ivBody, backgroundColor: "rgba(42,38,33,0.06)", padding: "4px 9px", borderRadius: 6, lineHeight: 1.2 }}>
                        {e.label} · {e.intensity}%
                      </span>
                    ))}
                    {analysis.interpretation.possibleCognitivePatterns.map((p) => (
                      <span key={p} style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdWarnLabel, backgroundColor: mdWarnSoft, padding: "4px 9px", borderRadius: 6, lineHeight: 1.2 }}>{p}</span>
                    ))}
                  </div>
                )}
              </SettingsGroup>
            )}

            {analysis.hypothesis.candidateBelief && (
              <SettingsGroup header="Belief this fed into" style={{ marginTop: 22, marginBottom: 0 }}>
                <div style={{ padding: "13px 16px", borderLeft: `3px solid ${fedBelief ? REGION_CONFIG[resolveRegion(fedBelief)].color : ivHeading}` }}>
                  {fedBelief && <div style={{ marginBottom: 8 }}><RegionBadge region={resolveRegion(fedBelief)} /></div>}
                  <div style={{ ...display, fontSize: 20, fontStyle: "italic", color: ivHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{analysis.hypothesis.candidateBelief}</div>
                </div>
              </SettingsGroup>
            )}
          </>
        )}
      </div>
    </div>
  );
}


// ── Screen 14 · Profile ────────────────────────────────────────────────────────
function ScreenProfile({
  onBack,
  onNavSelect,
  store,
  updateStore,
  onOpenSettings,
  isDemoMode,
  onToggleDemoMode,
  onOpenPaywall,
  onOpenManageSubscription,
  onOpenJourneyMap,
}: {
  // Profile is reached from Home's top-right icon, so "back" means Home.
  // Having a real back control also gives the edge swipe-back something
  // to press (see findBackButton in navGestures.ts).
  onBack?: () => void;
  onNavSelect?: (id: string) => void;
  store: Store;
  updateStore: (updater: (prev: Store) => Store) => void;
  onOpenSettings?: (screen: "notifications" | "dataPrivacy" | "help") => void;
  isDemoMode: boolean;
  onToggleDemoMode: (v: boolean) => void;
  onOpenPaywall?: () => void;
  onOpenManageSubscription?: () => void;
  onOpenJourneyMap?: () => void;
}) {
  const name = store.account?.name || "Anonymous observer";
  const initial = name.charAt(0);
  const firstEntryDate = [...store.history].sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
  const planLabel = store.proPlan === "monthly" ? "Monthly plan" : store.proPlan === "yearly" ? "Yearly plan" : null;
  const streakDays = computeStreak(store.history);
  const stats = [
    { value: store.entryCount, key: "profile.entries", label: "Thoughts logged" },
    { value: store.beliefs.length, key: "profile.beliefs", label: "Beliefs discovered" },
    { value: streakDays, key: "profile.streak", suffix: " days", label: "Streak" },
  ];
  const [copied, setCopied] = React.useState(false);
  const shareStats = async () => {
    const text = `${store.entryCount} thoughts logged, ${store.beliefs.length} beliefs discovered, ${streakDays}-day streak on Mindscape.`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* user cancelled */ }
      return;
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* clipboard permission denied */ }
    }
  };
  const logOut = onNavSelect
    ? () => {
        if (isCloudSyncConfigured) cloudSignOut();
        onNavSelect("auth");
      }
    : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...ivBackground }}>
      <div className="edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 16px 24px" }}>
        <div style={{ padding: "0 4px 24px" }}>
          <div style={{ marginBottom: 14 }}><BackButton onClick={onBack} color={ivBody} /></div>
          <div style={{ ...display, fontSize: 34, fontWeight: 400, color: ivHeading, marginBottom: 6 }}>Profile</div>
          <div style={{ ...sans, fontSize: 13, color: ivBody }}>We've been tracking your journey.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, backgroundColor: ivSurfaceSolid, borderRadius: 20, padding: 20, boxShadow: ivCardShadow, marginBottom: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: ivHeading, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...display, fontSize: 24, color: "#fff" }}>
            {initial}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...sans, fontSize: 17, fontWeight: 800, color: ivHeading }}>{name}</span>
              {MONETIZATION_ENABLED && store.isPro && (
                <span style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: ivHeading, backgroundColor: "rgba(42,38,33,0.06)", padding: "2px 8px", borderRadius: 999 }}>PRO</span>
              )}
            </div>
            {planLabel ? (
              <span style={{ ...mono, fontSize: 12, color: ivFaint }}>{planLabel}</span>
            ) : (
              firstEntryDate && <span style={{ ...mono, fontSize: 12, color: ivFaint }}>With you since {firstEntryDate}</span>
            )}
          </div>
        </div>

        {MONETIZATION_ENABLED && !store.isPro && (
          <Breathe amount={1.02}><motion.div
            role="button" tabIndex={0} onClick={onOpenPaywall} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onOpenPaywall)?.(); } }} whileTap={{ opacity: 0.6 }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 12,
              backgroundColor: ivSurfaceSolid, borderRadius: 20, padding: "16px 18px", boxShadow: ivCardShadow, marginBottom: 14,
              borderLeft: `2px solid ${ivHeading}`,
            }}
          >
            <div>
              <div style={{ ...sans, fontSize: 15, fontWeight: 800, color: ivHeading }}>Upgrade to Pro</div>
              <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 2 }}>Unlock your Brain Map, hypotheses, and more</div>
            </div>
            <CaretRight size={16} color={ivHeading} weight="bold" />
          </motion.div></Breathe>
        )}

        <div data-tutorial="profile-stats" style={{ display: "flex", gap: 12, marginBottom: 22 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ flex: 1, backgroundColor: ivSurfaceSolid, borderRadius: shape.md, padding: "16px 12px", textAlign: "center", boxShadow: ivCardShadow }}>
              <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: ivHeading, marginBottom: 4 }}>
                <AnimatedNumber value={s.value} memoryKey={s.key} />{s.suffix}
              </div>
              <div style={{ ...sans, fontSize: 11, color: ivBody }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Entry point into ScreenJourneyMap — Identity Drift's own
        aspiration/driftNotes data, just walked as waypoints instead of
        read as a list (see that screen's own comment). Sits right under
        the stats row since both are "how's this going so far" at a
        glance, not buried in Settings-style rows below. */}
        <SettingsGroup footer={store.aspiration ? "Where you started, and how far the goal still is." : "Set a direction and watch the distance to it."}>
          <SettingsRow icon={<JourneyCharacter size={20} />} label="Your Journey" value={store.aspiration ? undefined : "Not set"} onClick={onOpenJourneyMap} />
          {store.entryCount > 0 && (
            <SettingsRow
              icon={<ShareNetwork size={17} />} label={copied ? "Copied to clipboard" : "Share your progress"} onClick={shareStats} chevron={false}
              trailing={copied ? <span style={{ ...sans, fontSize: 15, color: ivBody }}>✓</span> : undefined}
            />
          )}
        </SettingsGroup>

        {/* Design/dev affordance: instantly switches the whole app between
            curated demo content and a real, on-device, initially-empty
            store — see src/app/dataProvider.ts. Not something a real end
            user would normally touch, but there's no separate build
            target to hide it behind. Premium Mode sits in the same group,
            same Switch, right below it — a distinct concept that just
            happens to be the other quiet on/off switch this screen has to
            offer, not a related pair. It doesn't gate anything in the
            demo-vs-real data source itself, only whether Mind/Analysis/
            History additionally surface their deeper layers (see
            store.isPro downstream in ScreenAnalysis/ScreenDiscoveryAnalysis/
            ScreenHistory) — no payment involved, updateStore alone persists
            it exactly the way every other real-store field already persists
            (localStorage + Supabase when signed in; ephemeral, same as any
            other demo interaction, while Demo Mode is on). Deliberately
            plain — no gold/crown/diamond styling; Premium here is just
            another quiet toggle, same as Demo Mode right above it. */}
        <SettingsGroup
          header="Modes"
          footer="Demo Mode fills every screen with example data; turn it off to see only your own entries — a new account starts empty. Premium Mode weaves a deeper layer into Mind, Analysis, and your Diary: unconscious patterns, distance from your aspiration, and how things have changed over time."
        >
          <SettingsRow icon={<Flask size={17} />} label="Demo Mode" trailing={<Switch label="Demo Mode" value={isDemoMode} onChange={onToggleDemoMode} />} />
          <SettingsRow icon={<Sparkle size={17} />} label="Premium Mode" trailing={<Switch label="Premium Mode" value={store.isPro} onChange={(v) => updateStore((prev) => ({ ...prev, isPro: v }))} />} />
        </SettingsGroup>

        <SettingsGroup>
          {MONETIZATION_ENABLED && store.isPro && <SettingsRow icon={<CreditCard size={17} />} label="Manage subscription" value={planLabel ?? undefined} onClick={onOpenManageSubscription} />}
          <SettingsRow icon={<BellSimple size={17} />} label="Notifications" onClick={() => onOpenSettings?.("notifications")} />
          <SettingsRow icon={<LockSimple size={17} />} label="Data & Privacy" onClick={() => onOpenSettings?.("dataPrivacy")} />
          <SettingsRow icon={<Question size={17} />} label="Help" onClick={() => onOpenSettings?.("help")} />
        </SettingsGroup>

        <SettingsGroup style={{ marginBottom: 0 }}>
          <SettingsRow label={<Breathe inline amount={1.04}>Log out</Breathe>} destructive center onClick={logOut} />
        </SettingsGroup>
      </div>
      <BottomNav active="profile" onSelect={onNavSelect} vintage />
    </div>
  );
}

// ── Settings list · Apple HIG "inset grouped" ────────────────────────────────
// The Profile hub and its sub-screens share one list grammar, the one iOS
// Settings uses: a rounded card per group, an optional header naming it,
// rows that keep to a single line, and the explanation that used to crowd
// each row moved to a footer under the group, where it reads once instead
// of in the middle of the list. Three HIG details carry the look:
//   · separators start at the label, not the card edge, so the icon
//     column reads as one strip;
//   · a pressed row tints its background instead of fading its text;
//   · a destructive action sits alone, centered, in its own group.
function SettingsGroup({ header, footer, children, style }: { header?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  const items = React.Children.toArray(children);
  return (
    <section style={{ marginBottom: 22, ...style }}>
      {header && <div style={{ ...hand, fontSize: 21, fontWeight: 600, color: ivHeading, opacity: 0.82, padding: "0 14px 4px", lineHeight: 1.15, wordBreak: "keep-all" }}>{header}</div>}
      {/* A barely-there light falloff, top to bottom, so the card sits on
          the page like a sheet catching light instead of a flat cut-out. */}
      <div style={{ backgroundColor: ivSurfaceSolid, backgroundImage: "linear-gradient(180deg, #FDFBF7 0%, #FBF8F2 55%, #F9F5EE 100%)", borderRadius: shape.md, boxShadow: ivCardShadow, overflow: "hidden" }}>
        {items.map((child, i) =>
          // Only the first row drops its separator; anything that isn't a
          // SettingsRow (a Collapse around one, say) draws its own.
          i === 0 && React.isValidElement(child) && child.type === SettingsRow ? React.cloneElement(child as React.ReactElement<SettingsRowProps>, { divider: false }) : child,
        )}
      </div>
      {footer && <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.5, padding: "8px 16px 0", wordBreak: "keep-all" }}>{footer}</div>}
    </section>
  );
}

type SettingsRowProps = {
  icon?: React.ReactNode;
  // The row's colour: tints its icon tile and its arrow, and colours the
  // ripple when it's tapped. Defaults to identity's violet.
  accent?: CognitiveRegion;
  label: React.ReactNode;
  value?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  center?: boolean;
  chevron?: boolean;
  divider?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
};

// The 28px icon tile is iOS Settings' glyph-on-a-rounded-square, in this
// app's own palette: charcoal on a soft tint rather than white on a
// saturated color, so a column of them stays quiet.
const settingsTile: React.CSSProperties = { width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

// ── Opening a page from the row you tapped ───────────────────────────────────
// A row that leads somewhere hands its own rectangle to the app shell
// (OpenFromContext); the next screen then grows out of that row (the
// "grow" transition: a clip-path opening like the one Home's orbs use to
// open the sky), instead of sliding in from the side. If the tap doesn't navigate, the hand-off lapses.
const OpenFromContext = React.createContext<((el: HTMLElement) => void) | null>(null);

// The arrow on a row: a small gem of the row's colour with the caret in
// its ink. Tapping it sends the caret flying off to the right while a new
// one slides in behind it.
function RowArrow({ accent, fired }: { accent: CognitiveRegion; fired: number }) {
  const reduce = useReducedMotion();
  const c = REGION_CONFIG[accent];
  return (
    <motion.span aria-hidden
      whileHover={reduce ? undefined : { x: 2 }}
      style={{
        position: "relative", width: 26, height: 26, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
        display: "inline-flex", alignItems: "center", justifyContent: "center", color: c.ink,
        backgroundImage: `radial-gradient(circle at 30% 25%, #FFFFFF 0%, ${c.color}30 45%, ${c.color}55 100%)`,
        boxShadow: `inset 0 0 0 1px ${c.color}55, 0 4px 10px -5px ${c.color}`,
      }}>
      {fired > 0 && !reduce && (
        <motion.span key={`out${fired}`} initial={{ x: 0, opacity: 1 }} animate={{ x: 16, opacity: 0 }} transition={{ duration: 0.28, ease: "easeIn" }}
          style={{ position: "absolute", lineHeight: 0 }}>
          <CaretRight size={13} weight="bold" />
        </motion.span>
      )}
      <motion.span key={`in${fired}`} initial={fired > 0 && !reduce ? { x: -14, opacity: 0 } : false} animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.32, delay: 0.12, ease: [0.22, 1, 0.36, 1] }} style={{ lineHeight: 0, display: "block" }}>
        <CaretRight size={13} weight="bold" />
      </motion.span>
    </motion.span>
  );
}

function SettingsRow({ icon, label, value, trailing, onClick, destructive, center, chevron, divider = true, disabled, style, accent }: SettingsRowProps) {
  const reduce = useReducedMotion();
  const openFrom = React.useContext(OpenFromContext);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const [fired, setFired] = React.useState(0);
  const interactive = !!onClick && !disabled;
  const showChevron = chevron ?? (!!onClick && !trailing && !center);
  const color = destructive ? mdWarn : ivHeading;
  const inset = icon ? 16 + 28 + 12 : 16;
  const tone = REGION_CONFIG[accent ?? "identity"];
  const activate = (pt?: { x: number; y: number }) => {
    const el = rowRef.current;
    if (el && !reduce) {
      const r = el.getBoundingClientRect();
      const x = pt ? pt.x - r.left : r.width - 30, y = pt ? pt.y - r.top : r.height / 2;
      const id = Date.now() + Math.random();
      setRipples((rs) => [...rs.slice(-2), { id, x, y, size: Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) * 2 }]);
      setTimeout(() => setRipples((rs) => rs.filter((q) => q.id !== id)), 650);
    }
    if (showChevron) setFired((n) => n + 1);
    if (el && showChevron) openFrom?.(el);
    onClick?.();
  };
  return (
    <motion.div
      ref={rowRef}
      role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} aria-disabled={disabled || undefined}
      onClick={interactive ? (e) => activate({ x: e.clientX, y: e.clientY }) : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } } : undefined}
      whileTap={interactive ? { backgroundColor: `${tone.color}14` } : undefined}
      transition={{ duration: 0.12 }}
      style={{
        position: "relative", display: "flex", alignItems: "center", justifyContent: center ? "center" : undefined, gap: 12, overflow: "hidden",
        minHeight: 46, padding: "10px 16px", cursor: interactive ? "pointer" : "default", backgroundColor: "rgba(42,38,33,0)",
        opacity: disabled ? 0.55 : 1, WebkitTapHighlightColor: "transparent", ...style,
      }}
    >
      {divider && <span aria-hidden style={{ position: "absolute", top: 0, left: inset, right: 0, height: 1, backgroundColor: ivDivider }} />}
      {ripples.map((q) => (
        <motion.span key={q.id} aria-hidden initial={{ scale: 0, opacity: 0.55 }} animate={{ scale: 1, opacity: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "absolute", left: q.x - q.size / 2, top: q.y - q.size / 2, width: q.size, height: q.size, borderRadius: "50%", pointerEvents: "none",
            backgroundImage: `radial-gradient(circle, ${tone.color}55 0%, ${tone.color}22 45%, transparent 70%)` }} />
      ))}
      {icon && <span style={{ ...settingsTile, position: "relative",
        ...(destructive ? { backgroundColor: mdWarnSoft, color } : accent
          ? { backgroundImage: `linear-gradient(135deg, ${tone.color}2e, ${tone.color}14)`, boxShadow: `inset 0 0 0 1px ${tone.color}33`, color: tone.ink }
          : { backgroundColor: "rgba(42,38,33,0.07)", color }) }}>{icon}</span>}
      <span style={{ ...sans, fontSize: 15, fontWeight: 500, color, flex: center ? undefined : 1, minWidth: 0, lineHeight: 1.3, wordBreak: "keep-all", position: "relative" }}>{label}</span>
      {value !== undefined && value !== null && <span style={{ ...sans, fontSize: 15, color: ivBody, flexShrink: 0, position: "relative" }}>{value}</span>}
      {trailing}
      {showChevron && <RowArrow accent={destructive ? "career" : accent ?? "identity"} fired={fired} />}
    </motion.div>
  );
}

// ── DiaryLinkCard ────────────────────────────────────────────────────────────
// A way into another page, drawn as a card pasted into the diary: paper
// washed in the page's colour, a strip of washi tape, a round sticker for
// the icon, the title with a line in hand saying what's inside, and the
// gem arrow. Opens its page by growing out of the card (OpenFromContext).
function DiaryLinkCard({ icon, title, note, badge, accent, onClick, tilt = 0, plain, divider }: {
  icon: React.ReactNode; title: string; note?: string; badge?: string; accent: CognitiveRegion; onClick?: () => void; tilt?: number;
  // `plain`: a row inside a quietCard list rather than a card of its own.
  plain?: boolean; divider?: boolean;
}) {
  const reduce = useReducedMotion();
  const openFrom = React.useContext(OpenFromContext);
  const ref = React.useRef<HTMLDivElement>(null);
  const [fired, setFired] = React.useState(0);
  const [ripple, setRipple] = React.useState<{ id: number; x: number; y: number; size: number } | null>(null);
  const c = REGION_CONFIG[accent];
  const activate = (pt?: { x: number; y: number }) => {
    const el = ref.current;
    if (el && !reduce) {
      const r = el.getBoundingClientRect();
      const x = pt ? pt.x - r.left : r.width - 30, y = pt ? pt.y - r.top : r.height / 2;
      setRipple({ id: Date.now(), x, y, size: Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) * 2 });
    }
    setFired((n) => n + 1);
    if (el) openFrom?.(el);
    onClick?.();
  };
  return (
    <motion.div
      ref={ref} role="button" tabIndex={0} aria-label={note ? `${title}. ${note}` : title}
      onClick={(e) => activate({ x: e.clientX, y: e.clientY })}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } }}
      initial={{ rotate: plain ? 0 : tilt }} whileHover={reduce || plain ? undefined : { y: -2, rotate: 0 }} whileTap={plain ? { backgroundColor: `${c.color}14` } : { scale: 0.98, rotate: 0 }} transition={SETTLE}
      style={plain ? {
        position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "14px 14px 14px 16px", cursor: "pointer",
        backgroundColor: "rgba(0,0,0,0)", WebkitTapHighlightColor: "transparent",
      } : {
        position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "16px 14px 16px 16px", borderRadius: 16, cursor: "pointer",
        backgroundColor: "#FFFCF6", backgroundImage: `radial-gradient(120% 100% at 0% 0%, ${c.color}30, transparent 55%), linear-gradient(160deg, ${c.color}14, #FFFCF6 70%)`,
        boxShadow: `0 0 0 1px ${c.color}33, 0 12px 24px -18px ${c.ink}`, WebkitTapHighlightColor: "transparent",
      }}
    >
      {divider && <span aria-hidden style={{ position: "absolute", top: 0, left: 66, right: 0, height: 1, backgroundColor: ivDivider }} />}
      {!plain && <span aria-hidden style={{ position: "absolute", top: -6, right: 34, width: 52, height: 15, transform: "rotate(4deg)", opacity: 0.8, pointerEvents: "none",
        backgroundImage: `repeating-linear-gradient(-45deg, ${c.color}99 0 5px, ${c.color}55 5px 10px)` }} />}
      <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: plain ? 0 : 16, overflow: "hidden", pointerEvents: "none" }}>
        {ripple && (
          <motion.span key={ripple.id} initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 1, opacity: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: "absolute", left: ripple.x - ripple.size / 2, top: ripple.y - ripple.size / 2, width: ripple.size, height: ripple.size, borderRadius: "50%",
              backgroundImage: `radial-gradient(circle, ${c.color}55 0%, ${c.color}22 45%, transparent 70%)` }} />
        )}
      </span>
      <span aria-hidden style={{
        position: "relative", width: plain ? 36 : 44, height: plain ? 36 : 44, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
        backgroundImage: `radial-gradient(circle at 32% 28%, ${c.color}, ${c.ink})`, boxShadow: plain ? `0 4px 12px -4px ${c.color}, 0 0 0 3px #FFFDF8, 0 0 0 4px ${c.color}44` : `0 6px 14px -6px ${c.ink}, 0 0 0 3px #FFFCF6, 0 0 0 4px ${c.color}55`,
      }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <span style={{ display: "block", ...display, fontSize: plain ? 18 : 19, color: ivHeading, lineHeight: 1.2, wordBreak: "keep-all" }}>{title}</span>
        {note && <span style={{ display: "block", ...hand, fontSize: plain ? 17 : 18, fontWeight: 500, color: c.ink, lineHeight: 1.15, marginTop: plain ? 3 : 4, wordBreak: "keep-all" }}>{note}</span>}
      </span>
      {badge && <span style={{ ...hand, fontSize: 19, fontWeight: 700, color: c.ink, flexShrink: 0, position: "relative" }}>{badge}</span>}
      <RowArrow accent={accent} fired={fired} />
    </motion.div>
  );
}

function Switch({ value, onChange, label }: { value: boolean; onChange?: (v: boolean) => void; label: string }) {
  return (
    <motion.button
      type="button" role="switch" aria-checked={value} aria-label={label}
      onClick={() => onChange?.(!value)} whileTap={{ scale: 0.95 }}
      whileFocus={{ boxShadow: "0 0 0 3px rgba(42,38,33,.16)" }}
      style={{ width: 44, height: 26, borderRadius: 13, border: 0, backgroundColor: value ? ivHeading : "rgba(42,38,33,0.12)", flexShrink: 0, padding: 3, cursor: "pointer", display: "flex", justifyContent: value ? "flex-end" : "flex-start", WebkitTapHighlightColor: "transparent" }}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 520, damping: 34 }} style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff", display: "block" }} />
    </motion.button>
  );
}

// ── Screen 14.1 · Notification settings ───────────────────────────────────────

function ScreenNotificationSettings({ settings, onBack, onChange }: { settings: StoredSettings; onBack?: () => void; onChange?: (settings: StoredSettings) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ivBg2 }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: ivHeading, marginTop: 10 }}>Notifications</div>
      </div>
      <div className="edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px 24px" }}>
        <SettingsGroup
          footer={settings.dailyReminder
            ? "Once a day, a nudge to log what's on your mind. It only fires while this app is open in a tab — there's no server behind it yet to reach you when it's closed."
            : "Once a day, a nudge to log what's on your mind."}
        >
          <SettingsRow icon={<BellSimple size={17} />} label="Daily reminder" trailing={<Switch label="Daily reminder" value={settings.dailyReminder} onChange={(v) => onChange?.({ ...settings, dailyReminder: v })} />} />
          <Collapse open={settings.dailyReminder}>
            <SettingsRow
              icon={<Clock size={17} />}
              label={<label htmlFor="daily-reminder-time" style={{ cursor: "pointer" }}>Remind me at</label>}
              trailing={
                <input
                  id="daily-reminder-time" type="time" value={settings.dailyReminderTime}
                  onChange={(e) => onChange?.({ ...settings, dailyReminderTime: e.target.value })}
                  style={{ ...sans, fontSize: 15, color: ivHeading, border: 0, borderRadius: shape.xs, padding: "5px 9px", backgroundColor: "rgba(42,38,33,0.07)" }}
                />
              }
            />
          </Collapse>
        </SettingsGroup>
        <SettingsGroup footer="Hypothesis alerts arrive when the AI finds a new pattern. The weekly summary is one recap of the unconscious beliefs and changes that built up over the week.">
          <SettingsRow icon={<Lightbulb size={17} />} label="New hypothesis alerts" trailing={<Switch label="New hypothesis alerts" value={settings.newHypothesisAlert} onChange={(v) => onChange?.({ ...settings, newHypothesisAlert: v })} />} />
          <SettingsRow icon={<CalendarBlank size={17} />} label="Weekly summary" trailing={<Switch label="Weekly summary" value={settings.weeklySummary} onChange={(v) => onChange?.({ ...settings, weeklySummary: v })} />} />
        </SettingsGroup>
      </div>
    </div>
  );
}

function downloadStoreAsJson(store: Store) {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mindscape-export-${formatDateDots(new Date()).replace(/\./g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Explainer illustrations ──────────────────────────────────────────────────
// Small animated drawings that carry what used to be a paragraph. Each one
// is a mechanism shown, not decoration: where your data goes, how a belief
// relates to an interpretation, what the app does with what you say. The
// sentences they replace are kept — as short captions under the picture,
// and in full behind a "Full details" row wherever the wording is a
// promise (privacy, consent). Every one stops moving under reduced motion
// and has an aria-label saying the same thing in words.

// Sample a cubic Bézier into keyframes for an SVG "travels along a path"
// dot (motion animates cx/cy through the samples).
function bezierSamples(p0: RoadPoint, p1: RoadPoint, p2: RoadPoint, p3: RoadPoint, n = 12) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    xs.push(u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]);
    ys.push(u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]);
  }
  return { xs, ys };
}

// Where an entry goes. A phone holding your entries, a green scan passing
// over them (the on-device crisis check, before anything leaves), and —
// only while AI analysis is on — an entry travelling out to Anthropic and
// an analysis travelling back. With cloud sync configured, a dashed line
// to your own encrypted account too.
function DataPathIllustration({ aiOn, cloud, lang = "en" }: { aiOn: boolean; cloud?: boolean; lang?: "en" | "ko" }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const L = lang === "ko"
    ? { phone: "이 기기", ai: "Anthropic (미국)", off: "분석 꺼짐", cloud: "내 계정 · 암호화" }
    : { phone: "This phone", ai: "Anthropic (US)", off: "Analysis off", cloud: "Your account · encrypted" };
  const violet = REGION_CONFIG.identity;
  const green = REGION_CONFIG.security;
  const blue = REGION_CONFIG.curiosity;
  const out = bezierSamples([140, 96], [178, 66], [226, 66], [264, 96]);
  const back = { xs: [...out.xs].reverse(), ys: [...out.ys].reverse().map((y) => y + 10) };
  const loop = { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const };
  const label = [
    `Your entries stay on this phone${cloud ? " and, if you've signed up, in your own encrypted account" : ""}.`,
    "Each one is checked on the phone for signs of crisis before anything is sent.",
    aiOn ? "With AI analysis on, an entry goes to Anthropic in the US to be analyzed, and the analysis comes back." : "AI analysis is off, so nothing is sent to Anthropic.",
  ].join(" ");
  return (
    <svg role="img" aria-label={label} viewBox="0 0 360 184" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={blue.tint} /><stop offset="1" stopColor={violet.tint} /></linearGradient>
        <linearGradient id={`scan${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={green.color} stopOpacity="0" /><stop offset="0.5" stopColor={green.color} stopOpacity="0.38" /><stop offset="1" stopColor={green.color} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`ai${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.6" stopColor={violet.tint} /><stop offset="1" stopColor={violet.color} stopOpacity="0.25" /></radialGradient>
        <clipPath id={`screen${id}`}><rect x="52" y="34" width="76" height="116" rx="10" /></clipPath>
      </defs>
      <rect width="360" height="184" rx="16" fill={`url(#bg${id})`} />

      {/* The phone and the entries it holds. */}
      <rect x="44" y="22" width="92" height="140" rx="16" fill="#FFFFFF" stroke="#2A2621" strokeOpacity="0.14" />
      <rect x="52" y="34" width="76" height="116" rx="10" fill="#FBF8F2" />
      {[violet, green, blue].map((tone, i) => (
        <motion.g key={i} animate={reduce ? undefined : { y: [0, -2, 0] }} transition={reduce ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}>
          <rect x="60" y={46 + i * 30} width="60" height="20" rx="6" fill={tone.tint} />
          <rect x="66" y={52 + i * 30} width="30" height="3" rx="1.5" fill={tone.ink} opacity="0.55" />
          <rect x="66" y={59 + i * 30} width="44" height="3" rx="1.5" fill={tone.ink} opacity="0.3" />
        </motion.g>
      ))}
      {/* The on-device check: a band of green light passing over them. */}
      <g clipPath={`url(#screen${id})`}>
        <motion.rect x="52" width="76" height="28" fill={`url(#scan${id})`}
          initial={{ y: 20 }} animate={reduce ? { y: 60 } : { y: [20, 150] }}
          transition={reduce ? undefined : { duration: 3.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }} />
      </g>
      {/* Lock: it stays here. */}
      <g transform="translate(128 26)">
        <circle r="10" fill="#2A2621" />
        <rect x="-4.5" y="-1" width="9" height="7" rx="1.5" fill="#FFFFFF" />
        <path d="M-2.6 -1 V-3.4 A2.6 2.6 0 0 1 2.6 -3.4 V-1" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
      </g>
      <text x="90" y="178" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621">{L.phone}</text>

      {cloud && (
        <g>
          <path d="M136 46 C 160 26, 178 22, 196 28" fill="none" stroke={blue.ink} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="3 4" />
          <path d="M198 36 a10 10 0 0 1 8 -14 a13 13 0 0 1 24 2 a9 9 0 0 1 4 17 h-32 a8 8 0 0 1 -4 -5 z" fill="#FFFFFF" stroke={blue.ink} strokeOpacity="0.35" />
          <text x="218" y="56" textAnchor="middle" fontSize="9.5" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill={blue.ink}>{L.cloud}</text>
        </g>
      )}

      {/* The way to Anthropic — travelled only while analysis is on. */}
      <motion.path d="M140 96 C 178 66, 226 66, 264 96" fill="none" stroke={violet.ink} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="4 6"
        strokeOpacity={aiOn ? 0.55 : 0.18}
        animate={aiOn && !reduce ? { strokeDashoffset: [0, -20] } : undefined} transition={aiOn && !reduce ? { duration: 1.2, repeat: Infinity, ease: "linear" } : undefined} />
      {aiOn && !reduce && (
        <>
          <motion.circle r="4.5" fill={violet.color} cx={out.xs[0]} cy={out.ys[0]} initial={{ cx: out.xs[0], cy: out.ys[0], opacity: 0 }} animate={{ cx: out.xs, cy: out.ys, opacity: [0, 1, 1, 1, 0] }} transition={{ ...loop, repeatDelay: 1.2 }} />
          <motion.circle r="4.5" fill={green.color} cx={back.xs[0]} cy={back.ys[0]} initial={{ cx: back.xs[0], cy: back.ys[0], opacity: 0 }} animate={{ cx: back.xs, cy: back.ys, opacity: [0, 1, 1, 1, 0] }} transition={{ ...loop, delay: 2.2, repeatDelay: 1.2 }} />
        </>
      )}
      <g opacity={aiOn ? 1 : 0.4}>
        <motion.circle cx="292" cy="96" r="26" fill={`url(#ai${id})`}
          animate={aiOn && !reduce ? { scale: [1, 1.06, 1] } : undefined} transition={aiOn && !reduce ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : undefined}
          style={{ transformOrigin: "292px 96px" }} />
        <path d="M292 82 L295.5 92.5 L306 96 L295.5 99.5 L292 110 L288.5 99.5 L278 96 L288.5 92.5 Z" fill={violet.ink} />
      </g>
      <text x="292" y="138" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621" opacity={aiOn ? 1 : 0.55}>{L.ai}</text>
      {!aiOn && <text x="292" y="153" textAnchor="middle" fontSize="10" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621" opacity="0.55">{L.off}</text>}
    </svg>
  );
}

// A caption row under an illustration: a tinted dot that matches the part
// of the drawing it describes, and one short line.
function IllustrationKey({ items }: { items: { tone: string; text: React.ReactNode }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: it.tone, marginTop: 5, flexShrink: 0 }} />
          <span style={{ ...sans, fontSize: 13, color: ivHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{it.text}</span>
        </div>
      ))}
    </div>
  );
}

// A belief and the interpretations it produces, as a plant: the belief is
// a glowing seed below the soil with roots running out to a second belief
// (beliefs prop each other up), and above ground three shoots rise in turn
// — each one a moment the belief showed up.
function BeliefRootsIllustration() {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const violet = REGION_CONFIG.identity;
  const gold = REGION_CONFIG.career;
  const green = REGION_CONFIG.security;
  const grow = (i: number) => (reduce ? undefined : { duration: 4.5, repeat: Infinity, ease: "easeInOut" as const, delay: i * 0.9, times: [0, 0.35, 0.8, 1] });
  return (
    <svg role="img" aria-label="A belief sits underneath, out of sight, with roots joining it to another belief. Above the surface, three shoots rise one after another: each is an interpretation, a moment the belief shows up." viewBox="0 0 360 170" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`air${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FBF7EF" /><stop offset="1" stopColor={green.tint} /></linearGradient>
        <linearGradient id={`soil${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E3D3BC" /><stop offset="1" stopColor="#CDB797" /></linearGradient>
        <radialGradient id={`seed${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.35" stopColor={violet.color} /><stop offset="1" stopColor={violet.color} stopOpacity="0" /></radialGradient>
        <radialGradient id={`seed2${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.35" stopColor={gold.color} /><stop offset="1" stopColor={gold.color} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="360" height="170" rx="16" fill={`url(#air${id})`} />
      <path d="M0 92 C 90 86, 260 98, 360 90 L360 154 A16 16 0 0 1 344 170 L16 170 A16 16 0 0 1 0 154 Z" fill={`url(#soil${id})`} />

      {/* Roots: the belief's reach, and the root it shares with another. */}
      <motion.path d="M150 128 C 175 136, 205 140, 236 132" fill="none" stroke="#8A6A4A" strokeWidth="2" strokeLinecap="round"
        strokeDasharray="120" initial={{ strokeDashoffset: 120 }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }} />
      {["M150 128 C 140 142, 120 148, 104 152", "M150 128 C 154 144, 150 152, 142 160", "M236 132 C 250 146, 266 150, 280 154"].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#8A6A4A" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
      ))}
      <motion.circle cx="150" cy="128" r="16" fill={`url(#seed${id})`} animate={reduce ? undefined : { scale: [1, 1.12, 1] }} transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "150px 128px" }} />
      <motion.circle cx="236" cy="132" r="12" fill={`url(#seed2${id})`} animate={reduce ? undefined : { scale: [1, 1.1, 1] }} transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 1.2 }} style={{ transformOrigin: "236px 132px" }} />

      {/* Shoots: the moments it shows up, rising one after another. */}
      {[{ x: 96, h: 40 }, { x: 150, h: 54 }, { x: 206, h: 36 }].map((s, i) => (
        <motion.g key={i} style={{ transformOrigin: `${s.x}px 92px` }}
          initial={{ scaleY: reduce ? 1 : 0.2 }} animate={reduce ? { scaleY: 1 } : { scaleY: [0.2, 1, 1, 0.2] }} transition={grow(i)}>
          <path d={`M${s.x} 92 C ${s.x - 2} ${92 - s.h * 0.5}, ${s.x + 3} ${92 - s.h * 0.8}, ${s.x} ${92 - s.h}`} fill="none" stroke={green.ink} strokeWidth="2" strokeLinecap="round" />
          <path d={`M${s.x} ${92 - s.h * 0.6} c 7 -8, 15 -7, 18 -3 c -6 6, -12 7, -18 3 z`} fill={green.color} />
          <path d={`M${s.x} ${92 - s.h * 0.85} c -7 -7, -14 -6, -16 -2 c 6 5, 11 6, 16 2 z`} fill={green.color} opacity="0.85" />
          <circle cx={s.x} cy={92 - s.h} r="3.5" fill={gold.color} />
        </motion.g>
      ))}
      {/* Tie the middle shoot visibly to the seed below it. */}
      <path d="M150 92 L150 116" stroke="#8A6A4A" strokeWidth="1.6" strokeDasharray="2 3" strokeOpacity="0.6" />

      <text x="292" y="38" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill={green.ink}>Interpretations</text>
      <text x="292" y="52" textAnchor="middle" fontSize="10" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621" opacity="0.65">the moments it shows</text>
      <text x="300" y="112" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill={violet.ink}>Beliefs</text>
      <text x="300" y="126" textAnchor="middle" fontSize="10" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621" opacity="0.65">running underneath</text>
    </svg>
  );
}

// What the app does, in three beats that light up in turn: you speak (a
// waveform), it notices what repeats (the same word marked across three
// lines), a pattern takes shape (orbs joining). One beat at a time keeps
// the order readable without arrows doing all the work.
function HowItWorksIllustration() {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const violet = REGION_CONFIG.identity;
  const gold = REGION_CONFIG.career;
  const rose = REGION_CONFIG.relationships;
  const blue = REGION_CONFIG.curiosity;
  const CYCLE = 7.5;
  // Each beat is lit for its third of the cycle and dims for the rest.
  const beat = (i: number) => (reduce
    ? { animate: { opacity: 1 } }
    : { animate: { opacity: [0.35, 1, 1, 0.35, 0.35] }, transition: { duration: CYCLE, repeat: Infinity, ease: "easeInOut" as const, times: [0, 0.08, 0.3, 0.38, 1], delay: i * (CYCLE / 3) } });
  const font = "'Pretendard Variable', Pretendard, sans-serif";
  return (
    <svg role="img" aria-label="Three steps: you speak or write; the app notices what repeats across entries; a pattern takes shape as connected beliefs." viewBox="0 0 360 150" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`hbg${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={rose.tint} /><stop offset="0.5" stopColor={gold.tint} /><stop offset="1" stopColor={violet.tint} /></linearGradient>
      </defs>
      <rect width="360" height="150" rx="16" fill={`url(#hbg${id})`} />
      {/* 1 · You speak */}
      <motion.g {...beat(0)}>
        <rect x="14" y="22" width="96" height="84" rx="14" fill="#FFFFFF" opacity="0.85" />
        {[10, 22, 34, 18, 28, 14, 24].map((h, i) => (
          <motion.rect key={i} x={30 + i * 9} width="5" rx="2.5" fill={rose.ink}
            initial={{ y: 64 - h / 2, height: h }}
            animate={reduce ? undefined : { height: [h, h * 0.45, h], y: [64 - h / 2, 64 - (h * 0.45) / 2, 64 - h / 2] }}
            transition={reduce ? undefined : { duration: 0.9 + (i % 3) * 0.2, repeat: Infinity, ease: "easeInOut" }} />
        ))}
        <text x="62" y="128" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily={font} fill="#2A2621">You speak</text>
      </motion.g>
      {/* 2 · It notices what repeats */}
      <motion.g {...beat(1)}>
        <rect x="132" y="22" width="96" height="84" rx="14" fill="#FFFFFF" opacity="0.85" />
        {[0, 1, 2].map((r) => (
          <g key={r}>
            <rect x="144" y={38 + r * 22} width="72" height="4" rx="2" fill="#2A2621" opacity="0.15" />
            <motion.rect x={150 + r * 14} y={35 + r * 22} width="26" height="10" rx="3" fill={gold.color}
              initial={{ opacity: reduce ? 0.7 : 0 }} animate={reduce ? undefined : { opacity: [0, 0.75, 0.75, 0] }}
              transition={reduce ? undefined : { duration: CYCLE, repeat: Infinity, times: [0.34, 0.42 + r * 0.04, 0.62, 0.7], ease: "easeInOut" }} />
            <rect x={150 + r * 14} y={38 + r * 22} width="26" height="4" rx="2" fill={gold.ink} opacity="0.8" />
          </g>
        ))}
        <text x="180" y="128" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily={font} fill="#2A2621">It spots repeats</text>
      </motion.g>
      {/* 3 · A pattern takes shape */}
      <motion.g {...beat(2)}>
        <rect x="250" y="22" width="96" height="84" rx="14" fill="#FFFFFF" opacity="0.85" />
        <path d="M276 76 L298 46 L322 70 Z" fill="none" stroke={violet.ink} strokeOpacity="0.45" strokeWidth="1.4" />
        {[{ x: 276, y: 76, c: violet.color }, { x: 298, y: 46, c: gold.color }, { x: 322, y: 70, c: blue.color }].map((o, i) => (
          <motion.circle key={i} cx={o.x} cy={o.y} r="7" fill={o.c} style={{ transformOrigin: `${o.x}px ${o.y}px` }}
            animate={reduce ? undefined : { scale: [1, 1.25, 1] }} transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }} />
        ))}
        <text x="298" y="128" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily={font} fill="#2A2621">A pattern forms</text>
      </motion.g>
      {/* Order between beats. */}
      {[118, 236].map((x) => (
        <path key={x} d={`M${x} 64 l6 0 m-3 -3 l3 3 l-3 3`} fill="none" stroke="#2A2621" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

// ── Screen 14.2 · Data & privacy ───────────────────────────────────────────────
function ScreenDataPrivacy({
  store,
  onBack,
  onResetData,
  onOpenPrivacyPolicy,
  onOpenTermsOfService,
  onDeleteAccount,
  aiConsentOn,
  onOpenAiConsent,
}: {
  aiConsentOn?: boolean;
  onOpenAiConsent?: () => void;
  store: Store;
  onBack?: () => void;
  onResetData?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenTermsOfService?: () => void;
  // Present only while a real cloud session exists — guests have no
  // account to delete, and "Delete all my data" already covers them.
  onDeleteAccount?: () => Promise<void>;
}) {
  const [armed, setArmed] = React.useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = React.useState(false);
  const [accountArmed, setAccountArmed] = React.useState(false);
  const [deletingAccount, setDeletingAccount] = React.useState(false);
  const [accountError, setAccountError] = React.useState("");
  const confirmDeleteAccount = async () => {
    if (!onDeleteAccount || deletingAccount) return;
    if (!accountArmed) { setAccountArmed(true); return; }
    setDeletingAccount(true);
    setAccountError("");
    try {
      await onDeleteAccount();
    } catch (err) {
      setDeletingAccount(false);
      setAccountArmed(false);
      setAccountError(err instanceof Error ? err.message : "Couldn't delete your account. Please try again.");
    }
  };
  const s = store;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ivBg2 }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: ivHeading, marginTop: 10 }}>Data & Privacy</div>
      </div>
      <div className="edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 16px 24px" }}>
        {/* Where your data goes, drawn: the phone, the on-device check,
            and the trip to Anthropic only while analysis is on. The exact
            wording is a promise, so it stays, word for word, one row down. */}
        <div style={{ backgroundColor: ivSurfaceSolid, borderRadius: shape.md, boxShadow: ivCardShadow, padding: 12, marginTop: 4 }}>
          <DataPathIllustration aiOn={!!aiConsentOn} cloud={isCloudSyncConfigured} />
          <div style={{ padding: "0 4px 4px" }}>
            <IllustrationKey items={[
              { tone: REGION_CONFIG.curiosity.color, text: isCloudSyncConfigured ? "Kept on this phone — and in your own encrypted account if you sign up." : "Kept on this phone. There's no account on a server." },
              { tone: REGION_CONFIG.security.color, text: "Checked here for signs of crisis before anything is sent." },
              { tone: REGION_CONFIG.identity.color, text: aiConsentOn ? "Sent to Anthropic only to be analyzed, then the analysis comes back." : "Not sent anywhere while AI analysis is off." },
            ]} />
          </div>
        </div>
        <SettingsGroup style={{ marginTop: 14 }}>
          <DisclosureRow title="Full details" open={showPrivacyDetails} onToggle={() => setShowPrivacyDetails((v) => !v)} first>
        <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.75, wordBreak: "keep-all", }}>
          {isCloudSyncConfigured
            ? "Browsing as a guest, everything stays only in this device's browser. If you've signed up, your unconscious beliefs, interpretations, and conversation history are also synced to a private, encrypted account — accessible only to you, never sold or shared, and protected by database-level access rules that make it impossible for anyone else to read your data even by mistake. Text you log with \"Speak your mind\" is only sent to Claude (Anthropic) at the moment it's analyzed."
            : "This app doesn't create an account on a separate server. Your unconscious beliefs, interpretations, and conversation history are stored only in this device's browser. Text you log with \"Speak your mind\" is only sent to Claude (Anthropic) at the moment it's analyzed, and never leaves your device otherwise."}
        </div>

        <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 12, lineHeight: 1.75, wordBreak: "keep-all", }}>
          One exception: what you write is checked on this device, before anything is sent anywhere, for language that suggests you might be in crisis. That check never leaves your device either — if it matches, you're shown real crisis resources instead of the usual analysis. Nothing about that check is stored, scored, or shared.
        </div>
          </DisclosureRow>
        </SettingsGroup>

        <SettingsGroup header="Stored on this device">
          {[
            ["Unconscious beliefs", s?.beliefs.length ?? 0],
            ["Recurring unconscious interpretations", s?.assumptions.length ?? 0],
            ["Connections between unconscious beliefs", s?.connections.length ?? 0],
            ["Conversation history", s?.history.length ?? 0],
            ["AI's hypotheses", s?.hypotheses.length ?? 0],
          ].map(([label, count]) => (
            <SettingsRow key={label as string} label={label} value={<span style={{ ...mono, fontSize: 13 }}>{count}</span>} />
          ))}
        </SettingsGroup>

        {onOpenAiConsent && (
          <SettingsGroup
            footer={aiConsentOn
              ? "On — entries are sent to Anthropic (US) for analysis. Tap to review or withdraw."
              : "Off — entries stay on this device and aren't analyzed. Tap to review or turn on."}
          >
            <SettingsRow icon={<Sparkle size={17} />} label="AI analysis consent" value={aiConsentOn ? "On" : "Off"} onClick={onOpenAiConsent} />
          </SettingsGroup>
        )}

        <SettingsGroup
          footer={isCloudSyncConfigured
            ? "Saves everything above to a JSON file on this device — worth doing if you're browsing as a guest, since there's no account to fall back on if this device's storage is ever cleared."
            : "Saves everything above to a JSON file on this device. There's no account or backup behind this app — if this device's storage is ever cleared, this download is the only copy that survives."}
        >
          <SettingsRow icon={<DownloadSimple size={17} />} label="Download my data" onClick={() => downloadStoreAsJson(s)} chevron={false} />
        </SettingsGroup>

        <SettingsGroup
          footer={armed
            ? (onDeleteAccount
              ? "All unconscious beliefs, interpretations, conversation history, and your goal will be erased from this device and your synced account. Your account itself (name and email) stays — use \"Delete my account\" below to remove that too. This can't be undone."
              : "All unconscious beliefs, interpretations, conversation history, and your goal stored on this device will be gone. This can't be undone.")
            : undefined}
        >
          <SettingsRow
            label={armed ? "Are you sure? Tap again to delete everything" : "Delete all my data"} destructive center
            onClick={() => (armed ? onResetData?.() : setArmed(true))}
            style={armed ? { backgroundColor: mdWarnSoft } : undefined}
          />
        </SettingsGroup>

        {onDeleteAccount && (
          <SettingsGroup
            footer={
              <span style={accountError ? { color: mdWarn } : undefined}>
                {accountError || (accountArmed
                  ? "Permanently deletes your login, name, email, and everything synced to your account, on every device. If you have a subscription, cancel it separately in your App Store or Google Play settings. This can't be undone."
                  : "Removes your account and all synced data. Download your data first if you want to keep a copy.")}
              </span>
            }
          >
            <SettingsRow
              label={deletingAccount ? "Deleting your account…" : accountArmed ? "Are you sure? Tap again to delete your account" : "Delete my account"}
              destructive center disabled={deletingAccount} onClick={confirmDeleteAccount}
              style={accountArmed ? { backgroundColor: mdWarnSoft } : undefined}
            />
          </SettingsGroup>
        )}

        <SettingsGroup header="Legal" style={{ marginBottom: 0 }}>
          <SettingsRow label="Privacy Policy" onClick={onOpenPrivacyPolicy} />
          <SettingsRow label="Terms of Service" onClick={onOpenTermsOfService} />
          <SettingsRow label="End User License Agreement" onClick={() => openLegalPage("eula")} />
          <SettingsRow label="Refund & Subscription Policy" onClick={() => openLegalPage("refund")} />
        </SettingsGroup>
      </div>
    </div>
  );
}

// ── Screen 14.3 · Help ─────────────────────────────────────────────────────────
const HELP_ITEMS = [
  { q: "What does this app do?", a: "It's not a diary for logging what happened. Over time, it quietly reflects back why you think and act the way you do — the unconscious beliefs and interpretations that keep showing up in your actual words and actions, without you consciously realizing it." },
  { q: "How do I use \"Speak your mind\"?", a: "Don't try to organize it. Whatever happened today, a thought that suddenly crossed your mind, something you haven't decided yet — just say or type it in whatever order it comes to you. Voice uses your browser's built-in recognition; text supports direct typing." },
  { q: "What are unconscious patterns?", a: "It shows the unconscious beliefs that seem to drive your actual decisions, even ones you're not fully aware of, as circles that grow as more evidence builds up. Below that are \"recurring unconscious interpretations\" — interpretations that automatically pop up in specific situations. Lines between circles are connections between unconscious beliefs that appear to come from the same root." },
  { q: "How is an AI hypothesis different from an unconscious belief?", a: "An unconscious belief is the thing itself — what repeatedly shows up in your actual words and actions. A hypothesis is a higher-level theory the AI offers by crossing multiple unconscious beliefs/connections (e.g., \"this pattern shows up the same way in both your career and your relationships\"). It's not a settled fact — it's an interpretation you refine together by agreeing or pushing back." },
  { q: "How is distance from your goal calculated?", a: "The AI points out the concrete gap between who you said you wanted to become and the unconscious beliefs/interpretations that have actually built up. You set the goal directly on that screen." },
  { q: "What is this analysis based on?", a: "It draws on concepts from CBT (Cognitive Behavioral Therapy) and ACT (Acceptance and Commitment Therapy). Cognitive-distortion tags like \"All-or-nothing thinking\" and \"Overgeneralization\" come from CBT; distance from your goal comes from ACT's \"value direction\" concept. A single entry never creates a belief — it takes at least 3 similar patterns building up. Confidence never reaches 100%, and actually goes down when there are conflicting entries. That said, this is a self-reflection tool, not a psychological diagnosis or treatment." },
  { q: "What if I'm in crisis?", a: "If what you write suggests you might be in crisis, we show you real crisis resources (like the 988 Suicide & Crisis Lifeline) right away, instead of the usual analysis — that check happens entirely on your device, before anything is sent anywhere. If you're in danger right now, please contact emergency services or 988 directly rather than waiting on this app." },
];

// ── DisclosureRow ────────────────────────────────────────────────────────────
// A row inside a SettingsGroup that unfolds its body in place: the title
// (and an optional one-line subtitle) stays put, the caret turns, and the
// body measures itself open. Used for Help's questions and for History's
// "how you've changed" modules — anything that should cost one line of a
// list until someone asks for it.
function DisclosureRow({ title, subtitle, icon, open, onToggle, first, titleStyle, children }: { title: string; subtitle?: string; icon?: React.ReactNode; open: boolean; onToggle: () => void; first: boolean; titleStyle?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      {!first && <span aria-hidden style={{ position: "absolute", top: 0, left: icon ? 16 + 28 + 12 : 16, right: 0, height: 1, backgroundColor: ivDivider }} />}
      <motion.button
        type="button" aria-expanded={open} onClick={onToggle}
        whileTap={{ backgroundColor: "rgba(42,38,33,0.07)" }} transition={{ duration: 0.12 }}
        style={{ width: "100%", border: 0, background: "rgba(42,38,33,0)", display: "flex", alignItems: icon ? "flex-start" : "center", gap: 12, padding: "13px 16px", textAlign: "left", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      >
        {icon && <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...sans, fontSize: 15, fontWeight: 500, color: ivHeading, lineHeight: 1.4, display: "block", wordBreak: "keep-all", ...titleStyle }}>{title}</span>
          {subtitle && <span style={{ ...hand, fontSize: 19, fontWeight: 500, color: ivBody, lineHeight: 1.2, display: "block", marginTop: 2, wordBreak: "keep-all" }}>{subtitle}</span>}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SETTLE} style={{ display: "flex", flexShrink: 0, marginTop: icon ? 4 : 0 }}>
          <CaretDown size={14} color={ivFaint} weight="bold" />
        </motion.span>
      </motion.button>
      <Collapse open={open}>
        <div style={{ padding: "2px 16px 18px" }}>{children}</div>
      </Collapse>
    </div>
  );
}

function HelpDisclosure({ question, answer, open, onToggle, first }: { question: string; answer: string; open: boolean; onToggle: () => void; first: boolean }) {
  return (
    <DisclosureRow title={question} open={open} onToggle={onToggle} first={first} titleStyle={{ ...display, fontWeight: 400 }}>
      <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.65, wordBreak: "keep-all" }}>{answer}</div>
    </DisclosureRow>
  );
}

function ScreenHelp({ onBack, onReplayTutorial }: { onBack?: () => void; onReplayTutorial?: () => void }) {
  const [openQuestion, setOpenQuestion] = React.useState<number | null>(0);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ivBg2 }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: ivHeading, marginTop: 10 }}>Help</div>
        <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
          There are patterns in your mind. You just can't see them from inside.
        </div>
      </div>
      <div className="edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px 24px" }}>
        {/* The app in three beats, before any question is asked. */}
        <div style={{ backgroundColor: ivSurfaceSolid, borderRadius: shape.md, boxShadow: ivCardShadow, padding: 12, marginBottom: 22 }}>
          <HowItWorksIllustration />
          <div style={{ ...sans, fontSize: 13, color: ivHeading, lineHeight: 1.5, padding: "10px 4px 2px", wordBreak: "keep-all" }}>
            Say what's on your mind, in any order. Over time the app notices what keeps coming back, and shows you the beliefs underneath.
          </div>
        </div>
        {onReplayTutorial && (
          <SettingsGroup>
            <SettingsRow icon={<ArrowCounterClockwise size={17} />} label="Replay the tutorial" onClick={onReplayTutorial} />
          </SettingsGroup>
        )}
        {/* Questions as disclosure rows: the list of seven reads at a
            glance, and one answer opens at a time where it was asked. */}
        <SettingsGroup header="Questions" style={{ marginBottom: 0 }}>
          {HELP_ITEMS.map((h, i) => (
            <HelpDisclosure key={h.q} question={h.q} answer={h.a} open={openQuestion === i} onToggle={() => setOpenQuestion((cur) => (cur === i ? null : i))} first={i === 0} />
          ))}
        </SettingsGroup>
      </div>
    </div>
  );
}

// ── Screen 14.4/14.5 · Legal documents ────────────────────────────────────────
// Both drafted to accurately describe how the app actually behaves today
// (local-storage-only, what gets sent to Claude/Anthropic and when,
// on-device crisis-language checking, the current MONETIZATION_ENABLED
// state) rather than generic boilerplate — but they're still a draft, not
// legal advice, and say so prominently. Swap in this file's content once
// an actual lawyer has reviewed it for your jurisdiction; nothing else
// about how these render needs to change.
type LegalSection = { heading: string; body: string };
type LegalDoc = "privacy" | "terms" | "eula" | "refund";

// The full, hosted versions live in public/legal/ (served at /legal/*.html)
// — those are the documents of record, and the URLs App Store Connect /
// Play Console point at. The in-app sections below are a faithful summary
// of them. Korean-language devices get the Korean edition (*.ko.html).
function legalPageUrl(doc: LegalDoc): string {
  const lang = typeof navigator !== "undefined" ? (navigator.language || "").toLowerCase() : "";
  return `/legal/${doc}${lang.startsWith("ko") ? ".ko" : ""}.html`;
}
function openLegalPage(doc: LegalDoc) {
  window.open(legalPageUrl(doc), "_blank", "noopener,noreferrer");
}

function ScreenLegalDocument({
  title,
  lastUpdated,
  sections,
  fullVersion,
  onBack,
}: {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
  fullVersion?: LegalDoc;
  onBack?: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: mdHeading, marginTop: 10 }}>{title}</div>
        <div style={{ ...mono, fontSize: 11, color: mdFaint, marginTop: 6 }}>Last updated {lastUpdated}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 32px" }}>
        <div style={{ padding: 14, borderRadius: 12, backgroundColor: mdWarnSoft, borderLeft: `2px solid ${mdWarn}`, marginBottom: 22 }}>
          <div style={{ ...sans, fontSize: 13, color: mdWarnLabel, lineHeight: 1.6, wordBreak: "keep-all" }}>
            Draft — written to accurately describe how the app works today, but not yet reviewed by a lawyer. Have this reviewed for your jurisdiction before relying on it.
          </div>
        </div>
        {fullVersion && (
          <a
            href={legalPageUrl(fullVersion)} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", ...sans, fontSize: 13, fontWeight: 600, color: mdHeading, marginBottom: 22, textDecoration: "underline" }}
          >
            This is a summary. Read the full {title} ↗
          </a>
        )}
        {sections.map((s) => (
          <div key={s.heading} style={{ marginBottom: 22 }}>
            <div style={{ ...sans, fontSize: 13, fontWeight: 700, color: mdHeading }}>{s.heading}</div>
            <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 6, lineHeight: 1.7, wordBreak: "keep-all" }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    heading: "1. Overview",
    body: isCloudSyncConfigured
      ? "What you write in Mindscape can reveal your thoughts, beliefs, and mental state, so we treat it as sensitive information. As a guest, everything stays in this browser's storage on your device. If you create an account, your data is also synced to a private, encrypted database that only your own login can read."
      : "What you write in Mindscape can reveal your thoughts, beliefs, and mental state, so we treat it as sensitive information. Everything you record stays in this browser's storage on your device — there's no Mindscape account server holding a copy.",
  },
  {
    heading: "2. What we collect",
    body: "Text you write or speak with \"Speak your mind\"; the AI's analysis of it (beliefs, interpretations, hypotheses, summaries); your reactions to those insights; an optional aspiration; your settings; and, only if you sign up, your name, email, and a password (stored only as a one-way hash by our authentication provider). We don't collect location, contacts, photos, advertising IDs, or anything outside the app.",
  },
  {
    heading: "3. Voice input",
    body: "If you use voice, the microphone is used on your device to draw the waveform. Speech-to-text is done by your browser's or operating system's built-in recognizer (e.g. Apple or Google), which may send audio to that vendor to return text. Mindscape itself never receives or stores audio — only the resulting text.",
  },
  {
    heading: "4. Who processes your data",
    body: "Anthropic (Claude) receives the text of an entry, relevant prior insights, and your first name, solely to generate your analysis — it does not use this to train its models. Vercel hosts the app and relays those requests. " +
      (isCloudSyncConfigured ? "Supabase stores your account and synced data (in Seoul, Korea). " : "") +
      "Some of these providers are in the United States. We never sell your data, show ads, or use third-party analytics or tracking.",
  },
  {
    heading: "5. Crisis-language detection",
    body: "Every entry is checked on your device — not sent anywhere, not reviewed by the AI — for language that may indicate a crisis. If detected, you're shown crisis support resources first. The result is never stored, logged, or transmitted.",
  },
  {
    heading: "6. Your rights & deleting your data",
    body: (isCloudSyncConfigured
      ? "Profile → Data & Privacy lets you download everything (JSON), erase all your data (\"Delete all my data\"), or permanently delete your account with its name, email, and all synced data (\"Delete my account\", shown while signed in). "
      : "Profile → Data & Privacy lets you download everything (JSON) or erase it permanently (\"Delete all my data\"). ") +
      "You can also email us to access, correct, delete, or export your data, or to withdraw consent. Depending on where you live (e.g. Korea, the EU/UK, California), you may have additional rights and can complain to your data protection authority.",
  },
  {
    heading: "7. Retention",
    body: "Data on your device stays until you delete it. Account data is erased when you delete your account (and from backups shortly after). Anthropic deletes analysis requests within 30 days under its commercial retention policy (longer only if flagged for a Usage Policy violation). Server logs are kept for up to 30 days for security.",
  },
  {
    heading: "8. Children",
    body: "Mindscape isn't intended for anyone under 14 (or the age of digital consent in your country, if higher), and we don't knowingly collect their information.",
  },
  {
    heading: "9. Changes & contact",
    body: "We'll notify you in the app before material changes take effect. Questions or requests: [CONTACT EMAIL — add before publishing].",
  },
];

const TERMS_OF_SERVICE_SECTIONS: LegalSection[] = [
  {
    heading: "1. What this app is",
    body: "Mindscape is a self-reflection tool that uses AI to help surface patterns in your own words, drawing on concepts from Cognitive Behavioral Therapy (CBT) and Acceptance and Commitment Therapy (ACT).",
  },
  {
    heading: "2. Not medical or mental health treatment",
    body: "Mindscape is not therapy, counseling, medical advice, or a treatment service, and nothing in it is provided or reviewed by a licensed clinician. It isn't monitored and can't respond to emergencies. If you're in crisis, contact emergency services right away (Korea: 112/119 or 109; US: call or text 988) or use the in-app crisis resources.",
  },
  {
    heading: "3. Eligibility & your account",
    body: (isCloudSyncConfigured
      ? "You must be at least 14 (or older where local law requires). You can use Mindscape as a guest (data on this device only) or create an account to sync across devices. Keep your login secure; you're responsible for activity under it. You can delete your account any time in Data & Privacy — deletion is permanent and we can't restore it."
      : "You must be at least 14 (or older where local law requires). Your data exists only in this browser's storage — if it's cleared, we can't recover it."),
  },
  {
    heading: "4. Your content",
    body: "You own what you write. You give us a limited license to store and process it — including sending it to our AI provider — only to provide the app to you. We don't use it to train AI models or for advertising, and there are no public or social features.",
  },
  {
    heading: "5. Acceptable use",
    body: "Don't use Mindscape to break the law or harm anyone, to reverse-engineer, disrupt, or bypass the app's security, to access others' data, to scrape or overload our servers, or to misuse the AI systems it relies on.",
  },
  {
    heading: "6. AI-generated content",
    body: "Analysis, hypotheses, and other AI output are probabilistic and can be wrong or incomplete. They aren't facts about you — use your own judgment.",
  },
  {
    heading: "7. Subscriptions",
    body: "Mindscape Pro is not currently offered — every feature is free and you won't be charged. If paid plans are introduced, they'll be sold through the App Store or Google Play, we'll tell you in advance, and the Refund & Subscription Policy will apply.",
  },
  {
    heading: "8. Disclaimers & liability",
    body: "Mindscape is provided \"as is,\" without warranties. To the extent the law allows, we aren't liable for indirect damages or data loss, and our total liability is limited to what you paid us in the past 12 months (or USD 50). Mandatory consumer rights where you live are not affected.",
  },
  {
    heading: "9. Changes & governing law",
    body: "We'll give in-app notice at least 7 days (30 days if unfavorable) before material changes. These terms are governed by the laws of the Republic of Korea. Contact: [CONTACT EMAIL — add before publishing].",
  },
];

// ── Screen 15 · Paywall ───────────────────────────────────────────────────────
// Free tier only records entries (see appendUnanalyzedEntry in realStore.ts)
// — every screen that reads AI-derived data (Mind/Analysis tab, Brain Map,
// AI's Hypotheses, Distance from Your Goal) renders this instead when
// !store.isPro, rather than showing an empty/broken version of itself. No
// real billing here — onContinue hands the picked plan to ScreenCheckout,
// which is the one place that actually flips store.isPro (see
// upgradeToPro in the App shell) — but both screens are written as a real
// paywall/checkout would be, so swapping in a payment SDK later only
// touches ScreenCheckout's submit handler.
const PRO_FEATURES = [
  { title: "Unconscious Patterns", detail: "See the core beliefs quietly running underneath your words and actions." },
  { title: "Brain Map", detail: "Watch your beliefs light up and connect to each other as a living map." },
  { title: "AI's Hypotheses", detail: "Get higher-level theories that cross multiple beliefs, and refine them together." },
  { title: "Distance from Your Goal", detail: "See the real gap between who you want to become and your actual patterns." },
];

type ProPlan = "monthly" | "yearly";

// Which free-tier entry triggers ScreenSoftPaywall — see the "think" case's
// onDone in the App shell and hasSeenUpgradePrompt in types.ts. 3 gives the
// free experience a little room to prove itself (a single entry has nothing
// to show a pattern in) before asking, without waiting so long the ask
// feels disconnected from what just happened.
const UPSELL_PROMPT_AT_ENTRY_COUNT = 3;

// Priced like the mental-wellness/self-reflection apps this one sits
// alongside (Reflectly, Stoic, etc. cluster around $7-13/mo or $40-70/yr) —
// yearly is the default selection below and priced to read as the
// obviously better deal (58% cheaper per month than paying monthly), which
// is what "BEST VALUE" is doing the actual math for, not just asserting.
const PRO_PLANS: { id: ProPlan; label: string; price: string; period: string; billedNote: string; badge?: string }[] = [
  { id: "yearly", label: "Yearly", price: "$49.99", period: "/year", billedNote: "$4.17/mo, billed annually", badge: "BEST VALUE" },
  { id: "monthly", label: "Monthly", price: "$9.99", period: "/month", billedNote: "Billed monthly" },
];

function ScreenPaywall({
  onBack,
  onContinue,
  activeTab,
  onNavSelect,
}: {
  onBack?: () => void;
  onContinue?: (plan: ProPlan) => void;
  // Set only when this screen is standing in for a real tab ("analysis" or
  // "discoveryAnalysis" — the gated screens whose real version has its own
  // BottomNav; see those cases in the App shell). Keeps this a full-
  // screen modal everywhere else it's used (from Profile, from the post-
  // recording upsell), matching those entry points' own real screens, none
  // of which have a tab bar either.
  activeTab?: string;
  onNavSelect?: (id: string) => void;
}) {
  const [selected, setSelected] = React.useState<ProPlan>("yearly");
  const plan = PRO_PLANS.find((p) => p.id === selected)!;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 24px" }}>
        <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: mdAccent, textTransform: "uppercase" }}>Upgrade to Pro</div>
        <div style={{ ...display, fontSize: 28, color: mdHeading, marginTop: 10, lineHeight: 1.4, wordBreak: "keep-all" }}>
          Recording is free.<br />Understanding the pattern isn't yet.
        </div>
        <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 10, lineHeight: 1.6, wordBreak: "keep-all" }}>
          Every thought you speak is already being kept, free. Pro turns that record into the unconscious beliefs, connections, and hypotheses behind it.
        </div>

        {/* Also the interactive tutorial's "today-discovery" spotlight target
            when a free-tier tour reaches the Analysis tab — see
            buildTutorialSteps in the App shell, which swaps in Pro-aware
            copy pointing here instead of at the (Pro-only) real discovery
            card. */}
        <div data-tutorial="today-discovery" style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
          {PRO_FEATURES.map((f) => (
            <div key={f.title} style={{ display: "flex", gap: 12, padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: mdAccentSoft, color: mdAccentText, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>✓</span>
              <div>
                <div style={{ ...sans, fontSize: 15, fontWeight: 700, color: mdHeading }}>{f.title}</div>
                <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.55, wordBreak: "keep-all" }}>{f.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
          {PRO_PLANS.map((p) => {
            const active = p.id === selected;
            return (
              <div
                key={p.id} role="button" tabIndex={0} onClick={() => setSelected(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => setSelected(p.id))?.(); } }}
                style={{
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                  padding: "16px 18px", borderRadius: 14, backgroundColor: active ? mdAccentSoft : mdCard,
                  boxShadow: mdCardShadow, border: `1.5px solid ${active ? mdAccent : "transparent"}`,
                }}
              >
                {p.badge && (
                  <span style={{ position: "absolute", top: -9, left: 16, ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: "#fff", backgroundColor: mdAccent, padding: "3px 9px", borderRadius: 999 }}>
                    {p.badge}
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${active ? mdAccent : mdDivider}`, backgroundColor: active ? mdAccent : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {active && <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#fff" }} />}
                  </span>
                  <div>
                    <div style={{ ...sans, fontSize: 15, fontWeight: 700, color: mdHeading }}>{p.label}</div>
                    <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 3 }}>{p.billedNote}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: mdHeading }}>{p.price}</div>
                  <div style={{ ...sans, fontSize: 11, color: mdFaint }}>{p.period}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ padding: "0 22px 20px", flexShrink: 0 }}>
        <PrimaryBtn onClick={() => onContinue?.(selected)} modernist>Continue — {plan.price}{plan.period}</PrimaryBtn>
        <div style={{ ...sans, fontSize: 11, color: mdFaint, textAlign: "center", marginTop: 10 }}>Cancel anytime. No commitment.</div>
      </div>
      {activeTab && <BottomNav active={activeTab} onSelect={onNavSelect} modernist />}
    </div>
  );
}

// ── Screen 15.5 · Checkout ────────────────────────────────────────────────────
// The one place that actually calls onSubscribed (which flips store.isPro —
// see upgradeToPro in the App shell). Card fields are formatted/validated
// like a real checkout (grouped digits, MM/YY, length checks) but nothing
// here is sent anywhere or charged — see the disclosure line above the
// submit button. Swapping in Stripe/RevenueCat later means replacing this
// screen's submit handler with a real charge call and firing onSubscribed
// only from its success callback; nothing else in the app would change.
function formatCardNumber(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ");
}
function formatExpiry(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function ScreenCheckout({ plan, onBack, onSubscribed }: { plan: ProPlan; onBack?: () => void; onSubscribed?: () => void }) {
  const planInfo = PRO_PLANS.find((p) => p.id === plan)!;
  const [cardNumber, setCardNumber] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [cvc, setCvc] = React.useState("");
  const [name, setName] = React.useState("");
  const [processing, setProcessing] = React.useState(false);

  const canSubmit = cardNumber.replace(/\s/g, "").length === 16 && /^\d{2}\/\d{2}$/.test(expiry) && cvc.length >= 3 && name.trim().length > 0;

  const submit = () => {
    if (!canSubmit || processing) return;
    setProcessing(true);
    setTimeout(() => { setProcessing(false); onSubscribed?.(); }, 900);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: mdHeading, marginTop: 10 }}>Payment</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow, marginBottom: 22 }}>
          <div>
            <div style={{ ...sans, fontSize: 15, fontWeight: 700, color: mdHeading }}>Mindscape Pro — {planInfo.label}</div>
            <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 3 }}>{planInfo.billedNote}</div>
          </div>
          <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: mdHeading }}>{planInfo.price}<span style={{ fontSize: 12, fontWeight: 500, color: mdBody }}>{planInfo.period}</span></div>
        </div>

        <TextField label="Card number" value={cardNumber} onChange={(v) => setCardNumber(formatCardNumber(v))} placeholder="4242 4242 4242 4242" />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}><TextField label="Expiry" value={expiry} onChange={(v) => setExpiry(formatExpiry(v))} placeholder="MM/YY" /></div>
          <div style={{ flex: 1 }}><TextField label="CVC" value={cvc} onChange={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))} placeholder="123" /></div>
        </div>
        <TextField label="Name on card" value={name} onChange={setName} placeholder="Jane Doe" />

        <div style={{ ...sans, fontSize: 11, color: mdFaint, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
          This is a demo checkout — no real card is charged.
        </div>
      </div>
      <div style={{ padding: "0 22px 32px", flexShrink: 0 }}>
        <PrimaryBtn onClick={submit} disabled={!canSubmit || processing} modernist>{processing ? "Processing…" : `Subscribe — ${planInfo.price}${planInfo.period}`}</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Screen 15.7 · Manage subscription ─────────────────────────────────────────
// Profile's settings-list entry point once isPro is true — same armed-
// confirmation pattern ScreenDataPrivacy uses for "Delete all my data,"
// since canceling is the same kind of one-way, worth-a-pause action.
// Canceling drops back to free immediately (no real billing period to
// honor) rather than pretending to schedule an end-of-period cancellation.
function ScreenManageSubscription({ store, onBack, onCancel }: { store: Store; onBack?: () => void; onCancel?: () => void }) {
  const [armed, setArmed] = React.useState(false);
  const planInfo = PRO_PLANS.find((p) => p.id === store.proPlan) ?? PRO_PLANS[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: mdHeading, marginTop: 10 }}>Manage Subscription</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
          <div>
            <div style={{ ...sans, fontSize: 15, fontWeight: 700, color: mdHeading }}>Mindscape Pro — {planInfo.label}</div>
            <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 3 }}>{planInfo.billedNote}</div>
          </div>
          <div style={{ ...mono, fontSize: 15, fontWeight: 700, color: mdHeading }}>{planInfo.price}<span style={{ fontSize: 11, fontWeight: 500, color: mdBody }}>{planInfo.period}</span></div>
        </div>

        <div style={{ marginTop: 28 }}>
          <motion.button
            type="button" aria-pressed={armed}
            onClick={() => (armed ? onCancel?.() : setArmed(true))}
            whileTap={{ scale: 0.985 }} whileFocus={{ boxShadow: "0 0 0 3px rgba(164,74,74,.13)" }}
            style={{ ...sans, width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 12, border: `1px solid ${armed ? mdWarn : mdDivider}`, backgroundColor: armed ? mdWarnSoft : "transparent", cursor: "pointer", fontSize: 15, fontWeight: 600, color: mdWarn, WebkitTapHighlightColor: "transparent" }}
          >
            {armed ? "Are you sure? Tap again to cancel" : "Cancel subscription"}
          </motion.button>
          {armed && (
            <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all" }}>
              You'll immediately lose access to your Brain Map, hypotheses, and analysis. Your recorded entries stay right where they are.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// On a real phone, the fixed 393×852 "device mockup" frame below (rounded
// corners, drop shadow, centered on a desktop backdrop) is exactly wrong —
// it reads as a small floating box with wasted padding around it instead of
// filling the actual screen. This flips the frame to full-bleed (edge to
// edge, no chrome) whenever the viewport itself is phone-width, so the same
// component tree serves both "a nice mockup to review on desktop" and "the
// real app on someone's phone" without a separate mobile build.
function useIsMobileViewport(): boolean {
  const query = "(max-width: 480px)";
  const [isMobile, setIsMobile] = React.useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

// ── App shell ──────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = React.useState("splash");
  // ── Navigation-transition plumbing (see screenTransitions/navGestures) ──
  // transitionOverride forces the next screen change's transition kind;
  // zoomClipRef holds the Home jar's rectangle for the jar <-> Brain Map
  // zoom; contentCache keeps each screen's last element so a swipe-back can
  // show the screen underneath before it's actually navigated to.
  const transitionOverride = React.useRef<TransitionKind | null>(null);
  const zoomClipRef = React.useRef<{ jar: string; full: string } | null>(null);
  const contentCache = React.useRef(new Map<string, React.ReactNode>());
  const contentHostRef = React.useRef<HTMLDivElement>(null);
  // Measures the jar on Home, relative to the screen layer, as clip-path
  // inset() strings: where the map starts (the jar) and where it ends
  // (covering the whole viewport — the map is position:fixed, so on the
  // desktop preview it extends past the phone frame).
  const captureJarClip = (): boolean => {
    const host = contentHostRef.current;
    const jar = host?.querySelector('[data-screen="home"] [data-shared="brain-jar"]');
    if (!host || !jar) { zoomClipRef.current = null; return false; }
    const h = host.getBoundingClientRect();
    const j = jar.getBoundingClientRect();
    zoomClipRef.current = {
      jar: `inset(${j.top - h.top}px ${h.right - j.right}px ${h.bottom - j.bottom}px ${j.left - h.left}px round 28px)`,
      full: `inset(${-h.top}px ${-(window.innerWidth - h.right)}px ${-(window.innerHeight - h.bottom)}px ${-h.left}px round 0px)`,
    };
    return true;
  };
  // A tapped row hands over its rectangle; the next screen grows out of it
  // (the "grow" transition, a slower cousin of Home's orb zoom). Lapses if
  // nothing navigates.
  const openFromRow = React.useCallback((el: HTMLElement) => {
    const host = contentHostRef.current;
    if (!host) return;
    const h = host.getBoundingClientRect();
    const j = el.getBoundingClientRect();
    const clip = {
      jar: `inset(${j.top - h.top}px ${h.right - j.right}px ${h.bottom - j.bottom}px ${j.left - h.left}px round 16px)`,
      full: `inset(${-h.top}px ${-(window.innerWidth - h.right)}px ${-(window.innerHeight - h.bottom)}px ${-h.left}px round 0px)`,
    };
    zoomClipRef.current = clip;
    transitionOverride.current = "grow";
    setTimeout(() => {
      if (transitionOverride.current === "grow" && zoomClipRef.current === clip) transitionOverride.current = null;
    }, 400);
  }, []);
  const leaveBrainMap = () => {
    if (brainMapReturnTo === "home" && zoomClipRef.current) transitionOverride.current = "unzoom";
    setScreen(brainMapReturnTo);
  };
  // Fetch the 3D chunks while the quote screen is up, once the first paint
  // is done — so the opening fades aren't competing with three.js parsing.
  React.useEffect(() => {
    const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
    if (ric) ric(preload3D, { timeout: 1500 }); else setTimeout(preload3D, 600);
  }, []);
  const [hypothesisIndex, setHypothesisIndex] = React.useState(0);
  // Investigate is reachable from two places now — the legacy standalone
  // hypothesisDetail screen, and the Analysis tab's inline discovery body —
  // so its back button needs to know which one to return to.
  const [investigateReturnTo, setInvestigateReturnTo] = React.useState<"hypothesisDetail" | "discoveryAnalysis">("hypothesisDetail");
  // Same idea, for the Brain Map: it's now reachable from both Home's jar
  // and the Mind tab's constellation, and "back" needs to return wherever
  // the trip actually started instead of always landing on Home.
  const [brainMapReturnTo, setBrainMapReturnTo] = React.useState<"home" | "analysis">("home");
  const [historyEntryIndex, setHistoryEntryIndex] = React.useState(0);
  const [thinkText, setThinkText] = React.useState("");
  const [analysisError, setAnalysisError] = React.useState("");
  const [pendingUpsell, setPendingUpsell] = React.useState(false);
  // Set right before navigating to "brainmap" whenever the trip started
  // from a region-filtered entry point rather than the Brain Map card's own
  // expand button — null just opens the map unfiltered, same as always.
  // (Home no longer has a region-shortcut row — see the vintage ScreenHome
  // comment — so today this is always null coming from Home; left in place
  // for whatever else ends up wanting a filtered entry point.)
  const [brainMapInitialRegion, setBrainMapInitialRegion] = React.useState<CognitiveRegion | null>(null);
  // Same idea, for one specific belief — set when Home's node field is
  // tapped directly on one of its real nodes (see ScreenHome's
  // JarBrainPreview onSelectNode below), so the map opens already flown-in
  // and panel-open on that exact belief instead of the unfiltered overview.
  const [brainMapInitialBeliefId, setBrainMapInitialBeliefId] = React.useState<string | null>(null);
  // The one data provider: `store` is whichever dataset is currently active
  // (curated demo content, or the real on-device store — see
  // src/app/dataProvider.ts), and every screen below reads only that, with
  // no idea which one it's looking at. `realStore`/`updateRealStore` are
  // used only for the pre-home account flow, which is always real even if
  // Demo Mode happens to be on.
  const { isDemoMode, setIsDemoMode, hasSeenTutorial, setHasSeenTutorial, store, updateStore, realStore, updateRealStore, cloudUserId } = useAppData();
  // Consent is a real legal record, so it always lives on the real store —
  // even while browsing Demo Mode, typing into "Speak your mind" sends the
  // person's own words to the AI.
  const aiAllowed = hasAiConsent(realStore);
  const [aiConsentReturnTo, setAiConsentReturnTo] = React.useState("think");
  // First "Speak your mind" (or the first one after the consent wording
  // changes) goes through the consent screen; after that, straight in —
  // declining is remembered too, so nobody is re-asked on every entry.
  // The feeling from Home's check-in when "Say why" opened this entry, so the
  // writing screen can ask about it. Anything other than a string (a click
  // event, when this is passed straight to onClick) means a plain start.
  const [thinkMood, setThinkMood] = React.useState<string | null>(null);
  const startThink = (mood?: unknown) => {
    setThinkMood(typeof mood === "string" ? mood : null);
    if (needsAiConsentDecision(realStore)) {
      setAiConsentReturnTo("think");
      setScreen("aiConsent");
    } else {
      setScreen("think");
    }
  };

  // A refresh or tab-close mid-analysis silently throws away the in-flight
  // /api/analyze call (and, for a Pro entry, the thought itself — it isn't
  // saved to history until mergeAnalysisIntoStore runs in onDone below).
  // Scoped to exactly the "processing" screen: armed the moment it mounts,
  // torn down the moment the screen changes away from it for any reason
  // (a real result, an error routing to thinkComplete, or Cancel routing
  // home), so normal navigation is never blocked once analysis is settled.
  React.useEffect(() => {
    if (screen !== "processing") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [screen]);

  React.useEffect(() => {
    if (!store.settings.dailyReminder) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") Notification.requestPermission();
    const check = () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (hhmm !== store.settings.dailyReminderTime) return;
      const todayStr = formatDateDots(now);
      let lastFired = "";
      try { lastFired = localStorage.getItem(DAILY_REMINDER_LAST_FIRED_KEY) ?? ""; } catch {}
      if (lastFired === todayStr) return;
      try { localStorage.setItem(DAILY_REMINDER_LAST_FIRED_KEY, todayStr); } catch {}
      new Notification("There's a pattern in your thinking.", { body: "Take a minute to reflect on today." });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [store.settings.dailyReminder, store.settings.dailyReminderTime]);

  // Weekly-summary Notification — same plain-Notification-API, tab-must-
  // be-open mechanism as the daily reminder above, just checked on an
  // hourly cadence (a "has 7 days passed" question doesn't need minute
  // granularity) and gated to Pro: a recap of what accumulated over the
  // week is exactly the kind of cross-entry insight the free tier doesn't
  // get (see mergeAnalysisIntoStore's `accumulate` param). Skips firing
  // entirely when there's nothing to report (computeWeeklySummary returns
  // null for zero entries this week) rather than sending an empty recap.
  React.useEffect(() => {
    if (!store.settings.weeklySummary) return;
    if (!(!MONETIZATION_ENABLED || store.isPro)) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") Notification.requestPermission();

    const check = () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      let lastFiredStr = "";
      try { lastFiredStr = localStorage.getItem(WEEKLY_SUMMARY_LAST_FIRED_KEY) ?? ""; } catch { /* private mode */ }
      const lastFired = lastFiredStr ? parseDotDate(lastFiredStr) : null;
      const daysSinceLastFired = lastFired ? Math.floor((now.getTime() - lastFired.getTime()) / (1000 * 60 * 60 * 24)) : Infinity;
      if (daysSinceLastFired < 7) return;
      const summary = computeWeeklySummary(store.history);
      if (!summary) return;
      try { localStorage.setItem(WEEKLY_SUMMARY_LAST_FIRED_KEY, formatDateDots(now)); } catch { /* private mode */ }
      const body = summary.topPattern
        ? `${summary.entryCount} thought${summary.entryCount === 1 ? "" : "s"} this week, most often touching on ${summary.topPattern.toLowerCase()}.`
        : `${summary.entryCount} thought${summary.entryCount === 1 ? "" : "s"} recorded this week.`;
      new Notification("Your week in review", { body });
    };
    check();
    const interval = setInterval(check, 3600000);
    return () => clearInterval(interval);
  }, [store.settings.weeklySummary, store.isPro, store.history]);

  // New-hypothesis alert — unlike the two notifications above, this one is
  // event-driven (fires the instant an entry actually surfaces something
  // new), not polled on a timer, so there's nothing to check periodically
  // here. This effect only requests permission as soon as the setting is
  // turned on, matching the other two, so it's already granted by the time
  // the "processing" case's onDone (below) tries to fire one.
  React.useEffect(() => {
    if (!store.settings.newHypothesisAlert) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") Notification.requestPermission();
  }, [store.settings.newHypothesisAlert]);

  const goToTab = (id: string) => setScreen(id);

  // Interactive tour state — see TutorialOverlay/buildTutorialSteps above.
  // Recomputed off store.isPro so a mid-tour upgrade (unlikely, but
  // possible if someone subscribes from the tour's own paywall step) shows
  // the Pro-flavored "today-discovery" copy from that point on instead of
  // the free one. frameRef lets the overlay measure real targets relative
  // to the phone frame; the effect below is the single place that decides
  // "we've arrived at a nav step's destination," whether that arrival came
  // from the real nav-bar tap passing through the spotlight or from the
  // tooltip's own button calling the identical setScreen.
  const TUTORIAL_STEPS = React.useMemo(
    () => buildTutorialSteps(!MONETIZATION_ENABLED || store.isPro),
    [store.isPro]
  );
  const [tutorialActive, setTutorialActive] = React.useState(false);
  const [tutorialStep, setTutorialStep] = React.useState(0);
  const frameRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!tutorialActive) return;
    const step = TUTORIAL_STEPS[tutorialStep];
    if (step?.navTo && screen === step.navTo) {
      setTutorialStep((s) => s + 1);
    }
  }, [screen, tutorialActive, tutorialStep]);
  // The single trigger for "should the tour start now" — arriving at Home
  // at all, for any reason (guest/signup onboarding, but also a returning
  // user logging into an existing account, which skips onboarding
  // entirely and used to skip the tour with it). Wiring this only into
  // onboarding's onDone meant anyone who already had an account never saw
  // it. Fires at most once per browser: hasSeenTutorial flips true the
  // moment the tour starts, and this effect's own condition then never
  // matches again.
  React.useEffect(() => {
    if (screen === "home" && !hasSeenTutorial && !tutorialActive) {
      setTutorialStep(0);
      setTutorialActive(true);
    }
  }, [screen, hasSeenTutorial, tutorialActive]);
  const finishTutorial = () => { setTutorialActive(false); setHasSeenTutorial(true); };
  const advanceTutorial = () => {
    const step = TUTORIAL_STEPS[tutorialStep];
    if (step?.navTo) { setScreen(step.navTo); return; }
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) { finishTutorial(); return; }
    setTutorialStep((s) => s + 1);
  };

  // Shared by both the legacy hypothesisDetail screen and the Analysis
  // tab's inline discovery body, so agree/disagree behaves identically no
  // matter which one the user reached it through.
  const agreeToHypothesis = (index: number) => {
    updateStore((prev) => ({
      ...prev,
      hypotheses: prev.hypotheses.map((h, i) => (i === index ? { ...h, reaction: "agree" as const } : h)),
    }));
  };
  const rejectBelief = (beliefId: string) => {
    updateStore((prev) => ({
      ...prev,
      beliefs: prev.beliefs.map((b) => (b.id === beliefId ? { ...b, userReaction: "rejected" as const } : b)),
    }));
  };
  // Mocked upgrade — no real billing wired up yet, just flips the flag that
  // gates analysis/belief-map/hypotheses/drift (see the "isPro" case guards
  // in the screen switch below), called only from ScreenCheckout's
  // onSubscribed once its (also mocked) card form validates. Real payment
  // processing (App Store/Play Store IAP or a web checkout) would replace
  // that one call site with a purchase-success callback; nothing else in
  // the app would need to change.
  const upgradeToPro = (plan: ProPlan) => {
    updateStore((prev) => ({ ...prev, isPro: true, proPlan: plan }));
  };
  const cancelPro = () => {
    updateStore((prev) => ({ ...prev, isPro: false, proPlan: undefined }));
  };
  // Where checkout (and the paywall itself, when reached as its own "paywall"
  // route rather than inline-gated) returns to on cancel/back or a
  // successful subscribe. Set right before navigating into that flow —
  // see each onContinue/onOpenPaywall/onUpgrade call site below.
  const [paywallReturnTo, setPaywallReturnTo] = React.useState("home");
  const [checkoutPlan, setCheckoutPlan] = React.useState<ProPlan>("yearly");
  // aspirationSetup is reachable from both ScreenDrift ("Mind" tab) and
  // ScreenJourneyMap (Profile) now — this is which one "Save"/back should
  // land on, set right before navigating in from either entry point.
  const [aspirationReturnTo, setAspirationReturnTo] = React.useState("drift");
  // Distinct from rejectBelief above: reacting to a belief as "Today's
  // Discovery" never hides it from "Unconscious Patterns" — only the dedicated reject
  // link there does that.
  const agreeToBeliefDiscovery = (beliefId: string) => {
    updateStore((prev) => ({
      ...prev,
      beliefs: prev.beliefs.map((b) => (b.id === beliefId ? { ...b, discoveryReaction: "agree" as const } : b)),
    }));
  };

  // Disagreeing with a discovery no longer just records a reason — it asks
  // the model for a genuinely different reading of the same evidence and
  // loops (see /api/reinterpret in vite.config.ts). reinterpretingKey scopes
  // the in-flight request to exactly one hypothesis/belief so two discovery
  // surfaces can never race each other.
  const [reinterpretingKey, setReinterpretingKey] = React.useState<string | null>(null);

  async function requestReinterpretation(currentText: string, evidenceQuotes: string[], rejectedTexts: string[]) {
    if (!aiAllowed) throw new Error("AI analysis is turned off. You can turn it on in Profile → Data & Privacy.");
    const res = await fetch("/api/reinterpret", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentText, evidenceQuotes, rejectedTexts }),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error || "Couldn't get another interpretation.");
    return data as { interpretation: string | null; confidence: number | null; exhausted: boolean; note?: string };
  }

  const disagreeWithHypothesis = async (index: number) => {
    const key = `hyp:${index}`;
    if (reinterpretingKey) return;
    const h = store.hypotheses[index];
    if (!h) return;
    setReinterpretingKey(key);
    try {
      const quotes = evidenceForHypothesis(h, store.beliefs).map((e) => e.quote);
      const result = await requestReinterpretation(h.title, quotes, h.rejectedTitles ?? []);
      updateStore((prev) => ({
        ...prev,
        hypotheses: prev.hypotheses.map((x, i) => {
          if (i !== index) return x;
          if (result.exhausted || !result.interpretation) {
            return { ...x, reaction: "disagree" as const, exhausted: true };
          }
          return {
            ...x,
            title: result.interpretation as string,
            confidence: typeof result.confidence === "number" ? result.confidence : x.confidence,
            rejectedTitles: [...(x.rejectedTitles ?? []), x.title],
            reaction: null,
          };
        }),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setReinterpretingKey(null);
    }
  };

  const disagreeWithBeliefDiscovery = async (beliefId: string) => {
    const key = `belief:${beliefId}`;
    if (reinterpretingKey) return;
    const b = store.beliefs.find((x) => x.id === beliefId);
    if (!b) return;
    setReinterpretingKey(key);
    try {
      const currentText = b.discoveryInterpretationOverride ?? b.statement;
      const quotes = b.evidenceQuotes.map((q) => q.quote);
      const result = await requestReinterpretation(currentText, quotes, b.rejectedStatements ?? []);
      updateStore((prev) => ({
        ...prev,
        beliefs: prev.beliefs.map((x) => {
          if (x.id !== beliefId) return x;
          if (result.exhausted || !result.interpretation) {
            return { ...x, discoveryReaction: "disagree" as const, discoveryExhausted: true };
          }
          const previousText = x.discoveryInterpretationOverride ?? x.statement;
          return {
            ...x,
            discoveryInterpretationOverride: result.interpretation as string,
            rejectedStatements: [...(x.rejectedStatements ?? []), previousText],
            discoveryReaction: null,
          };
        }),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setReinterpretingKey(null);
    }
  };

  let content: React.ReactNode = null;
  switch (screen) {
    case "quote": content = <ScreenQuoteOfTheDay onDone={() => setScreen("auth")} />; break;
    case "splash": content = <ScreenSplash onDone={() => setScreen("quote")} />; break;
    case "auth": content = <ScreenAuth onEmailStart={() => setScreen(realStore.account ? "login" : "signup")} onGuest={() => setScreen("onboarding")} />; break;
    case "login": content = (
      <ScreenLogin
        account={realStore.account}
        onBack={() => setScreen("auth")}
        onGoSignup={() => setScreen("signup")}
        onLogin={(upgradedPasswordHash) => {
          if (upgradedPasswordHash) {
            updateRealStore((prev) => (prev.account ? { ...prev, account: { ...prev.account, password: upgradedPasswordHash } } : prev));
          }
          setScreen("home");
        }}
      />
    ); break;
    case "signup": content = (
      <ScreenSignup
        onBack={() => setScreen("auth")}
        onGoLogin={() => setScreen("login")}
        onSignup={(account) => {
          updateRealStore((prev) => ({ ...prev, account }));
          setScreen("onboarding");
        }}
      />
    ); break;
    case "onboarding": content = (
      <ScreenOnboarding
        initialAspiration={realStore.aspiration}
        onDone={(aspiration) => {
          if (aspiration && aspiration !== realStore.aspiration) {
            updateRealStore((prev) => ({ ...prev, aspiration, aspirationSetDate: formatDateDots(new Date()) }));
          }
          // Starting the tour itself is handled by the "arrived at Home"
          // effect above, not here — this used to be the only trigger,
          // which meant a returning user logging into an existing account
          // (skipping onboarding entirely) never saw it.
          setScreen("home");
        }}
      />
    ); break;
    case "home": content = (
      <ScreenHome
        onNavSelect={goToTab}
        onStartThink={startThink}
        onOpenBrainMap={(region, beliefId) => { setBrainMapInitialRegion(region ?? null); setBrainMapInitialBeliefId(beliefId ?? null); setBrainMapReturnTo("home"); if (captureJarClip()) transitionOverride.current = "zoom"; setScreen("brainmap"); }}
        store={store}
        updateStore={updateStore}
      />
    ); break;
    case "brainmap": content = (!MONETIZATION_ENABLED || store.isPro) ? (
      <React.Suspense fallback={<div style={{ flex: 1, backgroundColor: "#ffffff" }} />}>
        <BrainNodeMapScreen beliefs={store.beliefs} connections={store.connections} onBack={leaveBrainMap} modernist initialActiveRegion={brainMapInitialRegion} initialSelectedBeliefId={brainMapInitialBeliefId} />
      </React.Suspense>
    ) : (
      <ScreenPaywall onBack={() => setScreen(brainMapReturnTo)} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("brainmap"); setScreen("checkout"); }} />
    ); break;
    case "analysis": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall
        onBack={() => setScreen("home")}
        onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("analysis"); setScreen("checkout"); }}
        activeTab="analysis"
        onNavSelect={goToTab}
      />
    ) : (
      <ScreenAnalysis
        onNavSelect={goToTab}
        onOpenArtifact={(id) => setScreen(id)}
        onOpenBrainMap={(region) => { setBrainMapInitialRegion(region ?? null); setBrainMapInitialBeliefId(null); setBrainMapReturnTo("analysis"); setScreen("brainmap"); }}
        store={store}
      />
    ); break;
    case "discoveryAnalysis": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall
        onBack={() => setScreen("home")}
        onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("discoveryAnalysis"); setScreen("checkout"); }}
        activeTab="discoveryAnalysis"
        onNavSelect={goToTab}
      />
    ) : (
      <ScreenDiscoveryAnalysis
        onNavSelect={goToTab}
        store={store}
        updateStore={updateStore}
        onAgreeHypothesis={agreeToHypothesis}
        onDisagreeHypothesis={disagreeWithHypothesis}
        onInvestigateHypothesis={(index) => {
          setHypothesisIndex(index);
          setInvestigateReturnTo("discoveryAnalysis");
          setScreen("investigate");
        }}
        onAgreeBeliefDiscovery={agreeToBeliefDiscovery}
        onDisagreeBeliefDiscovery={disagreeWithBeliefDiscovery}
        reinterpretingKey={reinterpretingKey}
      />
    ); break;
    case "think": content = (
      <ScreenThink
        mood={thinkMood}
        onBack={() => setScreen("home")}
        onDone={(text) => {
          setThinkText(text);
          setAnalysisError("");
          // Checked before anything else, regardless of tier — a crisis-
          // flagged entry never reaches /api/analyze or the belief/
          // hypothesis pipeline. The entry is still saved (see
          // appendUnanalyzedEntry below) — this is about where it routes
          // to next, not about withholding what was written. See
          // crisisDetection.ts for why this is the one exception to
          // "observe, don't judge."
          if (detectCrisisSignal(text)) {
            updateStore((prev) => appendUnanalyzedEntry(prev, text));
            setScreen("crisisSupport");
          } else if (!aiAllowed) {
            // No consent → the entry is kept on-device only and never sent
            // to /api/analyze. ScreenThinkComplete's no-error state ("added
            // to your record") is exactly the right message for this.
            updateStore((prev) => appendUnanalyzedEntry(prev, text));
            setScreen("thinkComplete");
          } else {
            // Every tier gets a one-entry analysis. Premium controls whether
            // that entry is allowed to accumulate into the longitudinal
            // belief/hypothesis/connection network once the result returns.
            setScreen("processing");
          }
        }}
      />
    ); break;
    case "processing": content = (
      <ScreenProcessing
        text={thinkText}
        matchableBeliefs={matchableCandidates(store).beliefs}
        matchablePending={matchableCandidates(store).pending}
        priorAssumptions={store.assumptions}
        priorConnections={store.connections.map((c) => ({
          aStatement: store.beliefs.find((b) => b.id === c.a)?.statement ?? "",
          bStatement: store.beliefs.find((b) => b.id === c.b)?.statement ?? "",
          note: c.note,
        }))}
        aspiration={store.aspiration}
        name={store.account?.name}
        recentMoods={recentMoodContext(store.history)}
        onDone={(result, sessionSummary) => {
          if (result) {
            const accumulate = !MONETIZATION_ENABLED || store.isPro;
            const isUpsellMoment = !accumulate && store.entryCount + 1 === UPSELL_PROMPT_AT_ENTRY_COUNT && !store.hasSeenUpgradePrompt;
            const merged = mergeAnalysisIntoStore(store, result, thinkText, sessionSummary, accumulate);
            if (store.settings.newHypothesisAlert && typeof Notification !== "undefined" && Notification.permission === "granted") {
              const foundNewPattern = merged.beliefs.length > store.beliefs.length || merged.hypotheses.length > store.hypotheses.length;
              if (foundNewPattern) new Notification("A new pattern showed up", { body: "Take a look at what your recent thoughts have in common." });
            }
            updateStore(() => (isUpsellMoment ? { ...merged, hasSeenUpgradePrompt: true } : merged));
            setPendingUpsell(isUpsellMoment);
            setScreen("sessionSummary");
          } else {
            setScreen("thinkComplete");
          }
        }}
        onError={(msg) => { setAnalysisError(msg); setScreen("thinkComplete"); }}
        onCancel={() => setScreen("home")}
      />
    ); break;
    case "sessionSummary": content = <ScreenSessionSummary store={store} onDone={() => {
      if (!MONETIZATION_ENABLED || store.isPro) setScreen("discoveryAnalysis");
      else if (pendingUpsell) setScreen("softPaywall");
      else setScreen("home");
    }} />; break;
    case "aiConsent": content = (
      <ScreenAiConsent
        current={realStore.aiConsent ?? null}
        onBack={() => setScreen(aiConsentReturnTo === "think" ? "home" : aiConsentReturnTo)}
        onDecide={(granted) => {
          updateRealStore((prev) => ({
            ...prev,
            aiConsent: { sensitive: granted, overseas: granted, decidedAt: new Date().toISOString(), version: AI_CONSENT_VERSION },
          }));
          setScreen(aiConsentReturnTo);
        }}
      />
    ); break;
    case "thinkComplete": content = (
      <ScreenThinkComplete
        error={analysisError}
        showUpsell={MONETIZATION_ENABLED && !store.isPro && !analysisError}
        onDone={() => setScreen("home")}
        onUpgrade={() => { setPaywallReturnTo("home"); setScreen("paywall"); }}
      />
    ); break;
    case "softPaywall": content = (
      <ScreenSoftPaywall
        onSeePlans={() => { setPaywallReturnTo("home"); setScreen("paywall"); }}
        onDismiss={() => setScreen("home")}
      />
    ); break;
    case "crisisSupport": content = <ScreenCrisisSupport onContinue={() => setScreen("home")} />; break;
    case "beliefs": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("beliefs"); setScreen("checkout"); }} />
    ) : (
      <ScreenBeliefMap onBack={() => setScreen("analysis")} store={store} onRejectBelief={rejectBelief} />
    ); break;
    case "assumptions": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("assumptions"); setScreen("checkout"); }} />
    ) : (
      <ScreenBeliefMap onBack={() => setScreen("home")} store={store} />
    ); break;
    case "drift": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("drift"); setScreen("checkout"); }} />
    ) : (
      <ScreenDrift onBack={() => setScreen("analysis")} store={store} onSetupAspiration={() => { setAspirationReturnTo("drift"); setScreen("aspirationSetup"); }} />
    ); break;
    case "journeyMap": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("journeyMap"); setScreen("checkout"); }} />
    ) : (
      <ScreenJourneyMap onBack={() => setScreen("profile")} store={store} onSetupAspiration={() => { setAspirationReturnTo("journeyMap"); setScreen("aspirationSetup"); }} />
    ); break;
    case "aspirationSetup": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("aspirationSetup"); setScreen("checkout"); }} />
    ) : (
      <ScreenAspirationSetup
        initialValue={store.aspiration}
        onBack={() => setScreen(aspirationReturnTo)}
        onSave={(value) => {
          updateStore((prev) => ({ ...prev, aspiration: value, aspirationSetDate: formatDateDots(new Date()) }));
          setScreen(aspirationReturnTo);
        }}
      />
    ); break;
    case "hypotheses": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("hypotheses"); setScreen("checkout"); }} />
    ) : (
      <ScreenHypotheses onBack={() => setScreen("home")} store={store} onOpen={(i) => { setHypothesisIndex(i); setScreen("hypothesisDetail"); }} />
    ); break;
    case "hypothesisDetail": content = MONETIZATION_ENABLED && !store.isPro ? (
      <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("hypothesisDetail"); setScreen("checkout"); }} />
    ) : (
      <ScreenHypothesisDetail
        index={hypothesisIndex}
        store={store}
        onBack={() => setScreen("hypotheses")}
        onInvestigate={() => {
          setInvestigateReturnTo("hypothesisDetail");
          setScreen("investigate");
        }}
        onAgree={() => agreeToHypothesis(hypothesisIndex)}
        onDisagree={() => disagreeWithHypothesis(hypothesisIndex)}
        reinterpreting={reinterpretingKey === `hyp:${hypothesisIndex}`}
      />
    ); break;
    case "investigate": {
      if (MONETIZATION_ENABLED && !store.isPro) {
        content = <ScreenPaywall onBack={() => setScreen("home")} onContinue={(plan) => { setCheckoutPlan(plan); setPaywallReturnTo("investigate"); setScreen("checkout"); }} />;
        break;
      }
      const investigatedHypothesis = store.hypotheses[hypothesisIndex] ?? store.hypotheses[0];
      content = investigatedHypothesis?.investigate ? (
        <ScreenInvestigate investigate={investigatedHypothesis.investigate} onBack={() => setScreen(investigateReturnTo)} />
      ) : (
        <ScreenHypotheses onBack={() => setScreen("home")} store={store} onOpen={(i) => { setHypothesisIndex(i); setScreen("hypothesisDetail"); }} />
      );
      break;
    }
    case "history": content = (
      <ScreenHistory
        onNavSelect={goToTab}
        store={store}
        onOpenEntry={(i) => { setHistoryEntryIndex(i); setScreen("historyDetail"); }}
      />
    ); break;
    case "historyDetail": content = <ScreenHistoryDetail index={historyEntryIndex} store={store} onBack={() => setScreen("history")} />; break;
    case "profile": content = (
      <ScreenProfile
        onBack={() => goToTab("home")}
        onNavSelect={goToTab}
        store={store}
        updateStore={updateStore}
        isDemoMode={isDemoMode}
        onToggleDemoMode={setIsDemoMode}
        onOpenSettings={(s) => setScreen(s === "notifications" ? "notifications" : s === "dataPrivacy" ? "dataPrivacy" : "help")}
        onOpenPaywall={() => { setPaywallReturnTo("profile"); setScreen("paywall"); }}
        onOpenManageSubscription={() => setScreen("manageSubscription")}
        onOpenJourneyMap={() => setScreen("journeyMap")}
      />
    ); break;
    case "paywall": content = (
      <ScreenPaywall
        onBack={() => setScreen(paywallReturnTo)}
        onContinue={(plan) => { setCheckoutPlan(plan); setScreen("checkout"); }}
      />
    ); break;
    case "checkout": content = (
      <ScreenCheckout
        plan={checkoutPlan}
        onBack={() => setScreen(paywallReturnTo)}
        onSubscribed={() => { upgradeToPro(checkoutPlan); setScreen(paywallReturnTo); }}
      />
    ); break;
    case "manageSubscription": content = (
      <ScreenManageSubscription
        store={store}
        onBack={() => setScreen("profile")}
        onCancel={() => { cancelPro(); setScreen("profile"); }}
      />
    ); break;
    case "notifications": content = (
      <ScreenNotificationSettings
        settings={store.settings}
        onBack={() => setScreen("profile")}
        onChange={(settings) => updateStore((prev) => ({ ...prev, settings }))}
      />
    ); break;
    case "dataPrivacy": content = (
      <ScreenDataPrivacy
        store={store}
        onBack={() => setScreen("profile")}
        onResetData={() => {
          updateStore(() => emptyStore());
          setScreen("profile");
        }}
        onOpenPrivacyPolicy={() => setScreen("privacyPolicy")}
        onOpenTermsOfService={() => setScreen("termsOfService")}
        aiConsentOn={aiAllowed}
        onOpenAiConsent={() => { setAiConsentReturnTo("dataPrivacy"); setScreen("aiConsent"); }}
        onDeleteAccount={
          isCloudSyncConfigured && cloudUserId && !isDemoMode
            ? async () => {
                // Server-side delete first: if it fails, nothing local is
                // touched and the screen shows the error. Only once the
                // account is really gone is the local copy cleared too.
                // (updateRealStore may still try one push with the old
                // user id before onAuthStateChange clears it — that push is
                // rejected by the FK/RLS and only logged; see cloudSync.ts.)
                await cloudDeleteAccount();
                updateRealStore(() => emptyStore());
                setScreen("auth");
              }
            : undefined
        }
      />
    ); break;
    case "privacyPolicy": content = (
      <ScreenLegalDocument
        title="Privacy Policy"
        lastUpdated="November 5, 2026"
        sections={PRIVACY_POLICY_SECTIONS}
        fullVersion="privacy"
        onBack={() => setScreen("dataPrivacy")}
      />
    ); break;
    case "termsOfService": content = (
      <ScreenLegalDocument
        title="Terms of Service"
        lastUpdated="November 5, 2026"
        sections={TERMS_OF_SERVICE_SECTIONS}
        fullVersion="terms"
        onBack={() => setScreen("dataPrivacy")}
      />
    ); break;
    case "help": content = <ScreenHelp onBack={() => setScreen("profile")} onReplayTutorial={() => { setTutorialStep(0); setTutorialActive(true); setScreen("home"); }} />; break;
    default: content = <ScreenHome onNavSelect={goToTab} onStartThink={startThink} onOpenBrainMap={(region, beliefId) => { setBrainMapInitialRegion(region ?? null); setBrainMapInitialBeliefId(beliefId ?? null); setBrainMapReturnTo("home"); if (captureJarClip()) transitionOverride.current = "zoom"; setScreen("brainmap"); }} store={store} updateStore={updateStore} />;
  }
  content = <AiConsentContext.Provider value={aiAllowed}>{content}</AiConsentContext.Provider>;
  contentCache.current.set(screen, content);

  const isMobileViewport = useIsMobileViewport();
  const reduceMotion = useReducedMotion();
  // See screenTransitions.ts — every route change keeps one opaque layer on
  // screen, and the direction (deeper / back / tab) is read from a visit stack.
  const { kind: transitionKind, below: screenBelow } = useScreenTransitionKind(screen, transitionOverride);
  const transitionCustom: TransitionCustom = { kind: transitionKind, reduce: !!reduceMotion, clip: zoomClipRef.current ?? undefined };
  // Edge swipe-back + scroll memory (navGestures.ts). The swipe drives the
  // current screen's own inner layer by finger, then presses that screen's
  // real back button, so the regular "back" transition finishes the move.
  const swipeEnabled = canSwipeBack(screen) && !tutorialActive;
  // While a swipe is in progress, the screen it will return to is drawn
  // underneath (from its last rendered element) with iOS-style parallax and
  // a fading dim, instead of the bare frame showing through.
  const [peekOpen, setPeekOpen] = React.useState(false);
  React.useEffect(() => { setPeekOpen(false); }, [screen]);
  const { dragX, edgeHandlers } = useSwipeBack(screen, {
    enabled: swipeEnabled,
    onActiveChange: setPeekOpen,
    getLayer: () => contentHostRef.current?.querySelector(`[data-screen="${screen}"]`) ?? null,
    getWidth: () => contentHostRef.current?.clientWidth ?? 393,
  });
  const dragShadow = useTransform(dragX, [0, 80], ["0px 0px 0px rgba(0,0,0,0)", "-10px 0px 28px rgba(0,0,0,0.16)"]);
  const peekProgress = (v: number) => 1 - Math.min(1, v / (contentHostRef.current?.clientWidth || 393));
  const peekX = useTransform(dragX, (v) => `${-8 * peekProgress(v)}%`);
  const peekDim = useTransform(dragX, (v) => 0.12 * peekProgress(v));
  const peekContent = peekOpen && screenBelow ? contentCache.current.get(screenBelow) : undefined;
  useScrollMemory(contentHostRef, screen, transitionKind);
  // The fake "9:41 + battery" status bar is mockup chrome for the desktop
  // preview — a real phone already has its own real status bar, so showing
  // ours too would just be a second, wrong clock sitting under the actual
  // one. Safe-area padding (below) takes over its job of clearing the
  // notch on mobile instead.
  const showStatusBar = !["quote", "splash"].includes(screen) && !isMobileViewport;
  // Screens ported from the Modernist (light/red) design import — every
  // other screen keeps the dark theme, see the dk*/md* token comments.
  //
  // This flag also picks the color of the frame's own fallback layer and
  // the fake status bar's text (see below) — so it needs to match each
  // screen's OWN background, not just its design lineage, or the fallback
  // shows as a wrong-colored strip whenever a screen's status-bar-clearance
  // padding is visible (every screen not using the "top:-30 bleed" trick).
  // quote/splash/auth/login/signup/onboarding now render on the ivory
  // canvas too (OPENING_BG/TEXT/MUTED alias the iv* tokens — see above),
  // so they need the light fallback/status-bar text just like every other
  // ivory screen, not the old dark-on-dark treatment this list used to
  // carve them out for.
  // assumptions/paywall/checkout/manageSubscription/privacyPolicy/
  // termsOfService all render mdBg (ScreenBeliefMap/ScreenPaywall/
  // ScreenCheckout/ScreenManageSubscription/ScreenLegalDocument) but were
  // missing from this list entirely, defaulting them to the dark fallback.
  // brainmap is left as-is: it breaks out of this
  // shared frame/status-bar system entirely (its own fixed-position,
  // full-viewport UI with no shared chrome), so this flag never reaches it.
  const isModernistScreen = [
    "home", "brainmap", "analysis", "discoveryAnalysis", "history", "profile",
    "beliefs", "assumptions", "drift", "journeyMap", "aspirationSetup", "hypotheses", "hypothesisDetail", "investigate",
    "paywall", "checkout", "manageSubscription", "privacyPolicy", "termsOfService",
    "quote", "splash", "auth", "login", "signup", "onboarding",
    "notifications", "dataPrivacy", "help",
  ].includes(screen);

  // Think is the app's one self-disclosure moment — the disinhibition-theory
  // note this roadmap draws from asks for the whole frame to read as a
  // slightly more private space while it's open: a faint dimming (not just
  // ScreenThink's own already-dark background) plus a distinct threshold
  // motion on the way in and out, instead of the plain fade every other
  // screen uses.
  const isThink = screen === "think";

  return (
    <MotionConfig reducedMotion="user">
    <OpenFromContext.Provider value={openFromRow}>
    <div style={{ minHeight: "100dvh", backgroundColor: "#EDEAE4", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobileViewport ? 0 : 20 }}>
      <div
        ref={frameRef}
        className={isModernistScreen ? "theme-modernist" : undefined}
        style={{
          width: isMobileViewport ? "100%" : 393,
          height: isMobileViewport ? "100dvh" : 852,
          borderRadius: isMobileViewport ? 0 : 40,
          overflow: "hidden",
          boxShadow: isMobileViewport ? "none" : "0 20px 60px rgba(0,0,0,0.25)",
          backgroundColor: dkBg,
          display: "flex", flexDirection: "column", position: "relative",
          // Clears the real notch/Dynamic Island whenever the fake status
          // bar isn't the one doing that job (mobile, or the status-bar-
          // less splash screen) — a no-op (0px) anywhere without a real
          // safe area, so it's always safe to include. When the fake bar
          // IS doing that job (desktop preview), this stays the same fixed
          // value for every screen — switching it per screen (e.g. 0 for
          // Home, 30 elsewhere) made the whole frame visibly jump on every
          // screen change, since AnimatePresence crossfades the *content*
          // but this padding lives on the frame itself, outside that
          // animation, so it was snapping instantly. Home still runs its
          // photo edge-to-edge behind the transparent overlay — it just
          // does that itself now (a negative margin on its own hero, see
          // ScreenHome) instead of asking the shared frame to change shape
          // under it.
          paddingTop: showStatusBar ? 30 : "env(safe-area-inset-top)",
        }}
      >
        {/* Animated fallback behind every screen. Screen-specific photos and
        surfaces still paint themselves above this; this layer only prevents
        a hard mdBg/dkBg color snap from showing through during a crossfade. */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ backgroundColor: isModernistScreen ? mdBg : dkBg }}
          transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
          style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}
        />
        <div ref={contentHostRef} style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 1 }}>
          {peekContent && (
            <motion.div
              aria-hidden
              {...({ inert: "" } as any)}
              style={{ position: "absolute", inset: 0, zIndex: 0, display: "flex", flexDirection: "column", pointerEvents: "none", x: peekX }}
            >
              <PeekContext.Provider value={true}>{peekContent}</PeekContext.Provider>
              <motion.div style={{ position: "absolute", inset: 0, backgroundColor: "#000", opacity: peekDim }} />
            </motion.div>
          )}
          <AnimatePresence initial={false} custom={transitionCustom}>
            <motion.div
              key={screen}
              data-screen={screen}
              custom={transitionCustom}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}
            >
              <motion.div style={{ x: dragX, boxShadow: dragShadow, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
                {content}
              </motion.div>
            </motion.div>
          </AnimatePresence>
          {swipeEnabled && (
            <div aria-hidden {...edgeHandlers} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, zIndex: 5, touchAction: "none" }} />
          )}
        </div>

        {/* Genuinely transparent now — an absolute overlay drawn on top of
        the real screen content instead of a flex row that used to reserve
        its own strip of the frame's flat mdBg/dkBg fallback color behind
        it. That fallback color rarely matched whatever screen was actually
        showing (Home's photo especially), which is what read as a visibly
        cut-off band sitting on top of the screen. Non-interactive so it
        never blocks a tap at the very top of whatever's under it. */}
        {showStatusBar && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, pointerEvents: "none" }}>
            <StatusBar modernist={isModernistScreen} />
          </div>
        )}

        {/* Session dimming — a faint scrim over the whole frame (status bar
        included), not just ScreenThink's own dark background, so opening
        the session reads as the room's lights dropping a notch. ~12% black,
        within the note's 10-15% range. */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: isThink ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.24, ease: "easeOut" }}
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.12)", pointerEvents: "none", zIndex: 40 }}
        />

        {tutorialActive && TUTORIAL_STEPS[tutorialStep] && (
          <TutorialOverlay
            step={TUTORIAL_STEPS[tutorialStep]}
            stepIndex={tutorialStep}
            totalSteps={TUTORIAL_STEPS.length}
            frameRef={frameRef}
            screen={screen}
            onNext={advanceTutorial}
            onSkip={finishTutorial}
          />
        )}
      </div>
    </div>
    </OpenFromContext.Provider>
    </MotionConfig>
  );
}
