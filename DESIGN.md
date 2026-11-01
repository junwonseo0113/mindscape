---
name: Mindscape
description: A quiet, warm-paper mirror for the unconscious beliefs running underneath your everyday thoughts.
colors:
  warm-paper-1: "#F4F0E8"
  warm-paper-2: "#F2EEE6"
  warm-paper-3: "#EEE9DF"
  surface-translucent: "rgba(255,253,248,0.66)"
  surface-solid: "#FBF8F2"
  border: "rgba(42,38,33,0.08)"
  divider: "rgba(42,38,33,0.1)"
  deep-charcoal-ink: "#2A2621"
  body-ink: "rgba(42,38,33,0.6)"
  faint-ink: "rgba(42,38,33,0.4)"
typography:
  display:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: "clamp(26px, 7.5vw, 34px)"
    fontWeight: 400
    lineHeight: 1.24
    letterSpacing: "0em"
  body:
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  "2xl": "22px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "11px"
  md: "14px"
  lg: "18px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.deep-charcoal-ink}"
    textColor: "{colors.surface-solid}"
    rounded: "{rounded.md}"
    padding: "13px 18px"
  card:
    backgroundColor: "{colors.surface-translucent}"
    textColor: "{colors.deep-charcoal-ink}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
  chip:
    backgroundColor: "{colors.surface-solid}"
    textColor: "{colors.deep-charcoal-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 11px"
---

# Design System: Mindscape

## Overview

**Creative North Star: "The Quiet Mirror"**

Mindscape is a mental-health journaling app whose entire visual identity rests on one idea, stated directly in its own interface copy: *the interface is quiet, the user's mind provides the color.* The ivory canvas, restrained charcoal typography, and near-total absence of a accent hue are not minimalism for its own sake — they're a deliberate refusal to compete with the one thing that's actually supposed to carry color and life on screen: the person's own belief data, rendered as a 3D star field. Until that data exists or is tapped, the system itself stays almost monochrome on purpose.

This is a direct rejection of the cold blue/white "medical dashboard" look most mental-health software defaults to. Nothing here reads as clinical. The palette behaves like warm paper, not a hospital form; the primary serif is set in italic for an epigraph, handwritten-adjacent register rather than a sans-serif UI face; elevation is soft and ambient rather than sharp and structural, like something resting on a desk rather than floating in a software layer.

Two further surfaces exist as **deliberate, named exceptions** to this system rather than parallel designs of equal weight: a Modernist red-accent mode used on a handful of screens (Auth, Profile, Belief Map, Settings), and a dark "immersive" mode used only by the full-screen Brain Map. Both are documented briefly at the end of Colors and Components; neither should be treated as an alternate version of the ivory system to keep in sync — they're intentionally a different register for a different kind of moment (a focused task, versus an immersive one).

**Key Characteristics:**
- Warm, paper-like, almost colorless by default — color is earned by real user data, not decoration
- Serif italic for voice/epigraph moments, sans for interface, mono for small tracked labels
- Soft, ambient, warm-tinted shadows — never sharp or state-driven
- Generously sized, softly tactile components (48px tap targets, gentle 0.94–0.99 tap-scale)
- The 3D belief star-field is the one true signature element and the app's actual color source

## Colors

The ivory palette reads as warm paper under even light — no pure white, no cool grays.

### Primary
- **Deep Charcoal Ink** (#2A2621): the system's only real "accent." There is no separate accent hue in the ivory theme — emphasis, selection, and call-to-action all read through this one ink color plus weight/contrast, never through introducing a second color.

### Neutral
- **Warm Paper** (#F4F0E8 → #F2EEE6 → #EEE9DF): a three-stop radial+linear gradient background, never a flat fill and never a photo. This is the canvas every ivory screen sits on.
- **Surface Translucent** (rgba(255,253,248,0.66)): the default card fill — lets a hint of the paper gradient show through underneath it.
- **Surface Solid** (#FBF8F2): opaque card fill, used where translucency would compete with content (e.g. the paywall teaser card).
- **Border** (rgba(42,38,33,0.08)) / **Divider** (rgba(42,38,33,0.1)): both derived from Deep Charcoal Ink at low opacity rather than a separate gray — keeps every line on screen tonally related to the one ink color.
- **Body Ink** (rgba(42,38,33,0.6)) / **Faint Ink** (rgba(42,38,33,0.4)): secondary and tertiary text, both opacity steps of the same ink rather than independent grays.

### Named Rules
**The One Ink Rule.** The ivory theme has exactly one hue (Deep Charcoal Ink) at varying opacity for every text, border, and emphasis need. Don't introduce a second color into this system to signal state or hierarchy — opacity and weight do that job.

### Modernist mode (named exception — Auth, Profile, Belief Map, Settings)
- **Signal Vermillion** (#ec3013, hover #dd2b0f): the one true accent color in the entire app, and it only exists in this mode. Text-on-white uses a separate darker step, #ae1800, since the accent itself fails contrast at small sizes.
- Background #f3f2f2, card #ffffff, heading #201e1d — a flatter, cooler, more conventional light UI than the ivory theme's warm gradient.

### Dark immersive mode (named exception — full-screen Brain Map only)
- Background #0d1322, panel rgba(15,21,36,0.86), ink #f2eee4.
- **Network-activation crimson** #ff3b57: appears only as a transient "this belief just activated" state on tapped star nodes — never a resting UI color.

## Typography

**Display Font:** 'Instrument Serif', Georgia, serif (italic variant loaded for epigraph use)
**Body Font:** 'Inter', -apple-system, BlinkMacSystemFont, sans-serif (weights 400/500/600/700)
**Label/Mono Font:** 'JetBrains Mono', ui-monospace, monospace (weights 400/500/600/700)

**Character:** Serif italic carries the app's "voice" moments — questions, epigraphs, reflective copy — while Inter runs the actual interface, and JetBrains Mono is reserved for small, tracked, uppercase metadata (dates, counts, catalogue-style labels). The three never blend within one piece of text.

### Hierarchy
- **Display** (400, clamp(26px, 7.5vw, 34px), line-height 1.24): the Home hero question and equivalent single-moment headlines — always serif, often italic.
- **Title** (400, 24–28px, line-height ~1.4): opening/auth/splash screen statements.
- **Body** (400, 13.5–17px, line-height ~1.5): statements, descriptions, card content.
- **Label** (700, 10.5–11.5px, letter-spacing 0.08–0.1em, uppercase): mono, used for dates, counts, section eyebrows — never for anything a user reads as prose.

### Named Rules
**The Voice-Switch Rule.** Serif italic means "the app or the user's own reflective voice." Sans means "interface." Mono means "data/metadata." Don't use serif for interface chrome or sans for a reflective/epigraph moment — the switch itself is load-bearing.

## Layout

Mobile-first, single-column, almost entirely percentage-positioned rather than grid-based — Home in particular lays its header, node field, summary, and input card out by percentage of the full screen height so everything is visible at once with no `overflow: auto` anywhere. Top clearance is a fixed pixel value (not a percentage) specifically to stay clear of the device status bar regardless of screen height. Safe-area insets (`env(safe-area-inset-top/bottom)`) are respected throughout rather than assumed away.

## Elevation & Depth

Ambient and diffuse, not structural. The system uses one consistent resting shadow rather than a ladder of elevation states tied to z-index or interaction — a card simply reads as resting gently on warm paper, not as floating above a layer stack. Shadows are warm-tinted (never a neutral/cool gray-black) to stay consonant with the palette.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 10px 28px rgba(120,105,80,0.10)`): the one card shadow used throughout the ivory theme. Warm-tinted, soft, low-opacity.
- **Focus ring** (`box-shadow: 0 0 0 3px <accent-tinted rgba, varies by theme/region>`): always tinted to the active theme or region's own color, never a generic blue.

### Named Rules
**The One Shadow Rule.** Don't add a second elevation tier for "more important" cards — importance is expressed through typography and ink opacity, not through a heavier shadow.

## Shapes

A wide, deliberately varied radius vocabulary (16 distinct values from 1px up to full pill) rather than a 2–3-step scale — different components each get their own considered radius instead of being snapped to a shared default. 14px is the most common card radius; 999px (full pill) is reserved for chips, tags, and pill-shaped buttons; 12px is reserved for form inputs and settings rows; 18–22px marks the largest, most prominent cards (modals, hero cards). Circles use 50%. No sharp (0px) corners appear anywhere in the ivory theme.

## Components

For each component, lead with the character, then shape/color/state.

### Buttons
- **Shape:** 12px radius, full-width, 48px minimum tap height (generous, never a compact/dense button).
- **Primary:** Deep Charcoal Ink background, Surface Solid text, `13px 18px` padding.
- **Tap:** a gentle scale-down (ranges 0.94–0.99 depending on component, never a hard snap) plus a slight opacity dip — soft, not mechanical.

### Chips / Pills
- **Style:** 999px (full pill) radius, `6–14px` / `11–18px` padding, Surface Solid background with Deep Charcoal Ink text; fills with a tinted color only when actively selected.

### Cards / Containers
- **Corner Style:** 14–22px radius depending on prominence.
- **Background:** Surface Translucent (default) or Surface Solid (where content needs a fully opaque backdrop).
- **Shadow Strategy:** see Elevation & Depth — the one ambient card-rest shadow, no variation by importance.
- **Border:** 1px, Border or Divider color.
- **Internal Padding:** `18px 20px` typical, up to `22px 20px` for hero cards.

### Inputs / Fields
- **Style:** 12px radius, 1px Divider-color border.
- **Error / Armed state:** border shifts to the theme's warn color rather than the accent — error states never borrow the primary ink or accent hue.

### The Belief Star Field (signature component)
The app's one true visual signature, and its actual color source: a 3D point cloud shaped like a brain (via rejection-sampled ellipsoid shells, not a mesh or texture), rendered as glowing star-sprites. Dormant background tissue renders pure white/faint; a real belief node is distinguished by size and brightness, never hue, until it's tapped — at which point it and its connected neighbors pulse into the network-activation crimson defined in the dark-immersive exception above. This component is the reason the rest of the system can stay this quiet: it's where all the color and motion budget goes.

## Do's and Don'ts

### Do:
- **Do** keep the ivory theme to one hue (Deep Charcoal Ink) at varying opacity for all text/border/emphasis needs.
- **Do** use the ambient warm-tinted card shadow (`0 10px 28px rgba(120,105,80,0.10)`) consistently rather than inventing elevation tiers.
- **Do** reserve serif italic for voice/reflective moments and keep interface chrome in Inter.
- **Do** let the belief star field carry color and motion — keep everything else around it quiet by comparison.

### Don't:
- **Don't** introduce a second accent color into the ivory theme to signal state — that's what Modernist mode is for, on its own separate screens.
- **Don't** treat Modernist (red-accent) or dark-immersive (Brain Map) mode as the system to extend elsewhere — they're deliberate exceptions for specific surfaces, not the default.
- **Don't** add a sharp/cold "medical dashboard" visual (pure white, cool blue, dense data tables) anywhere in the ivory theme — it's the system's explicit anti-reference.
- **Don't** make cards' shadows heavier to signal importance; use ink weight/opacity instead.
