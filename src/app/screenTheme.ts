import React from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
// A quiet, editorial palette — this app's job is to reveal patterns calmly,
// not to alarm or entertain. Warm paper background, plum as the single
// "insight" accent color (used only for AI-surfaced observations, nowhere
// else), so its appearance always means "the AI noticed something."
export const ink = "#1C1B1F";
const inkSoft = "#403E45";
export const mid = "#6E6B74";
export const subtle = "#706c78"; // 4.5:1 on surface
const faint = "#C4C1C9";
export const hair = "rgba(28,27,31,0.09)";
const surface = "#F4F1EC";
const page = "#FFFFFF";
export const accent = "#5B4B8A";
export const accentSoft = "#F0EDF8";
export const tension = "#B5533C";
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
export const dkBg = "#0a0716";
export const dkCard = "#14101f";
export const dkCardBorder = "rgba(150,120,255,0.10)";
const dkCardShadow = "0 8px 24px rgba(0,0,0,0.35)";
export const dkHeading = "#F2EEFA";
export const dkBody = "#8b83a3";
export const dkBodyLight = "#E8E3F5";
export const dkAccent = "#7B5CF0";
export const dkAccentLight = "#B39CFF";
export const dkAccentSoft = "rgba(123,92,240,0.14)";
const dkAccentTag = "rgba(123,92,240,0.22)";
const dkAccentTagText = "#D6C8FF";
export const dkTrack = "#241c38";
export const dkWarn = "#D98A4A";
const dkWarnSoft = "rgba(224,138,74,0.14)";
const dkWarnTag = "rgba(224,138,74,0.22)";
const dkWarnTagText = "#F0B78A";
const dkWarnLabel = "#b9682f"; // 4.5:1 on dkCard
export const dkDivider = "rgba(150,120,255,0.14)";
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
export const mdBg = "#f3f2f2";
export const mdCard = "#ffffff";
export const mdCardShadow = "0 1px 2px rgba(45,43,43,0.14)";
const mdCardShadowLg = "0 12px 32px rgba(45,43,43,0.22)";
export const mdHeading = "#201e1d";
export const mdBody = "rgba(32,30,29,0.62)";
export const mdBodyLight = "rgba(32,30,29,0.85)";
export const mdFaint = "rgba(32,30,29,0.48)"; // 3:1 on mdBg — large text and UI only
export const mdAccent = "#ec3013";
const mdAccentHover = "#dd2b0f";
export const mdAccentText = "#ae1800"; // deep ramp step — the design system's own rule for accent-colored body/paragraph text (the accent itself is only 3:1 against this ground, not enough for small text)
export const mdAccentSoft = "#fff2ef";
const mdAccentTag = "#ffe0d9";
const mdAccentTagText = "#7c1405";
export const mdTrack = "#d7d3d3";
export const mdDivider = "rgba(32,30,29,0.14)";
export const mdNeutralTag = "#f8f4f4";
export const mdNeutralTagText = "#444141";
// Warn ramp — a distinct muted amber (not the red accent) for "conflicting
// evidence"/caution states, same relationship dkWarn has to dkAccent in the
// dark theme: a second, clearly different hue reserved for that one job,
// never competing with the mono-red accent everywhere else.
export const mdWarn = "#a85a1a";
export const mdWarnSoft = "rgba(168,90,26,0.10)";
export const mdWarnTag = "rgba(168,90,26,0.14)";
// The Analysis tab's paper-and-desk redesign — ink colors for text that
// sits directly on the physical paper assets (discovery-paper/insight-card),
// deliberately warm brown rather than mdHeading's neutral near-black so it
// reads as actually written on old paper. mdAccentText (already the
// design system's own toned-down red ramp step, not the bright mdAccent)
// is reused as-is for the one restrained red accent this screen keeps.
const paperInk = "#2e2013";
const paperInkMuted = "rgba(46,32,19,0.68)";
const paperAccent = mdAccentText;
export const mdWarnTagText = "#7a4310";
export const mdWarnLabel = "#7a4310";

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
export const ivBg2 = "#F2EEE6";
// Used to be a three-layer radial/linear gradient wash — the single most
// common tell of a generated page (a soft gradient ground behind every
// screen). One flat tone reads as decided; a gradient reads as a default
// nobody chose.
// Diary paper: a fine grain (fractal noise, tiled) and a faint warm
// darkening toward the edges, the way a page catches less light near its
// margins. Both are a few percent strong — felt more than seen.
const PAPER_GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.28 0 0 0 0 0.2 0 0 0 0.09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")";
export const ivBackground: React.CSSProperties = {
  backgroundColor: ivBg2,
  backgroundImage: `${PAPER_GRAIN}, radial-gradient(ellipse 120% 90% at 50% 40%, rgba(255,252,245,0.55) 0%, rgba(255,252,245,0) 60%, rgba(160,130,90,0.10) 100%)`,
  backgroundSize: "180px 180px, 100% 100%",
};
const ivSurface = "rgba(255,253,248,0.66)"; // restrained translucent card fill over the ivory base
export const ivSurfaceSolid = "#FBF8F2"; // for a card that needs to sit fully opaque above dense content
// Used to be a soft 28px/10%-opacity drop shadow on every resting card —
// another generated-page tell (shadows belong to things that float: a
// menu, a dialog, not a card sitting flush on the page). A zero-blur,
// zero-offset box-shadow reads as a crisp hairline border instead, without
// touching any of this token's ~15 call sites or their box layout.
export const ivCardShadow = "0 0 0 1px rgba(42,38,33,0.08)";
// Material 3 shape scale (dp): small controls 12, cards 16, containers 20,
// sheets and the nav bar 28, chips full. Picking from a scale, not per
// element, is what makes a screen of boxes read as one family.
export const shape = { xs: 8, sm: 12, md: 16, lg: 20, xl: 28, full: 999 } as const;
// M3 tonal surfaces for the ivory theme: things that float *over* the
// canvas (a chip, a popover card) sit one tier lighter than cards that
// rest on it — elevation by tone, not by heavier shadows.
export const ivSurfaceHigh = "#FFFFFF";
export const ivBorder = "rgba(42,38,33,0.08)";
export const ivHeading = "#2A2621"; // deep charcoal — never pure black, never a saturated accent
export const ivBody = "rgba(42,38,33,0.65)"; // muted taupe-gray — 4.5:1 on ivBg2, the floor for body text
export const ivFaint = "rgba(42,38,33,0.5)"; // 3:1 on ivBg2 — large text, icons and chevrons only, never a sentence
export const ivDivider = "rgba(42,38,33,0.1)";
