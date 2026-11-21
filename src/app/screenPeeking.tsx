import React from "react";

// ── 3D, loaded off the startup path ──────────────────────────────────────────
// three.js + react-three-fiber, plus the brain-cloud generation that runs at
// module load, used to be in the one startup bundle — parsed and executed
// while the quote screen was trying to fade in. They're now separate chunks:
// the sky is fetched in the background shortly after launch (see preload3D
// in App); three.js loads only when a screen that still uses it opens.
const load3D = () => import("./NeuralBeliefGraph3D");
export const loadBrainMap = () => import("./StarGazeMap");
// The swipe-back "screen underneath" (see peekContent in App) re-mounts a
// cached screen for the length of a gesture. Everything in a screen is
// cheap to re-mount except a WebGL canvas: creating a GL context and its
// textures mid-drag is exactly the kind of work that makes the first frames
// of a swipe stutter. So the 3D views render nothing while they're only
// being peeked at — the rest of the screen still shows through.
export const PeekContext = React.createContext(false);
function skipWhilePeeking<P extends object>(Comp: React.LazyExoticComponent<React.ComponentType<P>>) {
  return function PeekAware(props: P) {
    return React.useContext(PeekContext) ? null : <Comp {...(props as any)} />;
  };
}
export const NeuralBeliefGraph3D = skipWhilePeeking(React.lazy(load3D));
export const BrainNodeMapScreen = skipWhilePeeking(React.lazy(loadBrainMap));
