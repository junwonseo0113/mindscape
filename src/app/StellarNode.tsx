import { stellarGradient } from './stellarProfile';

export default function StellarNode({ color = '#ffe2b2', size = 40, intensity = 1 }: { color?: string; size?: number; intensity?: number }) {
  return <span aria-hidden="true" data-stellar-node="true" style={{
    display:'block', flexShrink:0, width:size, height:size, borderRadius:'50%',
    background:stellarGradient(color), opacity:0.65 + Math.max(0, Math.min(1, intensity)) * 0.35,
    pointerEvents:'none',
  }}/>;
}
