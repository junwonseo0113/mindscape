// ── Smart search ─────────────────────────────────────────────────────────────
// Diary search for people who don't remember the exact words. A query like
// "the thought I had yesterday about work" is read as
//   · a time ("yesterday"), which narrows to entries from that day, and
//   · a few meaningful words ("work"), each of which also matches its
//     relatives ("job", "career", "boss"...), other forms ("working",
//     "worked") and near-misses (one typo in a longer word).
// Filler like "the thought I had" is dropped. Everything runs on the
// device; nothing is sent anywhere.
import { parseDotDate } from "./dateUtils";

export type DateRange = { from: Date; to: Date; label: string };
export type ParsedQuery = { range: DateRange | null; terms: string[]; raw: string };

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const daysBack = (today: Date, n: number) => startOfDay(new Date(today.getTime() - n * DAY));

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, couple: 2, few: 3 };

// Words that carry no meaning for finding a thought.
const FILLER = new Set(
  ("a an the i i'm im me my mine myself you your it its this that these those was were is are be been am do did does had have has " +
    "about of on in at to for from with and or but so just really very kind sort like thing things something stuff " +
    "thought thoughts entry entries wrote write written writing said say saying showed show shown talked talk told mentioned " +
    "one ones when where what which who how why find search looking look remember there some any again felt feel feeling feelings got get")
    .split(" "),
);

// Families of words that mean roughly the same thing in a diary. A query
// word matches every member of its family.
const FAMILIES: string[][] = [
  ["work", "job", "career", "boss", "office", "coworker", "colleague", "manager", "company", "promotion", "interview", "offer"],
  ["safe", "safety", "secure", "security", "risk", "risky", "careful", "cautious", "stable", "stability", "certain", "certainty"],
  ["alone", "lonely", "loneliness", "isolated", "isolation", "solo", "myself", "independent", "independence"],
  ["perfect", "perfection", "perfectionism", "flawless", "mistake", "mistakes", "ready", "prepared"],
  ["friend", "friends", "relationship", "relationships", "partner", "family", "people", "mom", "dad", "parents", "boyfriend", "girlfriend"],
  ["money", "finance", "financial", "invest", "investing", "investment", "salary", "pay", "savings", "rich"],
  ["anxious", "anxiety", "worry", "worried", "nervous", "scared", "fear", "afraid", "stress", "stressed", "panic"],
  ["sad", "sadness", "down", "depressed", "upset", "cry", "crying", "hurt", "lonely"],
  ["angry", "anger", "mad", "frustrated", "frustration", "annoyed", "irritated", "furious"],
  ["happy", "glad", "joy", "good", "great", "excited", "proud", "grateful"],
  ["calm", "peaceful", "relaxed", "okay", "fine", "content"],
  ["regret", "regretted", "guilt", "guilty", "ashamed", "shame", "sorry"],
  ["recognition", "recognized", "recognised", "praise", "credit", "noticed", "appreciated", "approval", "valued"],
  ["wait", "waiting", "delay", "postpone", "procrastinate", "procrastination", "later", "hesitate", "hesitant", "stuck"],
  ["start", "begin", "beginning", "launch", "try", "attempt"],
  ["fail", "failure", "failing", "lose", "losing", "lost"],
  ["freedom", "free", "choice", "autonomy", "control"],
  ["hard", "effort", "grind", "hustle", "harder"],
  ["identity", "self", "worth", "enough", "value", "values"],
  ["creative", "creativity", "art", "writing", "music", "idea", "ideas"],
  ["learn", "learning", "curious", "curiosity", "study", "new"],
];
const FAMILY_OF = new Map<string, number>();
FAMILIES.forEach((f, i) => f.forEach((w) => { if (!FAMILY_OF.has(w)) FAMILY_OF.set(w, i); }));

// A rough stem: enough to make "worrying", "worried" and "worries" meet.
export function stem(w: string): string {
  let s = w.toLowerCase().replace(/[’']s$/, "");
  for (const suf of ["ingly", "edly", "ing", "ies", "ied", "ed", "es", "ly", "s"]) {
    if (s.length - suf.length >= 3 && s.endsWith(suf)) { s = s.slice(0, -suf.length) + (suf === "ies" || suf === "ied" ? "y" : ""); break; }
  }
  return s.replace(/(.)\1$/, "$1");
}

function within1Edit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const words = (text: string) => text.toLowerCase().match(/[a-z0-9’']+/g) ?? [];

export function parseQuery(raw: string, today = new Date()): ParsedQuery {
  let q = ` ${raw.toLowerCase().replace(/[^a-z0-9’'\s]/g, " ")} `;
  let range: DateRange | null = null;
  const take = (re: RegExp, make: (m: RegExpMatchArray) => DateRange | null) => {
    if (range) return;
    const m = q.match(re);
    if (!m) return;
    const r = make(m);
    if (r) { range = r; q = q.replace(m[0], " "); }
  };
  const t = startOfDay(today);
  take(/\b(today|tonight|this morning|this evening)\b/, () => ({ from: t, to: endOfDay(t), label: "today" }));
  take(/\b(yesterday|last night)\b/, () => ({ from: daysBack(t, 1), to: endOfDay(daysBack(t, 1)), label: "yesterday" }));
  take(/\b(\d+|a|an|one|two|three|four|five|six|seven|couple|few)\s+(?:of\s+)?(day|days|week|weeks)\s+ago\b/, (m) => {
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[m[1]] ?? 1;
    const back = m[2].startsWith("week") ? n * 7 : n;
    const centre = daysBack(t, back);
    const slack = m[2].startsWith("week") ? 3 : 1;
    return { from: daysBack(centre, slack), to: endOfDay(new Date(centre.getTime() + slack * DAY)), label: `${m[1]} ${m[2]} ago` };
  });
  take(/\b(this week|lately|recently|these days)\b/, () => ({ from: daysBack(t, 6), to: endOfDay(t), label: "the last 7 days" }));
  take(/\blast week\b/, () => ({ from: daysBack(t, 13), to: endOfDay(daysBack(t, 7)), label: "last week" }));
  take(/\bthis month\b/, () => ({ from: new Date(t.getFullYear(), t.getMonth(), 1), to: endOfDay(t), label: "this month" }));
  take(/\blast month\b/, () => ({ from: new Date(t.getFullYear(), t.getMonth() - 1, 1), to: endOfDay(new Date(t.getFullYear(), t.getMonth(), 0)), label: "last month" }));
  take(new RegExp(`\\b(?:last |on )?(${WEEKDAYS.join("|")})\\b`), (m) => {
    const wd = WEEKDAYS.indexOf(m[1]);
    let back = (t.getDay() - wd + 7) % 7;
    if (back === 0) back = 7;
    const d = daysBack(t, back);
    return { from: d, to: endOfDay(d), label: `last ${m[1][0].toUpperCase()}${m[1].slice(1)}` };
  });
  take(new RegExp(`\\b(?:in |back in )?(${MONTHS.join("|")})\\b`), (m) => {
    const mo = MONTHS.indexOf(m[1]);
    const year = mo > t.getMonth() ? t.getFullYear() - 1 : t.getFullYear();
    return { from: new Date(year, mo, 1), to: endOfDay(new Date(year, mo + 1, 0)), label: `${m[1][0].toUpperCase()}${m[1].slice(1)}` };
  });
  const terms = Array.from(new Set(words(q).filter((w) => !FILLER.has(w) && w.length > 1)));
  return { range, terms, raw };
}

// How well one query term matches a piece of text, 0 to 1.
function termScore(term: string, textWords: string[]): number {
  const ts = stem(term);
  const fam = FAMILY_OF.get(term) ?? FAMILY_OF.get(ts);
  let best = 0;
  for (const w of textWords) {
    if (w === term) return 1;
    const ws = stem(w);
    if (ws === ts) { best = Math.max(best, 0.95); continue; }
    if (fam !== undefined && (FAMILY_OF.get(w) === fam || FAMILY_OF.get(ws) === fam)) { best = Math.max(best, 0.7); continue; }
    if (ts.length >= 4 && (ws.startsWith(ts) || ts.startsWith(ws)) && Math.min(ws.length, ts.length) >= 4) { best = Math.max(best, 0.75); continue; }
    if (ts.length >= 5 && within1Edit(ts, ws)) best = Math.max(best, 0.6);
  }
  return best;
}

export type SearchField = { text: string; weight?: number };
export type SearchDoc = { fields: SearchField[]; dates: string[] };

export function inRange(dateStr: string, range: DateRange): boolean {
  const d = parseDotDate(dateStr);
  return !!d && d.getTime() >= range.from.getTime() && d.getTime() <= range.to.getTime();
}

// 0 means no match. With only a time in the query, everything from that
// time matches; with words, each word has to find something (a document
// that matches half the words still ranks, below ones that match all).
export function scoreDoc(doc: SearchDoc, pq: ParsedQuery): number {
  if (pq.range && !doc.dates.some((d) => inRange(d, pq.range!))) return 0;
  if (pq.terms.length === 0) return pq.range ? 1 : 0;
  const fieldWords = doc.fields.map((f) => ({ w: words(f.text), weight: f.weight ?? 1 }));
  let total = 0, hits = 0;
  for (const term of pq.terms) {
    let best = 0;
    for (const f of fieldWords) best = Math.max(best, termScore(term, f.w) * f.weight);
    if (best > 0) hits += 1;
    total += best;
  }
  if (hits === 0 || hits < Math.ceil(pq.terms.length / 2)) return 0;
  return total / pq.terms.length;
}

// What the search understood, for the line under the field.
export function describeQuery(pq: ParsedQuery): string | null {
  const parts: string[] = [];
  if (pq.range) parts.push(pq.range.label);
  if (pq.terms.length) parts.push(pq.terms.map((t) => `“${t}”`).join(", "));
  return parts.length ? parts.join(" · ") : null;
}
