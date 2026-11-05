# Journal node readability update

Scope: dedicated Journal node detail only. Catalogue and original-entry screens compare exactly with the pushed implementation, as do star mappings and ConfidenceTrend (artifacts/journal/node-readability-audit.json).

- Statement is now the primary serif heading; optional thought label remains secondary sans-serif. No-label statements occur once. Long content wraps.
- Content-sized centered star/title group is compacted. Star props remain exactly color={color}, size={120}, intensity={catalogueOrbIntensity(star)}; no asset, glow or animation edits.
- Readable neutral category/domain text retains the category-colored star as the visual identifier.
- Left-aligned reflection notice stays visible; native About this interpretation disclosure preserves the complete previous explanation and review-dependent wording.
- Compact facts show appearances and current strength first, then first observed and review with original values/fallbacks.
- Supporting entries precede Development, then all dated evidence excerpts and informational connections. Full chronological original writing and every action remain.
- Development keeps its original chart, eligibility, point count and first/latest delta; explanation lives in a native disclosure, without implying increased confidence is improvement.
- Body writing uses 16–17px sans-serif with local dark reading surfaces; serif reserved for the primary statement.
- No backend, data, persistence, catalogue restoration, review or unrelated-screen changes.

Validation: App TypeScript passed. Journal browser regressions passed at 320/390/768/1440 with empty/missing/long/unavailable states, Premium gates and entry/node/catalogue navigation restoration. Focused browser tests passed at 320/390/1440 with multiple connections, keyboard-operated disclosures and 200% text sizes without horizontal overflow. Tests use reduced motion. Screenshots inspected at mobile and desktop. CSS lint passed. Initial focused browser run was interrupted by navigation while another browser test was running; isolated rerun passed. Production build passed before final category-text contrast adjustment; final build and focused browser rerun performed afterward.

Limitations: tests use isolated fixtures and mocked APIs, no live AI requests. Text zoom test doubles computed text sizes, rather than OS-level accessibility settings. Disclosure open state is local to the detail visit. No additional reference screenshot was attached with this message; implementation follows the attached written brief. No deployment or GitHub push.
