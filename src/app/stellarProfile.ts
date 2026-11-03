// A compact unresolved light source with a smooth optical halo, not a
// polygon, shaded planet, or telescope-specific diffraction cross.
// CSS and the WebGL sprite consume this same radial intensity profile.
export const STELLAR_PROFILE = [
  [0, 1], [0.16, 1], [0.26, 0.85], [0.38, 0.28],
  [0.58, 0.09], [0.8, 0.025], [1, 0],
] as const;

export function stellarGradient(color: string): string {
  return `radial-gradient(circle closest-side, ${STELLAR_PROFILE.map(([radius, alpha]) => {
    const tint = radius <= 0.16 ? '#fff8ed' : color;
    return `color-mix(in srgb, ${tint} ${alpha * 100}%, transparent) ${radius * 100}%`;
  }).join(', ')})`;
}
