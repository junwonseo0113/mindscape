import { describe, expect, it } from "vitest";
import { groupInsights } from "./insightGroups";
import type { RecentInsightItem } from "./discovery";
import type { Store, StoredHistoryEntry } from "./types";

const entry = (id: string, direction?: "toward" | "away"): StoredHistoryEntry => ({
  id, date: "2026.11.20", text: id, ...(direction ? { aspirationStep: { direction, size: 1, note: "" } } : {}),
});
const item = (id: string): RecentInsightItem => ({ key: id, target: { kind: "belief", id, text: id }, title: id, region: "identity", date: "", thoughtCount: 1, confidence: 50 });

describe("insight groups", () => {
  it("sorts insights by where the entries behind them pull", () => {
    const store = {
      history: [entry("e1", "toward"), entry("e2", "toward"), entry("e3", "away"), entry("e4")],
      beliefs: [
        { id: "up", supportingEntryIds: ["e1", "e2", "e3"] },
        { id: "down", supportingEntryIds: ["e3"] },
        { id: "flat", supportingEntryIds: ["e4"] },
        { id: "none" },
      ],
      hypotheses: [],
    } as unknown as Store;
    const g = groupInsights([item("up"), item("down"), item("flat"), item("none")], store);
    expect(g.closer.map((i) => i.key)).toEqual(["up"]);
    expect(g.back.map((i) => i.key)).toEqual(["down"]);
    expect(g.unclear.map((i) => i.key)).toEqual(["flat", "none"]);
  });
});
