import { motion } from "motion/react";
import { REGION_CONFIG, resolveRegion } from "./brainRegions";
import { CognitiveRegion } from "./neuralBrainLayout";
import { StoredBelief } from "./types";
import { AnimatedNumber, Breathe, MeterFill, SETTLE } from "./motionPrimitives";
import { Node } from "./orb";
import { display, mono, sans } from "./typefaces";
import { X } from "@phosphor-icons/react";
import { shape, ivSurfaceHigh, ivBorder, ivHeading, ivBody, ivFaint } from "./screenTheme";

// What one point in Home's field is, read right there — the Brain Map is
// for exploring, not for finding out what you just tapped. Shows the same
// facts the map's own panel leads with (region, the belief, how sure and
// on how much evidence) and offers the map as a next step, never as the
// only way to learn what a dot means.
// ── RegionBadge ──────────────────────────────────────────────────────────────
// The category badge: the region's pale tint under its dark ink (the two
// text-safe steps in REGION_CONFIG). It replaces the 9–10px tracked-caps
// eyebrow in faint gray that used to name the region — the least legible
// text in the app at 2.3:1. Sentence case, because a badge is a label,
// not a heading.
export function RegionBadge({ region, size = 11 }: { region: CognitiveRegion; size?: number }) {
  const r = REGION_CONFIG[region];
  return (
    <span style={{ ...sans, fontSize: size, fontWeight: 600, lineHeight: 1, color: r.ink, backgroundColor: r.tint, padding: "4px 7px", borderRadius: 6, whiteSpace: "nowrap", flexShrink: 0 }}>
      {r.label}
    </span>
  );
}

export function HomeNodeCard({ belief, onClose, onOpenInMap }: { belief: StoredBelief; onClose: () => void; onOpenInMap: () => void }) {
  const region = resolveRegion(belief);
  const color = REGION_CONFIG[region].color;
  return (
    <motion.div
      role="dialog" aria-label={`About this belief: ${belief.statement}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      // Leaves fast so tapping a second point swaps cards instead of
      // briefly stacking two.
      exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.14, ease: "easeIn" } }}
      transition={SETTLE}
      style={{
        position: "absolute", left: 20, right: 20, top: "44%", zIndex: 3,
        backgroundColor: ivSurfaceHigh, border: `1px solid ${ivBorder}`, borderRadius: shape.lg, padding: "14px 16px 12px",
        boxShadow: "0 14px 36px rgba(120,105,80,0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Node color={color} size={12} intensity={Math.min(1, 0.45 + (belief.confidence / 100) * 0.4)} />
        <RegionBadge region={region} />
        <span style={{ ...sans, fontSize: 12, color: ivBody, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{belief.domain}</span>
        <Breathe inline amount={1.1} style={{ lineHeight: 0 }}>
          <motion.button type="button" aria-label="Close" onClick={onClose} whileTap={{ opacity: 0.6 }} style={{ border: 0, background: "transparent", padding: 4, margin: -4, cursor: "pointer", color: ivFaint, lineHeight: 0, WebkitTapHighlightColor: "transparent" }}><X size={14} weight="bold" /></motion.button>
        </Breathe>
      </div>
      {belief.thoughtLabel && (
        <div style={{ ...sans, fontSize: 11, fontStyle: "italic", color: ivBody, marginTop: 8 }}>The "{belief.thoughtLabel}" thought</div>
      )}
      <div style={{ ...display, fontSize: 20, lineHeight: 1.4, color: ivHeading, marginTop: belief.thoughtLabel ? 3 : 8, wordBreak: "keep-all" }}>{belief.statement}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <MeterFill value={belief.confidence} color={color} track="rgba(42,38,33,0.08)" style={{ flex: 1 }} />
        <span style={{ ...mono, fontSize: 11, color: ivBody, flexShrink: 0 }}><AnimatedNumber value={belief.confidence} />% · {belief.evidenceCount} entr{belief.evidenceCount === 1 ? "y" : "ies"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <Breathe inline amount={1.05}>
          <motion.button type="button" onClick={onOpenInMap} whileTap={{ scale: 0.96, opacity: 0.8 }} transition={SETTLE}
            style={{ ...sans, fontSize: 12, fontWeight: 700, color: ivHeading, border: `1px solid ${ivBorder}`, background: "transparent", borderRadius: 999, padding: "6px 12px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            See it in your sky →
          </motion.button>
        </Breathe>
      </div>
    </motion.div>
  );
}
