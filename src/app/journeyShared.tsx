import { motion, useReducedMotion } from "motion/react";
import { ivSurfaceSolid, ivHeading } from "./screenTheme";

// ── Screen 10.6 · Journey Map ─────────────────────────────────────────────────
// A standing figure, tiny and plain — charcoal silhouette, two pale eye
// dots, nothing a saturated "mascot" color could clash with. Reused at two
// sizes: small inline next to the current waypoint, larger standing alone
// in the empty state.
export function JourneyCharacter({ size = 34 }: { size?: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      animate={reducedMotion ? undefined : { y: [0, -2, 0] }}
      transition={reducedMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx="12" cy="8" r="4.4" fill={ivHeading} />
      <circle cx="10.3" cy="7.6" r="0.8" fill={ivSurfaceSolid} />
      <circle cx="13.7" cy="7.6" r="0.8" fill={ivSurfaceSolid} />
      <path d="M7 23c.3-6.4 2.2-9.6 5-9.6s4.7 3.2 5 9.6" fill={ivHeading} />
    </motion.svg>
  );
}
