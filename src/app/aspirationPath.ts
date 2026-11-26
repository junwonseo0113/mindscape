// ── The path to who you want to be ───────────────────────────────────────────
// Mindscape's main measure: how close what you write is to the person you
// said you want to become (Store.aspiration).
//
// Each written entry is a step: toward, away, or neither. The step comes
// from /api/analyze's `aspirationStep` when there is one; older entries fall
// back to the analysis's own "toward / away from your values" reading.
// Closeness is how your recent steps balance out, 0 to 100:
//   50 = as many steps away as toward, 100 = every recent step toward.
// Only the last RECENT steps count, so the number follows who you are now
// rather than averaging over your whole history.
import { parseDotDate, formatDateDots } from "./dateUtils";
import { isMoodCheckIn } from "./realStore";
import type { StoredHistoryEntry } from "./types";

export const RECENT = 10;

export type Step = { dir: 1 | -1 | 0; size: number; note: string | null };

export function entryStep(e: StoredHistoryEntry): Step {
  const s = e.aspirationStep;
  if (s) return { dir: s.direction === "toward" ? 1 : s.direction === "away" ? -1 : 0, size: s.size, note: s.note || null };
  const v = e.analysis?.interpretation.valueDirection;
  if (v && (v.towardOrAway === "toward" || v.towardOrAway === "away")) {
    return { dir: v.towardOrAway === "toward" ? 1 : -1, size: 1, note: v.explanation || null };
  }
  return { dir: 0, size: 0, note: null };
}

const written = (history: StoredHistoryEntry[]) => history.filter((e) => !isMoodCheckIn(e));

// A score from one or two entries jumps straight to 0 or 100, which says more
// about the arithmetic than about the person. So the number waits until
// there are MIN_STEPS steps to go on; until then the voyage is "fog".
export const MIN_STEPS = 3;

function directedSteps(history: StoredHistoryEntry[], until?: Date): Step[] {
  const cutoff = until ? formatDateDots(until) : null;
  return written(history)
    .filter((e) => !cutoff || e.date <= cutoff)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(entryStep)
    .filter((s) => s.dir !== 0);
}

// Closeness from the last RECENT entries with a direction, written on or
// before `until`. null until there are MIN_STEPS steps to go on.
export function closenessAt(history: StoredHistoryEntry[], until?: Date): number | null {
  const steps = directedSteps(history, until).slice(-RECENT);
  if (steps.length < MIN_STEPS) return null;
  const weight = steps.reduce((a, s) => a + s.size, 0);
  const net = steps.reduce((a, s) => a + s.dir * s.size, 0);
  return Math.round(50 + (50 * net) / weight);
}

// How many steps there are so far, capped at MIN_STEPS (for "1 of 3").
export function stepsSoFar(history: StoredHistoryEntry[]): number {
  return Math.min(MIN_STEPS, directedSteps(history).length);
}

// How many of the latest steps in a row went away. Three or more is a
// "current", shown gently rather than as a falling score.
export function awayStreak(history: StoredHistoryEntry[]): number {
  const steps = directedSteps(history);
  let n = 0;
  for (let i = steps.length - 1; i >= 0 && steps[i].dir < 0; i -= 1) n += 1;
  return n;
}
export const CURRENT_STREAK = 3;

// The small thing to try next, from the latest written entry, only while
// that entry was a step away (a step toward needs no correction).
export function latestTryNext(history: StoredHistoryEntry[]): string | null {
  const last = written(history)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .pop();
  return last?.aspirationStep?.direction === "away" ? last.aspirationStep.tryNext || null : null;
}

export type PathDay = { date: string; score: number | null; wrote: boolean; moods: string[] };

// One point per day for the last `days` days (oldest first): the closeness
// as it stood at the end of that day, whether anything was written, and
// which feelings were checked in.
export function pathSeries(history: StoredHistoryEntry[], days = 7, today = new Date()): PathDay[] {
  const out: PathDay[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = formatDateDots(d);
    const that = history.filter((e) => e.date === key);
    out.push({
      date: key,
      score: closenessAt(history, d),
      wrote: that.some((e) => !isMoodCheckIn(e)),
      moods: that.filter(isMoodCheckIn).map((e) => e.analysis?.observation.emotions[0]?.label ?? "").filter(Boolean),
    });
  }
  return out;
}

// How much closer (positive) or further (negative) than a week ago.
export function weekChange(history: StoredHistoryEntry[], today = new Date()): number | null {
  const now = closenessAt(history, today);
  const before = closenessAt(history, new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
  return now === null || before === null ? null : now - before;
}

// The sentence shown right after an entry is analysed.
export function stepHeadline(step: Step): string | null {
  if (step.dir === 0) return null;
  const how = step.size >= 3 ? "a big step" : step.size === 2 ? "a step" : "a little";
  return step.dir > 0
    ? `This entry moved you ${how} closer to who you want to be.`
    : `This entry drifted ${how === "a little" ? "a little" : how} away from who you want to be.`;
}

// When the latest entry was written, for "today" / "2 days ago" copy.
export function lastWrittenDate(history: StoredHistoryEntry[]): Date | null {
  const dates = written(history).map((e) => parseDotDate(e.date)).filter((d): d is Date => !!d);
  return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
}
