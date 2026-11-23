import { detectCrisisSignal } from "./crisisDetection";
import { formatDateDots, mondayOfWeek, parseDotDate } from "./dateUtils";
import type { StoredHistoryEntry } from "./types";

export type WeeklyReflection = {
  weekStart: string;
  summary: string;
  entryIds: string[];
};

export const MAX_REFLECTION_ENTRIES = 8;
export const MAX_REFLECTION_ENTRY_LENGTH = 1400;

export function reflectionSource(history: StoredHistoryEntry[], today = new Date(), completedWeeks: readonly string[] = []) {
  const currentMonday = mondayOfWeek(today);
  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(previousMonday.getDate() - 7);
  const weeks = [currentMonday, previousMonday].map(formatDateDots);
  const eligible = history.filter((entry) =>
    entry.kind !== "mood" && entry.analysis && typeof entry.text === "string" && entry.text.trim() && !detectCrisisSignal(entry.text),
  );

  for (const weekStart of weeks) {
    if (completedWeeks.includes(weekStart)) continue;
    const entries = eligible.filter((entry) => {
      const date = typeof entry.date === "string" && parseDotDate(entry.date);
      return date && date <= today && formatDateDots(mondayOfWeek(date)) === weekStart;
    }).sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_REFLECTION_ENTRIES);
    if (entries.length >= 2) return { weekStart, entries };
  }
  return null;
}

export function sanitizeWeeklyReflection(raw: unknown): WeeklyReflection | undefined {
  if (!raw || typeof raw !== "object") return;
  const { weekStart, summary, entryIds } = raw as Partial<WeeklyReflection>;
  if (typeof weekStart !== "string" || !/^\d{4}\.\d{2}\.\d{2}$/.test(weekStart)) return;
  const date = parseDotDate(weekStart);
  if (!date || formatDateDots(mondayOfWeek(date)) !== weekStart) return;
  if (typeof summary !== "string" || !summary.trim() || summary.length > 1200) return;
  if (!Array.isArray(entryIds) || entryIds.length < 2 || entryIds.length > MAX_REFLECTION_ENTRIES) return;
  if (entryIds.some((id) => typeof id !== "string" || !id) || new Set(entryIds).size !== entryIds.length) return;
  return { weekStart, summary: summary.trim(), entryIds: [...entryIds] };
}


export function mergeWeeklyReflections(...lists: unknown[]): WeeklyReflection[] {
  const byWeek = new Map<string, WeeklyReflection>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const reflection = sanitizeWeeklyReflection(item);
      if (reflection && !byWeek.has(reflection.weekStart)) byWeek.set(reflection.weekStart, reflection);
    }
  }
  return [...byWeek.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}
