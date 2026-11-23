import { afterEach, describe, expect, it, vi } from "vitest";
import { handleWeeklyReflection } from "../server/weeklyReflection";
import { mergeStores } from "./storeMerge";
import { emptyStore, type EntryAnalysis, type StoredHistoryEntry } from "./types";
import { reflectionSource } from "./weeklyReflection";

const entry = (id: string, date: string, extra: Partial<StoredHistoryEntry> = {}): StoredHistoryEntry =>
  ({ id, date, text: "I took time to think on the way home.", analysis: {} as EntryAnalysis, ...extra });

afterEach(() => vi.unstubAllGlobals());

const ENV = { VITE_SUPABASE_URL: "https://example.test", VITE_SUPABASE_ANON_KEY: "anon" };
const BODY = { entries: ["First entry.", "Second entry."] };
const PLUS = { id: "u1", app_metadata: { mindscape_plan: "plus" } };
const FREE = { id: "u1", app_metadata: {} };
const user = (u: object) => ({ ok: true, status: 200, json: async () => ({ id: "u1", ...u }) });
const rows = (r: unknown[]) => ({ ok: true, status: 200, json: async () => r });
const claude = (text: string) => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text }] }) });

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
    const fetch = vi.fn()
      .mockResolvedValueOnce(user(PLUS))
      .mockResolvedValueOnce(claude('{"summary":"You paused to reflect.","evidence":[0,2]}'));
    vi.stubGlobal("fetch", fetch);
    const body = { entries: ["An afternoon walk.", "I walked after work."] };
    expect((await handleWeeklyReflection("test-key", body, "false", "Bearer token", ENV)).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
    expect((await handleWeeklyReflection("test-key", body, "true", "Bearer token", ENV)).status).toBe(502);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("skips completed weeks when choosing the next Plus reflection", () => {
    const today = new Date(2026, 10, 20, 12);
    const entries = [entry("latest", "2026.11.20"), entry("recent", "2026.11.19"), entry("old", "2026.11.11"), entry("older", "2026.11.10")];
    expect(reflectionSource(entries, today, ["2026.11.16"])?.weekStart).toBe("2026.11.09");
    expect(reflectionSource(entries, today, ["2026.11.16", "2026.11.09"])).toBeNull();
  });

  it("requires a signed-in account and makes no AI request without one", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);
    expect((await handleWeeklyReflection("test-key", BODY, "true", undefined, ENV)).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect((await handleWeeklyReflection("test-key", BODY, "true", "Bearer expired", ENV)).status).toBe(401);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe("https://example.test/auth/v1/user");
  });

  it("ignores a Plus claim in the body and in user-editable metadata", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(user({ app_metadata: {}, user_metadata: { mindscape_plan: "plus" } }))
      .mockResolvedValueOnce(rows([{ user_id: "u1" }]));
    vi.stubGlobal("fetch", fetch);
    const body = { mode: "plus", app_metadata: { mindscape_plan: "plus" }, entries: BODY.entries };
    const result = await handleWeeklyReflection("test-key", body, "true", "Bearer token", ENV);
    expect(result.status).toBe(403);
    expect(result.json.code).toBe("free_used");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("generates a Plus reflection after verifying administrator-granted access", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(user(PLUS)).mockResolvedValueOnce(claude('{"summary":"A shared theme.","evidence":[0,1]}'));
    vi.stubGlobal("fetch", fetch);
    const result = await handleWeeklyReflection("test-key", BODY, "true", "Bearer token", ENV);
    expect(result).toEqual({ status: 200, json: { summary: "A shared theme.", evidence: [0, 1], plan: "plus" } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("gives a free account one reflection and records it only after success", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(user(FREE)).mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(claude("not json"))
      .mockResolvedValueOnce(user(FREE)).mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(claude('{"summary":"A shared theme.","evidence":[0,1]}'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => true })
      .mockResolvedValueOnce(user(FREE)).mockResolvedValueOnce(rows([{ user_id: "u1" }]));
    vi.stubGlobal("fetch", fetch);
    // A failed generation doesn't spend the free reflection: no claim call.
    expect((await handleWeeklyReflection("test-key", BODY, "true", "Bearer token", ENV)).status).toBe(502);
    expect(fetch.mock.calls.some(([url]) => String(url).includes("claim_free_reflection"))).toBe(false);
    const ok = await handleWeeklyReflection("test-key", BODY, "true", "Bearer token", ENV);
    expect(ok).toEqual({ status: 200, json: { summary: "A shared theme.", evidence: [0, 1], plan: "free" } });
    expect(fetch.mock.calls[6][0]).toBe("https://example.test/rest/v1/rpc/claim_free_reflection");
    expect(fetch.mock.calls[6][1].headers.Authorization).toBe("Bearer token");
    // Once used, the next request stops before any AI call.
    expect((await handleWeeklyReflection("test-key", BODY, "true", "Bearer token", ENV)).json.code).toBe("free_used");
    expect(fetch).toHaveBeenCalledTimes(9);
  });

  it("withholds the reflection when a parallel request already claimed the free use", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(user(FREE)).mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(claude('{"summary":"A shared theme.","evidence":[0,1]}'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => false }));
    const result = await handleWeeklyReflection("test-key", BODY, "true", "Bearer token", ENV);
    expect(result.status).toBe(403);
    expect(result.json).not.toHaveProperty("summary");
  });

  it("fails closed for free accounts when the usage table is missing", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(user(FREE)).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);
    expect((await handleWeeklyReflection("test-key", BODY, "true", "Bearer token", ENV)).status).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns a reflection with validated evidence indices", async () => {
    const summary = "You mentioned walking to make room for your thoughts on two days.";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(user(PLUS)).mockResolvedValueOnce(claude(JSON.stringify({ summary, evidence: [1, 0] }))));
    const result = await handleWeeklyReflection("test-key", { entries: ["An afternoon walk.", "I walked after work."] }, "true", "Bearer token", ENV);
    expect(result).toEqual({ status: 200, json: { summary, evidence: [1, 0], plan: "plus" } });
  });
});
