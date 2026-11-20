import { describe, expect, it } from "vitest";
import { mergeStores } from "./storeMerge";
import { emptyStore, type Store } from "./types";
import { stripForCloud } from "./cloudSync";

const store = (over: Partial<Store>): Store => ({ ...emptyStore(), ...over });

describe("mergeStores", () => {
  it("keeps entries from both copies, in date order", () => {
    const local = store({ history: [{ id: "a", date: "2026.11.02", text: "written offline" }] });
    const cloud = store({ history: [{ id: "b", date: "2026.11.01", text: "from the other phone" }] });
    const m = mergeStores(local, cloud);
    expect(m.history.map((e) => e.id)).toEqual(["b", "a"]);
  });
  it("prefers the analysed copy of the same entry", () => {
    const bare = { id: "a", date: "2026.11.02", text: "same" };
    const analysed = { ...bare, aspirationStep: { direction: "toward" as const, size: 1 as const, note: "" } };
    expect(mergeStores(store({ history: [bare] }), store({ history: [analysed] })).history[0].aspirationStep).toBeTruthy();
  });
  it("keeps the belief with more evidence", () => {
    const b = { id: "x", domain: "work", statement: "s", confidence: 50, evidenceCount: 3, evidenceQuotes: [] };
    const m = mergeStores(store({ beliefs: [b] }), store({ beliefs: [{ ...b, evidenceCount: 5 }] }));
    expect(m.beliefs[0].evidenceCount).toBe(5);
  });
  it("takes the later aspiration and keeps this device's settings", () => {
    const local = store({ aspiration: "old", aspirationSetDate: "2026.01.01" });
    local.settings = { ...local.settings, dailyReminder: true };
    const cloud = store({ aspiration: "new", aspirationSetDate: "2026.06.01", entryCount: 9 });
    const m = mergeStores(local, cloud);
    expect(m.aspiration).toBe("new");
    expect(m.settings.dailyReminder).toBe(true);
    expect(m.entryCount).toBe(9);
  });
});

describe("stripForCloud", () => {
  it("never uploads the password hash", () => {
    const s = store({ account: { name: "A", email: "a@example.com", password: "pbkdf2$1$x$y" } });
    expect(stripForCloud(s).account?.password).toBe("");
    expect(s.account?.password).toBe("pbkdf2$1$x$y");
  });
});
