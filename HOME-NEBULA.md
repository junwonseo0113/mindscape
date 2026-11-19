# Map-based Home implementation

The supplied image is the Home composition reference. This Home-specific design
supersedes the earlier dashboard/observatory layout notes; other screens retain their styles.

## Implementation and scope

- `src/app/StargazingHome.tsx`: full-height map composition, small literary wordmark,
  profile, real pending-discovery count, text/voice actions, three Home navigation
  destinations, explicit example preview, and an evidence/connection bottom sheet.
- `src/app/HomeThoughtMap.tsx`: mounts the actual full Brain Map renderer in Home
  presentation mode and projects Home's larger ivory information nodes and connection
  paths onto the true 3D positions. Rotation, pan, zoom and picking use the existing scene.
- `src/app/homeMapModel.ts`: the existing approval filter and deterministic curve helpers;
  the earlier flat layout is no longer used by Home's renderer.
- `src/app/home-observatory.css`: Home-scoped styles. The existing shared navigation
  CSS and other screens are unchanged. Background drift changes only transform/opacity,
  pauses when the document is hidden, and stops under reduced motion. Nodes do not pulse,
  orbit, or move while reading.
- `src/app/App.tsx`: passes the existing `!MONETIZATION_ENABLED || store.isPro` map
  access decision into Home and connects source IDs to the existing reversed History
  detail ordering. Home evidence links return to Home. No other feature routes changed.
- `src/assets/home-nebula.png`: separate generated background-only asset. No text,
  nodes, connections, stars, bright specks, or UI are baked into it. The generation
  prompt and tool mode are recorded in `artifacts/home-nebula-prompt.md`.
- `src/app/homeMapModel.test.ts`, `vitest.home-map.config.ts`,
  `tests/home-nebula-ui.mjs`: focused model and browser verification.

The original full 3D Brain Map remains available and is now also the actual scene on
Home. Optional Home presentation hooks retain the existing renderer's defaults for the
standalone route. Map controls expose 'Open full Brain Map' and 'Open Mind overview';
all prior destinations and other screens' navigation remain intact.

## Honest states and access

Empty accounts get the atmosphere and a recording invitation, with no invented nodes.
Examples require an explicit preview action (or the existing Demo Mode) and are labelled
as example content, not personal data. Example excerpts do not link into a real user's
journal. Counts and labels always derive from the selected dataset.

The existing launch configuration currently has `MONETIZATION_ENABLED = false`, so
the existing map policy grants access without a paid-plan check. This change does not
alter that policy. With monetization enabled, a free account's personal nodes, pending
count, and interactions are not passed to the map. The existing access/paywall route is
used, while recording/navigation stay available. An explicit public example preview
never contains the user's protected map data. Ideal Self's separate server entitlement
boundary remains unchanged and disabled as documented in `IDEAL-SELF.md`.

Loading/error UI isolates lazy map-module failures, leaving recording and navigation
available. A failed atmospheric image has a procedural, star-free gradient fallback.
Existing cloud synchronization and its status/error behavior are unchanged.

## Verification

```text
node node_modules/vitest/vitest.mjs run --config vitest.home-map.config.ts
npm run test:ideal-self
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json
npm run build
```

With the local dev server running, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed
Chromium if needed, then run `node tests/home-full-brain-ui.mjs`.

Browser checks cover 390×844, 430×932 and desktop; populated/empty/restricted/loading/
error states; selection and the exact original source entry; text and voice entry;
Home/Analysis/Journal/Profile/Ideal Self/Mind navigation; deterministic positions;
pan, pinch, wheel and keyboard zoom; reduced motion and hidden-page pause. The restricted
state enables the existing launch monetization flag in an isolated browser test only.
Loading/error tests delay/abort the renderer import rather than add production test states.

Screenshots are in `artifacts/home-nebula/`. Populated screenshots use an isolated
fixture from the existing DEMO_STORE with simulated user approvals, not invented personal
content. This fixture has five nodes, so the map is deliberately sparser than the visual
reference. Actual accounts show their own counts, labels, and connections. Desktop keeps
the app's existing phone-sized preview frame rather than replacing the app shell.

No lint command is configured. The large-bundle build warning predates this change.
There is no Git metadata in the supplied directory; a file-hash baseline verifies only
`App.tsx` and `StargazingHome.tsx` were changed among existing files. Earlier Ideal Self,
backend, database, environment, dependency, and other-screen work was preserved.

No deployment, push, remote migration, database change, or environment-file change was made.

## Full Brain Map renderer integration

Home now mounts the actual `BrainNodeMapScreen` Three.js scene in an optional
`homePresentation` mode. It uses the same deterministic 5,000/8,000-point brain cloud,
region-based belief assignment, OrbitControls, picking, zoom and keyboard browsing.
The standalone full-map route keeps its original defaults and UI.

`HomeThoughtMap.tsx` now projects actual 3D belief positions onto Home's ivory circular
information-node overlay and thin connection paths. This preserves the Home node styling,
amber selection and source-evidence sheet while replacing the flat layout with the real
brain geometry and camera. Information targets stay 44px; smaller structural points are
context only. Initial framing is closer on Home; manual rotation and zoom remain available.
Home disables automatic scene rotation, tissue flicker, and floating dust. Empty accounts
see the structural brain with zero information nodes and an explicit empty-state label.

The optional projection/control callbacks do not change the standalone renderer's behavior.
`tests/home-full-brain-ui.mjs` verifies the real renderer and point count, distinct information
nodes, idle stability, rotation, native wheel/pinch zoom, evidence links, recording, Mind
navigation, empty structure, and mobile/desktop screenshots. Current screenshots are in
`artifacts/home-full-brain/`; populated captures use the existing example-data test fixture.

## World-space nebula
Home now renders finite nested nebula shells through `homeNebulaScene.ts`, with seam-free triplanar sampling of the existing texture. The background camera copies the brain camera world pose and matches its focal length and screen center across the full Home viewport. Orbit, dolly and pan therefore change the view through the same world; CSS no longer scales or drifts the background. Two translucent inner shells provide depth relative to the outer shell. GPU textures, geometry, materials and renderer are disposed on unmount. Home UI stays outside the WebGL surfaces. Playwright checks camera synchronization and actual backdrop pixel changes during orbit, plus wheel/pinch zoom and existing interactions.

## Node focus and procedural cloud diversity
Selecting an information node eases the orbit target and camera together to that node over 650 ms, preserving orientation and zoom. The pre-selection pose is saved once, including when switching nodes. Tapping the active node again, closing its sheet, or pressing Escape restores that pose; reduced motion uses an immediate transition. User camera gestures interrupt a running focus animation.
The nebula shader now samples asymmetric domain-warped 3D noise fields with different depth-layer offsets and spatial teal, rose and amber color regions. The old repeated image sampling and texture allocation have been removed. Browser tests verify the selected point projects to the map center and deselection restores the exact camera pose, with both normal and reduced motion.

## Evolving cloud animation
The Home nebula now deforms its world-space density field over time. Three differential flows move through the existing domain-warp noise, with a different rate at each depth layer. This changes cloud forms and filaments rather than translating or rotating a background image. It uses the existing scene render loop and adds no noise samples, timers or React frame updates. The brain camera and information nodes do not move with the cloud evolution.
Animation time accumulates from clamped visible-frame deltas. Hidden tabs pause via the existing render-loop visibility guard; returning does not advance through the hidden interval. The live reduced-motion media preference freezes cloud deformation without disabling camera interaction, and resumes it if the preference changes back.
`tests/nebula-motion-ui.mjs` passed mobile and desktop pixel-change checks, unchanged camera/marker positions, live reduced-motion pause/resume and hidden-page pause/resume. Before/after screenshots: `artifacts/nebula-motion/`.
