import React from "react";
import { weeklyReflectionsEnabled, type MindscapePlan } from "./mindscapePlan";
import { WeeklyReflectionPanel } from "./WeeklyReflectionPanel";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import { REGION_CONFIG, resolveRegion, recencyFromDate } from "./brainRegions";
import { CognitiveRegion, COGNITIVE_REGIONS } from "./neuralBrainLayout";
import { Store, StoredBelief, StoredHistoryEntry } from "./types";
import { formatDateDots, parseDotDate, relativeDayLabel, weekdayFromDotDate } from "./dateUtils";
import { describeQuery, parseQuery, scoreDoc, type SearchDoc } from "./smartSearch";
import { isMoodCheckIn } from "./realStore";
import { Breathe, SETTLE } from "./motionPrimitives";
import { Node } from "./orb";
import { display, hand, mono, sans } from "./typefaces";
import { ArrowLeft, CalendarBlank, CaretRight, ChatCircleText, Compass, Funnel, Lightbulb, MagnifyingGlass, Microphone, Smiley } from "@phosphor-icons/react";
import { mdWarnSoft, mdWarnLabel, ivBg2, ivBackground, ivSurfaceSolid, ivCardShadow, shape, ivSurfaceHigh, ivHeading, ivBody, ivFaint, ivDivider } from "./screenTheme";
import { RegionBadge } from "./regionUI";
import { CHANGE_TINT, summarizeChanges, ChangeEmotions, ChangeValues, ChangePatterns, ChangeConsistency, ChangeSelfTalk } from "./insightUI";
import { B } from "./insightText";
import { PRIMARY_HEADER_TOP, PRIMARY_HEADER_SIDE, PageTitle, BottomNav, BackButton } from "./screenUI";
import { HistoryControlButton } from "./historyShared";
import { SettingsGroup, settingsTile, DisclosureRow } from "./settingsUI";

// The design spec colors each history entry by domain, which this app's
// entries don't carry directly (only beliefs have a domain) — so this
// looks up whichever belief this entry actually supported, and borrows
// its domain + region color. Entries that never matched a pattern (most
// early ones) simply render without a domain badge, never a fabricated one.
function findEntryDomain(entryId: string, beliefs: StoredBelief[]): { domain: string; color: string } | null {
  const match = beliefs.find((b) => (b.supportingEntryIds ?? []).includes(entryId));
  if (!match) return null;
  return { domain: match.domain, color: REGION_CONFIG[resolveRegion(match)].color };
}

// ── History icons ────────────────────────────────────────────────────────────
function MicGlyph({ color }: { color: string }) {
  return <Microphone size={12} color={color} />;
}
function MoodGlyph({ color }: { color: string }) {
  return <Smiley size={12} color={color} />;
}

// ── History helpers ───────────────────────────────────────────────────────────

// A small stable (not re-randomized every render) tilt for the margin
// annotation — same id always yields the same angle, so it doesn't jitter
// as the journal re-renders.
function hashRotationDeg(id: string, spread = 4): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return (h / 999) * spread * 2 - spread;
}

// One honest margin note per entry, priority-ordered by how much the real
// data actually supports it — never a decorative placeholder (see the
// redesign brief: "Only show annotations when actual Analysis data supports
// them"). Reuses the exact same fields the old list view's "Recurring
// thought" tag and findEntryDomain already relied on.
function entryAnnotation(entry: StoredHistoryEntry, beliefs: StoredBelief[]): string | null {
  if (beliefs.some((b) => (b.contradictoryEntryIds ?? []).includes(entry.id))) return "Contradicts earlier belief";
  const status = entry.analysis?.hypothesis?.status;
  if (status === "supported" || status === "emerging") return "Recurring thought";
  if (beliefs.some((b) => (b.supportingEntryIds ?? [])[0] === entry.id)) return "First appearance";
  const domainInfo = findEntryDomain(entry.id, beliefs);
  if (domainInfo) return `Connected to ${domainInfo.domain}`;
  return null;
}

// The belief this entry actually helped establish, if any — the same match
// findEntryDomain uses, just returning the whole belief so its statement can
// be shown as the journal's "Related Discovery" line.
function relatedBeliefForEntry(entry: StoredHistoryEntry, beliefs: StoredBelief[]): StoredBelief | null {
  return beliefs.find((b) => (b.supportingEntryIds ?? []).includes(entry.id)) ?? null;
}

// ── History star catalogue ──────────────────────────────────────────────────
// A belief has no explicit "discovered" field; the two real signals that
// exist are confidenceHistory (first point = first tracked confidence) and
// supportingEntryIds (resolved against store.history for a real date).
// Combines both and falls back to null — never a fabricated date — when
// neither is present; catalogue-number assignment below stays fully
// deterministic regardless, via the id tiebreak.
function beliefFirstDiscoveredDate(belief: StoredBelief, history: StoredHistoryEntry[]): Date | null {
  const times: number[] = [];
  (belief.confidenceHistory ?? []).forEach((p) => {
    const d = parseDotDate(p.date);
    if (d) times.push(d.getTime());
  });
  (belief.supportingEntryIds ?? []).forEach((id) => {
    const entry = history.find((e) => e.id === id);
    const d = entry ? parseDotDate(entry.date) : null;
    if (d) times.push(d.getTime());
  });
  if (times.length === 0) return null;
  return new Date(Math.min(...times));
}

// One catalogued star — a persistent, non-rejected belief plus everything
// its cell/detail view need, computed once per store change rather than
// re-derived per cell. `region`/`vitality` are the exact same
// resolveRegion/recencyFromDate the Brain Map itself uses (the latter now
// exported from NeuralBeliefGraph3D for this reuse), so a star here can
// never silently disagree with what Mind is showing for the same belief.
type CatalogueStar = {
  belief: StoredBelief;
  region: CognitiveRegion;
  catalogueNumber: number;
  firstDiscovered: Date | null;
  vitality: number;
  appearances: number;
};

function buildCatalogueStars(store: Store): CatalogueStar[] {
  // A rejected belief is one the user explicitly said isn't accurate —
  // excluded from the live Brain Map (see ScreenBeliefMap's own
  // visibleBeliefs filter) and so excluded here too, for the same reason.
  const base = store.beliefs
    .filter((b) => b.userReaction !== "rejected")
    .map((belief) => ({
      belief,
      region: resolveRegion(belief),
      firstDiscovered: beliefFirstDiscoveredDate(belief, store.history),
      vitality: recencyFromDate(belief.lastUpdatedAt) ?? 0.4,
      appearances: belief.evidenceCount || (belief.supportingEntryIds ?? []).length || 1,
    }));
  const ordered = [...base].sort((x, y) => {
    const xt = x.firstDiscovered ? x.firstDiscovered.getTime() : Infinity;
    const yt = y.firstDiscovered ? y.firstDiscovered.getTime() : Infinity;
    if (xt !== yt) return xt - yt;
    return x.belief.id < y.belief.id ? -1 : x.belief.id > y.belief.id ? 1 : 0;
  });
  return ordered.map((c, i) => ({ ...c, catalogueNumber: i + 1 }));
}

// The shared bottom-sheet chrome for Search/Calendar/Filter — restyled dark
// (frosted charcoal, not the warm paper card) to match the archive; scoped
// only to History, so this doesn't touch any other screen's sheets.
// ── Bottom-sheet panel ────────────────────────────────────────────────────────
// Shared by every bottom sheet: rises from below on a spring (not a fixed
// 0.25s tween), and can be dragged down by its grab handle to dismiss —
// past ~90px or on a downward flick it closes, otherwise it settles back.
// Only the handle starts a drag (dragListener off), so the sheet's own
// scrolling content keeps scrolling normally.
function SheetPanel({ onClose, style, children }: { onClose?: () => void; style: React.CSSProperties; children: React.ReactNode }) {
  const controls = useDragControls();
  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
      drag="y" dragListener={false} dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.04, bottom: 0.8 }}
      onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) onClose?.(); }}
      onClick={(e) => e.stopPropagation()}
      style={style}
    >
      <div
        aria-hidden
        onPointerDown={(e) => controls.start(e)}
        style={{ alignSelf: "stretch", display: "flex", justifyContent: "center", padding: "2px 0 12px", margin: "-10px 0 0", touchAction: "none", cursor: "grab", flexShrink: 0 }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(42,38,33,0.18)" }} />
      </div>
      {children}
    </motion.div>
  );
}

function HistorySheet({ title, onClose, children }: { title: string; onClose?: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      role="button" tabIndex={-1} onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 20, backgroundColor: "rgba(42,38,33,0.24)", display: "flex", alignItems: "flex-end" }}
    >
      <SheetPanel onClose={onClose} style={{
          width: "100%", maxHeight: "74%", backgroundColor: "#FBF8F2",
          borderTop: "1px solid rgba(42,38,33,0.08)", borderRadius: "20px 20px 0 0", padding: "18px 20px 26px", boxShadow: "0 -16px 40px rgba(120,105,80,0.14)",
          display: "flex", flexDirection: "column",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
          <span style={{ ...display, fontSize: 20, color: "#2A2621" }}>{title}</span>
          <Breathe inline amount={1.08}><motion.span role="button" tabIndex={0} aria-label="Close" onClick={onClose} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose?.(); } }} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: "rgba(42,38,33,0.5)", cursor: "pointer" }}>Close</motion.span></Breathe>
        </div>
        <div style={{ overflowY: "auto", minHeight: 0 }}>{children}</div>
      </SheetPanel>
    </motion.div>
  );
}

function CatalogueFilterChip({ label, color, active, disabled, onClick }: { label: string; color?: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button" onClick={disabled ? undefined : onClick} whileTap={disabled ? undefined : { opacity: 0.6 }} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 6, ...sans, fontSize: 12, fontWeight: 700, padding: "7px 13px", borderRadius: 999,
        cursor: disabled ? "default" : "pointer", border: `1px solid ${active ? "rgba(42,38,33,0.45)" : "rgba(42,38,33,0.14)"}`,
        backgroundColor: active ? "rgba(42,38,33,0.08)" : "transparent",
        color: disabled ? "rgba(42,38,33,0.22)" : active ? "#2A2621" : "rgba(42,38,33,0.65)",
      }}
    >
      {color && <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color, opacity: disabled ? 0.3 : 0.85, flexShrink: 0 }} />}
      {label}
    </motion.button>
  );
}

function CatalogueFilterRow({ label, note, active, onClick }: { label: string; note: string; active: boolean; onClick: () => void }) {
  return (
    <motion.div
      role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      whileTap={{ opacity: 0.6 }}
      style={{ padding: "11px 4px", borderBottom: "1px solid rgba(42,38,33,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
    >
      <div>
        <div style={{ ...display, fontSize: 17, color: active ? "#2A2621" : "#2A2621" }}>{label}</div>
        <div style={{ ...sans, fontSize: 11, color: "rgba(42,38,33,0.5)", marginTop: 2 }}>{note}</div>
      </div>
      {active && <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#2A2621", flexShrink: 0 }} />}
    </motion.div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: ivBody, marginBottom: 3 }}>{label}</div>
      <div style={{ ...display, fontSize: 17, color: "#2A2621", lineHeight: 1.42, wordBreak: "keep-all" }}>{value}</div>
    </div>
  );
}


// A star's orb size/intensity, in one place so the grid cell and the
// detail sheet (which renders the same star larger) can never compute it
// two different ways.
function catalogueOrbSize(star: CatalogueStar): number {
  return 12 + Math.round((star.belief.confidence / 100) * 8);
}
function catalogueOrbIntensity(star: CatalogueStar): number {
  return Math.min(1, 0.35 + (star.belief.confidence / 100) * 0.35 + star.vitality * 0.35);
}

// One catalogue row — node, title, and light metadata (date + how many
// times it's appeared) — a spacious list row now, not a boxed database
// cell. The node is the specimen being catalogued; the statement and
// metadata describe it, and neither the internal catalogueNumber nor any
// other database-style id is shown — per the redesign brief, an id like
// that reads as inventory, and a personal thought pattern shouldn't. Node
// color still carries the category, exactly as it did in the old grid,
// just without a bounding box competing with it. `dimmed` (search/filter/
// as-of-date mismatch) fades the whole row rather than removing it, so the
// list's overall shape never jumps. `isLast` drops this row's own divider
// so a family section doesn't end with a trailing hairline.
// One area of life in the Patterns catalogue, drawn as its own page of the
// diary: a heading with that area's orb and name in its ink, and a card
// with a coloured spine down the left and a wash of the same colour.
function CatalogueFamily({ region, count, children }: { region: CognitiveRegion; count: number; children: React.ReactNode }) {
  const c = REGION_CONFIG[region];
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 8px" }}>
        <Node color={c.color} size={14} intensity={0.9} />
        <span style={{ ...hand, fontSize: 22, fontWeight: 600, color: c.ink, lineHeight: 1 }}>{c.label}</span>
        <span style={{ ...hand, fontSize: 17, color: ivBody, lineHeight: 1 }}>· {count} {count === 1 ? "thought" : "thoughts"}</span>
      </div>
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: shape.md, paddingLeft: 5,
        backgroundColor: "#FFFDF8", backgroundImage: `linear-gradient(100deg, ${c.color}22 0%, ${c.color}0a 50%, transparent 85%)`,
        border: `1px solid ${c.color}33`, boxShadow: `0 10px 22px -18px ${c.ink}`,
      }}>
        <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundImage: `linear-gradient(180deg, ${c.color}, ${c.ink})` }} />
        {children}
      </div>
    </section>
  );
}

function CatalogueCell({ star, dimmed, first, onOpen }: { star: CatalogueStar; dimmed: boolean; first?: boolean; onOpen: () => void }) {
  const tone = REGION_CONFIG[star.region];
  const color = tone.color;
  const since = star.firstDiscovered ? star.firstDiscovered.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  const metaParts = [
    `came up ${star.appearances} time${star.appearances === 1 ? "" : "s"}`,
    since ? `since ${since}` : null,
  ].filter((p): p is string => !!p);
  return (
    <motion.div
      role="button" tabIndex={0}
      aria-label={`${REGION_CONFIG[star.region].label} pattern: ${star.belief.statement}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      whileTap={{ backgroundColor: `${color}1a` }}
      animate={{ opacity: dimmed ? 0.3 : 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px 11px 16px", minHeight: 56,
        cursor: "pointer", backgroundColor: "rgba(42,38,33,0)", WebkitTapHighlightColor: "transparent",
      }}
    >
      {!first && <span aria-hidden style={{ position: "absolute", top: 0, left: 16 + 28 + 12, right: 0, height: 1, backgroundColor: `${color}2e` }} />}
      {/* A fixed 28px column keeps every title flush regardless of how
          big the star itself is. */}
      <span style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Node color={color} size={catalogueOrbSize(star)} intensity={catalogueOrbIntensity(star)} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...display, fontSize: 17, lineHeight: 1.32, color: ivHeading, wordBreak: "keep-all", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {star.belief.statement}
        </div>
        <div style={{ ...hand, fontSize: 17, fontWeight: 500, color: tone.ink, marginTop: 2 }}>
          {metaParts.join(", ")}
        </div>
      </div>
      <Breathe inline amount={1.3}><CaretRight size={14} color={tone.ink} weight="bold" style={{ display: "block", opacity: 0.7 }} /></Breathe>
    </motion.div>
  );
}

// ── Screen 13 · History ───────────────────────────────────────────────────────
// Redesigned around a "star catalogue" concept: every persistent
// (non-rejected) belief is the same conceptual node the Brain Map (Mind)
// already renders, catalogued here by discovery order and grouped into the
// same six cognitive-region families Mind/Analysis use — never a second,
// competing notion of what a "pattern" is. The old per-entry journal
// becomes a star's provenance instead of the primary interface: tap a star,
// then "View its story" to see the actual recorded thoughts/check-ins
// behind it, still reachable in full via the pre-existing ScreenHistoryDetail
// (onOpenEntry) — nothing about that screen or its data changed.
// ── Segmented control ────────────────────────────────────────────────────────
// iOS's segmented control / Material 3's segmented button: one pill track,
// the selected segment carried by a sliding indicator (layoutId), so a
// switch reads as one control moving, not two buttons swapping.
function SegmentedControl<T extends string>({ options, value, onChange, layoutId }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; layoutId: string }) {
  return (
    <div role="tablist" style={{ display: "flex", padding: 3, borderRadius: shape.full, backgroundColor: "rgba(42,38,33,0.07)" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={o.value} role="tab" aria-selected={active} type="button" onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.97 }} transition={SETTLE}
            style={{ position: "relative", flex: 1, border: 0, background: "transparent", padding: "7px 12px", borderRadius: shape.full, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
          >
            {active && <motion.span layoutId={layoutId} transition={SETTLE} style={{ position: "absolute", inset: 0, borderRadius: shape.full, backgroundColor: ivSurfaceHigh, boxShadow: ivCardShadow }} />}
            <span style={{ position: "relative", ...sans, fontSize: 13, fontWeight: active ? 600 : 500, color: active ? ivHeading : ivBody }}>{o.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Journal view ─────────────────────────────────────────────────────────────
// History's first page is the journal itself: every entry, newest first,
// grouped by month, each one a sheet of ruled paper with the day printed in
// the margin — the Day One / Apple Journal timeline, drawn with this app's
// own paper (ivory card, serif, faint rules at the text's own line height).
// A mood check-in is a line on the timeline rather than a page: it's a
// word, not a thought. Tapping a page opens the same ScreenHistoryDetail
// the star sheet's "View its story" always led to.

function journalMonthLabel(dateStr: string): string {
  const d = parseDotDate(dateStr);
  return d ? d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : dateStr;
}

function JournalEntryRow({ entry, beliefs, onOpen }: { entry: StoredHistoryEntry; beliefs: StoredBelief[]; onOpen: () => void }) {
  const d = parseDotDate(entry.date);
  const rel = relativeDayLabel(entry.date);
  const dayLabel = rel === "Today" || rel === "Yesterday" ? rel : d ? d.toLocaleDateString("en-US", { weekday: "short" }) : "";
  const dayNumber = d ? d.getDate() : "";
  const emotion = entry.analysis?.observation.emotions[0]?.label;
  const regions = Array.from(new Set(beliefs.map((b) => resolveRegion(b)))).slice(0, 2);
  const mood = isMoodCheckIn(entry);
  // Each entry is a small page pasted into the diary: paper tinted by the
  // area of life it touched, a strip of washi tape, colored ruling, and a
  // slight tilt that varies from page to page (stable per entry).
  const tone = REGION_CONFIG[regions[0] ?? (["identity", "relationships", "career", "curiosity", "security", "creativity"] as CognitiveRegion[])[entry.id.length % 6]];
  const seed = Array.from(entry.id).reduce((a, c) => a + c.charCodeAt(0), 0);
  const tilt = ((seed % 5) - 2) * 0.35;
  const LINE = 30;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {/* The margin: day and weekday, the way a diary prints them. */}
      <div style={{ width: 40, flexShrink: 0, textAlign: "center", paddingTop: mood ? 2 : 10 }}>
        <div style={{ ...display, fontSize: mood ? 20 : 32, lineHeight: 1, color: mood ? ivBody : ivHeading, fontVariantNumeric: "lining-nums" }}>{dayNumber}</div>
        <div style={{ ...hand, fontSize: 17, fontWeight: 600, color: ivBody, marginTop: 2 }}>{dayLabel}</div>
      </div>
      {mood ? (
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7, padding: "5px 0", ...hand, fontSize: 20, fontWeight: 500, color: ivBody }}>
          <Smiley size={16} color={REGION_CONFIG.security.ink} weight="duotone" /> <span>{entry.text.replace(/\.$/, "")}</span>
        </div>
      ) : (
        <motion.div
          role="button" tabIndex={0} aria-label={`Entry from ${entry.date}`} onClick={onOpen}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
          initial={{ rotate: tilt }} whileTap={{ scale: 0.985, rotate: 0 }} transition={SETTLE}
          style={{
            position: "relative", flex: 1, minWidth: 0, borderRadius: 12, padding: "16px 16px 12px 26px", cursor: "pointer", WebkitTapHighlightColor: "transparent",
            backgroundColor: "#FFFCF6", backgroundImage: `linear-gradient(150deg, ${tone.color}2e 0%, ${tone.color}12 55%, #FFFCF6 100%)`,
            boxShadow: `0 0 0 1px rgba(42,38,33,0.06), 0 10px 22px -16px ${tone.ink}`,
          }}
        >
          {/* Washi tape and the margin line. */}
          <span aria-hidden style={{ position: "absolute", top: -8, left: 18, width: 52, height: 16, borderRadius: 2, opacity: 0.85, transform: `rotate(${-4 - tilt * 2}deg)`,
            backgroundImage: `repeating-linear-gradient(45deg, ${tone.color}aa 0 6px, ${tone.tint} 6px 12px)`, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }} />
          <span aria-hidden style={{ position: "absolute", left: 14, top: 10, bottom: 10, width: 1.5, borderRadius: 1, backgroundColor: `${REGION_CONFIG.relationships.color}77` }} />
          {/* Ruled paper: one hairline per text line, drawn behind the
              text at exactly its line height, so the rules only ever sit
              under written lines — never under the margin or the meta. */}
          <div
            style={{
              ...hand, fontSize: 22, fontWeight: 500, lineHeight: `${LINE}px`, color: "#2E2547", wordBreak: "keep-all",
              display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE - 1}px, ${tone.color}40 ${LINE - 1}px, ${tone.color}40 ${LINE}px)`,
            }}
          >
            {entry.text}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {entry.duration && <span style={{ ...mono, fontSize: 11, color: ivFaint }}>{entry.duration}</span>}
            {emotion && <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: ivBody, backgroundColor: "rgba(42,38,33,0.06)", padding: "4px 7px", borderRadius: 6, lineHeight: 1 }}>{emotion}</span>}
            {regions.map((r) => <RegionBadge key={r} region={r} />)}
            <span style={{ flex: 1 }} />
            <Breathe inline amount={1.3}><CaretRight size={14} color={ivFaint} weight="bold" style={{ display: "block" }} /></Breathe>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// What smart search reads for one journal entry.
function entryDoc(entry: StoredHistoryEntry, beliefs: StoredBelief[]): SearchDoc {
  return {
    dates: [entry.date],
    fields: [
      { text: entry.text },
      { text: (entry.analysis?.observation.emotions ?? []).map((e) => e.label).join(" "), weight: 0.85 },
      ...beliefs.map((b) => ({ text: `${b.statement} ${b.thoughtLabel ?? ""} ${REGION_CONFIG[resolveRegion(b)].label}`, weight: 0.85 })),
    ],
  };
}

function JournalView({ store, query, onOpenEntry }: { store: Store; query: string; onOpenEntry?: (index: number) => void }) {
  // Newest first, and `detailIndex` is the position ScreenHistoryDetail
  // expects (it reverses store.history the same way).
  const items = React.useMemo(
    () => [...store.history].reverse().map((entry, detailIndex) => ({ entry, detailIndex }))
      // A journal reads by date, whatever order the entries were stored in
      // (a check-in logged after a backfilled thought still files under its
      // own day). Fixed-width "YYYY.MM.DD" sorts lexicographically.
      .sort((a, b) => (a.entry.date < b.entry.date ? 1 : a.entry.date > b.entry.date ? -1 : 0)),
    [store.history]
  );
  const beliefsByEntry = React.useMemo(() => {
    const m = new Map<string, StoredBelief[]>();
    store.beliefs.forEach((b) => (b.supportingEntryIds ?? []).forEach((id) => m.set(id, [...(m.get(id) ?? []), b])));
    return m;
  }, [store.beliefs]);
  // Smart search (see smartSearch.ts): an entry is found by its own words,
  // the thoughts it backs, the feeling it carried, and its date.
  const parsed = React.useMemo(() => (query.trim() ? parseQuery(query) : null), [query]);
  const visible = parsed ? items.filter(({ entry }) => scoreDoc(entryDoc(entry, beliefsByEntry.get(entry.id) ?? []), parsed) > 0) : items;
  const months: { label: string; items: typeof items }[] = [];
  visible.forEach((it) => {
    const label = journalMonthLabel(it.entry.date);
    const last = months[months.length - 1];
    if (last && last.label === label) last.items.push(it); else months.push({ label, items: [it] });
  });
  if (items.length === 0) {
    return <div style={{ marginTop: 20, ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, padding: "0 6px" }}>Nothing written yet. Your first entry goes here.</div>;
  }
  if (visible.length === 0) {
    return <div style={{ marginTop: 20, ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, padding: "0 6px" }}>Nothing found. Try other words, or a time like <B>yesterday</B> or <B>last week</B>.</div>;
  }
  return (
    <>
      {months.map((m) => (
        <section key={m.label} style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 2px 10px" }}>
            <span style={{ ...display, fontSize: 20, color: ivHeading }}>{m.label}</span>
            <span style={{ ...hand, fontSize: 19, fontWeight: 500, color: ivBody }}>{m.items.length} {m.items.length === 1 ? "entry" : "entries"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {m.items.map((it) => (
              <JournalEntryRow key={it.entry.id} entry={it.entry} beliefs={beliefsByEntry.get(it.entry.id) ?? []} onOpen={() => onOpenEntry?.(it.detailIndex)} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function ScreenHistory({ onNavSelect, store, onOpenEntry, updateStore, onOpenAiConsent, cloudUserId, plan }: { onNavSelect?: (id: string) => void; store: Store; onOpenEntry?: (index: number) => void; updateStore?: (updater: (previous: Store) => Store) => void; onOpenAiConsent?: () => void; cloudUserId?: string | null; plan?: MindscapePlan }) {
  // Two pages in one tab: the journal (entries, by day) and the patterns
  // catalogue (beliefs, by family). The journal is first because it's the
  // thing the person actually wrote.
  const [view, setView] = React.useState<"entries" | "patterns">("entries");
  const catalogue = React.useMemo(() => buildCatalogueStars(store), [store]);
  const families = React.useMemo(() => {
    const map = new Map<CognitiveRegion, CatalogueStar[]>();
    COGNITIVE_REGIONS.forEach((r) => map.set(r, []));
    catalogue.forEach((star) => map.get(star.region)!.push(star));
    return map;
  }, [catalogue]);

  const [search, setSearch] = React.useState("");
  const [sheet, setSheet] = React.useState<"search" | "calendar" | "filter" | null>(null);
  const [filterMode, setFilterMode] = React.useState<
    { type: "region"; region: CognitiveRegion } | { type: "active" } | { type: "dormant" } | { type: "recent" } | { type: "recurrent" } | null
  >(null);
  const [asOfDate, setAsOfDate] = React.useState<string | null>(null);
  const [selectedStarId, setSelectedStarId] = React.useState<string | null>(null);
  const [storyOpen, setStoryOpen] = React.useState(false);
  // Which of Premium's "how you've changed" modules is unfolded — one at a
  // time, closed by default, so the catalogue above stays the screen.
  const [openDeeper, setOpenDeeper] = React.useState<number | null>(null);
  const changeSummaries = React.useMemo(() => summarizeChanges(store.history), [store.history]);

  const query = search.trim();
  const parsedSearch = React.useMemo(() => (query ? parseQuery(query) : null), [query]);
  // Smart search (see smartSearch.ts): a star is found by its wording, its
  // name, its area of life, what was actually written behind it, and the
  // days those entries were written.
  const matchesSearch = React.useCallback(
    (star: CatalogueStar) => {
      if (!parsedSearch) return true;
      const entries = (star.belief.supportingEntryIds ?? []).map((id) => store.history.find((x) => x.id === id)).filter((e): e is StoredHistoryEntry => !!e);
      const doc: SearchDoc = {
        dates: [...entries.map((e) => e.date), ...(star.belief.evidenceQuotes ?? []).map((q) => q.date)],
        fields: [
          { text: `${star.belief.statement} ${star.belief.thoughtLabel ?? ""}` },
          { text: `${star.belief.domain} ${REGION_CONFIG[star.region].label}`, weight: 0.9 },
          ...entries.map((e) => ({ text: e.text, weight: 0.75 })),
          ...(star.belief.evidenceQuotes ?? []).map((q) => ({ text: q.quote, weight: 0.75 })),
        ],
      };
      return scoreDoc(doc, parsedSearch) > 0;
    },
    [parsedSearch, store.history]
  );

  const recurrentThreshold = React.useMemo(() => {
    if (catalogue.length === 0) return Infinity;
    const sorted = [...catalogue].sort((a, b) => b.appearances - a.appearances);
    const cut = Math.max(1, Math.ceil(sorted.length * 0.3));
    return sorted[cut - 1].appearances;
  }, [catalogue]);

  const matchesFilter = React.useCallback(
    (star: CatalogueStar) => {
      if (!filterMode) return true;
      if (filterMode.type === "region") return star.region === filterMode.region;
      if (filterMode.type === "active") return star.vitality > 0.5;
      if (filterMode.type === "dormant") return star.vitality <= 0.5;
      if (filterMode.type === "recent") {
        if (!star.firstDiscovered) return false;
        return (Date.now() - star.firstDiscovered.getTime()) / 86_400_000 <= 30;
      }
      return star.appearances >= recurrentThreshold; // "recurrent"
    },
    [filterMode, recurrentThreshold]
  );

  const asOfCutoff = asOfDate ? parseDotDate(asOfDate) : null;
  const isAfterCutoff = React.useCallback(
    (star: CatalogueStar) => (asOfCutoff && star.firstDiscovered ? star.firstDiscovered.getTime() > asOfCutoff.getTime() : false),
    [asOfCutoff]
  );
  const isDimmed = React.useCallback(
    (star: CatalogueStar) => !matchesSearch(star) || !matchesFilter(star) || isAfterCutoff(star),
    [matchesSearch, matchesFilter, isAfterCutoff]
  );

  const calendarMilestones = React.useMemo(() => {
    const map = new Map<string, number>();
    catalogue.forEach((star) => {
      if (!star.firstDiscovered) return;
      const key = formatDateDots(star.firstDiscovered);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }, [catalogue]);

  const selectedStar = catalogue.find((s) => s.belief.id === selectedStarId) ?? null;
  const selectedConnection = selectedStar
    ? store.connections.find((c) => c.a === selectedStar.belief.id || c.b === selectedStar.belief.id)
    : null;
  const selectedConnectedBelief =
    selectedConnection && selectedStar
      ? store.beliefs.find((b) => b.id === (selectedConnection.a === selectedStar.belief.id ? selectedConnection.b : selectedConnection.a))
      : null;
  const selectedEntries = React.useMemo(() => {
    if (!selectedStar) return [];
    return (selectedStar.belief.supportingEntryIds ?? [])
      .map((id) => store.history.find((e) => e.id === id))
      .filter((e): e is StoredHistoryEntry => !!e)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [selectedStar, store.history]);

  const closeStarSheet = () => { setSelectedStarId(null); setStoryOpen(false); };
  const openEntryFromStory = (entryId: string) => {
    const detailItems = [...store.history].reverse();
    const idx = detailItems.findIndex((e) => e.id === entryId);
    if (idx >= 0) onOpenEntry?.(idx);
  };

  return (
    // top: -30 (same as Home/Mind above) so the archive backdrop runs
    // behind the status-bar safe area instead of showing a flat fallback
    // color there — see those screens for the pattern this reuses.
    <div style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, ...ivBackground, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        {/* ── Header + controls — same shared position/size/spacing as
        Mind and Analysis's own headers (see PRIMARY_HEADER_TOP/SIDE and
        primaryTitleStyle/primaryTitleSubtitleStyle); the sentence-style
        subtitle replaces the old small-caps label so all three read as
        the same typographic system, not three different ones. flex:1/
        minWidth:0 + the shared subtitle style's built-in truncation is
        what keeps it to one line next to History's own three-button
        control row, same technique Mind uses next to its two. ── */}
        <div style={{ padding: `${PRIMARY_HEADER_TOP}px ${PRIMARY_HEADER_SIDE}px 8px`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PageTitle tone="relationships" title="Diary" subtitle={view === "entries" ? "Every entry, in the order you lived it." : "Your thoughts, sorted by area of life."} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <HistoryControlButton icon={<MagnifyingGlass size={18} />} label="Search" active={sheet === "search" || !!query} onClick={() => setSheet(sheet === "search" ? null : "search")} />
            {view === "patterns" && (
              <>
                <HistoryControlButton icon={<CalendarBlank size={18} />} label="Rewind to a date" active={sheet === "calendar" || !!asOfDate} onClick={() => setSheet(sheet === "calendar" ? null : "calendar")} />
                <HistoryControlButton icon={<Funnel size={18} weight={filterMode ? "fill" : "regular"} />} label="Filter" active={sheet === "filter" || !!filterMode} onClick={() => setSheet(sheet === "filter" ? null : "filter")} />
              </>
            )}
          </div>
        </div>
        <div style={{ padding: "2px 16px 4px", flexShrink: 0 }}>
          <SegmentedControl layoutId="history-view" value={view} onChange={(v) => { setView(v); setSheet(null); }} options={[{ value: "entries", label: "Entries" }, { value: "patterns", label: "Patterns" }]} />
        </div>

        {/* ── The catalogue: one grouped card per family that actually has
        a star in it. Empty families don't render — "Nothing here yet"
        three times over was most of what made this screen feel busy — and
        come back the moment a star lands in them, or when the filter
        sheet asks for that family by name. ── */}
        <div data-tutorial="history-list" className="no-scrollbar edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 16px 28px" }}>
          {view === "entries" ? (
            <>
              {!search.trim() && updateStore && onOpenAiConsent && plan &&
                (plan.demo || weeklyReflectionsEnabled || !!store.weeklyReflections?.length || !!store.weeklyReflection) && (
                <WeeklyReflectionPanel key={plan.demo ? "demo" : cloudUserId ?? "guest"} store={store} cloudUserId={cloudUserId} plan={plan} updateStore={updateStore} onOpenEntry={onOpenEntry} onOpenAiConsent={onOpenAiConsent} />
              )}
              <JournalView store={store} query={query} onOpenEntry={onOpenEntry} />
            </>
          ) : (
          <>
          {catalogue.length === 0 && (
            <div style={{ marginTop: 20, ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, padding: "0 6px" }}>
              Nothing catalogued yet. Speak your mind, and your first star will appear here.
            </div>
          )}
          {asOfDate && (
            <div style={{ margin: "12px 0 4px", padding: "0 6px", display: "flex", alignItems: "center", justifyContent: "space-between", ...sans, fontSize: 12, color: ivBody }}>
              <span>As catalogued by {asOfDate}</span>
              <Breathe inline amount={1.08}><motion.span role="button" tabIndex={0} onClick={() => setAsOfDate(null)} whileTap={{ opacity: 0.6 }} style={{ cursor: "pointer", fontWeight: 700, color: ivHeading }}>Reset</motion.span></Breathe>
            </div>
          )}
          {COGNITIVE_REGIONS.filter((region) => (filterMode?.type === "region" ? filterMode.region === region : (families.get(region)?.length ?? 0) > 0)).map((region) => {
            const stars = families.get(region) ?? [];
            return (
              <CatalogueFamily key={region} region={region} count={stars.length}>
                {stars.length > 0 ? (
                  stars.map((star, i) => (
                    <CatalogueCell
                      key={star.belief.id} star={star} dimmed={isDimmed(star)} first={i === 0}
                      onOpen={() => { setSelectedStarId(star.belief.id); setStoryOpen(false); }}
                    />
                  ))
                ) : (
                  <div style={{ ...sans, fontSize: 13, color: ivBody, padding: "13px 16px" }}>Nothing here yet.</div>
                )}
              </CatalogueFamily>
            );
          })}

          {/* ── How you've changed — the longitudinal layer (see
          ChangeEmotions and its siblings). Each closed row already says
          its takeaway; opening one shows the picture behind it. ── */}
            <SettingsGroup header="How you've changed" footer="Tap a row for the details." style={{ marginTop: 28, marginBottom: 0 }}>
              {[
                { key: "emotions" as const, title: "Your feelings", Icon: Smiley, body: <ChangeEmotions history={store.history} /> },
                { key: "values" as const, title: "What you're moving toward", Icon: Compass, body: <ChangeValues history={store.history} /> },
                { key: "patterns" as const, title: "Thinking habits", Icon: Lightbulb, body: <ChangePatterns history={store.history} /> },
                { key: "consistency" as const, title: "When you write", Icon: CalendarBlank, body: <ChangeConsistency history={store.history} /> },
                { key: "selfTalk" as const, title: "How you talk to yourself", Icon: ChatCircleText, body: <ChangeSelfTalk history={store.history} /> },
              ].map((d, i) => {
                const tone = REGION_CONFIG[CHANGE_TINT[d.key]];
                return (
                  <DisclosureRow
                    key={d.key} title={d.title} subtitle={changeSummaries[d.key] ?? "Fills in after a few entries."}
                    icon={<span style={{ ...settingsTile, backgroundColor: tone.tint, color: tone.ink }}><d.Icon size={17} weight="duotone" /></span>}
                    open={openDeeper === i} onToggle={() => setOpenDeeper((cur) => (cur === i ? null : i))} first={i === 0}
                  >
                    {d.body}
                  </DisclosureRow>
                );
              })}
            </SettingsGroup>
          </>
          )}
        </div>

        {/* Same vintage/cream bar as Home, Mind, and Analysis — nav chrome
        stays identical across tabs even though this screen's own theme is
        the dark archive; same shared BottomNav component and active-state
        system either way. */}
        <BottomNav active="history" onSelect={onNavSelect} vintage />
      </div>

      {/* ── Star detail / story sheet ── */}
      <AnimatePresence>
        {selectedStar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            role="button" tabIndex={-1} onClick={closeStarSheet}
            style={{ position: "absolute", inset: 0, zIndex: 25, backgroundColor: "rgba(42,38,33,0.28)", display: "flex", alignItems: "flex-end" }}
          >
            <SheetPanel onClose={closeStarSheet} style={{
                width: "100%", maxHeight: "82%", backgroundColor: "#FBF8F2",
                borderTop: "1px solid rgba(42,38,33,0.09)", borderRadius: "22px 22px 0 0", padding: "22px 22px 28px",
                display: "flex", flexDirection: "column", minHeight: 0, boxShadow: "0 -20px 50px rgba(120,105,80,0.16)",
              }}>
              {!storyOpen ? (
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, flexShrink: 0 }}>
                    <div>
                      <div style={{ ...mono, fontSize: 11, color: "rgba(42,38,33,0.5)", letterSpacing: "0.05em" }}>{String(selectedStar.catalogueNumber).padStart(3, "0")}</div>
                      <div style={{ marginTop: 6 }}><RegionBadge region={selectedStar.region} /></div>
                    </div>
                    <Breathe inline amount={1.08}><motion.span role="button" tabIndex={0} aria-label="Close" onClick={closeStarSheet} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: "rgba(42,38,33,0.5)", cursor: "pointer" }}>Close</motion.span></Breathe>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 18px", flexShrink: 0 }}>
                    <Node color={REGION_CONFIG[selectedStar.region].color} size={34} intensity={catalogueOrbIntensity(selectedStar)} />
                  </div>
                  <div style={{ ...display, fontSize: 22, lineHeight: 1.42, color: "#2A2621", textAlign: "center", wordBreak: "keep-all", marginBottom: 24, flexShrink: 0 }}>
                    {selectedStar.belief.statement}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 15, overflowY: "auto", minHeight: 0 }}>
                    <StatRow
                      label="First observed"
                      value={selectedStar.firstDiscovered ? `${formatDateDots(selectedStar.firstDiscovered)} · ${weekdayFromDotDate(formatDateDots(selectedStar.firstDiscovered))}` : "Unknown"}
                    />
                    <StatRow label="Appeared" value={`${selectedStar.appearances} time${selectedStar.appearances === 1 ? "" : "s"}`} />
                    <StatRow label="Current strength" value={`${selectedStar.belief.confidence}%`} />
                    {selectedConnectedBelief && <StatRow label="Strongly connected with" value={selectedConnectedBelief.statement} />}
                  </div>
                  {selectedEntries.length > 0 && (
                    <motion.div
                      role="button" tabIndex={0} onClick={() => setStoryOpen(true)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setStoryOpen(true); } }}
                      whileTap={{ opacity: 0.7 }}
                      style={{ marginTop: 22, ...sans, fontSize: 13, fontWeight: 700, color: "#2A2621", cursor: "pointer", textAlign: "center", flexShrink: 0 }}
                    >
                      View its story →
                    </motion.div>
                  )}
                </>
              ) : (
                <>
                  <motion.span
                    role="button" tabIndex={0} onClick={() => setStoryOpen(false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setStoryOpen(false); } }}
                    whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: "rgba(42,38,33,0.65)", cursor: "pointer", marginBottom: 14, flexShrink: 0 }}
                  >
                    <ArrowLeft size={13} weight="bold" aria-hidden /> Back
                  </motion.span>
                  <div style={{ ...display, fontSize: 20, color: "#2A2621", marginBottom: 4, wordBreak: "keep-all", flexShrink: 0 }}>{selectedStar.belief.statement}</div>
                  <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.5)", marginBottom: 18, flexShrink: 0 }}>Its story, in the order it happened.</div>
                  <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                    {(selectedStar.belief.confidenceHistory?.length ?? 0) > 1 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: ivBody, marginBottom: 8 }}>Strength over time</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {selectedStar.belief.confidenceHistory!.map((p, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)" }}>
                              <span>{p.date}</span><span style={{ ...mono, color: "#2A2621" }}>{p.value}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: ivBody }}>Appearances</div>
                    {selectedEntries.map((entry) => (
                      <motion.div
                        key={entry.id} role="button" tabIndex={0} onClick={() => openEntryFromStory(entry.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEntryFromStory(entry.id); } }}
                        whileTap={{ opacity: 0.6 }}
                        style={{ padding: "12px 14px", borderRadius: 12, backgroundColor: "rgba(42,38,33,0.045)", border: "1px solid rgba(42,38,33,0.07)", cursor: "pointer" }}
                      >
                        <div style={{ ...mono, fontSize: 11, color: "rgba(42,38,33,0.5)" }}>{entry.date}</div>
                        <div style={{ ...display, fontStyle: "italic", fontSize: 15, color: "#2A2621", marginTop: 4, lineHeight: 1.45, wordBreak: "keep-all", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          "{entry.text}"
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </SheetPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search / Calendar / Filter sheets ── */}
      <AnimatePresence>
        {sheet === "search" && (
          <HistorySheet title={view === "entries" ? "Search your entries" : "Search the catalogue"} onClose={() => setSheet(null)}>
            <input
              autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={view === "entries" ? "e.g. what I wrote yesterday about work" : "e.g. the one about money"}
              aria-label={view === "entries" ? "Search your entries" : "Search the star catalogue"}
              style={{ ...sans, fontSize: 16, color: "#2A2621", backgroundColor: "rgba(42,38,33,0.06)", border: "1.5px solid rgba(42,38,33,0.14)", borderRadius: 12, padding: "10px 14px", outline: "none", width: "100%", boxSizing: "border-box" }}
            />
            <div style={{ ...sans, fontSize: 13, color: "rgba(42,38,33,0.6)", marginTop: 14, lineHeight: 1.5 }}>
              {parsedSearch ? (
                <>
                  {describeQuery(parsedSearch) && <div style={{ marginBottom: 4 }}>Looking for <B>{describeQuery(parsedSearch)}</B></div>}
                  {view === "entries"
                    ? <><B>{store.history.filter((e) => scoreDoc(entryDoc(e, store.beliefs.filter((b) => (b.supportingEntryIds ?? []).includes(e.id))), parsedSearch) > 0).length}</B> of {store.history.length} entries</>
                    : <><B>{catalogue.filter(matchesSearch).length}</B> of {catalogue.length} thoughts</>}
                </>
              ) : (
                <>You don't need the exact words. Try a <B>time</B> ("yesterday", "last week") or <B>what it was about</B>.</>
              )}
            </div>
          </HistorySheet>
        )}
        {sheet === "calendar" && (
          <HistorySheet title="Rewind the catalogue" onClose={() => setSheet(null)}>
            <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.65)", lineHeight: 1.6, marginBottom: 14 }}>
              See which stars had already been discovered by a given date.
            </div>
            <div
              role="button" tabIndex={0} onClick={() => { setAsOfDate(null); setSheet(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAsOfDate(null); setSheet(null); } }}
              style={{ padding: "10px 8px", borderRadius: 10, backgroundColor: !asOfDate ? "rgba(42,38,33,0.08)" : "transparent", cursor: "pointer", marginBottom: 6 }}
            >
              <span style={{ ...display, fontSize: 17, color: "#2A2621" }}>Show the whole catalogue</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto" }}>
              {calendarMilestones.map(([date, count]) => (
                <div
                  key={date} role="button" tabIndex={0} onClick={() => { setAsOfDate(date); setSheet(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAsOfDate(date); setSheet(null); } }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 8px", borderBottom: "1px solid rgba(42,38,33,0.06)", cursor: "pointer", backgroundColor: asOfDate === date ? "rgba(42,38,33,0.08)" : "transparent", borderRadius: 8 }}
                >
                  <span style={{ ...display, fontSize: 17, color: "#2A2621" }}>{date} <span style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,0.5)" }}>· {weekdayFromDotDate(date)}</span></span>
                  <span style={{ ...mono, fontSize: 11, color: "rgba(42,38,33,0.5)" }}>{count} discovered</span>
                </div>
              ))}
              {calendarMilestones.length === 0 && <div style={{ ...sans, fontSize: 13, color: "rgba(42,38,33,0.5)" }}>No dated stars yet.</div>}
            </div>
          </HistorySheet>
        )}
        {sheet === "filter" && (
          <HistorySheet title="Filter the catalogue" onClose={() => setSheet(null)}>
            <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: ivBody, marginBottom: 10 }}>By category</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
              <CatalogueFilterChip label="All" active={!filterMode} onClick={() => { setFilterMode(null); setSheet(null); }} />
              {COGNITIVE_REGIONS.map((region) => (
                <CatalogueFilterChip
                  key={region} label={REGION_CONFIG[region].label} color={REGION_CONFIG[region].color}
                  active={filterMode?.type === "region" && filterMode.region === region}
                  disabled={(families.get(region)?.length ?? 0) === 0}
                  onClick={() => { setFilterMode({ type: "region", region }); setSheet(null); }}
                />
              ))}
            </div>
            <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: ivBody, marginBottom: 4 }}>By pattern</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <CatalogueFilterRow label="Active" note="Recently reinforced" active={filterMode?.type === "active"} onClick={() => { setFilterMode({ type: "active" }); setSheet(null); }} />
              <CatalogueFilterRow label="Dormant" note="Quieter, not recently reinforced" active={filterMode?.type === "dormant"} onClick={() => { setFilterMode({ type: "dormant" }); setSheet(null); }} />
              <CatalogueFilterRow label="Recently discovered" note="First observed in the last 30 days" active={filterMode?.type === "recent"} onClick={() => { setFilterMode({ type: "recent" }); setSheet(null); }} />
              <CatalogueFilterRow label="Most recurrent" note="Appeared the most often" active={filterMode?.type === "recurrent"} onClick={() => { setFilterMode({ type: "recurrent" }); setSheet(null); }} />
            </div>
          </HistorySheet>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Screen 13.5 · History entry detail ────────────────────────────────────────
// Previously showed only the raw date/duration/text and threw away
// everything else already sitting on the entry — entry.analysis (situation,
// automatic thought, emotions, cognitive patterns, the belief it fed into)
// and entry.sessionSummary (Feature 3's AI recap, otherwise only ever seen
// once, on ScreenSessionSummary, right after recording — never revisitable
// anywhere else). A tap into any entry landed on a screen with a wall of
// empty space below one paragraph, which read as unfinished rather than
// deliberately minimal. Free-tier entries (see appendUnanalyzedEntry in
// realStore.ts) genuinely have no `analysis`, so those sections just don't
// render — never a fabricated "nothing to see" placeholder for them.
export function ScreenHistoryDetail({ index, store, onBack }: { index: number; store: Store; onBack?: () => void }) {
  const items = [...store.history].reverse();
  const entry = items[index] ?? items[0];
  if (!entry) return null;
  const analysis = entry.analysis;
  // The page's dateline, the way a diary heads a page: weekday, then the
  // full date. relativeDayLabel gives Today/Yesterday when it applies.
  const d = parseDotDate(entry.date);
  const rel = relativeDayLabel(entry.date);
  const dateline = d
    ? `${rel === "Today" || rel === "Yesterday" ? rel : d.toLocaleDateString("en-US", { weekday: "long" })} · ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
    : entry.date;
  // The belief this entry fed, resolved to its region for the badge.
  const fedBelief = analysis?.hypothesis.candidateBelief ? store.beliefs.find((b) => b.statement === analysis.hypothesis.candidateBelief) : undefined;
  const PAGE_LINE = 36; // px — the page body's line height and ruling pitch
  const field: React.CSSProperties = { padding: "12px 16px", position: "relative" };
  const fieldLabel: React.CSSProperties = { ...sans, fontSize: 12, color: ivBody, marginBottom: 3 };
  const divider = <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ivBg2 }}>
      <div style={{ padding: "16px 22px 10px", flexShrink: 0 }}>
        <BackButton onClick={onBack} color={ivBody} />
      </div>
      <div className="edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 16px 32px" }}>
        {/* The page itself: dateline, then the entry on ruled paper. */}
        <div style={{ backgroundColor: ivSurfaceSolid, borderRadius: shape.lg, boxShadow: ivCardShadow, padding: "16px 20px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <span style={{ ...hand, fontSize: 21, fontWeight: 600, color: REGION_CONFIG.identity.ink }}>{dateline}</span>
            {entry.duration && <span style={{ ...mono, fontSize: 11, color: ivFaint, flexShrink: 0 }}>{entry.duration}</span>}
          </div>
          <div
            style={{
              ...hand, fontSize: 26, fontWeight: 500, lineHeight: `${PAGE_LINE}px`, color: "#2E2547", wordBreak: "keep-all",
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${PAGE_LINE - 1}px, rgba(42,38,33,0.1) ${PAGE_LINE - 1}px, rgba(42,38,33,0.1) ${PAGE_LINE}px)`,
            }}
          >
            {entry.text}
          </div>
        </div>

        {entry.sessionSummary && (
          <SettingsGroup header="Recap" style={{ marginTop: 22, marginBottom: 0 }}>
            <div style={{ ...sans, fontSize: 13, color: ivHeading, padding: "13px 16px", lineHeight: 1.65, wordBreak: "keep-all" }}>{entry.sessionSummary}</div>
          </SettingsGroup>
        )}

        {analysis && (
          <>
            {(analysis.observation.situation || analysis.observation.automaticThought || analysis.observation.actionUrge) && (
              <SettingsGroup
                header="What stood out"
                style={{ marginTop: 22, marginBottom: 0 }}
                footer={analysis.interpretation.valueDirection.explanation || undefined}
              >
                {analysis.observation.situation && (
                  <div style={field}>
                    <div style={fieldLabel}>Situation</div>
                    <div style={{ ...sans, fontSize: 15, color: ivHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{analysis.observation.situation}</div>
                  </div>
                )}
                {analysis.observation.automaticThought && (
                  <div style={field}>
                    {analysis.observation.situation && divider}
                    <div style={fieldLabel}>Automatic thought</div>
                    <div style={{ ...display, fontStyle: "italic", fontSize: 20, color: ivHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>"{analysis.observation.automaticThought}"</div>
                  </div>
                )}
                {analysis.observation.actionUrge && (
                  <div style={field}>
                    {(analysis.observation.situation || analysis.observation.automaticThought) && divider}
                    <div style={fieldLabel}>What it made you want to do</div>
                    <div style={{ ...sans, fontSize: 15, color: ivHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{analysis.observation.actionUrge}</div>
                  </div>
                )}
                {(analysis.observation.emotions.length > 0 || analysis.interpretation.possibleCognitivePatterns.length > 0) && (
                  <div style={{ ...field, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {divider}
                    {analysis.observation.emotions.map((e, i) => (
                      <span key={`e-${i}`} style={{ ...sans, fontSize: 12, fontWeight: 600, color: ivBody, backgroundColor: "rgba(42,38,33,0.06)", padding: "4px 9px", borderRadius: 6, lineHeight: 1.2 }}>
                        {e.label} · {e.intensity}%
                      </span>
                    ))}
                    {analysis.interpretation.possibleCognitivePatterns.map((p) => (
                      <span key={p} style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdWarnLabel, backgroundColor: mdWarnSoft, padding: "4px 9px", borderRadius: 6, lineHeight: 1.2 }}>{p}</span>
                    ))}
                  </div>
                )}
              </SettingsGroup>
            )}

            {analysis.hypothesis.candidateBelief && (
              <SettingsGroup header="Belief this fed into" style={{ marginTop: 22, marginBottom: 0 }}>
                <div style={{ padding: "13px 16px", borderLeft: `3px solid ${fedBelief ? REGION_CONFIG[resolveRegion(fedBelief)].color : ivHeading}` }}>
                  {fedBelief && <div style={{ marginBottom: 8 }}><RegionBadge region={resolveRegion(fedBelief)} /></div>}
                  <div style={{ ...display, fontSize: 20, fontStyle: "italic", color: ivHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{analysis.hypothesis.candidateBelief}</div>
                </div>
              </SettingsGroup>
            )}
          </>
        )}
      </div>
    </div>
  );
}
