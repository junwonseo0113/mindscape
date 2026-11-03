# Mindscape: the rooms around the observatory

Home retains its interactive 3D nebula, star nodes, camera focus, recording controls and navigation. The rest of the app shares its materials rather than repeating that scene.

| Screen family | Treatment | Main job |
| --- | --- | --- |
| Mind, belief patterns, full map | Teal undertone in midnight ink | Read the user's patterns and connections |
| Analysis, hypotheses, evidence | Cooler blue with opaque reading panels | Review an interpretation against its sources |
| Journal and entry details | Muted plum at the edge of the page | Find and revisit recorded material |
| Recording and session states | Quiet ink with a low warm undertone | Write or speak without visual competition |
| Ideal Self and aspiration | Warm charcoal and subdued brass | Describe a direction in the user's own words |
| Profile, settings, privacy and help | Neutral midnight with flat surfaces | Read and change account preferences |
| Membership and payment | A restrained warm edge | Compare the existing plans and controls |
| Arrival and onboarding | A muted rose edge | Enter the same product world |
| Support | Flat, calm teal ink | Read support information clearly |

`eveningTheme.ts` maps existing routes to treatments. `evening-screens.css` scopes the shared surfaces and controls to non-Home screen wrappers. No routes, backend behavior, entitlements or personal data were added. Home's rendering stays separate.

Controls and page titles use Inter. Instrument Serif remains for the wordmark, personal thought excerpts and reflective passages. Primary actions use flat warm ivory; panels are separated by a lightness step, with borders reserved mainly for inputs and quiet dividers. Navigation follows Home's four destinations. Journal controls have readable labels and touch targets on a separate row so the title and subtitle fit.

The local design-taste-frontend and emil-design-eng skills informed the review. The former's flat-dark surface hierarchy was retained; the user's established midnight/ivory palette, restrained brass and subtle screen-specific atmosphere take precedence over its neutral-black defaults. No imagery was generated.

## Validation

- `tests/evening-screens-ui.mjs`: mobile, desktop and 320px; distinct atmosphere; populated and empty states; deeper belief/aspiration screens; evidence views; Journal search; settings toggles; Ideal Self disabled save state; recording drafts; navigation; no page errors.
- `tests/home-full-brain-ui.mjs`: Home's 3D map, focus/return, orbit, pinch/wheel zoom, evidence navigation and recording.
- `tests/ideal-self-ui.mjs`: real unconfigured state plus explicitly mocked profile CRUD and review workflows.
- 7 Home model tests and 60 Ideal Self tests passed.
- App and Node TypeScript checks and production build passed. The existing large-bundle advisory remains.

Screenshots are in `artifacts/evening-screens/`. Populated screenshots use the existing demo fixture in isolated browser storage. Empty screenshots use a fresh guest account. No deployment or GitHub push was performed for this redesign.

The final multi-screen browser run also passed against the production preview on port 5174. Stable Journal DOM inspection passed with zero failures after allowing the brand atmospheric wash and a fixed-shell covered-text diagnostic that was checked separately through live heading bounds and screenshots. Its remaining warnings concern the requested ivory palette and compact metadata. Numeric metadata now uses Inter with tabular digits; small labels are at least 11px in App screens.

## Stronger atmospheric pass
The non-Home rooms now use distinct, asymmetric SVG cloud fields in `src/assets/evening/`, each with a different noise seed, formation, and color pairing. These static code-native vector assets replace the earlier faint radial washes. Panel contrast, primary heading size and the brass navigation indicator are stronger; reading panels remain opaque. Home's 3D scene is untouched. The UI test writes static audit HTML only when using production preview, preventing Vite from reloading during development-server navigation checks.

## Quote author portraits
The opening Quote of the Day now pairs each of its 12 existing quotes with an individual continuous-line SVG portrait. Repeated authors receive different poses. Every portrait is one uninterrupted path with no fill, so the arrival atmosphere remains visible through the face and surrounding space. The paths live in `QuotePortrait.tsx`; daily text, attribution and portrait keys live in `dailyQuotes.ts`. A short pen-line reveal respects reduced motion. The automatic pause is 8.5 seconds (6.5 with reduced motion), with immediate tap/keyboard continuation retained. No backend changes or raster generation were needed.
`tests/quote-portraits-ui.mjs` passed the 12-date rotation, author mapping, one-subpath/no-fill checks and mobile/320px/desktop layouts against the production build. `tests/quote-smoke.mjs` independently verifies actual tap-through with the real clock. Date-simulation checks intentionally do not depend on animated exits; those are exercised by the real-clock smoke test. TypeScript and production build passed. Screenshots: `artifacts/quote-portraits/`.

## Detailed portrait revision
The minimal SVG outlines have been replaced with twelve detailed warm-ivory pen-and-ink scribble portraits, created with the built-in image generation tool and saved in `src/assets/quote-portraits/`. The visible Quote of the Day heading has been removed. PNG alpha transparency is preserved; two assets received an explicit background-cleanup edit. Each quote still selects its own portrait, including different poses for repeated authors. `QuotePortrait.tsx` imports asset URLs rather than decoding or downloading the whole set. Only the active image is displayed. The gentle appearance is an opacity fade, with no animation under reduced motion.
Exact prompts and cleanup prompts: `QUOTE-PORTRAITS-PROMPTS.json`. Final alpha checks measured 39-53% fully transparent pixels across the twelve images. The browser suite verifies complete image decoding, resolution, alpha transparency, attribution matching, no visible top heading, and mobile/small/desktop layouts. No deployment or push was performed.

## Random opening selection
Opening selection now chooses an author randomly on each full app launch/reload, with equal author probability. It then picks one of that author's existing quote/portrait pairs. The last displayed author is stored locally to avoid consecutive author repeats; selection still works when storage is unavailable. A module-level cache keeps the selection stable throughout one app visit, including React Strict Mode and viewport rerenders. `tests/quote-random-ui.mjs` verifies eight actual launches, matching quote/portrait pairs, no consecutive author repeats, and stable selection during a visit. The exhaustive portrait layout suite now uses an explicit development-only module fixture to inspect every artwork deterministically.

## Seamless opening transitions
The desktop content inset is now a constant 30px regardless of preview-clock visibility. Mobile retains a constant safe-area inset. A persistent opening sky fills the entire frame for quote, splash, authentication and onboarding; arrival wrappers are transparent, so the clock never exposes a dark fallback strip and backgrounds do not reset during the transition. `tests/opening-transition-ui.mjs` samples actual animation frames on desktop and mobile to verify fixed viewport bounds, an unmoving outgoing splash wordmark, persistent sky identity, and full-frame sky coverage behind the clock. Screenshots are in `artifacts/opening-transition/`.
