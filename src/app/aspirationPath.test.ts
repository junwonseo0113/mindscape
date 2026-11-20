import { describe, expect, it } from "vitest";
import { closenessAt, entryStep, pathSeries, stepHeadline, weekChange } from "./aspirationPath";
import type { StoredHistoryEntry } from "./types";

const entry = (id: string, date: string, direction?: "toward" | "away" | "unclear", size: 1 | 2 | 3 = 1): StoredHistoryEntry => ({
  id, date, text: `entry ${id}`, ...(direction ? { aspirationStep: { direction, size, note: "" } } : {}),
});
const mood = (date: string, label: string): StoredHistoryEntry => ({
  id: `m${date}${label}`, date, text: `Checked in feeling ${label.toLowerCase()}.`, kind: "mood",
  analysis: {
    observation: { situation: "", automaticThought: "", emotions: [{ label, intensity: 50 }], actionUrge: "" },
    interpretation: { possibleCognitivePatterns: [], valueDirection: { relatedValues: [], towardOrAway: "unclear", explanation: "" } },
    hypothesis: { candidateBelief: "", confidence: 0, status: "insufficient_data", supportingEntryIds: [], contradictoryEntryIds: [], reasoningSummary: "" },
  },
});

describe("closeness", () => {
  it("is null with no steps, 50 when balanced, higher when more toward", () => {
    expect(closenessAt([])).toBeNull();
    expect(closenessAt([entry("a", "2026.11.01", "toward"), entry("b", "2026.11.02", "away")])).toBe(50);
    expect(closenessAt([entry("a", "2026.11.01", "toward", 3), entry("b", "2026.11.02", "away")])).toBe(75);
  });
  it("ignores unclear steps and mood check-ins", () => {
    expect(closenessAt([entry("a", "2026.11.01", "toward"), entry("b", "2026.11.02", "unclear"), mood("2026.11.02", "Sad")])).toBe(100);
  });
  it("falls back to the analysis's value direction", () => {
    const e: StoredHistoryEntry = { ...entry("a", "2026.11.01"), analysis: { ...mood("x", "Calm").analysis!, interpretation: { possibleCognitivePatterns: [], valueDirection: { relatedValues: [], towardOrAway: "away", explanation: "" } } } };
    expect(entryStep(e).dir).toBe(-1);
  });
});

describe("over time", () => {
  const today = new Date(2026, 10, 19);
  const history = [entry("a", "2026.11.10", "away"), entry("b", "2026.11.17", "toward"), entry("c", "2026.11.19", "toward", 2), mood("2026.11.18", "Anxious")];
  it("gives one point per day with moods", () => {
    const s = pathSeries(history, 7, today);
    expect(s).toHaveLength(7);
    expect(s[0].date).toBe("2026.11.13");
    expect(s[0].score).toBe(0);
    expect(s[5].moods).toEqual(["Anxious"]);
    expect(s[6].wrote).toBe(true);
  });
  it("compares with a week ago", () => {
    expect(weekChange(history, today)).toBe(Math.round(50 + (50 * 2) / 4) - 0);
  });
  it("words the step", () => {
    expect(stepHeadline({ dir: 1, size: 1, note: null })).toBe("This entry moved you a little closer to who you want to be.");
    expect(stepHeadline({ dir: 0, size: 0, note: null })).toBeNull();
  });
});
