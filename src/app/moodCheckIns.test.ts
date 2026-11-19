import { describe, expect, it } from "vitest";
import { appendMoodCheckIn, appendUnanalyzedEntry, capHistory, isMoodCheckIn, recentMoodContext, HISTORY_CAP } from "./realStore";
import { emptyStore, type StoredHistoryEntry } from "./types";

const written = (i: number): StoredHistoryEntry => ({ id: `w${i}`, date: "2026.11.01", text: `entry ${i}` });
const mood = (i: number, at?: string): StoredHistoryEntry => ({
  id: `m${i}`, date: "2026.11.01", text: "Checked in feeling calm.", kind: "mood", at,
  analysis: {
    observation: { situation: "", automaticThought: "", emotions: [{ label: "Calm", intensity: 35 }], actionUrge: "" },
    interpretation: { possibleCognitivePatterns: [], valueDirection: { relatedValues: [], towardOrAway: "unclear", explanation: "" } },
    hypothesis: { candidateBelief: "", confidence: 0, status: "insufficient_data", supportingEntryIds: [], contradictoryEntryIds: [], reasoningSummary: "" },
  },
});

describe("mood check-ins", () => {
  it("are marked and recognised, including older text-only ones", () => {
    const s = appendMoodCheckIn(emptyStore(), "Anxious", 60);
    const e = s.history[0];
    expect(e.kind).toBe("mood");
    expect(isMoodCheckIn(e)).toBe(true);
    expect(isMoodCheckIn({ id: "x", date: "2026.01.01", text: "Checked in feeling sad." })).toBe(true);
    expect(isMoodCheckIn(written(1))).toBe(false);
    expect(s.entryCount).toBe(0);
  });

  it("never push written entries out of history", () => {
    const history = [...Array.from({ length: HISTORY_CAP }, (_, i) => written(i)), ...Array.from({ length: 200 }, (_, i) => mood(i))];
    const capped = capHistory(history);
    expect(capped.filter((e) => !isMoodCheckIn(e))).toHaveLength(HISTORY_CAP);
    expect(capped[0].id).toBe("w0");
  });

  it("still caps written entries at the usual limit", () => {
    let s = emptyStore();
    for (let i = 0; i < HISTORY_CAP + 5; i++) s = appendUnanalyzedEntry(s, `entry ${i}`);
    expect(s.history).toHaveLength(HISTORY_CAP);
    expect(s.history[0].text).toBe("entry 5");
  });

  it("sends only the last few check-ins from the past 12 hours", () => {
    const now = Date.parse("2026-11-19T12:00:00Z");
    const history = [
      mood(1, "2026-11-18T20:00:00Z"), // 16h ago: too old
      mood(2, "2026-11-19T09:00:00Z"),
      written(1),
      mood(3, "2026-11-19T11:30:00Z"),
      mood(4), // no time recorded
    ];
    expect(recentMoodContext(history, now)).toEqual([
      { label: "Calm", intensity: 35, minutesAgo: 180 },
      { label: "Calm", intensity: 35, minutesAgo: 30 },
    ]);
  });
});
