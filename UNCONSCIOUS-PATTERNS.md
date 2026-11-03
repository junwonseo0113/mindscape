# Unconscious Patterns: preservation and redesign

Scope: only the Unconscious Patterns presentation, its belief-detail navigation, and a static option for its existing connection illustration. Mind, Analysis, Journal and Home screen implementations are unchanged. No database, API, analysis framework, store, persistence or rejection changes.

## Inspected implementation and design decisions

The prior `ScreenBeliefMap` combined `BeliefCard`, `BeliefNetworkSection`, `ContradictionSection`, recurring assumptions and `ConnectionSpark` in one scroll. Its sources are the existing `Store.beliefs`, `history`, `assumptions` and `connections`. There are no extra API requests in this section.

Existing calculations retained: intensity-weighted `dominantEmotion`; `hasFunctionalLoopData`; latest eligible supporting entry and strongest emotion in `FunctionalLoopDiagram`; exact `confidenceHistory` points, first-to-last delta and chart geometry in `ConfidenceTrend`; `isLikelyRuminating`; root-only connected components with at least three members in `findBeliefClusters`; explicit contradiction relationships in `findContradictionPairs`; reversed evidence excerpts capped at two; original store ordering; exclusion by `userReaction !== 'rejected'`.

The existing `rejectBelief` callback still only marks `userReaction: 'rejected'`. It does not delete history. The existing `beliefs` and `assumptions` route wiring is unchanged, including whether a route supplies a rejection action.

The design-taste-frontend app workflow dealt **Data terminal**, seed **1553758620**, with existing palette and type retained and no redraw. The selected move is quiet labelled tabs with an underline. Mindscape's existing midnight surfaces and warm serif belief statements supply its identity. The screen's question is “Which recurring belief do I want to examine?” The real belief statement leads each summary, with its existing evidence count and status beside an explicit View belief action. No fixture data is added to normal sessions.

## Feature locations

| Preservation item | Location and behavior |
| --- | --- |
| Back to Mind, title, populated/empty introduction | Overview header; same existing parent callbacks and wording. |
| Reflection/diagnosis notice; three-entry threshold and full explanation | Explicit **About this analysis** disclosure available from every overview view. |
| Belief-versus-interpretation explanation | About this analysis; original first-visible-belief example, fallback and fixed illustrative situation retained verbatim. |
| Domain, statement, evidence count and applicable statuses | **Beliefs** summaries and full belief details. Original ordering; rejected beliefs excluded. |
| Thought label | Belief detail, conditional on the existing field. |
| Confidence percentage and bar | Belief detail, always visible. |
| Confidence chart, recorded point count and signed first-to-last delta | **Confidence history** disclosure; original chart component, shown with at least two recorded points. |
| Weighted predominant emotion and conditional recurrence observation | Belief detail, under the existing calculations and data conditions. |
| Distanced reframe | **See it from a distance**, with **Back to the original**. Original stored wording; no new AI call. |
| Cognitive-pattern tags, descriptions, benefit and caution | Individual native disclosures under **Cognitive patterns**, including **What helps** and **What to watch for**. Each can stay open independently. |
| Up to two most recent saved excerpts and dates | **Recent evidence** disclosure; original reverse-and-slice ordering. No new original-entry links. |
| Situation, automatic thought, strongest emotion/intensity, action urge, entry date and feedback note | **See why this pattern repeats**, with **Collapse repeat structure**. Original loop component and eligibility. |
| Reject observation | Existing **This observation doesn't match how I see it** action at the end of detail; returns to the overview after rejection. |
| Numbered assumptions, triggers, automatic interpretations, optional domains, conversation count and separate empty state | **Interpretations** view. Original source order and wording. |
| Reinforcing groups, count, member statements and circular diagram | **Connections → Beliefs That Support Each Other**, under the unchanged three-member/root-connection qualification. Diagram explicitly labelled a simplified group illustration. |
| Contradictory statements, saved explanation and neutral wording | **Connections → Tension Between What You've Said**, only for existing qualifying pairs. |
| Pairwise illustration, both domains/statements and saved note | **Connections → Discovered Connections**. Same endpoints, categories and links; static illustration in this section only. View belief buttons open either endpoint's detail. |
| Return view, scroll and focus | In-memory state per view; details replace the overview, and Back restores its active view/scroll and originating control. No persistence contract changes. |

## Presentation and accessibility

`UnconsciousPatterns.tsx` owns only view selection, detail selection, the About disclosure, scroll restoration and focus. CSS is scoped under `patterns-*`. The three tabs use keyboard arrows/Home/End and accessible tab states. Cognitive tags and supporting information use native disclosure semantics; repeat-cycle and reframe controls expose their state. Buttons have comfortable touch targets and visible focus. No nested disclosure hierarchy is added. The reading pane owns scrolling and has safe-area bottom padding. The initial Mind/Analysis overview remains intact.

## Verification

- `tests/unconscious-patterns-ui.mjs`: isolated populated, missing-optional-data, long-statement, conflicting-evidence, empty and all-rejected fixtures; 320, 390, 768 and 1440px viewports. Checks all views, keyboard access, independent tag expansion/collapse, reframe return, confidence chart/count/delta, weighted emotion, conditional recurrence, evidence ordering, cycle expansion/collapse, rejection without changing history, and restoration from Beliefs and Connections details.
- `artifacts/patterns/preservation-audit.json`: source comparison confirms unchanged calculation helpers, group diagram geometry, analysis/store/type files, and surrounding screen functions.
- Screenshots and test results are stored in `artifacts/patterns/`. Screenshot fixtures are examples only.

Final results: all four responsive interaction runs and the empty/all-rejected state runs passed; both TypeScript configurations passed; seven existing home-map model tests passed; the existing full-screen sweep passed all 84 frame/background/safe-area/seam checks; the production build passed with its pre-existing large-chunk warning.

Design skill source lint: 0 failures, 0 warnings. The production-CSS static capture inspection at 390/768/1440px also completed with no remaining findings after two documented allowances: `palette-cream` retains the explicitly required warm ivory typography, and `covered-text` compensates for the inspector forcing the existing decorative frame overlays to receive pointer events. Normal Chromium hit-testing returned the heading itself, and visual review plus the live interactive runs showed no covered title. The static capture is an extra CSS inspection, not a replacement for the live app's responsive JavaScript/frame checks. The actual app's existing centered desktop phone frame remains unchanged.

Existing limitations retained: the source excerpts are capped at two; missing optional data stays absent; confidence is an existing hypothesis-strength metric rather than a diagnosis; the group diagram is simplified; the educational example keeps its existing fixed situation. This pass adds no search, filtering, sorting, direct editing, philosopher perspectives, backend operations or entry-link features.
