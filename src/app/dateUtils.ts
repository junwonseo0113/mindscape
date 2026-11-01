// ── "YYYY.MM.DD" dot-date utilities ──────────────────────────────────────────
// Every date this app persists or displays goes through this one string
// format (formatDateDots/parseDotDate are exact inverses of each other) —
// pulled out of App.tsx and types.ts into their own module since this pair
// and everything built on parseDotDate (weekday/short-month-day labels, the
// relative "Today"/"N days ago" labels, and the Monday-of-week bucketing) is
// reached into from realStore.ts and across most of App.tsx's screens, far
// more broadly than either of those files' own primary concerns.

export function formatDateDots(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// Parses "YYYY.MM.DD" (formatDateDots) into a local Date at midnight, or
// null if it doesn't parse — shared by the streak calculator and history
// grouping so both agree on exactly what counts as "the same day."
export function parseDotDate(dateStr: string): Date | null {
  const parts = dateStr.split(".").map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// Monday-anchored week bucket — no isoWeek library in this project, so
// this is plain date arithmetic. Keyed by that Monday's own dot-date
// string (via formatDateDots) so the bucket key doubles as something
// parseDotDate/shortMonthDay can already read back out, rather than
// inventing a separate label format.
export function mondayOfWeek(d: Date): Date {
  const copy = new Date(d);
  const daysSinceMonday = (copy.getDay() + 6) % 7; // Sun=0..Sat=6 -> Mon=0..Sun=6
  copy.setDate(copy.getDate() - daysSinceMonday);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// "Today"/"Yesterday" relative to now, else the raw date — matches the
// History screen's original mockup group headers without fabricating
// anything the date itself doesn't say.
// NOTE: currently unused anywhere in the app (relativeInsightLabel below
// covers the one call site that needs relative labels) — kept as-is rather
// than deleted during this extraction, since removing it wasn't part of
// the ask; flagging for a separate cleanup decision.
export function relativeDayLabel(dateStr: string): string {
  const d = parseDotDate(dateStr);
  if (!d) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return dateStr;
}

// A fuller "N days/weeks ago" ladder than relativeDayLabel's Today/Yesterday
// pair — used only by Recent Insights' small-caps date badge (see the
// supplied concept reference: "YESTERDAY" / "3 DAYS AGO" / "1 WEEK AGO"),
// so relativeDayLabel's own two-step behavior for History stays untouched.
export function relativeInsightLabel(dateStr: string): string {
  const d = parseDotDate(dateStr);
  if (!d) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  const weeks = Math.round(diffDays / 7);
  if (weeks <= 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  return dateStr;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// No time-of-day is ever actually recorded (StoredHistoryEntry has only
// `date`) — this derives the one thing that genuinely IS recoverable from a
// real date, the weekday, rather than inventing a clock time the concept
// mockup showed.
export function weekdayFromDotDate(dateStr: string): string {
  const d = parseDotDate(dateStr);
  return d ? WEEKDAY_NAMES[d.getDay()] : "";
}

export function shortMonthDay(dateStr: string): string {
  const d = parseDotDate(dateStr);
  return d ? `${SHORT_MONTH_NAMES[d.getMonth()]} ${d.getDate()}` : dateStr;
}
