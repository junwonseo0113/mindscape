import React from "react";
import { motion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { CognitiveRegion } from "./neuralBrainLayout";
import { Breathe, SETTLE } from "./motionPrimitives";
import { shape } from "./screenTheme";

// The header's icon buttons (Search / Rewind / Filter): the same bare
// 19px glyphs Mind and Analysis put in their headers, so the three tabs
// share one header grammar. A sheet that's open, or a search/filter/date
// that's still applied, shows as Material 3's tonal icon-button state — a
// soft filled circle — instead of a caption under the icon.
export function HistoryControlButton({ icon, label, active, onClick, tone = "relationships" }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; tone?: CognitiveRegion }) {
  const c = REGION_CONFIG[tone];
  return (
    <Breathe inline amount={1.08}>
      <motion.button
        type="button" aria-label={label} aria-pressed={active || undefined} onClick={onClick}
        whileTap={{ scale: 0.9 }} transition={SETTLE}
        whileFocus={{ boxShadow: "0 0 0 3px rgba(42,38,33,.14)" }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: shape.full, border: 0, color: c.ink,
          backgroundColor: active ? `${c.color}33` : "#FFFCF6", boxShadow: `inset 0 0 0 1px ${c.color}${active ? "88" : "44"}, 0 6px 12px -8px ${c.ink}`,
          cursor: "pointer", WebkitTapHighlightColor: "transparent",
        }}
      >
        <span style={{ display: "flex" }}>{icon}</span>
      </motion.button>
    </Breathe>
  );
}
