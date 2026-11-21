

// ── Screen 10 · Identity Drift ────────────────────────────────────────────────
// Identity Drift isn't a before/after mood chart — it's a gap between a
// stated aspiration and the pattern actually observed since. The quote is
// something the person said about who they wanted to become; the bar below
// it is how close recent behavior actually tracks that, not a vague mood
// score. This is the one screen most tied to the mission line "helps you
// consciously become the person you want to be" — it has to show the gap
// plainly, not soften it into a neutral-sounding statistic.
// ── GoalRoad ─────────────────────────────────────────────────────────────────
// Distance from a goal, drawn as a road: a winding lane runs from the
// bottom of the scene to a flag on the far hill, and a glowing orb — the
// same light the app uses for a belief — stands on it where the person is.
// The stretch already walked glows; what's left is plain road. The scene
// lives a little (clouds drift, the lane's center dashes roll forward, the
// pennant flutters, the sun breathes) and the orb walks out to its spot
// when the card appears. All of it stops under reduced motion.
//
// `progress` is 0..1 (start → flag). `milestones` (also 0..1) are posts
// along the way — check-ins, when the distance itself isn't measured.
export type RoadPoint = [number, number];

// ── Explainer illustrations ──────────────────────────────────────────────────
// Small animated drawings that carry what used to be a paragraph. Each one
// is a mechanism shown, not decoration: where your data goes, how a belief
// relates to an interpretation, what the app does with what you say. The
// sentences they replace are kept — as short captions under the picture,
// and in full behind a "Full details" row wherever the wording is a
// promise (privacy, consent). Every one stops moving under reduced motion
// and has an aria-label saying the same thing in words.

// Sample a cubic Bézier into keyframes for an SVG "travels along a path"
// dot (motion animates cx/cy through the samples).
export function bezierSamples(p0: RoadPoint, p1: RoadPoint, p2: RoadPoint, p3: RoadPoint, n = 12) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    xs.push(u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]);
    ys.push(u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]);
  }
  return { xs, ys };
}
