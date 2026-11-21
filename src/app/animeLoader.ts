

// anime.js drives only two one-off moments (the onboarding brain demo and
// the processing constellation), so it loads on demand instead of sitting
// in the startup bundle. preloadIdle() warms it shortly after launch.
export const loadAnime = () => import("./anime");
