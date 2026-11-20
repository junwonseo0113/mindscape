import { describe, expect, it } from "vitest";
import { FULL_DETAIL, HISTORY_CAP, capHistory, compactEntry, recentEntryMemory } from "./realStore";
import type { StoredHistoryEntry } from "./types";

const analysed = (i: number): StoredHistoryEntry => ({
  id: `e${i}`, date: `2026.${String(1 + (i % 12)).padStart(2, "0")}.01`, text: `entry ${i}`, sessionSummary: `summary ${i}`,
  aspirationStep: { direction: "toward", size: 1, note: "n" },
  analysis: {
    observation: { situation: "long situation", automaticThought: `thought ${i}`, emotions: [{ label: "Calm", intensity: 3 }], actionUrge: "urge" },
    interpretation: { possibleCognitivePatterns: ["Catastrophizing"], valueDirection: { relatedValues: ["Growth"], towardOrAway: "toward", explanation: "long explanation" } },
    hypothesis: { candidateBelief: "b", confidence: 50, status: "emerging", supportingEntryIds: [], contradictoryEntryIds: [], reasoningSummary: "long reasoning" },
  },
});

describe("history retention", () => {
  it("keeps far more than 50 entries", () => {
    const h = Array.from({ length: 300 }, (_, i) => analysed(i));
    expect(capHistory(h)).toHaveLength(300);
    expect(HISTORY_CAP).toBeGreaterThanOrEqual(1000);
  });
  it("compacts only entries older than the newest FULL_DETAIL", () => {
    const h = capHistory(Array.from({ length: FULL_DETAIL + 10 }, (_, i) => analysed(i)));
    expect(h[0].analysis?.hypothesis.reasoningSummary).toBe("");
    expect(h[h.length - 1].analysis?.hypothesis.reasoningSummary).toBe("long reasoning");
  });
  it("keeps what screens still read from an old entry", () => {
    const c = compactEntry(analysed(1));
    expect(c.text).toBe("entry 1");
    expect(c.analysis?.observation.emotions[0].label).toBe("Calm");
    expect(c.analysis?.interpretation.valueDirection.towardOrAway).toBe("toward");
    expect(c.aspirationStep?.direction).toBe("toward");
    expect(c.sessionSummary).toBe("summary 1");
  });
});

describe("recentEntryMemory", () => {
  it("gives the last few written entries as short gists, oldest first", () => {
    const m = recentEntryMemory(Array.from({ length: 8 }, (_, i) => analysed(i)), 3);
    expect(m.map((x) => x.gist)).toEqual(["summary 5", "summary 6", "summary 7"]);
    expect(m[0].step).toBe("toward");
  });
  it("skips mood check-ins", () => {
    const mood: StoredHistoryEntry = { id: "m", date: "2026.11.01", text: "Checked in feeling calm.", kind: "mood" };
    expect(recentEntryMemory([analysed(1), mood])).toHaveLength(1);
  });
});
