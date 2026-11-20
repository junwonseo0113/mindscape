import { describe, expect, it } from "vitest";
import { parseQuery, scoreDoc, stem } from "./smartSearch";

const today = new Date(2026, 10, 19); // Thu 19 Nov 2026

describe("parseQuery", () => {
  it("drops filler and reads 'yesterday'", () => {
    const q = parseQuery("the thought I showed yesterday", today);
    expect(q.terms).toEqual([]);
    expect(q.range?.label).toBe("yesterday");
    expect(q.range?.from.getDate()).toBe(18);
  });
  it("reads relative and named times", () => {
    expect(parseQuery("about work last week", today).range?.label).toBe("last week");
    expect(parseQuery("2 days ago", today).range?.label).toBe("2 days ago");
    expect(parseQuery("on monday", today).range?.from.getDate()).toBe(16);
    expect(parseQuery("in july", today).range?.from.getMonth()).toBe(6);
    expect(parseQuery("about work last week", today).terms).toEqual(["work"]);
  });
});

describe("scoreDoc", () => {
  const entry = (text: string, date = "2026.11.18") => ({ fields: [{ text }], dates: [date] });
  it("matches by date alone", () => {
    const q = parseQuery("the thing I wrote yesterday", today);
    expect(scoreDoc(entry("Anything at all"), q)).toBeGreaterThan(0);
    expect(scoreDoc(entry("Anything at all", "2026.11.10"), q)).toBe(0);
  });
  it("matches related words, other forms and typos", () => {
    expect(scoreDoc(entry("My boss ignored my idea again"), parseQuery("work", today))).toBeGreaterThan(0);
    expect(scoreDoc(entry("I keep worrying about the launch"), parseQuery("worried", today))).toBeGreaterThan(0);
    expect(scoreDoc(entry("Felt so anxious before the call"), parseQuery("anxeous", today))).toBeGreaterThan(0);
    expect(scoreDoc(entry("I'd rather do it alone"), parseQuery("lonely", today))).toBeGreaterThan(0);
  });
  it("needs the words to relate to something", () => {
    expect(scoreDoc(entry("Lunch was nice"), parseQuery("money", today))).toBe(0);
  });
  it("stems common endings", () => {
    expect(stem("worrying")).toBe(stem("worried"));
  });
});
