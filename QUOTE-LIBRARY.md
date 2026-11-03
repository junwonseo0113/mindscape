# Opening quote library

The opening collection contains 100 quotes: the original 12, retained unchanged, and 88 additions from 22 authors. There are 31 authors in total. Each quote has a distinct illustration. New authors have four separately drawn poses, stored together on a transparent 2×2 portrait plate and displayed individually with CSS cropping. Only the currently selected plate is downloaded by the image element.

The opening chooses an author randomly, excludes the author from the previous launch when local storage is available, then chooses one of that author's quotes. The selection stays fixed during the visit. Refresh or reopen to see another author. The existing tap-to-continue, automatic continuation and reduced-motion behavior remain.

## Sources and wording

Every new entry in [additionalQuotes.ts](src/app/additionalQuotes.ts) includes its source title, edition link and translator where applicable. Quotations are selected passages, sometimes taken from a longer sentence; capitalization and terminal punctuation may be normalized. Poetry retains line breaks. Dialogue passages are attributed to the author of the work. The four Douglass passages were checked against the original 1857 printing, printed page 22 (PDF page 24).

The other 84 additions were checked as consecutive words against the cited public-domain editions. Research texts and the verification report are in `artifacts/quote-research/`; these files are not imported into the app. The original 12 are preserved as requested; the new source audit does not make an attribution claim about those existing entries.

## Artwork

The new portraits were made with the built-in image generation tool, using the existing Maya Angelou illustration as the style reference. Each author's four poses differ in viewpoint or expression. For ancient figures, these are imagined portraits rather than claims of photographic likeness. Transparent areas expose the existing opening sky. The prompt manifest is `QUOTE-LIBRARY-PROMPTS.json`; final plates are in `src/assets/quote-portraits/`. Five plates received an additional background-removal pass; those final output paths and prompts are recorded in `QUOTE-LIBRARY-CLEANUP.json`.

## Validation

`node tests/quote-library-check.mjs` checks the total, uniqueness and source wording. `tests/quote-portraits-ui.mjs` exercises all 100 quote/portrait combinations, checks alpha transparency for each individual atlas cell, and captures screenshots. The longest new passage is checked at small mobile and desktop sizes. `tests/quote-random-ui.mjs` checks eight real launches and visit stability. `tests/quote-smoke.mjs` checks continuation into the app.
