// ── Home's orb field ─────────────────────────────────────────────────────────
// Home's beliefs as glowing orbs, drawn in plain HTML with the shared 2D
// orb (orb.tsx), the same one the night sky and every list use.
//
// This used to be a three.js canvas (JarBrainPreview). It only ever drew a
// handful of orbs, but it spun up a WebGL context every time Home mounted,
// which froze the screen for around half a second on each return to Home.
// The orbs look the same; they're now buttons that float gently on CSS
// (.float-drift), placed by a small deterministic layout so the field is
// the same every visit.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Node } from "./orb";
import { REGION_CONFIG, resolveRegion, type NeuralBeliefNode } from "./brainRegions";

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Placed = { b: NeuralBeliefNode; x: number; y: number; size: number };

// The strongest belief or two are drawn largest (the same "core" idea the
// 3D field used); every orb gets room for its glow; the bottom-right corner
// stays clear for the "Your sky" link.
function place(beliefs: NeuralBeliefNode[], w: number, h: number): Placed[] {
  if (!w || !h || beliefs.length === 0) return [];
  const sorted = [...beliefs].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
  const n = sorted.length;
  const unit = Math.min(w, h);
  const base = n <= 6 ? 1 : n <= 12 ? 0.8 : 0.62;
  const out: Placed[] = sorted.map((b, i) => {
    const angle = (hash(b.id) % 360) * (Math.PI / 180) * 0.15 + i * 2.39996;
    const r = n === 1 ? 0 : Math.sqrt((i + 0.6) / n) * unit * 0.38;
    const size = Math.round((22 + (b.confidence / 100) * 26) * base * (i < Math.min(2, Math.ceil(n / 4)) ? 1.25 : 1));
    return { b, size, x: w / 2 + Math.cos(angle) * r * 1.15, y: h / 2 + Math.sin(angle) * r * 0.9 };
  });
  const pad = (p: Placed) => p.size * 1.3;
  for (let pass = 0; pass < 60; pass++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], c = out[j];
        const dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = (a.size + c.size) * 1.25;
        if (d >= min) continue;
        const push = (min - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        c.x += (dx / d) * push; c.y += (dy / d) * push;
      }
    }
    out.forEach((p) => {
      p.x = Math.max(pad(p), Math.min(w - pad(p), p.x));
      p.y = Math.max(pad(p), Math.min(h - pad(p), p.y));
      if (p.x > w - 170 && p.y > h - 60) p.y = h - 60 - pad(p) * 0.5;
    });
  }
  return out;
}

export function HomeOrbField({ beliefs, selectedId, onSelectNode, onBackgroundTap }: {
  beliefs: NeuralBeliefNode[];
  selectedId?: string | null;
  onSelectNode?: (id: string) => void;
  onBackgroundTap?: () => void;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const placed = useMemo(() => place(beliefs, size.w, size.h), [beliefs, size.w, size.h]);

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onBackgroundTap?.(); }}>
      {placed.map((p, i) => {
        const region = resolveRegion(p.b);
        const h = hash(p.b.id);
        const sel = selectedId === p.b.id;
        return (
          <div key={p.b.id} className={reduce ? undefined : "float-drift"}
            style={{
              position: "absolute", left: p.x, top: p.y, width: 0, height: 0,
              ["--fx" as string]: `${4 + (h % 7)}px`, ["--fy" as string]: `${5 + ((h >> 3) % 7)}px`,
              ["--dur" as string]: `${11 + (h % 9)}s`, ["--delay" as string]: `-${(h % 13)}s`,
            } as React.CSSProperties}>
            <motion.button
              type="button"
              aria-label={`${REGION_CONFIG[region].label}: ${p.b.statement}`}
              aria-pressed={sel}
              onClick={() => onSelectNode?.(p.b.id)}
              initial={reduce ? false : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: sel ? 1.18 : 1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: reduce ? 0 : 0.05 + i * 0.06 }}
              style={{
                position: "absolute", left: 0, top: 0, x: "-50%", y: "-50%", padding: 8, margin: 0, border: 0,
                background: "transparent", borderRadius: "50%", cursor: "pointer", lineHeight: 0, WebkitTapHighlightColor: "transparent",
              }}
            >
              <Node color={REGION_CONFIG[region].color} size={p.size} intensity={0.65 + (p.b.confidence / 100) * 0.35} />
            </motion.button>
          </div>
        );
      })}
    </div>
  );
}
