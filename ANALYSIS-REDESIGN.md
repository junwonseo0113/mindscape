# Analysis preservation checklist

Before-edit inventory: `ScreenDiscoveryAnalysis` owns the landing/Examine selection; `computeDiscovery`, `resolveDiscoveryTarget`, `buildRecentInsights` and `evidenceForHypothesis` supply its existing targets and counts. `DiscoveryCard`, `InsightCard`, evidence/timeline components, `DiscoveryReflection`, `GoalDirectionsPanel`, `LiteraryReflectionPanel` and `ScreenInvestigate` provide the features below. The app shell owns review callbacks, reinterpretation API calls, persistence, Premium gating, direct review entry and investigation routing. Repository design instructions retain the midnight palette, warm type, real store data and keyboard/touch access. No general root AGENTS.md applies.

## Checklist established before editing

- [x] Overview title/explanation, main navigation, ambient sky/reduced motion, separate empty states.
- [x] Same featured selection priority, date/confidence tie-break, stable visit identity, category node, thought label/title, distinct supporting text, thoughts count, confidence, exact Examine target.
- [x] Further insights remain horizontal; all eligible hypotheses/beliefs, exclusions/deduplication, newest-first ordering, category/node, thought label/title/supporting text/date/count/confidence, exact target. Add labelled scroll controls and a visible overflow cue.
- [x] Examine Back/navigation/direct entry; selected identity survives reconsideration and investigation return. Restore scroll and relevant UI state.
- [x] Three latest saved supporting excerpts in chronological order, dates/domains and no-evidence state. Contradictory entries/domains remain. Existing timeline eligibility and data points remain.
- [x] Agree/disagree, reconsidering, updated wording, accepted/exhausted states, settled buttons hidden, existing persistence/API/error semantics unchanged.
- [x] Growth directions: broader belief collection, three-belief threshold, three numbered results, same inference/save/count-refresh logic; rendered once in Examine, distinct from the user's aspiration.
- [x] Literary reading: Premium eligibility, passage/author/work/optional correct portrait/explanation, saved stable selection and Keep writing fallback. Exclude placeholders at selection, cache and display; invalidate legacy placeholder caches. Discovery-first relevance, per-target/content cache, same-count invalidation, stable unchanged selection and genuine no-match. Do not change opening quotes or invent assets/content.
- [x] Investigation: eligible hypotheses only; introduction, origin, comparison, related pattern, step counter, forward/back and return to the same hypothesis; all recorded material retained.
- [x] Empty/missing fields, conflicts, long content, loading/error/review states; 320/390/768/1440px, contrast/focus/touch/keyboard, no clipping or content behind navigation; existing checks and focused regression tests.

## Final presentation and feature locations

| Feature | Final location and preserved behavior |
| --- | --- |
| Overview and navigation | Analysis title/explanation; existing labelled bottom navigation; existing subtle sky and reduced-motion behavior. Existing no-discovery and no-additional-insights messages remain separate. |
| Today's discovery | Dominant solid reading surface with the same category-colored stellar node, thought label/title, distinct interpretation preview, thoughts count, confidence percentage and explicit Examine button. Long previews are capped; Examine retains the full text. Selection still prioritizes the first unreviewed hypothesis, then the most recently updated non-rejected belief with confidence as tie-breaker. |
| Further insights | Horizontal cards retain every eligible item, existing deduplication/exclusions/date ordering, category/node, thought label/title/supporting text, relative date, thoughts count and confidence. A visible overflow cue, labelled previous/next controls and keyboard-focusable scrolling region supplement touch scrolling. |
| Examine entry and return | Exact target, including direct Home review entry. Full interpretation, optional thought label and confidence lead. Back restores overview scroll, carousel position and originating control. A parent-held in-memory visit retains the target, detail scroll and disclosures across investigation navigation. |
| Supporting evidence | Why this interpretation is immediately below the interpretation, before supplementary material. It uses the unchanged three-most-recent/chronological ordering, dates, optional domains and explicit no-evidence state. |
| Contradictory evidence | Entries pointing the other way follows supporting evidence, under the same linked-entry eligibility and with the same entry text/domain. |
| Development | Clearly labelled How this has evolved disclosure; existing eligibility, earliest/latest belief excerpts and hypothesis origin/current/comparison points are unchanged. No timeline is invented when data is absent. |
| Review | Always visible review panel after evidence/development. The original question, observer framing, agree/disagree actions, reconsidering state, accepted/exhausted messages and settled-button hiding remain. A labelled Review this interpretation shortcut scrolls/focuses this panel. Failed reconsideration now also has a scoped inline error and leaves the existing action available to retry. |
| Growth directions | One instance in Examine, now after evidence and review because it describes the broader belief collection rather than evidence for the selected interpretation. Same three-belief threshold, API payload/call, saved results, count-change refresh and three numbered directions; separate from the user's aspiration. |
| Optional literary reading | Premium-only For where you are now disclosure below the decision area. Eligible passage text, author, work, matching optional portrait and explanation remain; no-match uses the original Keep writing fallback. The available production library currently has no eligible passages, so the fallback is the expected result. |
| Dig deeper | Eligible hypotheses only. Four steps retain the introduction, original date/quote/note, both complete comparison sequences, related-pattern text, counter and forward/back/return actions. Larger type and a separate scrolling body keep content above the footer. Return restores the same Examine target and scroll. |

## Literary correction

`literaryPassages.ts` now filters out every placeholder before ranking and validates again at cache/load/display boundaries. The selected discovery's current wording/domain/thought label is the primary matching signal; only its associated excerpts and journal entries supplement that signal. Unrelated global belief themes cannot force a match. The original minimum-data eligibility remains three non-rejected beliefs. This is deterministic keyword/theme matching, not an embedding or new AI service, and zero overlap returns no match.

The existing JSON store now has an optional `literarySelections` map keyed by belief/hypothesis identity. Each record contains the selected passage or deliberate no-match plus an exact content signature. The signature includes relevant discovery/evidence content and the eligible library, so edits with unchanged record counts invalidate the selection. Unrelated content does not reshuffle it. Unchanged revisits retain the selection and original selection date. Legacy placeholder caches are discarded during load; no old global selection is displayed. No database migration or API contract was introduced.

No passages, portraits or author attributions were added to the production library. The existing author registry is still optional and author-specific. The 100 opening quotes and their random selection were not modified.

## Checks and results

- TypeScript app and node configurations: passed.
- `vitest.analysis.config.ts`: **19 passed**, covering placeholder eligibility/migration, per-discovery relevance, unrelated-context exclusion, evidence fallback, threshold/rejected/missing targets, stable revisits, same-count content invalidation, separate caches and no-match/library changes.
- Existing Ideal Self suite: **60 passed**. Existing home-map model suite: **7 passed**.
- Opening quote integrity/source check: **100 unique quotes and illustration identities, 88 source-checked additions, 31 authors**, passed.
- `tests/analysis-redesign-ui.mjs`: final isolated run passed at **320, 390, 768 and 1440px**. Exercised ordering/deduplication, every exact card target, long text, evidence selection/domain fields, contradictory entries, eligible/ineligible timelines, review/reconsidering/accepted/exhausted/error states, all four investigation steps, return scroll/disclosures, growth threshold/count persistence, Premium on/off, placeholder fallback, direct Home entry, belief-specific review fields, per-discovery literary display, missing portraits and same-count cache refresh. Additional empty/below-threshold/tie-break cases passed. API responses and injected eligible-reading fixtures are isolated to browser test contexts; no live AI calls were made.
- One concurrent development-server run timed out during the exhaustion check. The complete subsequent isolated run passed all viewports and edge cases; the final result recorded in `artifacts/analysis/checks.json` is that isolated run.
- Existing frame sweep: **84 passed**, covering real-route frame bounds, full backgrounds, safe-area placement, seams and page overflow.
- Additional keyboard-only Chromium pass: carousel activation, exact Examine entry, native disclosure toggling, review acceptance and focus restoration all passed without live API calls.
- Production build: passed, retaining the existing large-chunk warning.
- Source audit: original selection/order/evidence/timeline/review dispatch/growth-inference logic and unrelated Mind, Unconscious Patterns, Journal and sign-in screen functions are unchanged. Audit stored in `artifacts/analysis/preservation-audit.json`.
- Design source lint: **0 failures, 0 warnings**. Production-CSS capture inspection at 390/768/1440: **0 failures**; one expected desktop empty-margin warning reflects the existing centered phone frame. Warm-ivory and covered-text checks were allowed because the palette is explicitly required and the existing decorative frame overlay produces a hit-test false positive when the inspector forces pointer events onto it. Live browser/screenshots verify the visible title and layout. The static capture supplements, rather than replaces, live interaction checks.

Design-taste-frontend direction: **Data terminal**, seed **58699564**, no redraw, existing palette/type preserved. Its restrained panels and clear selection/reading hierarchy are adapted to the existing labelled mobile navigation, rather than replacing that navigation with the dealt desktop rail. The overview asks which interpretation to explore; Examine asks what supports it and whether it fits; investigation follows the recorded trail. Screenshots were visually reviewed at phone, tablet and desktop widths.

## Remaining limitations

All four production literary records remain placeholders and are intentionally excluded; real reading results require verified eligible records. Matching remains deterministic theme/keyword matching. Live AI/backend availability was not verified; existing growth and reconsideration services still require their normal configuration. Existing confidence/evidence and analysis rules were preserved rather than reinterpreted. No deployment or publication was performed.
