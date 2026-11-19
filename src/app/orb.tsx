// ── The orb ──────────────────────────────────────────────────────────────────
// The app's one 2D "ball of light": a soft halo, a body that dissolves at
// its own edge around a white center, and light drifting inside it
// (.orb-flow in styles/index.css). Lists, cards, sheets and the night sky
// all draw beliefs with this, so a belief looks like the same thing
// everywhere it appears.
import * as React from "react";

// ── The shared Node primitive ────────────────────────────────────────────────
// The one canonical "glowing belief node" component — a tiny near-white
// core that transitions outward into the category color, wrapped in a soft
// diffused halo. Originally History's own CatalogueOrb; promoted to the
// app's shared Node component for the ivory redesign (see the "Global node
// system" pass) since it already does exactly what that pass asked for:
// real CSS/DOM (not a baked-in image), a solid luminous center + soft
// outer glow with no hard neon edge, and colors that read clearly on a
// light ivory ground (radial gradients to real color stops, not the
// dark-ground-assuming additive blending the WebGL Brain Map uses) —
// deliberately the same "dim halo → colored luminous body → bright core"
// layering the Brain Map's own nodes use (see ActiveBeliefNode/the
// point+glow+bloom sprite stack in NeuralBeliefGraph3D), so a node here and
// one there read as the same object seen two ways, not two unrelated
// marks. Used by Home's node field, Analysis's Discovery/Insight cards, and
// History's catalogue. `intensity` (0..1) is one knob for "how much this
// node has earned" — currently a blend of confidence and vitality/recency
// depending on the caller, but any future reinforcement signal can feed the
// same prop without this component changing at all.
export function Node({ color, size, intensity }: { color: string; size: number; intensity: number }) {
  const glow = Math.round(size * 2.3);
  // Inner flow (see .orb-flow in styles/index.css): two soft blobs of
  // light inside the core drift on a slow loop. Each orb starts at its own
  // point in the cycle so a list of them never pulses in unison.
  const flowDelay = React.useMemo(() => `-${(Math.random() * 11).toFixed(2)}s`, []);
  return (
    <div aria-hidden style={{ position: "relative", width: glow, height: glow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div
        style={{
          position: "absolute", width: glow, height: glow, borderRadius: "50%",
          background: `radial-gradient(circle, ${color}47 0%, ${color}17 42%, transparent 72%)`,
          opacity: 0.42 + intensity * 0.4,
        }}
      />
      <div
        style={{
          // A centered highlight (not an off-axis one) and a body that
          // dissolves to transparent at its own edge — rather than a
          // crisp, opaque circular silhouette with a corner glint — are
          // what keep this reading as "a concentration of light" instead
          // of a lit, shaded 3D ball (a marble/planet).
          position: "relative", width: size, height: size, borderRadius: "50%", display: "block",
          backgroundImage: `radial-gradient(circle at 46% 42%, #FFFFFF 0%, #FFFFFF 7%, ${color}D9 24%, ${color}8C 52%, ${color}00 88%)`,
          boxShadow: `0 0 ${Math.round(size * 0.6)}px ${color}4D`,
          opacity: 0.6 + intensity * 0.4,
        }}
      >
        {/* The mask keeps the moving light inside the body's own soft edge
            (no crisp disc), and the oversized child is what moves. */}
        <span
          style={{
            position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden",
            WebkitMaskImage: "radial-gradient(circle closest-side, #000 40%, transparent 100%)",
            maskImage: "radial-gradient(circle closest-side, #000 40%, transparent 100%)",
          }}
        >
          <span
            className="orb-flow"
            style={{
              position: "absolute", inset: "-35%",
              backgroundImage: [
                "radial-gradient(circle at 34% 38%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 26%)",
                `radial-gradient(circle at 66% 62%, ${color} 0%, ${color}00 34%)`,
                "radial-gradient(circle at 44% 74%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 22%)",
              ].join(", "),
              ["--orb-delay" as string]: flowDelay,
            } as React.CSSProperties}
          />
        </span>
      </div>
    </div>
  );
}
