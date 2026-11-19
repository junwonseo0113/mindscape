// ── Typefaces ────────────────────────────────────────────────────────────────
// The app's five type roles, in one place so every screen (App, the night
// sky) draws from the same set. All self-hosted via Fontsource; see the
// imports at the top of styles/index.css.
//
//   display — Instrument Serif: titles and large statements (20px and up),
//             the slim editorial lettering of a notebook cover. Hangul
//             falls back to Gowun Batang.
//   hand    — Caveat, with Nanum Pen Script for Hangul: the handwriting —
//             datelines, section labels, and what you write on a page.
//   serif   — Source Serif 4: reading text below 20px, where a display
//             serif gets tight.
//   sans    — Pretendard: interface text (Inter-based, covers Korean).
//   mono    — JetBrains Mono: numbers and counts.
export const display = { fontFamily: "'Instrument Serif', 'Gowun Batang', Georgia, serif", fontWeight: 400 as const };
export const hand = { fontFamily: "'Caveat Variable', 'Nanum Pen Script', 'Gowun Batang', cursive" };
export const serif = { fontFamily: "'Source Serif 4 Variable', 'Gowun Batang', Georgia, serif" };
export const sans = { fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif" };
export const mono = { fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" };
export const MONO_FAMILY = mono.fontFamily;
