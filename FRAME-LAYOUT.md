# Full-frame layout sweep

Every screen now paints its background across the complete app frame. Content is inset separately, using a single `--app-top-inset`: 30px for the desktop preview clock and the actual safe area on mobile. The clock is an overlay; toggling it never changes the shared viewport's position or dimensions.

The previous negative 30px screen offsets have been removed. Mind, Analysis, Journal and the deeper views use normal roots within `.screen-content`. Screen-level nested canvases are transparent, including all guided-investigation slides; reading panels retain opaque surfaces. Home keeps its own full-frame 3D sky and explicit safe-area spacing. The standalone full-screen brain map retains its own viewport and does not display the preview clock.

Page transitions fade without scaling the background plane. Recording retains its dimming and slower fade, while keeping page bounds fixed. Intentional component animations and scrolling remain.

## Browser verification

- `tests/frame-sweep-ui.mjs`: 35 real routes on desktop and mobile, plus every onboarding and investigation slide: 84 checks. Verifies full-frame background bounds, shared viewport and content insets, removed negative root offsets, horizontal overflow, and screenshot pixels around the desktop status-bar boundary.
- The sweep uses isolated existing demo data and a browser-only initial-route fixture to reach all screens through the real App shell. API calls are disabled in this test. It makes no account, billing or backend changes.
- `tests/navigation-frame-ui.mjs`: actual animated tab, profile, settings and recording navigation. Samples animation frames to ensure neither the shared viewport nor entering/exiting page bounds move. Outgoing headings remain fixed after any intentional scroll to the chosen control.
- `tests/opening-transition-ui.mjs`: splash/auth wordmark position, persistent sky and frame bounds on desktop/mobile.
- `tests/home-full-brain-ui.mjs`: real Home map geometry, node selection/return, rotate, zoom, source navigation and recording.
- App and Node TypeScript checks, 7 Home tests, 60 Ideal Self tests and production build passed. The existing large-bundle advisory remains.

Screenshots and the full route report are in `artifacts/frame-sweep/`. Screenshots use demo data. No deployment or GitHub push was performed.
