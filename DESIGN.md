# Mindscape: a midnight observatory

The application shares Home's ink-blue sky, warm cream typography, gold actions, and colored stars. No scenic background images are used. Existing routes and data behavior remain unchanged by the theme.

## Shared foundations

`src/app/nightTheme.ts` is the palette source for the existing screen tokens. Background: #08131c; upper sky: #142943; solid reading surface: #102031; primary text: #fff0d8; body: #c2ceda; muted text: #aebed1; action: #ecd2a8. Borders use gold at low opacity. Warnings remain distinct from primary actions.

Instrument Serif carries screen titles and reflective statements. Inter carries controls, body copy, and navigation. JetBrains Mono is reserved for compact metadata. Solid panels protect long-form reading and evidence review.

`StargazingNav.tsx` provides the same labeled, touch-friendly Home / Mind / Analysis / Journal navigation throughout the app. Every interactive control needs a visible keyboard focus state; essential interaction must not depend on hover.

## Screen treatments

- Home: pointed stars, stable category hues, explicit approved interpretation preview, node detail dialog, record action, and pending review entry. Background stars are decorative and noninteractive.
- Mind and Analysis: navy reading panels, cream serif statements, gold review actions, supporting evidence and contradictions retained.
- Journal: night catalogue, pointed star markers, searchable and filterable entries, legible dark search/calendar/filter sheets.
- Writing: quiet dark editor, clear primary action, warm recording feedback.
- Full map: code-rendered night gradient, existing 3D brain controls and keyboard support, gold selection activation.
- Onboarding, authentication, profile, settings, legal, and subscription screens: same palette and control states without competing ivory, red, or purple themes.

## Motion and accessibility

Star shimmer and ambient light shifts remain gentle. Reduced-motion preferences disable decorative motion. Panel transitions are short. Text and control contrast must be checked on solid surfaces; primary gold controls use dark text.

## Data honesty

Screens read the existing store; no sample data is injected into normal user sessions. Playwright screenshots use isolated browser fixtures. Home admits only its existing explicit approval signals; theme work does not change the underlying approval or analysis pipeline.

## Home composition

Recording comes first, with separate text and voice actions using the same existing writing route. A pending interpretation and its actual linked source excerpt follow. The review action opens that exact interpretation in the existing analysis route. No pending data produces a factual empty review state, not a sample reflection.

The constellation is an open region with an honest empty state. An opt-in Premium preview uses existing demo data, labels it as example content, and never writes it into the personal store. Real map nodes still require existing approval signals. Home uses expressive serif only for its wordmark and the one quoted reflective passage; controls, labels, headings, and node text use sans-serif. No decorative sparkle field, scenic image, outlined empty card, or button gradient remains.
