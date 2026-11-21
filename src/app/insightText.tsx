import type React from "react";
import { display, hand } from "./typefaces";
import { ivBody, ivHeading, shape } from "./screenTheme";

// ── Emph ────────────────────────────────────────────────────────────────────
// Bolds the part of a sentence that matters, so a longer explanation can be
// skimmed. What counts as "the part that matters", in order:
//   1. anything in quotes ("Safety comes first"),
//   2. any of `keys` (the thoughts the sentence is about), and numbers with
//      their unit ("62 out of 100", "3 times", "78%"),
//   3. if nothing above matched, the sentence's opening clause, up to the
//      first comma, dash or linking verb ("seems", "may", "because"...).
const EMPH_NUM = /\b\d+(?:\.\d+)?\s?(?:%|out of 100|times?|entries|entry|days?|weeks?)/gi;
export function Emph({ text, keys = [], color = ivHeading }: { text: string; keys?: (string | undefined)[]; color?: string }) {
  const b = (t: string, k: React.Key) => <b key={k} style={{ fontWeight: 700, color, fontStyle: "normal" }}>{t}</b>;
  const ranges: [number, number][] = [];
  const add = (start: number, end: number) => { if (end > start && !ranges.some(([a, z]) => start < z && end > a)) ranges.push([start, end]); };
  for (const m of text.matchAll(/["“]([^"”]{2,80})["”]/g)) add(m.index!, m.index! + m[0].length);
  const lower = text.toLowerCase();
  keys.filter((k): k is string => !!k && k.length > 3).sort((a, z) => z.length - a.length).forEach((k) => {
    const i = lower.indexOf(k.toLowerCase());
    if (i >= 0) add(i, i + k.length);
  });
  for (const m of text.matchAll(EMPH_NUM)) add(m.index!, m.index! + m[0].length);
  if (ranges.length === 0) {
    const cut = text.search(/,\s|\s[—–-]\s|\s(?:seems?|may|might|is|are|tends?|because|when)\s/);
    if (cut > 8 && cut < text.length * 0.65) add(0, cut);
  }
  if (ranges.length === 0) return <>{text}</>;
  ranges.sort((x, y) => x[0] - y[0]);
  const out: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([a, z], i) => { if (a > at) out.push(text.slice(at, a)); out.push(b(text.slice(a, z), i)); at = z; });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

// A bold word in hand-written copy.
export const B = ({ children }: { children: React.ReactNode }) => <b style={{ fontWeight: 700, color: ivHeading }}>{children}</b>;

// ── Quiet pieces for Mind and Analysis ─────────────────────────────────────
// Each of those pages has one bold card at the top (today's discovery, the
// two thoughts joined by a thread). Everything below it sits in this same
// plain paper card with the same section heading, so the page reads as one
// notebook instead of a scrapbook of differently decorated boxes.
export const quietCard: React.CSSProperties = {
  backgroundColor: "#FFFDF8", borderRadius: shape.md, border: "1px solid rgba(42,38,33,0.08)",
  boxShadow: "0 10px 22px -18px rgba(42,38,33,0.5)", overflow: "hidden",
};

export function SectionHeading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "0 4px 8px" }}>
      <div style={{ ...hand, fontSize: 21, fontWeight: 600, color: ivHeading, opacity: 0.82, lineHeight: 1.15 }}>{children}</div>
      {aside && <div style={{ ...hand, fontSize: 17, color: ivBody, flexShrink: 0 }}>{aside}</div>}
    </div>
  );
}
