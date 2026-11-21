// ── Readable diary export ────────────────────────────────────────────────────
// "Download my data" gives a full JSON backup, which is right for restoring
// but unreadable to a person. People choosing a journaling app test the exit
// path first: can I get my own words back, with their dates, in a file I can
// open anywhere? This turns the diary into plain Markdown for exactly that.
// Pure on purpose (no DOM, no dates from the clock) so it is easy to test;
// saveTextFile below is the only part that touches the browser.
import { isMoodCheckIn } from "./realStore";
import type { Store, StoredHistoryEntry } from "./types";

const STEP_LABEL = {
  toward: "Toward who you want to be",
  away: "Away from who you want to be",
} as const;

function stepLine(e: StoredHistoryEntry): string | null {
  const step = e.aspirationStep;
  if (!step || step.direction === "unclear") return null;
  const note = step.note?.trim();
  return `*${STEP_LABEL[step.direction]}${note ? `: ${note}` : ""}*`;
}

// Oldest first, like a paper diary. Dates are "YYYY.MM.DD", so a string
// compare is a date compare; `at` (minutes) breaks ties within a day.
function chronological(history: StoredHistoryEntry[]): StoredHistoryEntry[] {
  return [...history].sort((a, b) =>
    a.date === b.date ? (a.at ?? "").localeCompare(b.at ?? "") : a.date.localeCompare(b.date));
}

export function diaryAsMarkdown(store: Pick<Store, "aspiration" | "aspirationSetDate" | "history">, exportedOn: string): string {
  const lines: string[] = ["# My Mindscape diary", "", `Exported on ${exportedOn}.`, ""];

  if (store.aspiration) {
    lines.push("## Who I want to become", "", `> ${store.aspiration.replace(/\n/g, "\n> ")}`);
    if (store.aspirationSetDate) lines.push("", `Written on ${store.aspirationSetDate}.`);
    lines.push("");
  }

  const entries = chronological(store.history);
  if (!entries.length) {
    lines.push("No entries yet.", "");
    return lines.join("\n");
  }

  lines.push("## Entries", "");
  let day = "";
  for (const e of entries) {
    if (e.date !== day) {
      day = e.date;
      lines.push(`### ${day}`, "");
    }
    // A one-tap mood check-in is a single line, not a written entry.
    if (isMoodCheckIn(e)) {
      lines.push(`- ${e.at ? `${e.at} ` : ""}${e.text.trim()}`, "");
      continue;
    }
    lines.push(e.text.trim());
    const step = stepLine(e);
    if (step) lines.push("", step);
    lines.push("");
  }
  return lines.join("\n");
}

// Hands a file to the person. In the iOS app a plain <a download> does
// nothing inside the web view, so the share sheet (Web Share with files)
// goes first where it exists; it lets them save to Files, Notes, or mail
// it. Everywhere else, and if sharing is refused, it's a normal download.
export async function saveTextFile(name: string, content: string, type: string) {
  const file = new File([content], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (err) {
      // Closing the sheet is a choice, not a failure: don't also download.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
