// The only two anime.js functions the app uses. App.tsx loads this module
// with a dynamic import so anime.js stays out of the startup bundle; going
// through named re-exports (instead of import("animejs") directly) keeps
// the lazy chunk tree-shaken to just these two.
export { animate, stagger } from "animejs";
