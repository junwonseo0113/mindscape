# Journal preservation checklist (recorded before implementation)

Source: attached brief, archived in artifacts/journal/brief.txt.

- [x] Overview title, subtitle, controls, navigation, background and empty states.
- [x] Catalogue: six categories, colors, ordering, counts, rejected exclusion, dates, appearance fallbacks, activation.
- [x] Locked stars: unchanged Node, StellarNode, size/intensity mapping, alignment, dimming.
- [x] Search: same fields, count, case handling, dimming, combination and sheet-close behavior.
- [x] Rewind: milestones, weekdays/counts, cutoff, undated behavior, explicit reset and empty state.
- [x] Filters: category eligibility and exact active/dormant/recent/top-30%-including-ties rules.
- [x] Node: large star, label/statement, reflection copy, all facts, history, full entries, evidence, informational connections, unavailable fallback.
- [x] Entry: originating return, date/duration/full writing, optional recap and all saved analysis fields.
- [x] Premium: original gate, all five components, broader-history scope, unchanged calculations/encodings/limits/empty states.
- [x] Memory-only search/filter/cutoff/view/scroll restoration through node and entry navigation.
- [x] Responsive text, keyboard controls/sheets/tabs, reduced motion, browser validation.

Direction: data-terminal, retained palette/type, seed 1823768890. Existing six-family stellar axis is the product signature. The catalogue answers which thoughts have appeared; details distinguish source writing from interpretation. User-locked star glow overrides the skill's generic no-glow rule.

## Feature locations and preservation evidence

| Existing feature | Final location / verification |
| --- | --- |
| Journal title, subtitle, Search / Calendar / Filter, main navigation, sky | Catalogue shell and shared unchanged BottomNav/background; header wraps at narrow widths. |
| Six categories, ordered beliefs except explicitly rejected, counts, empty categories | Catalogue; buildCatalogueStars and earliest-date helper are byte-for-byte unchanged. Dates derive from confidence-history and linked entries, appearances retain evidenceCount / linked count / 1 fallback. |
| Stellar core/halo/color, confidence sizing, recency brightness, 64px vertical column | Original Node, catalogueOrbSize, catalogueOrbIntensity and StellarNode remain unchanged. Row markup retains its exact star container, opacity targets, activation and grouping; only an identity attribute and full statement wrapping changed. Large detail star keeps color, 120px size and original intensity expression. |
| Search fields/count and dimmed but clickable rows | Search sheet plus persistent active-state summary. Same statement/domain/category/linked-entry-text predicate; no thought-label or unlinked-entry search. Search count remains independent of filter and rewind. |
| Calendar dates, weekdays, discovered counts, cutoff/reset, undated behavior | Rewind sheet and catalogue indicator. Original milestones and cutoff predicates unchanged. Copy clarifies this is discovery visibility, not reconstruction of historical confidence or wording. Reset is now a native keyboard-accessible button. |
| All/category/active/dormant/recent/recurrent filters | Filter sheet plus active summary. Original predicates, >0.5 threshold, 30-day semantics and ceil(top 30%) cutoff including ties unchanged; empty categories remain disabled. |
| Node label/statement, category/domain, reviewed/reflection wording | Dedicated node hero with original large star. |
| Date, appearance count, confidence, review status | Compact two-column facts section. Exact original values and fallbacks. |
| History chart, point count and first-to-latest delta | Development section, only when at least two points exist. ConfidenceTrend unchanged. |
| Full chronological supporting writing and entry actions; missing entries | Supporting entries section. Original linked-ID resolution and date ordering unchanged. |
| Every saved excerpt/date | Evidence excerpts section, no cap or text truncation. |
| Connected belief statements and saved explanation | Connections section, informational only; original nonrejected catalogue resolution retained. |
| Unavailable node | Original dedicated fallback and Back to Journal. |
| Date/duration/full original writing | Original entry screen, before Saved analysis; whitespace preserved. |
| Optional Recap, situation, automatic thought, action urge | Saved analysis; Recap retains its own surface, What Stood Out uses a connected reading section. All original conditionals retained. |
| Emotions and intensities, possible cognitive patterns | Separately labelled groups; saved values and original tags retained. |
| Values explanation and candidate belief | Values direction; Belief This Fed Into. Missing fields stay absent. |
| Emotion distribution and value shifts | Premium Trends > Emotions and values. |
| Cognitive-pattern frequency and self-talk | Premium Trends > Thinking and language. |
| 12-week heatmap | Premium Trends > Recording activity. |
| All five chart calculations, encoding, top-six/top-eight limits, minimum weeks, empty states and accessible SVG/heatmap summaries | Existing chart components and aggregation functions are byte-for-byte unchanged, recorded in artifacts/journal/preservation-audit.json. New named groups provide headings and measurement descriptions without changing chart data. |
| Premium gate and broader-history scope | Trends switch/content only when store.isPro. Every chart still receives store.history, independent of catalogue state. |
| Internal return state | App-held JournalVisit ref: search, single filter, cutoff, active view, per-view scroll, originating node focus, per-node scroll. Node -> original entry -> same node -> same catalogue. No URL/storage changes. State lasts only for this app session. |

## Validation

- App and Node TypeScript checks passed.
- Production build passed; existing large-chunk warning remains.
- Existing Analysis literary regressions: 19 passed.
- Journal CSS skill lint: 0 failures, 0 warnings.
- Source preservation audit: all 15 named helpers/components match before implementation exactly, including all chart components and aggregation helpers plus Mind, Unconscious Patterns wrapper and authentication.
- Playwright: 320, 390, 768, 1440 widths, reduced motion; populated catalogue, combined search/filter/rewind, dimmed row keyboard activation, original-entry round trip, catalogue scroll/focus and node scroll restoration, switch state, all five charts and no page overflow.
- Edge browser fixtures: Premium off/on, all six empty categories, all chart empty states, rejected exclusion, long untruncated statement, missing node fields/evidence/entries/history, unavailable-node fallback.
- Reviewed mobile catalogue, node, entry and desktop Trends screenshots. Screenshots use isolated demo/test data, not invented production content.
- One in-flight browser run was interrupted by a development hot reload while polishing headings; rerun after source edits completed. Build initially needed elevated esbuild filesystem access, then passed.

## Limits

This remains a star catalogue rather than an all-entry chronological feed. Unlinked entries are not newly surfaced or searched. Rewind only dims discoveries after the cutoff. Connections remain informational. Navigation state is deliberately memory-only and resets on reload. Premium eligibility and charts' original statistical limitations are unchanged; no new generated insight, causal interpretation, backend, API or schema changes. Desktop retains the existing phone-frame presentation. Browser fixtures isolate API calls; no live AI service was exercised. No deployment or GitHub push performed.

Visual inspector: completed on a captured static Journal Trends page at 1440/768/390, 0 failures and 4 warnings. Warnings were reviewed: outer desktop phone-frame margins are existing intentional layout; neutral chart encodings are explicitly locked by this brief; strong lines are active control/tab markers rather than panel outlines; captured static page could not load the dev-only Geist font URL, so its fallback warning is specific to that capture. The live Playwright screenshots remain the primary visual evidence. The first inspector run hit a sandbox CDP timeout; rerun with Chromium access completed. No claim of zero-warning visual audit.
