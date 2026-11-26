// ── Insights, grouped by where they pull you ─────────────────────────────────
// Mind's Insights web sorts every further insight (discovery.ts's
// buildRecentInsights) into three branches by the diary entries behind it:
// did those entries, on balance, move toward who the person wants to be
// (aspirationPath's steps) or away from it? Nothing is guessed: an insight
// with no linked entries, or entries that never touched the goal, is
// "unclear".
import { entryStep } from "./aspirationPath";
import type { RecentInsightItem } from "./discovery";
import type { Store } from "./types";

export type InsightLean = "closer" | "back" | "unclear";

export const LEAN_LABEL: Record<InsightLean, { title: string; hint: string }> = {
  closer: { title: "Pulls you closer", hint: "Patterns from entries that moved you toward who you want to be." },
  back: { title: "Holds you back", hint: "Patterns from entries that moved you away from it." },
  unclear: { title: "Still unclear", hint: "Patterns that don't touch your goal yet, or pull both ways." },
};

function entryIdsFor(item: RecentInsightItem, store: Store): string[] {
  const t = item.target;
  if (t.kind === "belief") return store.beliefs.find((b) => b.id === t.id)?.supportingEntryIds ?? [];
  if (t.kind === "hypothesis") {
    const h = store.hypotheses[t.index];
    if (!h) return [];
    return h.relatedBeliefIds.flatMap((id) => store.beliefs.find((b) => b.id === id)?.supportingEntryIds ?? []);
  }
  return [];
}

export function insightLean(item: RecentInsightItem, store: Store): InsightLean {
  const ids = new Set(entryIdsFor(item, store));
  let net = 0;
  for (const e of store.history) {
    if (!ids.has(e.id)) continue;
    const s = entryStep(e);
    net += s.dir * s.size;
  }
  return net > 0 ? "closer" : net < 0 ? "back" : "unclear";
}

export function groupInsights(items: RecentInsightItem[], store: Store): Record<InsightLean, RecentInsightItem[]> {
  const out: Record<InsightLean, RecentInsightItem[]> = { closer: [], back: [], unclear: [] };
  for (const item of items) out[insightLean(item, store)].push(item);
  return out;
}
