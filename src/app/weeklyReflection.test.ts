import { afterEach, describe, expect, it, vi } from "vitest";
import { handleWeeklyReflection } from "../server/weeklyReflection";
import { mergeStores } from "./storeMerge";
import { emptyStore, type EntryAnalysis, type StoredHistoryEntry } from "./types";
import { reflectionSource } from "./weeklyReflection";

const entry = (id: string, date: string, extra: Partial<StoredHistoryEntry> = {}): StoredHistoryEntry =>
  ({ id, date, text: "I took time to think on the way home.", analysis: {} as EntryAnalysis, ...extra });

afterEach(() => vi.unstubAllGlobals());

describe("weekly reflections", () => {
  it("keeps entries within one week and excludes mood, local-only and future entries", () => {
    const entries = [
      entry("old", "2026.11.08"),
      entry("first", "2026.11.09"),
      entry("second", "2026.11.13"),
      entry("mood", "2026.11.15", { kind: "mood" }),
      entry("local-only", "2026.11.17", { analysis: undefined }),
      entry("recent", "2026.11.19"),
      entry("future", "2026.11.21"),
    ];
    const source = reflectionSource(entries, new Date(2026, 10, 20, 12));
    expect(source?.weekStart).toBe("2026.11.09");
    expect(source?.entries.map(({ id }) => id)).toEqual(["first", "second"]);
  });

  it("preserves a saved preview through a cloud merge with an older store", () => {
    const weeklyReflection = { weekStart: "2026.11.16", summary: "You paused to think on the way home.", entryIds: ["a", "b"] };
    expect(mergeStores({ ...emptyStore(), weeklyReflection }, emptyStore()).weeklyReflection).toEqual(weeklyReflection);
  });

  it("rejects invalid citations and makes no AI request when the preview is disabled", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: '{"summary":"You paused to reflect.","evidence":[0,2]}' }] }),
    });
    vi.stubGlobal("fetch", fetch);
    const body = { entries: ["An afternoon walk.", "I walked after work."] };
    expect((await handleWeeklyReflection("test-key", body, "false")).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
    expect((await handleWeeklyReflection("test-key", body, "true")).status).toBe(502);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("skips completed weeks when choosing the next Plus reflection", () => {
    const today = new Date(2026, 10, 20, 12);
    const entries = [entry("latest", "2026.11.20"), entry("recent", "2026.11.19"), entry("old", "2026.11.11"), entry("older", "2026.11.10")];
    expect(reflectionSource(entries, today, ["2026.11.16"])?.weekStart).toBe("2026.11.09");
    expect(reflectionSource(entries, today, ["2026.11.16", "2026.11.09"])).toBeNull();
  });

  it("rejects an unverified Plus request even when the body claims Plus", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ app_metadata: {}, user_metadata: { mindscape_plan: "plus" } }) });
    vi.stubGlobal("fetch", fetch);
    const body = { mode: "plus", app_metadata: { mindscape_plan: "plus" }, entries: ["First entry.", "Second entry."] };
    const env = { VITE_SUPABASE_URL: "https://example.test", VITE_SUPABASE_ANON_KEY: "anon" };
    expect((await handleWeeklyReflection("test-key", body, "true", undefined, env)).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    expect((await handleWeeklyReflection("test-key", body, "true", "Bearer token", env)).status).toBe(403);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe("https://example.test/auth/v1/user");
  });

  it("generates a Plus reflection after verifying administrator-granted access", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ app_metadata: { mindscape_plan: "plus" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: [{ type: "text", text: '{"summary":"A shared theme.","evidence":[0,1]}' }] }) });
    vi.stubGlobal("fetch", fetch);
    const env = { VITE_SUPABASE_URL: "https://example.test", VITE_SUPABASE_ANON_KEY: "anon" };
    const body = { mode: "plus", entries: ["First entry.", "Second entry."] };
    expect((await handleWeeklyReflection("test-key", body, "true", "Bearer token", env)).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns a reflection with validated evidence indices", async () => {
    const summary = "You mentioned walking to make room for your thoughts on two days.";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: JSON.stringify({ summary, evidence: [1, 0] }) }] }),
    }));
    const result = await handleWeeklyReflection("test-key", { entries: ["An afternoon walk.", "I walked after work."] }, "true");
    expect(result).toEqual({ status: 200, json: { summary, evidence: [1, 0] } });
  });
});
