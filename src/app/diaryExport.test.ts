import { describe, expect, it } from "vitest";
import { diaryAsMarkdown } from "./diaryExport";
import type { StoredHistoryEntry } from "./types";

const entry = (over: Partial<StoredHistoryEntry>): StoredHistoryEntry => ({ id: Math.random().toString(36), date: "2026.11.01", text: "", ...over });

describe("readable diary export", () => {
  it("puts the aspiration first and entries oldest first, grouped by day", () => {
    const md = diaryAsMarkdown({
      aspiration: "Someone who speaks up",
      aspirationSetDate: "2026.10.01",
      history: [
        entry({ date: "2026.11.03", text: "Third day" }),
        entry({ date: "2026.11.01", text: "First day" }),
        entry({ date: "2026.11.01", text: "Checked in feeling Calm", kind: "mood", at: "09:10" }),
      ],
    }, "2026.11.20");

    expect(md.indexOf("Someone who speaks up")).toBeLessThan(md.indexOf("First day"));
    expect(md.indexOf("First day")).toBeLessThan(md.indexOf("Third day"));
    expect(md).toContain("Written on 2026.10.01.");
    expect(md.match(/### 2026\.11\.01/g)).toHaveLength(1);
    expect(md).toContain("- 09:10 Checked in feeling Calm");
  });

  it("keeps the exact words and marks toward/away steps", () => {
    const md = diaryAsMarkdown({
      aspiration: "Calmer",
      aspirationSetDate: null,
      history: [
        entry({ text: "I waited again.\nSecond line.", aspirationStep: { direction: "away", size: 1, note: "You held back." } }),
        entry({ text: "Muddled day", aspirationStep: { direction: "unclear", size: 1, note: "no read" } }),
      ],
    }, "2026.11.20");

    expect(md).toContain("I waited again.\nSecond line.");
    expect(md).toContain("*Away from who you want to be: You held back.*");
    expect(md).toContain("Muddled day");
    expect(md).not.toContain("no read");
    expect(md).not.toContain("Written on");
  });

  it("still says something useful with no aspiration and no entries", () => {
    const md = diaryAsMarkdown({ aspiration: null, aspirationSetDate: null, history: [] }, "2026.11.20");
    expect(md).toContain("No entries yet.");
    expect(md).not.toContain("Who I want to become");
  });
});
