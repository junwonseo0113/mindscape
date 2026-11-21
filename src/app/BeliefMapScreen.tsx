import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { REGION_CONFIG, resolveRegion } from "./brainRegions";
import { CognitiveRegion } from "./neuralBrainLayout";
import { Store, StoredBelief, StoredConnection, StoredEvidenceQuote, StoredHistoryEntry } from "./types";
import { entryStep } from "./aspirationPath";
import { Collapse, SETTLE } from "./motionPrimitives";
import { Node } from "./orb";
import { display, hand, mono, sans } from "./typefaces";
import { ArrowDownRight, ArrowUpRight, CaretDown, Lightning } from "@phosphor-icons/react";
import { COGNITIVE_PATTERN_DESCRIPTIONS, COGNITIVE_PATTERN_REFLECTIONS, DISCLAIMER_NOTICE, GENERIC_PATTERN_REFLECTION, findBeliefClusters, findContradictionPairs, isLikelyRuminating } from "./analysisFramework";
import { ink, mid, accent, accentSoft, mdWarnLabel, ivBackground, ivSurfaceSolid, ivCardShadow, shape, ivHeading, ivBody, ivFaint, ivDivider } from "./screenTheme";
import { OftenDots } from "./insightUI";
import { Emph, B, quietCard } from "./insightText";
import { SettingsGroup, IllustrationKey, BeliefRootsIllustration } from "./settingsUI";
import { type RoadPoint, bezierSamples } from "./roadGeometry";
import { PRIMARY_HEADER_TOP, BackButton } from "./screenUI";

// ── Screen 8 · Belief Map ─────────────────────────────────────────────────────
// Radius encodes real evidence count, not a hand-picked size — r ∝ √value so
// circle AREA (which is what the eye actually compares) reads proportionally
// correct, the same lesson as an earlier project's GDP bubble chart. Domain
// tags stay inside the circle (short enough to fit at any radius); the full
// belief sentence lives in the list below, same split BRICS used (chart
// carries magnitude, list carries the actual claim).
// Generic layout for a live, arbitrary-length belief graph (the demo chart
// above uses 5 hand-placed positions; real data grows one node at a time,
// so this needs a rule instead of fixed coordinates). Radius still encodes
// evidenceCount via sqrt — same "area, not radius, is what the eye compares"
// rule as the demo chart.
function layoutBeliefNodes(items: { evidenceCount: number }[]) {
  const cx = 150, cy = 132;
  const maxV = Math.max(1, ...items.map((it) => it.evidenceCount || 1));
  const maxR = 50, minR = 26;
  const sizeOf = (v: number) => minR + (maxR - minR) * Math.sqrt((v || 1) / maxV);
  if (items.length === 1) return [{ x: cx, y: cy, r: sizeOf(items[0].evidenceCount) }];
  const ringR = items.length <= 3 ? 68 : items.length <= 5 ? 92 : 108;
  return items.map((it, i) => {
    const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * ringR, y: cy + Math.sin(angle) * ringR, r: sizeOf(it.evidenceCount) };
  });
}

// The "brain network" view: same bubbles, plus lines wherever the model
// found two beliefs share a root cause. Lines render first so bubbles sit
// on top of them.
// Synapses, not just lines: each connection draws itself in on mount, then a
// small pulse keeps traveling along it — a standing "signal" between the two
// beliefs it links, instead of a static diagram.
function BeliefNetworkChart({ beliefs, connections }: { beliefs: StoredBelief[]; connections: StoredConnection[] }) {
  const positioned = layoutBeliefNodes(beliefs).map((pos, i) => ({ ...beliefs[i], ...pos }));
  const byId = new Map(positioned.map((b) => [b.id, b]));
  return (
    <svg viewBox="6 6 288 248" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {connections.map((c, i) => {
        const a = byId.get(c.a);
        const b = byId.get(c.b);
        if (!a || !b) return null;
        return (
          <React.Fragment key={i}>
            <motion.line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={accent} strokeWidth={1.4}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.4 }}
              transition={{ duration: 0.9, delay: 0.15 * i, ease: "easeOut" }}
            />
            <motion.circle
              r={2.6} fill={accent}
              initial={{ opacity: 0, cx: a.x, cy: a.y }}
              animate={{ opacity: [0, 1, 1, 0], cx: [a.x, a.x, b.x, b.x], cy: [a.y, a.y, b.y, b.y] }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.1, delay: 1 + 0.15 * i, ease: "easeInOut", times: [0, 0.08, 0.92, 1] }}
            />
          </React.Fragment>
        );
      })}
      {positioned.map((b) => (
        <circle key={b.id} cx={b.x} cy={b.y} r={b.r} fill={accentSoft} stroke={accent} strokeOpacity={0.4} strokeWidth={1.2} />
      ))}
      {positioned.map((b) => (
        <React.Fragment key={`${b.id}-text`}>
          <text x={b.x} y={b.y - 3} textAnchor="middle" dominantBaseline="central" style={{ ...sans, fontSize: Math.max(b.r * 0.24, 9), fontWeight: 700, fill: ink }}>{b.domain}</text>
          <text x={b.x} y={b.y + Math.max(b.r * 0.3, 12)} textAnchor="middle" dominantBaseline="central" style={{ ...mono, fontSize: Math.max(b.r * 0.16, 7.5), fontWeight: 600, fill: mid }}>{b.evidenceCount}</text>
        </React.Fragment>
      ))}
    </svg>
  );
}

// Affect labeling — naming an emotion is itself the intervention (Lieberman
// et al.: putting a feeling into words measurably calms the reaction to it),
// so this just surfaces whichever emotion showed up most, weighted by
// intensity, across the entries that actually support this belief. Not a
// claim that the belief "causes" the emotion — just what tended to be
// nearby when it did.
function dominantEmotion(entryIds: string[] | undefined, history: StoredHistoryEntry[]): string | null {
  if (!entryIds || entryIds.length === 0) return null;
  const totals = new Map<string, number>();
  entryIds.forEach((id) => {
    const entry = history.find((e) => e.id === id);
    entry?.analysis?.observation.emotions.forEach((em) => {
      totals.set(em.label, (totals.get(em.label) ?? 0) + em.intensity);
    });
  });
  if (totals.size === 0) return null;
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

// Whether at least one of a belief's own supporting entries carries a full
// situation→thought→emotion→action chain — powers BeliefCard's "see why
// this pattern repeats" toggle.
function hasFunctionalLoopData(belief: Pick<StoredBelief, "supportingEntryIds">, history: StoredHistoryEntry[]): boolean {
  return (belief.supportingEntryIds ?? []).some((id) => history.find((e) => e.id === id)?.analysis?.observation.situation);
}

// Longitudinal drift (Level 4) — a plain sparkline over confidenceHistory,
// purely descriptive ("this is how it's moved"), never a forecast. Only
// renders once there are at least two points; a single point is just the
// belief's current confidence, already shown by the bar above it.
function ConfidenceTrend({ history }: { history: { date: string; value: number }[] }) {
  if (history.length < 2) return null;
  const w = 240;
  const h = 32;
  const pad = 3;
  const values = history.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = history
    .map((p, i) => {
      const x = pad + (i / (history.length - 1)) * (w - pad * 2);
      const y = h - pad - ((p.value - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const delta = history[history.length - 1].value - history[0].value;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: "rgba(42,38,33,0.65)" }}>Confidence over time · {history.length} entries</span>
        <span style={{ ...mono, fontSize: 11, color: delta > 0 ? "#2A2621" : delta < 0 ? "rgba(42,38,33,0.4)" : "rgba(42,38,33,0.42)" }}>{delta > 0 ? "+" : ""}{delta}</span>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 4, display: "block" }}>
        <polyline points={points} fill="none" stroke={"#2A2621"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// Functional analysis (Level 2) — reads the situation → automatic thought →
// emotion → action chain straight off the belief's own supporting entries
// (already recorded per-entry, see ThoughtObservation) and closes the loop
// with a plain-language note about the action feeding back into a similar
// situation. No new extraction, no claim beyond what one real entry already
// showed — just naming the cycle instead of leaving it implicit.
function FunctionalLoopDiagram({ belief, history }: { belief: StoredBelief; history: StoredHistoryEntry[] }) {
  const candidateEntries = (belief.supportingEntryIds ?? [])
    .map((id) => history.find((e) => e.id === id))
    .filter((e): e is StoredHistoryEntry => !!e && !!e.analysis?.observation.situation);
  const entry = candidateEntries[candidateEntries.length - 1];
  if (!entry?.analysis) {
    return <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.5)" }}>There isn't a detailed enough entry yet to show this belief's cycle.</div>;
  }
  const obs = entry.analysis.observation;
  const topEmotion = [...obs.emotions].sort((a, b) => b.intensity - a.intensity)[0];
  const steps = [
    { label: "Situation", text: obs.situation },
    { label: "Automatic thought", text: obs.automaticThought },
    { label: "Emotion", text: topEmotion ? `${topEmotion.label} (intensity ${topEmotion.intensity})` : "No record" },
    { label: "Action", text: obs.actionUrge },
  ];
  return (
    <div>
      <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)", marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>
        From your entry on {entry.date}, here's how this belief actually played out, step by step.
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "rgba(42,38,33,0.06)", color: "#2A2621", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, paddingBottom: 4 }}>
                <div style={{ ...sans, fontSize: 11, fontWeight: 700, color: "rgba(42,38,33,0.65)", letterSpacing: "0.04em" }}>{s.label}</div>
                <div style={{ ...display, fontSize: 17, color: "#2A2621", marginTop: 2, lineHeight: 1.5, wordBreak: "keep-all" }}>{s.text}</div>
              </div>
            </div>
            {i < steps.length - 1 && <div style={{ marginLeft: 9, width: 1, height: 14, backgroundColor: "rgba(42,38,33,0.09)" }} />}
          </React.Fragment>
        ))}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, marginLeft: 32 }}>
          <span style={{ ...sans, fontSize: 15, color: "#2A2621", lineHeight: 1 }}>↺</span>
          <span style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)", fontStyle: "italic", lineHeight: 1.5, wordBreak: "keep-all" }}>
            It looks like this action tends to create a similar situation again, and the same thought shows back up.
          </span>
        </div>
      </div>
    </div>
  );
}

// One belief's full card — its own component (rather than inlined in the
// map below) so each can hold its own "which pattern tag is expanded" state
// without the cards interfering with each other.
function BeliefCard({ belief, history, connections, onReject, first, pull }: { belief: StoredBelief; history: StoredHistoryEntry[]; connections: StoredConnection[]; onReject?: (id: string) => void; first?: boolean; pull?: BeliefPull }) {
  const [openPattern, setOpenPattern] = React.useState<string | null>(null);
  const [showLoop, setShowLoop] = React.useState(false);
  // The card is three lines — badge row, statement, meter — until asked
  // for more: everything else (the thought label, the trend, chips,
  // quotes, the loop diagram, the reject link) sits behind one "Details"
  // row. Legibility first; the depth is still all there.
  const [showDetails, setShowDetails] = React.useState(false);
  const region = resolveRegion(belief);
  const color = REGION_CONFIG[region].color;
  const emotion = dominantEmotion(belief.supportingEntryIds, history);
  const patterns = belief.possibleCognitivePatterns ?? [];
  const hasLoopData = hasFunctionalLoopData(belief, history);
  // Rumination-vs-reflection (Trapnell & Campbell): rising confidence with no
  // new connection and no widening emotional register reads as circling, not
  // moving. The line stays purely observational — a frequency fact, not a
  // suggestion to stop or a diagnostic label — same principle as every other
  // card element here.
  const ruminationLikely = isLikelyRuminating(belief, connections, history);
  // Distanced self-talk (Kross & Ayduk) — a literal card-flip metaphor for
  // the reframe itself, not just an expand/collapse: the statement is a
  // fact-in-1st-person on one face, the same meaning at 2nd-person distance
  // on the other.
  const [reframeFlipped, setReframeFlipped] = React.useState(false);
  const statementStyle: React.CSSProperties = { ...display, fontSize: 20, color: ivHeading, lineHeight: 1.35, wordBreak: "keep-all" };
  return (
    <div style={{ position: "relative", padding: "14px 16px 4px" }}>
      {!first && <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 24 }}>
        <Node color={color} size={12} intensity={0.75} />
        <span style={{ ...sans, fontSize: 12, color: ivBody, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{belief.domain}</span>
        <span style={{ flex: 1 }} />
        {belief.status === "conflicted" && <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdWarnLabel, flexShrink: 0 }}>Mixed signals</span>}
        {belief.status === "supported" && <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: ivBody, flexShrink: 0 }}>Keeps showing up</span>}
      </div>
      {belief.distancedReframe ? (
        <div style={{ marginTop: 8, perspective: 800 }}>
          {/* Distanced self-talk flip: both faces share one grid cell so the
              block sizes to whichever face wraps to more lines. */}
          <motion.div animate={{ rotateY: reframeFlipped ? 180 : 0 }} transition={{ duration: 0.2, ease: "easeInOut" }} style={{ display: "grid", transformStyle: "preserve-3d" }}>
            <div style={{ ...statementStyle, gridArea: "1 / 1", backfaceVisibility: "hidden" }}>{belief.statement}</div>
            <div style={{ ...statementStyle, gridArea: "1 / 1", backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>{belief.distancedReframe}</div>
          </motion.div>
        </div>
      ) : (
        <div style={{ ...statementStyle, marginTop: 8 }}>{belief.statement}</div>
      )}
      <div style={{ marginTop: 10 }}>
        <OftenDots confidence={belief.confidence} region={region} extra={`· in ${belief.evidenceCount} ${belief.evidenceCount === 1 ? "entry" : "entries"}`} />
        {pull && pull.kind !== "none" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, ...sans, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
            color: pull.kind === "away" ? REGION_CONFIG.relationships.ink : REGION_CONFIG.security.ink,
            backgroundColor: pull.kind === "away" ? `${REGION_CONFIG.relationships.color}1f` : `${REGION_CONFIG.security.color}1f` }}>
            {pull.kind === "away" ? <ArrowDownRight size={12} weight="bold" /> : <ArrowUpRight size={12} weight="bold" />}
            {(() => {
              const n = pull.kind === "away" ? pull.away : pull.toward, total = pull.away + pull.toward;
              const verb = pull.kind === "away" ? <b>away</b> : <b>closer</b>;
              return n === total
                ? <>Each time it came up, you moved {verb}</>
                : <>In {n} of {total} entries with it, you moved {verb}</>;
            })()}
          </div>
        )}
      </div>
      <motion.button
        type="button" aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)} whileTap={{ opacity: 0.6 }}
        style={{ display: "flex", alignItems: "center", gap: 6, border: 0, background: "transparent", padding: "10px 0 8px", margin: 0, ...sans, fontSize: 13, fontWeight: 500, color: ivHeading, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      >
        {showDetails ? "Less" : "Details"}
        <motion.span animate={{ rotate: showDetails ? 180 : 0 }} transition={SETTLE} style={{ display: "flex" }}><CaretDown size={13} color={ivFaint} weight="bold" /></motion.span>
      </motion.button>
      <Collapse open={showDetails}>
      <div style={{ paddingBottom: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Defusion reframe (ACT: "naming the thought") — a recurring
          visitor, not a fact about the person. */}
      {belief.thoughtLabel && (
        <div style={{ ...sans, fontSize: 13, fontStyle: "italic", color: ivBody }}>The "{belief.thoughtLabel}" thought keeps showing up</div>
      )}
      {belief.distancedReframe && (
        <motion.span
          role="button" tabIndex={0} whileTap={{ opacity: 0.6 }}
          onClick={() => setReframeFlipped((v) => !v)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setReframeFlipped((v) => !v); }}
          style={{ ...sans, fontSize: 13, fontWeight: 500, color: ivHeading, display: "inline-block", cursor: "pointer" }}
        >
          {reframeFlipped ? "Back to the original" : "See it from a distance"}
        </motion.span>
      )}
      {/* Longitudinal drift (Level 4) — how this belief's confidence has
          actually moved, not just where it stands right now. */}
      {belief.confidenceHistory && <ConfidenceTrend history={belief.confidenceHistory} />}
      {ruminationLikely && (
        <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.5, wordBreak: "keep-all" }}>
          This thought has come back often in recent sessions.
        </div>
      )}
      {(patterns.length > 0 || emotion) && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {emotion && (
            <span style={{ ...sans, fontSize: 11, color: "rgba(42,38,33,0.65)", backgroundColor: "rgba(42,38,33,0.08)", padding: "3px 8px", borderRadius: 999 }}>Predominant emotion · {emotion}</span>
          )}
          {patterns.map((p) => {
            const active = openPattern === p;
            return (
              <motion.span
                key={p} role="button" tabIndex={0} whileTap={{ opacity: 0.6 }}
                onClick={() => setOpenPattern(active ? null : p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => setOpenPattern(active ? null : p))?.(); } }}
                style={{ ...sans, fontSize: 11, fontWeight: active ? 700 : 500, color: active ? "#fff" : "#2A2621", backgroundColor: active ? "rgba(42,38,33,0.5)" : "rgba(42,38,33,0.06)", padding: "3px 8px", borderRadius: 999, cursor: "pointer" }}
              >
                {p}
              </motion.span>
            );
          })}
        </div>
      )}
      {openPattern && (
        <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.75)", marginTop: 8, lineHeight: 1.5, wordBreak: "keep-all", padding: 10, borderRadius: 10, backgroundColor: "rgba(42,38,33,0.06)" }}>
          <div>{COGNITIVE_PATTERN_DESCRIPTIONS[openPattern as keyof typeof COGNITIVE_PATTERN_DESCRIPTIONS] ?? ""}</div>
          {/* Balanced reframe (ported from a parallel session) — most
              cognitive habits started as adaptive, not just a flaw. */}
          {(() => {
            const r = COGNITIVE_PATTERN_REFLECTIONS[openPattern as keyof typeof COGNITIVE_PATTERN_REFLECTIONS] ?? GENERIC_PATTERN_REFLECTION;
            return (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${"rgba(42,38,33,0.09)"}`, display: "flex", flexDirection: "column", gap: 4 }}>
                <div><span style={{ fontWeight: 700, color: "#2A2621" }}>What helps</span> · {r.benefit}</div>
                <div><span style={{ fontWeight: 700, color: "rgba(42,38,33,0.5)" }}>What to watch for</span> · {r.caution}</div>
              </div>
            );
          })()}
        </div>
      )}
      {belief.evidenceQuotes.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {[...belief.evidenceQuotes].reverse().slice(0, 2).map((q: StoredEvidenceQuote, qi: number) => (
            <div key={qi} style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)", lineHeight: 1.5, wordBreak: "keep-all" }}>
              <span style={{ ...mono, fontSize: 11, color: "rgba(42,38,33,0.5)" }}>{q.date}</span> · "{q.quote}"
            </div>
          ))}
        </div>
      )}
      {hasLoopData && (
        <div style={{ marginTop: 10 }}>
          <motion.span
            role="button" tabIndex={0} whileTap={{ opacity: 0.6 }} onClick={() => setShowLoop((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => setShowLoop((v) => !v))?.(); } }}
            style={{ ...sans, fontSize: 12, color: "#2A2621", fontWeight: 600, cursor: "pointer", display: "inline-block" }}
          >
            {showLoop ? "Collapse repeat structure ↑" : "See why this pattern repeats ↓"}
          </motion.span>
          <Collapse open={showLoop}>
            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: "rgba(42,38,33,0.08)" }}>
              <FunctionalLoopDiagram belief={belief} history={history} />
            </div>
          </Collapse>
        </div>
      )}
      {onReject && (
        <motion.span
          role="button" tabIndex={0} onClick={() => onReject(belief.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => onReject(belief.id))?.(); } }} whileTap={{ opacity: 0.6 }}
          style={{ ...sans, fontSize: 13, color: ivBody, display: "inline-block", cursor: "pointer" }}
        >
          This observation doesn't match how I see it
        </motion.span>
      )}
      </div>
      </Collapse>
    </div>
  );
}

// A small circular node/edge diagram for one cluster — deliberately not
// force-directed (that needs real layout math for a payoff mainly visible
// with many nodes; a 3-6 node cluster reads just as clearly evenly spaced
// on a circle) so every pair gets a visible edge with no overlap.
function BeliefClusterDiagram({ count }: { count: number }) {
  const size = 96;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const positions = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {positions.map((p1, i) =>
        positions.slice(i + 1).map((p2, j) => (
          <line key={`${i}-${i + 1 + j}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={"#2A2621"} strokeOpacity={0.3} strokeWidth={1} />
        ))
      )}
      {positions.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={8} fill={"rgba(42,38,33,0.06)"} stroke={"#2A2621"} strokeWidth={1.4} />
      ))}
    </svg>
  );
}

// Belief network mapping (Level 3) — a core belief rarely stands alone;
// this surfaces the connected clusters findBeliefClusters finds among
// "root" connections (3+ mutually-reinforcing beliefs), which the flat
// pairwise "Discovered Connections" list elsewhere never states as a single structure.
function BeliefNetworkSection({ beliefs, connections }: { beliefs: StoredBelief[]; connections: StoredConnection[] }) {
  const clusters = findBeliefClusters(beliefs, connections);
  if (clusters.length === 0) return null;
  const byId = new Map(beliefs.map((b) => [b.id, b]));
  return (
    <SettingsGroup header="Thoughts that hold each other up" footer={<>These show up <B>together</B>, each one making the others <B>feel more true</B>.</>}>
      {clusters.map((clusterIds, ci) => {
        const clusterBeliefs = clusterIds.map((id) => byId.get(id)).filter((b): b is StoredBelief => !!b);
        if (clusterBeliefs.length === 0) return null;
        return (
          <div key={ci} style={{ position: "relative", display: "flex", gap: 14, alignItems: "center", padding: "14px 16px" }}>
            {ci > 0 && <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />}
            <BeliefClusterDiagram count={clusterBeliefs.length} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...sans, fontSize: 15, fontWeight: 500, color: ivHeading }}>These {clusterBeliefs.length} hold each other up</div>
              <ul style={{ margin: "6px 0 0", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                {clusterBeliefs.map((b) => (
                  <li key={b.id} style={{ ...display, fontSize: 15, color: ivBody, lineHeight: 1.4, wordBreak: "keep-all" }}>{b.statement}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </SettingsGroup>
  );
}

// Contradiction detection (Level 5) — just lays the two statements side by
// side and stops there; no verdict on which one is "true." This is the
// motivational-interviewing "discrepancy" technique — naming the tension
// out loud is the entire intervention.
// ── Lower Unconscious-patterns illustrations ─────────────────────────────────
// One drawing per section, each showing the relationship that section is
// about rather than decorating it: tension as a balance that tips toward
// the belief with more behind it, an interpretation as a spark that sets
// off a ripple, a connection as two plants that turn out to share a root.

const regionOfBelief = (b: { domain: string }) => REGION_CONFIG[resolveRegion(b as StoredBelief)];
const shortBelief = (b: StoredBelief) => b.thoughtLabel || (b.statement.length > 26 ? `${b.statement.slice(0, 25)}…` : b.statement);

// A balance with one belief on each pan. It settles tipped toward the one
// with more confidence behind it (real values, at most ±11°), and rocks
// gently around that, the way a scale does before it comes to rest.
function TensionScale({ a, b }: { a: StoredBelief; b: StoredBelief }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const ra = regionOfBelief(a), rb = regionOfBelief(b);
  // Degrees, clockwise-positive: the heavier side drops. Rocks ±1.9° around
  // its resting tilt on a 5s period. The beam ends are computed from the
  // angle each frame and the pans hang straight down from them, so they
  // stay attached however far it tips.
  const tilt = Math.max(-11, Math.min(11, (b.confidence - a.confidence) * 0.35));
  const [angle, setAngle] = React.useState(tilt);
  React.useEffect(() => {
    if (reduce) { setAngle(tilt); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      setAngle(tilt + Math.sin(((now - t0) / 5000) * Math.PI * 2) * 1.9);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [tilt, reduce]);
  const rad = (angle * Math.PI) / 180;
  const half = 92;
  const L: RoadPoint = [160 - half * Math.cos(rad), 40 - half * Math.sin(rad)];
  const R: RoadPoint = [160 + half * Math.cos(rad), 40 + half * Math.sin(rad)];
  const heavier = a.confidence === b.confidence ? null : a.confidence > b.confidence ? a : b;
  const pan = ([x, y]: RoadPoint, tone: typeof ra, gid: string) => (
    <g>
      <line x1={x} y1={y} x2={x - 22} y2={y + 24} stroke="#8A6A4A" strokeOpacity="0.6" strokeWidth="1.2" />
      <line x1={x} y1={y} x2={x + 22} y2={y + 24} stroke="#8A6A4A" strokeOpacity="0.6" strokeWidth="1.2" />
      <path d={`M${x - 26} ${y + 24} Q ${x} ${y + 38} ${x + 26} ${y + 24} Z`} fill={tone.tint} stroke={tone.ink} strokeOpacity="0.35" />
      <circle cx={x} cy={y + 14} r="13" fill={`url(#${gid})`} />
      <circle cx={x} cy={y + 14} r="4.5" fill={tone.color} />
    </g>
  );
  return (
    <div>
      <svg role="img" aria-label={`A balance between "${a.statement}" and "${b.statement}". ${heavier ? `It tips toward "${heavier.statement}", which has more behind it.` : "It sits level."}`}
        viewBox="0 0 320 118" style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id={`tbg${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={ra.tint} /><stop offset="1" stopColor={rb.tint} /></linearGradient>
          <radialGradient id={`ta${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.4" stopColor={ra.color} /><stop offset="1" stopColor={ra.color} stopOpacity="0" /></radialGradient>
          <radialGradient id={`tb${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.4" stopColor={rb.color} /><stop offset="1" stopColor={rb.color} stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="320" height="118" rx="14" fill={`url(#tbg${id})`} opacity="0.7" />
        <path d="M160 40 L148 104 L172 104 Z" fill="#8A6A4A" opacity="0.75" />
        <rect x="128" y="102" width="64" height="5" rx="2.5" fill="#8A6A4A" opacity="0.75" />
        <line x1={L[0]} y1={L[1]} x2={R[0]} y2={R[1]} stroke="#6B4E37" strokeWidth="5" strokeLinecap="round" />
        {pan(L, ra, `ta${id}`)}
        {pan(R, rb, `tb${id}`)}
        <circle cx="160" cy="40" r="5" fill="#6B4E37" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6, ...sans, fontSize: 12 }}>
        <span style={{ color: ra.ink, fontWeight: 600, maxWidth: "46%" }}>{shortBelief(a)}</span>
        <span style={{ color: rb.ink, fontWeight: 600, maxWidth: "46%", textAlign: "right" }}>{shortBelief(b)}</span>
      </div>
    </div>
  );
}

// A trigger and the reading it sets off: a spark leaves the trigger, lands
// in still water, and the ripple spreads — the automatic part.
function TriggerRipple({ region }: { region: CognitiveRegion }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const tone = REGION_CONFIG[region];
  const gold = REGION_CONFIG.career;
  const path = bezierSamples([62, 54], [120, 6], [190, 10], [232, 64], 14);
  const CYCLE = 3.6;
  const font = "'Pretendard Variable', Pretendard, sans-serif";
  return (
    <svg role="img" aria-label="A trigger sends a spark into still water and a ripple spreads out: the situation, then the reading that follows it automatically." viewBox="0 0 320 120" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`rbg${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={gold.tint} /><stop offset="1" stopColor={tone.tint} /></linearGradient>
        <radialGradient id={`pond${id}`}><stop offset="0" stopColor={tone.color} stopOpacity="0.35" /><stop offset="1" stopColor={tone.color} stopOpacity="0.08" /></radialGradient>
      </defs>
      <rect width="320" height="120" rx="14" fill={`url(#rbg${id})`} />
      {/* The trigger */}
      <g transform="translate(46 54)">
        <circle r="22" fill="#FFFFFF" opacity="0.85" />
        <path d="M3 -14 L-8 2 L-1 2 L-4 14 L8 -3 L1 -3 Z" fill={gold.ink} />
      </g>
      <text x="46" y="96" textAnchor="middle" fontSize="10.5" fontWeight="600" fontFamily={font} fill={gold.ink}>The situation</text>
      {/* Spark flight */}
      <path d={`M62 54 C 120 6, 190 10, 232 64`} fill="none" stroke={gold.ink} strokeOpacity="0.25" strokeWidth="1.2" strokeDasharray="3 5" />
      {!reduce && (
        <motion.circle r="4" fill={gold.color} cx={path.xs[0]} cy={path.ys[0]}
          initial={{ cx: path.xs[0], cy: path.ys[0], opacity: 0 }}
          animate={{ cx: path.xs, cy: path.ys, opacity: [0, 1, 1, 1, 1, 0] }}
          transition={{ duration: CYCLE * 0.45, repeat: Infinity, repeatDelay: CYCLE * 0.55, ease: "easeIn" }} />
      )}
      {/* The water and its ripples */}
      <ellipse cx="248" cy="70" rx="58" ry="20" fill={`url(#pond${id})`} />
      {[0, 1, 2].map((i) => (
        <motion.ellipse key={i} cx="248" cy="70" rx="12" ry="4" fill="none" stroke={tone.color} strokeWidth="1.6"
          initial={{ scale: reduce ? 1.6 + i : 0.3, opacity: reduce ? 0.5 - i * 0.12 : 0 }}
          animate={reduce ? undefined : { scale: [0.3, 4.2], opacity: [0, 0.8, 0] }}
          transition={reduce ? undefined : { duration: CYCLE * 0.6, repeat: Infinity, repeatDelay: CYCLE * 0.4, delay: CYCLE * 0.45 + i * 0.28, ease: "easeOut" }}
          style={{ transformBox: "view-box", transformOrigin: "248px 70px" }} />
      ))}
      <text x="248" y="106" textAnchor="middle" fontSize="10.5" fontWeight="600" fontFamily={font} fill={tone.ink}>The reading that follows</text>
    </svg>
  );
}

// Two beliefs that looked unrelated, as two plants above the soil whose
// roots meet at one glowing seed below — and light travels up from that
// shared root to both.
function SharedRoot({ a, b }: { a: StoredBelief; b: StoredBelief }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const ra = regionOfBelief(a), rb = regionOfBelief(b);
  const gold = REGION_CONFIG.career;
  const upA = bezierSamples([150, 96], [120, 94], [72, 80], [72, 44], 12);
  const upB = bezierSamples([150, 96], [180, 94], [228, 80], [228, 44], 12);
  const font = "'Pretendard Variable', Pretendard, sans-serif";
  const climb = (s: { xs: number[]; ys: number[] }, color: string, delay: number) => !reduce && (
    <motion.circle r="3.4" fill={color} cx={s.xs[0]} cy={s.ys[0]}
      initial={{ cx: s.xs[0], cy: s.ys[0], opacity: 0 }}
      animate={{ cx: s.xs, cy: s.ys, opacity: [0, 1, 1, 1, 0] }}
      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2, delay, ease: "easeInOut" }} />
  );
  return (
    <svg role="img" aria-label={`"${a.statement}" and "${b.statement}" grow from the same root.`} viewBox="0 0 300 116" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={ra.tint} /><stop offset="1" stopColor={rb.tint} /></linearGradient>
        <linearGradient id={`soil${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E6D6BF" /><stop offset="1" stopColor="#CDB797" /></linearGradient>
        <radialGradient id={`seed${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.35" stopColor={gold.color} /><stop offset="1" stopColor={gold.color} stopOpacity="0" /></radialGradient>
        {[["a", ra], ["b", rb]].map(([k, t]) => (
          <radialGradient key={k as string} id={`o${k}${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.4" stopColor={(t as typeof ra).color} /><stop offset="1" stopColor={(t as typeof ra).color} stopOpacity="0" /></radialGradient>
        ))}
      </defs>
      <rect width="300" height="116" rx="14" fill={`url(#sky${id})`} />
      <path d="M0 60 C 80 56, 220 64, 300 58 L300 102 A14 14 0 0 1 286 116 L14 116 A14 14 0 0 1 0 102 Z" fill={`url(#soil${id})`} />
      {/* Roots meeting at one seed */}
      <path d="M72 60 C 72 80, 120 94, 150 96" fill="none" stroke="#8A6A4A" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M228 60 C 228 80, 180 94, 150 96" fill="none" stroke="#8A6A4A" strokeWidth="1.8" strokeLinecap="round" />
      <motion.circle cx="150" cy="96" r="13" fill={`url(#seed${id})`}
        animate={reduce ? undefined : { scale: [1, 1.18, 1] }} transition={reduce ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformBox: "view-box", transformOrigin: "150px 96px" }} />
      {/* Stems and the two beliefs */}
      <path d="M72 60 L72 40" stroke={REGION_CONFIG.security.ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M228 60 L228 40" stroke={REGION_CONFIG.security.ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="72" cy="30" r="15" fill={`url(#oa${id})`} /><circle cx="72" cy="30" r="5" fill={ra.color} />
      <circle cx="228" cy="30" r="15" fill={`url(#ob${id})`} /><circle cx="228" cy="30" r="5" fill={rb.color} />
      {climb(upA, ra.color, 0)}
      {climb(upB, rb.color, 0.5)}
      <text x="150" y="80" textAnchor="middle" fontSize="10" fontWeight="600" fontFamily={font} fill="#6B4E37">same root</text>
    </svg>
  );
}

function ContradictionSection({ beliefs, connections }: { beliefs: StoredBelief[]; connections: StoredConnection[] }) {
  const pairs = findContradictionPairs(beliefs, connections);
  if (pairs.length === 0) return null;
  return (
    <SettingsGroup header="Where you pull two ways" footer={<>Two things you've said that <B>don't fit together</B>. Neither one is marked right.</>}>
      {pairs.map((p, i) => (
        <div key={i} style={{ position: "relative", padding: "14px 16px" }}>
          {i > 0 && <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />}
          <TensionScale a={p.a} b={p.b} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
            <div style={{ ...display, fontSize: 17, fontStyle: "italic", color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all", paddingLeft: 10, borderLeft: `3px solid ${regionOfBelief(p.a).color}` }}>"{p.a.statement}"</div>
            <div style={{ ...display, fontSize: 17, fontStyle: "italic", color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all", paddingLeft: 10, borderLeft: `3px solid ${regionOfBelief(p.b).color}` }}>"{p.b.statement}"</div>
          </div>
          {p.note && (
            <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${ivDivider}`, lineHeight: 1.55, wordBreak: "keep-all" }}><Emph text={p.note} keys={[p.a.statement, p.b.statement]} /></div>
          )}
        </div>
      ))}
    </SettingsGroup>
  );
}

// Belief Map and Recurring Assumptions used to be two separate screens, but
// a belief ("Safety comes first") and an assumption ("When uncertain →
// waiting is safer") are the same kind of thing at different specificity — one
// screen now, sectioned, instead of two nearly-redundant ones.
// How a recurring thought relates to the main measure: across the entries
// that back it, did you mostly move toward who you want to be, or away?
type BeliefPull = { toward: number; away: number; kind: "toward" | "away" | "none" };
function beliefPull(belief: StoredBelief, history: StoredHistoryEntry[]): BeliefPull {
  let toward = 0, away = 0;
  (belief.supportingEntryIds ?? []).forEach((id) => {
    const e = history.find((x) => x.id === id);
    if (!e) return;
    const st = entryStep(e);
    if (st.dir > 0) toward += 1; else if (st.dir < 0) away += 1;
  });
  return { toward, away, kind: away > toward ? "away" : toward > away ? "toward" : "none" };
}

export function ScreenBeliefMap({ onBack, store, onRejectBelief }: { onBack?: () => void; store: Store; onRejectBelief?: (beliefId: string) => void }) {
  const hasBeliefs = store.beliefs.length > 0;
  const hasAssumptions = store.assumptions.length > 0;
  const visibleBeliefs = store.beliefs.filter((b) => b.userReaction !== "rejected");
  const divider = <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />;
  const [showMore, setShowMore] = React.useState(false);
  return (
    // Same full-bleed pattern the rest of Premium's deeper layers use —
    // top:-30 on the root, one merged scroll region (Back/title scroll away
    // with the rest), .no-scrollbar hides the native scrollbar. The page is
    // a stack of grouped cards: each section's explanation is its footer,
    // one or two sentences, instead of a paragraph above every list.
    <div style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...ivBackground }}>
      <div className="no-scrollbar edge-fade" style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, overflowY: "auto", padding: `${PRIMARY_HEADER_TOP}px 16px calc(24px + env(safe-area-inset-bottom))`, boxSizing: "border-box" }}>
        <div style={{ padding: "0 6px" }}>
          <BackButton onClick={onBack} color={ivBody} />
          <div style={{ ...display, fontSize: 28, fontWeight: 400, lineHeight: 1.15, color: ivHeading, marginTop: 14 }}>Patterns you might not notice</div>
          <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
            {hasBeliefs ? <>What shows up in your words <B>without you noticing</B>.</> : <>No patterns yet. Write with <B>Speak your mind</B> and they'll show up here.</>}
          </div>
        </div>

        {/* What matters most comes first. With an aspiration set, that's the
            thoughts pulling you away from it, then where you contradict
            yourself, then what's helping. Every other recurring thought
            follows, and the finer-grained patterns fold under "More". */}
        {(() => {
          const withPull = visibleBeliefs.map((b) => ({ b, pull: beliefPull(b, store.history) }));
          const goal = !!store.aspiration;
          const away = goal ? withPull.filter((x) => x.pull.kind === "away").sort((x, y) => y.pull.away - x.pull.away || y.b.confidence - x.b.confidence) : [];
          const toward = goal ? withPull.filter((x) => x.pull.kind === "toward").sort((x, y) => y.pull.toward - x.pull.toward) : [];
          const shown = new Set([...away, ...toward].map((x) => x.b.id));
          const rest = withPull.filter((x) => !shown.has(x.b.id)).sort((x, y) => y.b.confidence - x.b.confidence);
          const card = (x: { b: StoredBelief; pull: BeliefPull }, i: number) => (
            <BeliefCard key={x.b.id} belief={x.b} history={store.history} connections={store.connections} onReject={onRejectBelief} first={i === 0} pull={goal ? x.pull : undefined} />
          );
          return (
            <>
              {away.length > 0 && (
                <SettingsGroup header="What pulls you away from who you want to be" style={{ marginTop: 24 }}
                  footer={<>These came up in entries where you <B>moved away</B> from "{store.aspiration}".</>}>
                  {away.map(card)}
                </SettingsGroup>
              )}
              <ContradictionSection beliefs={visibleBeliefs} connections={store.connections} />
              {toward.length > 0 && (
                <SettingsGroup header="What helps you get there" footer={<>These came up when you <B>moved closer</B>.</>}>
                  {toward.map(card)}
                </SettingsGroup>
              )}
              <SettingsGroup
                header={away.length || toward.length ? "Other thoughts that keep coming back" : "Thoughts that keep coming back"}
                style={{ marginTop: away.length ? 0 : 24 }}
                footer={<>More dots means it <B>comes up more often</B>. A thought shows up here after <B>3 entries</B>.</>}
              >
                {visibleBeliefs.length === 0 ? (
                  <div style={{ ...sans, fontSize: 13, color: ivBody, padding: "13px 16px" }}>No unconscious beliefs discovered yet.</div>
                ) : rest.length === 0 ? (
                  <div style={{ ...sans, fontSize: 13, color: ivBody, padding: "13px 16px" }}>All of them are above.</div>
                ) : rest.map(card)}
              </SettingsGroup>
            </>
          );
        })()}

        {/* The finer-grained patterns: still all here, one tap away. */}
        {hasBeliefs && (
          <div style={{ marginBottom: 22 }}>
            <motion.button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} whileTap={{ scale: 0.98 }}
              style={{ ...quietCard, width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: 0, cursor: "pointer", textAlign: "left" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", ...display, fontSize: 18, color: ivHeading }}>More patterns</span>
                <span style={{ display: "block", ...sans, fontSize: 13, color: ivBody, marginTop: 2 }}>How they cluster, how you read moments, shared roots</span>
              </span>
              <motion.span animate={{ rotate: showMore ? 180 : 0 }} style={{ lineHeight: 0, color: ivBody }}><CaretDown size={16} weight="bold" /></motion.span>
            </motion.button>
            <Collapse open={showMore}>
              <div style={{ paddingTop: 22 }}>
                <BeliefNetworkSection beliefs={visibleBeliefs} connections={store.connections} />
        <SettingsGroup header="How you tend to read moments" footer={<><B>When this happens</B>, you tend to <B>read it this way</B>.</>}>
          {!hasAssumptions ? (
            <div style={{ ...sans, fontSize: 13, color: ivBody, padding: "13px 16px" }}>Nothing like this has shown up yet.</div>
          ) : (
            [
              <div key="ripple" style={{ padding: "12px 12px 4px" }}>
                <TriggerRipple region={resolveRegion({ domain: store.assumptions[0].domains?.[0] ?? "identity" } as StoredBelief)} />
              </div>,
              ...store.assumptions.map((a, i) => {
              const tone = regionOfBelief({ domain: a.domains?.[0] ?? "identity" });
              return (
              <div key={a.id} style={{ position: "relative", padding: "13px 16px 13px 22px" }}>
                {divider}
                <span aria-hidden style={{ position: "absolute", left: 10, top: 14, bottom: 14, width: 3, borderRadius: 2, backgroundImage: `linear-gradient(180deg, ${REGION_CONFIG.career.color}, ${tone.color})` }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...sans, fontSize: 12, color: REGION_CONFIG.career.ink, fontWeight: 600, wordBreak: "keep-all" }}>
                  <Lightning size={13} weight="fill" aria-hidden style={{ flexShrink: 0 }} />{a.trigger}
                </div>
                <div style={{ ...display, fontSize: 20, color: tone.ink, lineHeight: 1.4, marginTop: 4, wordBreak: "keep-all" }}>{a.interpretation}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {(a.domains ?? []).map((d: string) => (
                    <span key={d} style={{ ...sans, fontSize: 11, fontWeight: 600, color: ivBody, backgroundColor: "rgba(42,38,33,0.06)", padding: "3px 8px", borderRadius: 6 }}>{d}</span>
                  ))}
                  <span style={{ flex: 1 }} />
                  <span style={{ ...mono, fontSize: 11, color: ivFaint }}>{a.count === 1 ? "once" : `${a.count} times`}</span>
                </div>
              </div>
              );
            }),
            ]
          )}
        </SettingsGroup>

        {store.connections.some((c) => c.type !== "contradiction") && (
          <SettingsGroup header="Same root, different thoughts" footer={<>They look different but <B>grow from the same place</B>.</>}>
            {store.connections.filter((c) => c.type !== "contradiction").map((c, i) => {
              const from = visibleBeliefs.find((b) => b.id === c.a);
              const to = visibleBeliefs.find((b) => b.id === c.b);
              if (!from || !to) return null;
              return (
                <div key={i} style={{ position: "relative", padding: "14px 16px" }}>
                  {i > 0 && divider}
                  <SharedRoot a={from} b={to} />
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ ...display, fontSize: 17, color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all" }}>{from.statement}</div>
                    <div style={{ ...display, fontSize: 17, color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all" }}>{to.statement}</div>
                  </div>
                  <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}><Emph text={c.note} /></div>
                </div>
              );
            })}
          </SettingsGroup>
        )}



        {hasBeliefs && (
          <div style={{ backgroundColor: ivSurfaceSolid, borderRadius: shape.md, boxShadow: ivCardShadow, padding: 12, marginBottom: 22 }}>
            <div style={{ ...hand, fontSize: 20, fontWeight: 600, color: ivHeading, opacity: 0.82, padding: "0 4px 6px" }}>How to read this page</div>
            <BeliefRootsIllustration />
            <div style={{ padding: "0 4px 4px" }}>
              <IllustrationKey items={[
                { tone: REGION_CONFIG.identity.color, text: <><b style={{ fontWeight: 600 }}>A belief</b> runs underneath — "Safety comes first."</> },
                { tone: REGION_CONFIG.security.color, text: <><b style={{ fontWeight: 600 }}>An interpretation</b> is a moment it shows — "When I start something new, I tell myself I'm not ready."</> },
              ]} />
            </div>
          </div>
        )}

              </div>
            </Collapse>
          </div>
        )}

        <div style={{ ...sans, fontSize: 12, color: ivFaint, lineHeight: 1.5, padding: "0 6px", wordBreak: "keep-all" }}>{DISCLAIMER_NOTICE}</div>
      </div>
    </div>
  );
}
