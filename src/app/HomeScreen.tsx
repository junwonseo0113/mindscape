import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { REGION_CONFIG, resolveRegion } from "./brainRegions";
import { CognitiveRegion, COGNITIVE_REGIONS } from "./neuralBrainLayout";
import { Store, StoredBelief } from "./types";
import { closenessAt, weekChange } from "./aspirationPath";
import { VoyageCard } from "./Voyage";
import { AnimatedNumber, Breathe, SETTLE } from "./motionPrimitives";
import { HomeOrbField } from "./HomeOrbField";
import { display, hand, mono, sans } from "./typefaces";
import { ArrowRight, PenNib, Sparkle, User } from "@phosphor-icons/react";
import { daysSinceLastEntry, voyageAnchor } from "./entryTiming";
import { dkHeading, dkBody, dkAccentLight, dkAccentSoft, dkTrack, dkDivider, mdHeading, mdBody, mdBodyLight, mdAccentText, mdAccentSoft, mdDivider, mdNeutralTag, mdNeutralTagText, ivBackground, ivSurfaceSolid, ivCardShadow, shape, ivHeading, ivBody, ivFaint } from "./screenTheme";
import { HomeNodeCard } from "./regionUI";
import { WaveformIcon, BottomNav } from "./screenUI";
import { QuickMoodCheckIn } from "./moodUI";
import { Emph } from "./insightText";

// ── Screen 4 · Home ────────────────────────────────────────────────────────────
// Kept to what Home is for, top to bottom: the day's date and the profile
// icon; the question; your beliefs as orbs (tap one to read it in place,
// or "Your sky" to open the full night sky); "Speak your mind"; and the
// quick mood check-in. Everything else — today's discovery, counts by
// region, search — lives on its own tab (Analysis, the sky, Diary).
export function ScreenHome({ onNavSelect, onStartThink, onOpenBrainMap, onOpenVoyage, onSetAspiration, store, updateStore }: { onNavSelect?: (id: string) => void; onStartThink?: (mood?: string) => void; onOpenVoyage?: () => void; onSetAspiration?: () => void; onOpenBrainMap?: (region?: CognitiveRegion, beliefId?: string) => void; store: Store; updateStore?: (updater: (prev: Store) => Store) => void }) {
  // Tapping a point explains it in place (HomeNodeCard); the Brain Map
  // itself is entered only through its own button — or from that card.
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const selectedBelief = selectedNodeId ? store.beliefs.find((b) => b.id === selectedNodeId) ?? null : null;
  const daysAway = daysSinceLastEntry(store.history);

  return (
    <div
      style={{
        position: "absolute", top: -30, left: 0, right: 0, bottom: 0, ...ivBackground, overflow: "hidden",
        // Inside, a plain column: header, headline, the node field taking
        // whatever height is left, its caption bar, the bottom stack, nav.
        // Percent-of-screen placement used to let the caption and the
        // stack collide on a short phone; in a column only the field
        // gives way.
        display: "flex", flexDirection: "column",
        // Every other screen just fills its slot (height: 100%) below the
        // App shell's fixed status-bar clearance. Home is the one screen
        // whose composition is meant to run edge-to-edge under the
        // transparent status bar overlay (see the App shell), so instead
        // of asking the shared frame to change shape for it — the actual
        // cause of an earlier bug where switching screens made the whole
        // frame visibly jump — Home extends itself 30px above its given
        // slot instead. Header, node field, mind summary, Speak-your-mind
        // card, and nav all sit on the one ivory canvas by percentage, all
        // visible at once with no overflow:auto anywhere (unchanged from
        // before — only the backdrop and every surface's styling changed).
      }}
    >
      {/* top is a fixed px, not a %, specifically so it stays clear of
      the real device status bar / the desktop preview's transparent
      "9:41" overlay (see the App shell) regardless of screen height. */}
      <div style={{ padding: "34px 24px 0", flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        {/* Today's date, written the way a diary heads a page. */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, ...hand, fontSize: 21, fontWeight: 500, color: ivBody }}>
          <PenNib size={14} weight="fill" color={REGION_CONFIG.identity.color} aria-hidden />
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Breathe inline amount={1.08} style={{ lineHeight: 0 }}>
          <motion.div
            role="button" tabIndex={0} aria-label="Open profile" onClick={() => onNavSelect?.("profile")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavSelect?.("profile"); } }}
            whileTap={{ opacity: 0.6 }} style={{ cursor: "pointer" }}
          >
            <User size={20} color={ivHeading} />
          </motion.div>
          </Breathe>
        </div>
      </div>

      <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
        <div style={{ ...display, fontSize: "clamp(24px, 7vw, 30px)", fontWeight: 400, lineHeight: 1.2, color: ivHeading, wordBreak: "keep-all" }}>
          What crossed your mind today?
        </div>
      </div>

      {/* The main feature: how close you are to who you want to be. */}
      <div style={{ padding: "16px 18px 0", flexShrink: 0 }}>
        <VoyageCard
          closeness={closenessAt(store.history)} change={weekChange(store.history, voyageAnchor(store.history))}
          aspiration={store.aspiration} onOpen={onOpenVoyage} onSetAspiration={onSetAspiration}
        />
      </div>

        <>
          {/* Your beliefs as orbs (HomeOrbField: plain HTML, the same 2D orb
          the sky and every list use — it replaced a three.js canvas that
          froze Home for ~0.5s on every mount).
          Tapping an orb opens HomeNodeCard for that belief right here;
          tapping empty space just dismisses the card. The field never
          opens the Brain Map by itself any more — that's the explicit
          button in the corner (or the card's own link). */}
          <div data-tutorial="brain-card" data-shared="brain-jar" style={{ position: "relative", flex: 1, minHeight: 120, margin: "4px 4% 0" }}>
            <HomeOrbField
              beliefs={store.beliefs}
              selectedId={selectedNodeId}
              onSelectNode={(id) => setSelectedNodeId((cur) => (cur === id ? null : id))}
              onBackgroundTap={() => setSelectedNodeId(null)}
            />
            {/* With zero beliefs the canvas has nothing to draw, so a
                single resting dot marks where the first belief will
                appear (pointerEvents: none — nothing here to open yet). */}
            {/* The one way into the full sky from Home: a small link on the
                field's own corner, with the count it opens onto. */}
            {store.beliefs.length > 0 && (
              <div style={{ position: "absolute", right: 12, bottom: 6, zIndex: 2 }}>
                <Breathe inline amount={1.05}>
                  <motion.button
                    type="button" aria-label="Open your sky" onClick={() => onOpenBrainMap?.()}
                    whileTap={{ scale: 0.95 }} transition={SETTLE}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, borderRadius: shape.full, padding: "6px 12px 6px 10px", cursor: "pointer",
                      backgroundColor: "rgba(255,252,246,0.85)", boxShadow: ivCardShadow, WebkitTapHighlightColor: "transparent" }}
                  >
                    <Sparkle size={13} weight="fill" color={REGION_CONFIG.identity.color} />
                    <span style={{ ...hand, fontSize: 19, fontWeight: 600, color: ivHeading, lineHeight: 1 }}>Your sky</span>
                    <span style={{ ...hand, fontSize: 17, fontWeight: 500, color: ivBody, lineHeight: 1 }}>· <AnimatedNumber value={store.beliefs.length} memoryKey="home.beliefs" /> {store.beliefs.length === 1 ? "star" : "stars"}</span>
                  </motion.button>
                </Breathe>
              </div>
            )}
            {store.beliefs.length === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, pointerEvents: "none" }}>
                <motion.div
                  animate={{ scale: [1, 1.04, 1], opacity: [0.5, 0.75, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: 14, height: 14, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #C9B48A 0%, #A68F5E 70%, #8A7647 100%)", boxShadow: "0 0 18px rgba(166,143,94,0.35)" }}
                />
                <div style={{ ...display, fontStyle: "italic", fontSize: 15, color: ivFaint, textAlign: "center" }}>Your first thought will appear here.</div>
              </div>
            )}
          </div>
          <AnimatePresence>
            {selectedBelief && (
              <HomeNodeCard
                key={selectedBelief.id}
                belief={selectedBelief}
                onClose={() => setSelectedNodeId(null)}
                onOpenInMap={() => { setSelectedNodeId(null); onOpenBrainMap?.(undefined, selectedBelief.id); }}
              />
            )}
          </AnimatePresence>

        </>


      {/* The bottom stack sits in the column above the nav, so on a short
          phone it's the node field above that gives way, never the three
          things a person came here to do. */}
      <div style={{ padding: "14px 20px 10px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <div data-tutorial="think-card">
          <Breathe amount={1.025}>
          <motion.div
            role="button" tabIndex={0} onClick={() => onStartThink?.()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onStartThink)?.(); } }} whileTap={{ scale: 0.98, opacity: 0.92 }} transition={SETTLE}
            style={{ display: "flex", alignItems: "center", gap: 14, backgroundColor: ivSurfaceSolid, borderRadius: shape.lg, padding: "14px 18px", cursor: "pointer", boxShadow: ivCardShadow }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: ivHeading, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <WaveformIcon color="#fff" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ ...display, fontSize: 20, color: ivHeading }}>Speak your mind</span>
              <span style={{ ...hand, fontSize: 18, fontWeight: 500, color: ivBody, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{daysAway !== null && daysAway >= 2 ? `It's been ${daysAway} days` : "It's okay if it's not organized"}</span>
            </div>
            <ArrowRight size={16} color={ivHeading} weight="bold" style={{ flexShrink: 0 }} />
          </motion.div>
          </Breathe>
        </div>
        <QuickMoodCheckIn updateStore={updateStore} onSayWhy={(mood) => onStartThink?.(mood)} />
      </div>

      <div style={{ flexShrink: 0 }}>
        <BottomNav active="home" onSelect={onNavSelect} vintage />
      </div>
    </div>
  );
}

// Per-region count of active beliefs, using the exact same region
// classification the 3D brain itself uses (resolveRegion, exported from
// NeuralBeliefGraph3D) — so this list can never disagree with what the
// brain above it is actually showing.
function RegionBreakdown({ beliefs }: { beliefs: StoredBelief[] }) {
  const counts = new Map<CognitiveRegion, number>();
  COGNITIVE_REGIONS.forEach((r) => counts.set(r, 0));
  beliefs.forEach((b) => counts.set(resolveRegion(b), (counts.get(resolveRegion(b)) ?? 0) + 1));
  const total = beliefs.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {COGNITIVE_REGIONS.map((region) => {
        const count = counts.get(region) ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={region} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: REGION_CONFIG[region].color, flexShrink: 0 }} />
            <span style={{ ...sans, fontSize: 13, color: mdBodyLight, flex: 1 }}>{REGION_CONFIG[region].label}</span>
            <span style={{ ...mono, fontSize: 12, color: mdBody }}>{count}</span>
            <span style={{ ...mono, fontSize: 12, color: mdAccentText, width: 36, textAlign: "right" }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// Fallback for "related active neurons" — the crimson glow on the brain above is
// subtle at this card's small embed size (a real point in a dense field,
// not a big obvious marker), so this gives a guaranteed-legible list of
// exactly which beliefs make up today's discovery, plus the relationship
// note between them when the graph itself would already be drawing a line
// there — reuses store.connections rather than inventing a second notion
// of "related."
export function DiscoveryBeliefList({ beliefIds, store, modernist = false }: { beliefIds: string[]; store: Store; modernist?: boolean }) {
  const items = beliefIds.map((id) => store.beliefs.find((b) => b.id === id)).filter((b): b is StoredBelief => !!b);
  if (items.length === 0) return null;
  const notes = store.connections.filter((c) => beliefIds.includes(c.a) && beliefIds.includes(c.b) && c.note);
  const tagBg = modernist ? mdNeutralTag : dkTrack;
  const tagText = modernist ? mdNeutralTagText : dkBody;
  const heading = modernist ? mdHeading : dkHeading;
  const body = modernist ? mdBody : dkBody;
  const noteBg = modernist ? mdAccentSoft : dkAccentSoft;
  const noteText = modernist ? mdAccentText : dkAccentLight;
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${modernist ? mdDivider : dkDivider}` }}>
      <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: body, letterSpacing: "0.06em" }}>
        The beliefs behind this discovery · the spots glowing on your brain
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {items.map((belief) => (
          <div key={belief.id} style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: tagBg, borderRadius: 12, padding: "10px 12px" }}>
            <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: tagText, flexShrink: 0 }}>{belief.domain}</span>
            <span style={{ ...display, fontSize: 15, color: heading, flex: 1, lineHeight: 1.4, wordBreak: "keep-all" }}>{belief.statement}</span>
            <span style={{ ...mono, fontSize: 11, color: tagText, flexShrink: 0 }}>{belief.confidence}%</span>
          </div>
        ))}
      </div>
      {notes.map((c, i) => (
        <div key={i} style={{ ...sans, fontSize: 12, color: noteText, backgroundColor: noteBg, borderRadius: 10, padding: "10px 12px", marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all" }}>
          <Emph text={c.note} color={noteText} />
        </div>
      ))}
    </div>
  );
}
