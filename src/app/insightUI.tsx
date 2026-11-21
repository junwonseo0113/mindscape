import React from "react";
import { motion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { CognitiveRegion } from "./neuralBrainLayout";
import { StoredHistoryEntry } from "./types";
import { formatDateDots, mondayOfWeek, parseDotDate, shortMonthDay } from "./dateUtils";
import { Breathe, MeterFill } from "./motionPrimitives";
import { hand, mono, sans } from "./typefaces";
import { ArrowDownRight, ArrowUpRight, Minus } from "@phosphor-icons/react";
import { COGNITIVE_PATTERN_DESCRIPTIONS } from "./analysisFramework";
import { ink, hair, tension, dkCardBorder, dkBodyLight, dkAccent, dkTrack, mdHeading, mdDivider, shape, ivBorder, ivHeading, ivBody, ivFaint } from "./screenTheme";

// ── How you've changed ───────────────────────────────────────────────────────
// Five lenses on the same entries. They used to be five identical gray bar
// lists with cryptic tails ("62 · 1×", "1 toward · 0 away"), so the only
// way to tell them apart was the title. Now each one:
//   · leads with a plain one-line takeaway — the same sentence the closed
//     row shows as its subtitle, so the list reads before anything opens;
//   · has its own tint (borrowed from the region palette, so nothing new
//     enters the app's colors) and its own picture, matched to what it
//     measures: magnitude bars for feelings, a two-sided bar for value
//     direction, short explained cards for thinking habits, a calendar for
//     consistency, then-and-now numbers for self-talk;
//   · says what its numbers mean in words, under the picture.
export const CHANGE_TINT: Record<"emotions" | "values" | "patterns" | "consistency" | "selfTalk", CognitiveRegion> = {
  emotions: "relationships",
  values: "security",
  patterns: "career",
  consistency: "curiosity",
  selfTalk: "identity",
};

const PLEASANT_FEELINGS = new Set([
  "calm", "happy", "joy", "relief", "gratitude", "grateful", "hope", "hopeful", "anticipation", "excitement", "excited",
  "pride", "proud", "contentment", "content", "love", "curiosity", "curious", "peace", "peaceful", "relaxed", "satisfied",
]);
const isPleasantFeeling = (label: string) => PLEASANT_FEELINGS.has(label.trim().toLowerCase());

function aggregateEmotions(history: StoredHistoryEntry[]) {
  const totals = new Map<string, { sum: number; count: number }>();
  history.forEach((entry) => {
    entry.analysis?.observation.emotions.forEach((em) => {
      const cur = totals.get(em.label) ?? { sum: 0, count: 0 };
      cur.sum += em.intensity;
      cur.count += 1;
      totals.set(em.label, cur);
    });
  });
  return Array.from(totals.entries())
    .map(([label, { sum, count }]) => ({ label, avg: Math.round(sum / count), count, pleasant: isPleasantFeeling(label) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6);
}

function aggregateValues(history: StoredHistoryEntry[]) {
  const totals = new Map<string, { toward: number; away: number; unclear: number }>();
  history.forEach((entry) => {
    const vd = entry.analysis?.interpretation.valueDirection;
    if (!vd) return;
    vd.relatedValues.forEach((value) => {
      const cur = totals.get(value) ?? { toward: 0, away: 0, unclear: 0 };
      cur[vd.towardOrAway] += 1;
      totals.set(value, cur);
    });
  });
  return Array.from(totals.entries())
    .map(([label, t]) => ({ label, ...t, total: t.toward + t.away + t.unclear }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

function aggregatePatterns(history: StoredHistoryEntry[]) {
  const counts = new Map<string, number>();
  history.forEach((entry) => {
    entry.analysis?.interpretation.possibleCognitivePatterns.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1));
  });
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 6);
}

// "A common habit of mind that holds yourself to…" → "Holds yourself to…"
function plainPatternDescription(label: string): string {
  const d = COGNITIVE_PATTERN_DESCRIPTIONS[label as keyof typeof COGNITIVE_PATTERN_DESCRIPTIONS] ?? "";
  const s = d.replace(/^A common habit of mind that /, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const RECORDING_HEATMAP_WEEKS = 12;
type HeatmapDay = { date: Date; count: number; isFuture: boolean };

// Sun–Sat columns, the most recent week last, GitHub-contribution style.
// The window ends on the Saturday of the week of the *latest entry* (not
// of today), the same anchoring the Analysis tab's Recent weeks uses: a
// person who hasn't written this month still sees the shape of when they
// did write, instead of twelve weeks of empty squares. Days after that
// entry are marked isFuture and drawn as empty space.
function buildRecordingHeatmapWeeks(history: StoredHistoryEntry[], numWeeks = RECORDING_HEATMAP_WEEKS): { weeks: HeatmapDay[][]; anchor: Date } {
  const counts = new Map<string, number>();
  let latest: Date | null = null;
  history.forEach((e) => {
    const d = parseDotDate(e.date);
    if (!d) return;
    counts.set(d.toDateString(), (counts.get(d.toDateString()) ?? 0) + 1);
    if (!latest || d > latest) latest = d;
  });
  const anchor = new Date(latest ?? new Date());
  anchor.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(anchor);
  endOfWeek.setDate(anchor.getDate() + (6 - anchor.getDay()));
  const start = new Date(endOfWeek);
  start.setDate(endOfWeek.getDate() - numWeeks * 7 + 1);
  const weeks: HeatmapDay[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < numWeeks; w++) {
    const week: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(cursor);
      const isFuture = dayDate > anchor;
      week.push({ date: dayDate, count: isFuture ? 0 : counts.get(dayDate.toDateString()) ?? 0, isFuture });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return { weeks, anchor };
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The takeaway sentence for each lens — shown as the closed row's subtitle
// and again as the opened body's first line. null means "no data yet".
type ChangeSummaries = Record<keyof typeof CHANGE_TINT, string | null>;
export function summarizeChanges(history: StoredHistoryEntry[]): ChangeSummaries {
  const emotions = aggregateEmotions(history);
  const values = aggregateValues(history);
  const patterns = aggregatePatterns(history);
  const { weeks, anchor } = buildRecordingHeatmapWeeks(history);
  const days = weeks.flat().filter((d) => !d.isFuture && d.count > 0);
  const selfTalk = buildSelfTalkWeeks(history);

  const toward = [...values].filter((v) => v.toward > 0).sort((a, b) => b.toward - a.toward)[0];
  const away = [...values].filter((v) => v.away > 0).sort((a, b) => b.away - a.away)[0];
  const allSameCount = patterns.length > 1 && patterns.every((p) => p.count === patterns[0].count);
  const weekdayCounts = new Array(7).fill(0);
  days.forEach((d) => { weekdayCounts[d.date.getDay()] += d.count; });
  const topWeekday = weekdayCounts.indexOf(Math.max(...weekdayCounts));
  const firstRate = selfTalk[0]?.cognitiveVerbPerHundredWords ?? 0;
  const lastRate = selfTalk[selfTalk.length - 1]?.cognitiveVerbPerHundredWords ?? 0;

  return {
    emotions: emotions.length ? `${emotions[0].label} has been the strongest feeling — ${emotions[0].avg} out of 100 on average.` : null,
    values: toward && away ? `Moving toward ${toward.label}, drifting from ${away.label}.`
      : toward ? `Mostly moving toward ${toward.label}.`
      : away ? `Drifting from ${away.label} more than toward anything.`
      : values.length ? "No clear direction yet — entries touch your values without leaning either way." : null,
    patterns: !patterns.length ? null
      : allSameCount ? `${patterns.length} habits of mind showed up, ${patterns[0].count === 1 ? "once each" : `${patterns[0].count} times each`}.`
      : `${patterns[0].label} comes up most — ${patterns[0].count} ${patterns[0].count === 1 ? "time" : "times"}.`,
    consistency: days.length
      ? `You wrote on ${days.length} ${days.length === 1 ? "day" : "days"} in the ${RECORDING_HEATMAP_WEEKS} weeks to ${shortMonthDay(formatDateDots(anchor))}${days.length > 1 ? `, most often on ${WEEKDAY_NAMES[topWeekday]}s` : ""}.`
      : null,
    selfTalk: selfTalk.length < 2 ? null
      : firstRate < 0.05 && lastRate >= 0.05 ? `You've started using reflective words — ${lastRate.toFixed(1)}% of what you wrote lately, none at first.`
      : lastRate > firstRate + 0.3 ? `You use more reflective words lately — ${firstRate.toFixed(1)}% then, ${lastRate.toFixed(1)}% now.`
      : lastRate < firstRate - 0.3 ? `You use fewer reflective words lately — ${firstRate.toFixed(1)}% then, ${lastRate.toFixed(1)}% now.`
      : `Your reflective language has held steady, around ${lastRate.toFixed(1)}% of your words.`,
  };
}

function ChangeEmpty({ children }: { children: React.ReactNode }) {
  return <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, wordBreak: "keep-all" }}>{children}</div>;
}
function ChangeNote({ children }: { children: React.ReactNode }) {
  return <div style={{ ...sans, fontSize: 12, color: ivBody, lineHeight: 1.55, marginTop: 12, wordBreak: "keep-all" }}>{children}</div>;
}

// Feelings: which ones, how strong. A balance bar first (lighter vs.
// heavier feelings, weighted by strength), then one bar per feeling in its
// tone. The tone is a second, quieter cue beside the label — the words do
// the identifying.
export function ChangeEmotions({ history }: { history: StoredHistoryEntry[] }) {
  const rows = aggregateEmotions(history);
  if (rows.length === 0) return <ChangeEmpty>No feelings recorded yet. They show up here after a few entries.</ChangeEmpty>;
  const light = REGION_CONFIG.security;
  const heavy = REGION_CONFIG.relationships;
  const weight = (pleasant: boolean) => rows.filter((r) => r.pleasant === pleasant).reduce((s, r) => s + r.avg * r.count, 0);
  const lightShare = Math.round((weight(true) / Math.max(1, weight(true) + weight(false))) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", ...sans, fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: light.ink, fontWeight: 600 }}>Lighter {lightShare}%</span>
        <span style={{ color: heavy.ink, fontWeight: 600 }}>Heavier {100 - lightShare}%</span>
      </div>
      <div
        role="img" aria-label={`Lighter feelings ${lightShare} percent, heavier feelings ${100 - lightShare} percent.`}
        style={{ height: 10, borderRadius: 5, backgroundImage: `linear-gradient(90deg, ${light.color} 0%, ${light.color} ${Math.max(0, lightShare - 6)}%, ${heavy.color} ${Math.min(100, lightShare + 6)}%, ${heavy.color} 100%)` }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ ...sans, fontSize: 14, fontWeight: 500, color: ivHeading }}>{r.label}</span>
              <span style={{ ...mono, fontSize: 12, color: ivBody }}>{r.avg}<span style={{ color: ivFaint }}> / 100</span></span>
            </div>
            <MeterFill value={r.avg} color={(r.pleasant ? light : heavy).color} track="rgba(42,38,33,0.07)" height={6} radius={3} />
          </div>
        ))}
      </div>
      <ChangeNote>Each bar is how strong that feeling was, on average, on the days it came up. Green leans light, rose leans heavy.</ChangeNote>
    </div>
  );
}

// Values: a two-sided bar per value — away to the left of the center line,
// toward to the right — so direction is the first thing the eye gets.
export function ChangeValues({ history }: { history: StoredHistoryEntry[] }) {
  const rows = aggregateValues(history);
  if (rows.length === 0) return <ChangeEmpty>No value directions yet. They show up here after a few entries.</ChangeEmpty>;
  const toward = REGION_CONFIG.security;
  const away = REGION_CONFIG.creativity;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.toward, r.away)));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", ...sans, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
        <span style={{ color: away.ink }}>← Away from it</span>
        <span style={{ color: toward.ink }}>Toward it →</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((r) => (
          <div key={r.label} role="img" aria-label={`${r.label}: ${r.toward} toward, ${r.away} away.`}>
            <div style={{ ...sans, fontSize: 14, fontWeight: 500, color: ivHeading, textAlign: "center", marginBottom: 5 }}>{r.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...mono, fontSize: 12, color: r.away ? away.ink : ivFaint, width: 14, textAlign: "right" }}>{r.away}</span>
              <div style={{ flex: 1, height: 8, borderRadius: "4px 0 0 4px", backgroundColor: "rgba(42,38,33,0.06)", display: "flex", justifyContent: "flex-end", overflow: "hidden" }}>
                <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: `${(r.away / max) * 100}%`, height: "100%", transformOrigin: "right", backgroundImage: `linear-gradient(270deg, ${away.color}66, ${away.color})` }} />
              </div>
              <span aria-hidden style={{ width: 2, height: 16, borderRadius: 1, backgroundColor: ivFaint, flexShrink: 0 }} />
              <div style={{ flex: 1, height: 8, borderRadius: "0 4px 4px 0", backgroundColor: "rgba(42,38,33,0.06)", overflow: "hidden" }}>
                <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: `${(r.toward / max) * 100}%`, height: "100%", transformOrigin: "left", backgroundImage: `linear-gradient(90deg, ${toward.color}66, ${toward.color})` }} />
              </div>
              <span style={{ ...mono, fontSize: 12, color: r.toward ? toward.ink : ivFaint, width: 14 }}>{r.toward}</span>
            </div>
          </div>
        ))}
      </div>
      <ChangeNote>The numbers are entries. "Toward" means what you did that day moved you closer to something you care about; "away" means it pulled you from it.</ChangeNote>
    </div>
  );
}

// Thinking habits: each one named, counted, and explained in a sentence —
// the explanation is what makes "Mental filtering" mean something.
export function ChangePatterns({ history }: { history: StoredHistoryEntry[] }) {
  const rows = aggregatePatterns(history);
  if (rows.length === 0) return <ChangeEmpty>No thinking habits spotted yet. They show up here after a few entries.</ChangeEmpty>;
  const tone = REGION_CONFIG.career;
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ borderRadius: shape.sm, backgroundImage: `linear-gradient(135deg, ${tone.tint} 0%, rgba(255,255,255,0.6) 100%)`, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ ...sans, fontSize: 14, fontWeight: 600, color: tone.ink }}>{r.label}</span>
              <span style={{ ...mono, fontSize: 12, color: tone.ink, flexShrink: 0 }}>{r.count}×</span>
            </div>
            <div style={{ ...sans, fontSize: 12.5, color: ivHeading, opacity: 0.8, lineHeight: 1.5, marginTop: 4, wordBreak: "keep-all" }}>{plainPatternDescription(r.label)}</div>
          </div>
        ))}
      </div>
      <ChangeNote>These are common habits of mind from CBT, not diagnoses. Noticing one is the point — it isn't something to fix.</ChangeNote>
    </div>
  );
}

// Consistency: a twelve-week calendar in the module's blue, with month
// labels across the top and weekday initials down the side.
export function ChangeConsistency({ history }: { history: StoredHistoryEntry[] }) {
  const { weeks } = React.useMemo(() => buildRecordingHeatmapWeeks(history), [history]);
  const tone = REGION_CONFIG.curiosity;
  const recorded = weeks.flat().filter((d) => !d.isFuture && d.count > 0);
  if (recorded.length === 0) return <ChangeEmpty>No entries yet. Each day you write fills in a square here.</ChangeEmpty>;
  const cellColor = (d: HeatmapDay) => (d.isFuture ? "transparent" : d.count === 0 ? "rgba(42,38,33,0.06)" : d.count === 1 ? `${tone.color}99` : tone.ink);
  const cell = 20;
  const gap = 4;
  const label = `Days written in the last ${RECORDING_HEATMAP_WEEKS} weeks: ${recorded.map((d) => shortMonthDay(formatDateDots(d.date))).join(", ")}.`;
  return (
    <div>
      <div role="img" aria-label={label} style={{ display: "flex", gap: 6 }}>
        <div aria-hidden style={{ display: "flex", flexDirection: "column", gap, paddingTop: 13 + gap }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} style={{ ...sans, fontSize: 10, lineHeight: `${cell}px`, height: cell, color: i % 2 ? ivBody : "transparent" }}>{d}</span>
          ))}
        </div>
        <div aria-hidden style={{ display: "flex", gap, overflowX: "auto" }} className="no-scrollbar">
          {weeks.map((week, wi) => {
            const first = week[0].date;
            const showMonth = wi === 0 || first.getDate() <= 7;
            return (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap, flexShrink: 0 }}>
                <span style={{ ...sans, fontSize: 10, height: 13, color: ivBody, whiteSpace: "nowrap", width: cell, overflow: "visible" }}>
                  {showMonth ? first.toLocaleDateString("en-US", { month: "short" }) : ""}
                </span>
                {week.map((day, di) => (
                  <div key={di} title={day.isFuture ? undefined : `${formatDateDots(day.date)} · ${day.count} ${day.count === 1 ? "entry" : "entries"}`}
                    style={{ width: cell, height: cell, borderRadius: 5, backgroundColor: cellColor(day) }} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, ...sans, fontSize: 11, color: ivBody }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: "rgba(42,38,33,0.06)" }} /> none
        <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: `${tone.color}99`, marginLeft: 6 }} /> one entry
        <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: tone.ink, marginLeft: 6 }} /> more
      </div>
    </div>
  );
}

// Self-talk: two then-and-now numbers instead of a per-week bar list —
// how much reflective language ("think", "realize", "notice"), and how
// much the writing is about "I" versus other people.
export function ChangeSelfTalk({ history }: { history: StoredHistoryEntry[] }) {
  const weeks = buildSelfTalkWeeks(history);
  if (weeks.length < 2) return <ChangeEmpty>This needs entries from at least two different weeks to compare.</ChangeEmpty>;
  const tone = REGION_CONFIG.identity;
  const other = REGION_CONFIG.curiosity;
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const delta = last.cognitiveVerbPerHundredWords - first.cognitiveVerbPerHundredWords;
  const TrendIcon = delta > 0.3 ? ArrowUpRight : delta < -0.3 ? ArrowDownRight : Minus;
  const iShare = (w: SelfTalkWeek) => {
    const t = w.firstPersonSingularCount + w.collectiveOrOtherCount;
    return t > 0 ? Math.round((w.firstPersonSingularCount / t) * 100) : null;
  };
  const lastShare = iShare(last);
  const firstShare = iShare(first);
  const tile: React.CSSProperties = { flex: 1, minWidth: 140, borderRadius: shape.sm, padding: "12px 13px", backgroundImage: `linear-gradient(150deg, ${tone.tint} 0%, rgba(255,255,255,0.65) 100%)` };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={tile}>
          <div style={{ ...sans, fontSize: 12, color: tone.ink, fontWeight: 600 }}>Reflective words</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{ ...mono, fontSize: 24, fontWeight: 700, color: ivHeading }}>{last.cognitiveVerbPerHundredWords.toFixed(1)}%</span>
            <TrendIcon size={18} weight="bold" color={tone.ink} />
          </div>
          <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 2 }}>{first.cognitiveVerbPerHundredWords < 0.05 ? "none" : `was ${first.cognitiveVerbPerHundredWords.toFixed(1)}%`} the week of {shortMonthDay(first.weekStart)}</div>
        </div>
        <div style={tile}>
          <div style={{ ...sans, fontSize: 12, color: tone.ink, fontWeight: 600 }}>About you vs. others</div>
          {lastShare === null ? (
            <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 8 }}>No pronouns counted yet.</div>
          ) : (
            <>
              <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginTop: 10, backgroundImage: `linear-gradient(90deg, ${tone.color} 0%, ${tone.color} ${Math.max(0, lastShare - 5)}%, ${other.color} ${Math.min(100, lastShare + 5)}%, ${other.color} 100%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", ...sans, fontSize: 12, marginTop: 5 }}>
                <span style={{ color: tone.ink, fontWeight: 600 }}>"I" {lastShare}%</span>
                <span style={{ color: other.ink, fontWeight: 600 }}>"we/they" {100 - lastShare}%</span>
              </div>
              {firstShare !== null && firstShare !== lastShare && (
                <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 2 }}>"I" was {firstShare}% at first</div>
              )}
            </>
          )}
        </div>
      </div>
      <ChangeNote>Reflective words — "think", "realize", "notice" — as a share of everything you wrote that week. More of them often means stepping back from a feeling to look at it.</ChangeNote>
    </div>
  );
}

type SelfTalkWeek = {
  weekStart: string;
  cognitiveVerbPerHundredWords: number;
  firstPersonSingularCount: number;
  collectiveOrOtherCount: number;
};

// Only entries that actually carry languageObservation contribute (older
// entries from before Feature 2 existed won't) — weeks with real entries
// but zero observation data simply don't produce a bucket, rather than a
// misleading zero-rate week.
function buildSelfTalkWeeks(history: StoredHistoryEntry[], maxWeeks = 8): SelfTalkWeek[] {
  const buckets = new Map<string, { words: number; verbs: number; firstPerson: number; collective: number }>();
  history.forEach((e) => {
    const obs = e.languageObservation;
    const d = parseDotDate(e.date);
    if (!obs || !d) return;
    const key = formatDateDots(mondayOfWeek(d));
    const cur = buckets.get(key) ?? { words: 0, verbs: 0, firstPerson: 0, collective: 0 };
    cur.words += obs.wordCount;
    cur.verbs += obs.cognitiveVerbCount;
    cur.firstPerson += obs.firstPersonSingularCount;
    cur.collective += obs.collectiveOrOtherCount;
    buckets.set(key, cur);
  });
  return Array.from(buckets.entries())
    .map(([weekStart, b]) => ({
      weekStart,
      cognitiveVerbPerHundredWords: b.words > 0 ? (b.verbs / b.words) * 100 : 0,
      firstPersonSingularCount: b.firstPerson,
      collectiveOrOtherCount: b.collective,
    }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)) // lexicographic sort is safe: fixed-width zero-padded "YYYY.MM.DD"
    .slice(-maxWeeks);
}



// The one shared agree/disagree control — used compactly in the hero (a
// quick read, available before the user has even scrolled) and again in
// the Reflection section further down (where disagreeing also asks what
// specifically didn't land). Both touchpoints read/write the exact same
// reaction, so they can never contradict each other about what the user
// actually said.
export function ReactionButtons({ reaction, onReact, disabled, dark, modernist, night }: { reaction: "agree" | "disagree" | null | undefined; onReact?: (r: "agree" | "disagree") => void; disabled?: boolean; dark?: boolean; modernist?: boolean; night?: boolean }) {
  // "night" — Examine/Analysis's own quiet ivory reaction pair, distinct
  // from "dark"/"modernist" below.
  if (night) {
    return (
      <div style={{ display: "flex", gap: 10, opacity: disabled ? 0.55 : 1 }}>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("agree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, border: `1px solid ${ivHeading}`, backgroundColor: ivHeading, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 13, fontWeight: 700, color: "#fff" }}>I agree</span>
        </motion.div></Breathe>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("disagree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, border: `1px solid ${ivBorder}`, backgroundColor: "transparent", cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 13, fontWeight: 700, color: ivBody }}>Doesn't feel right</span>
        </motion.div></Breathe>
      </div>
    );
  }
  if (modernist) {
    return (
      <div style={{ display: "flex", gap: 8, opacity: disabled ? 0.55 : 1 }}>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("agree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 14, backgroundColor: mdHeading, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 13, fontWeight: 800, color: "#fff" }}>I agree</span>
        </motion.div></Breathe>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("disagree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 14, border: `1px solid ${mdDivider}`, backgroundColor: "transparent", cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 13, fontWeight: 800, color: mdHeading }}>Doesn't feel right</span>
        </motion.div></Breathe>
      </div>
    );
  }
  if (dark) {
    return (
      <div style={{ display: "flex", gap: 10, opacity: disabled ? 0.55 : 1 }}>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("agree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, backgroundColor: dkAccent, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 15, fontWeight: 600, color: "#fff" }}>I agree</span>
        </motion.div></Breathe>
        <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
          role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("disagree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 12, border: `1px solid ${dkCardBorder}`, backgroundColor: dkTrack, cursor: disabled ? "default" : "pointer" }}
        >
          <span style={{ ...sans, fontSize: 15, fontWeight: 600, color: dkBodyLight }}>Doesn't feel right</span>
        </motion.div></Breathe>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 10, opacity: disabled ? 0.55 : 1 }}>
      <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
        role="button" tabIndex={0} onClick={() => !disabled && onReact?.("agree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("agree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
        style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, border: `1px solid ${reaction === "agree" ? ink : hair}`, backgroundColor: reaction === "agree" ? ink : "transparent", cursor: disabled ? "default" : "pointer" }}
      >
        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: reaction === "agree" ? "#fff" : ink }}>I agree</span>
      </motion.div></Breathe>
      <Breathe amount={1.03} style={{ flex: 1, width: "auto" }}><motion.div
        role="button" tabIndex={0} onClick={() => !disabled && onReact?.("disagree")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => !disabled && onReact?.("disagree"))?.(); } }} whileTap={disabled ? undefined : { scale: 0.97 }}
        style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, border: `1px solid ${reaction === "disagree" ? tension : hair}`, backgroundColor: reaction === "disagree" ? tension : "transparent", cursor: disabled ? "default" : "pointer" }}
      >
        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: reaction === "disagree" ? "#fff" : ink }}>Doesn't feel right</span>
      </motion.div></Breathe>
    </div>
  );
}

// How often a thought comes up, said in words instead of a percentage:
// the confidence score behind it, read as "a lot / often / now and then",
// with five small dots in the thought's colour. Used wherever a belief's
// strength is shown to the person (Mind, Patterns, the sky's star sheet).
export function howOften(confidence: number) {
  return {
    label: confidence >= 75 ? "Comes up a lot" : confidence >= 50 ? "Comes up often" : "Comes up now and then",
    dots: Math.max(1, Math.round(confidence / 20)),
  };
}

export function OftenDots({ confidence, region, extra, night }: { confidence: number; region: CognitiveRegion; extra?: string; night?: boolean }) {
  const c = REGION_CONFIG[region];
  const { label, dots } = howOften(confidence);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span aria-hidden style={{ display: "inline-flex", gap: 3 }}>
        {Array.from({ length: 5 }, (_, k) => (
          <span key={k} style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: k < dots ? c.color : night ? "rgba(255,255,255,0.16)" : "rgba(42,38,33,0.12)", boxShadow: k < dots ? `0 0 ${night ? 8 : 5}px ${c.color}${night ? "cc" : "88"}` : undefined }} />
        ))}
      </span>
      <span style={{ ...hand, fontSize: 18, fontWeight: 600, color: night ? c.color : c.ink }}>{label}</span>
      {extra && <span style={{ ...sans, fontSize: 12, color: night ? "rgba(244,239,255,0.6)" : ivBody }}>{extra}</span>}
    </div>
  );
}

// One "Further Insights" card — a small, quiet ivory SurfaceCard in a
// horizontally-scrolling row. Every field is still real (see
// RecentInsightItem/buildRecentInsights) and nothing here is invented
// per-card copy — tapping a card still opens the exact same Examine view a
// row used to. The card's node (the shared Node component, same one
// History's catalogue and Home's node field use) sits directly beside that
// region's own name, so its color reads as this insight's actual identity
// rather than a decorative dot. The primary label is the short semantic
// thoughtLabel when one exists (the same "defusion" noun-phrase Today's
// Discovery's own headline uses, e.g. "Perfectionism thought") — a
// genuinely more legible heading than a full sentence at this size — with
// the fuller statement demoted to quiet supporting text under it, and the
// relative date folded into one small, muted metadata line at the bottom
// instead of a bold colored badge up top.
