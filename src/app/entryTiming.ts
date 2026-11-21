import { StoredHistoryEntry } from "./types";
import { parseDotDate } from "./dateUtils";
import { lastWrittenDate } from "./aspirationPath";
import { isMoodCheckIn } from "./realStore";

export function daysSinceLastEntry(history: StoredHistoryEntry[]): number | null {
  if (history.length === 0) return null;
  const dates = history.map((e) => parseDotDate(e.date)).filter((d): d is Date => !!d);
  if (dates.length === 0) return null;
  const mostRecent = new Date(Math.max(...dates.map((d) => d.getTime())));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  mostRecent.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - mostRecent.getTime()) / 86_400_000));
}

// Powers the weekly-summary Notification (see App()'s effect near the
// daily-reminder one) — not a component, just the same kind of real
// aggregation CognitivePatternFrequency does above, scoped to the last 7
// days instead of all-time. Returns null when there's nothing to report
// (no entries this week) so the caller can skip firing an empty
// notification rather than sending "0 thoughts this week."
export function computeWeeklySummary(history: StoredHistoryEntry[]): { entryCount: number; topPattern: string | null } | null {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recent = history.filter((e) => {
    const d = parseDotDate(e.date);
    return !!d && d >= sevenDaysAgo && d <= now;
  });
  if (recent.length === 0) return null;

  const patternCounts = new Map<string, number>();
  recent.forEach((e) => {
    e.analysis?.interpretation.possibleCognitivePatterns.forEach((p) => {
      patternCounts.set(p, (patternCounts.get(p) ?? 0) + 1);
    });
  });
  const topPattern = Array.from(patternCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { entryCount: recent.length, topPattern };
}

// "This week" for the voyage: today, or the day of the latest entry when
// nothing has been written in the last week (so a quiet spell still shows
// the last real week instead of a flat line).
export function voyageAnchor(history: StoredHistoryEntry[]): Date {
  const today = new Date();
  const days = history.map((e) => parseDotDate(e.date)).filter((d): d is Date => !!d);
  const last = days.length ? new Date(Math.max(...days.map((d) => d.getTime()))) : lastWrittenDate(history);
  return last && today.getTime() - last.getTime() > 6 * 86_400_000 ? last : today;
}

// Longest run of consecutive calendar days (ending at the most recent
// entry, not necessarily today — a real gap shouldn't quietly read as an
// active streak) with at least one entry — real data only, no rounding up.
export function computeStreak(history: StoredHistoryEntry[]): number {
  const days = new Set<string>();
  // Days with something written. A mood tap alone doesn't keep a streak going.
  history.forEach((e) => {
    if (isMoodCheckIn(e)) return;
    const d = parseDotDate(e.date);
    if (d) days.add(d.toDateString());
  });
  if (days.size === 0) return 0;
  const sorted = Array.from(days)
    .map((s) => new Date(s))
    .sort((a, b) => b.getTime() - a.getTime());
  let streak = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const diff = Math.round((sorted[i - 1].getTime() - sorted[i].getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) streak += 1;
    else break;
  }
  return streak;
}
