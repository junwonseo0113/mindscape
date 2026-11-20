// ── Merging two copies of the same person's diary ───────────────────────────
// When someone signs in, this device's copy and the cloud copy can both
// have things the other doesn't: entries written as a guest or offline
// here, entries written on another phone there. Signing in used to replace
// this device's copy with the cloud's, which silently lost the local ones.
// mergeStores keeps both:
//   · lists (entries, beliefs, hypotheses, ...) are joined by id, and when
//     both copies have the same item, the more recently updated one wins;
//   · "who you want to be" goes with whichever copy set it later;
//   · this device's own preferences (settings, consent, local account)
//     stay as they are here.
import type { Store, StoredBelief, StoredHistoryEntry } from "./types";
import { capHistory, sanitizeStore } from "./realStore";

function unionBy<T>(a: T[] = [], b: T[] = [], key: (x: T) => string, prefer: (x: T, y: T) => T = (x) => x): T[] {
  const out = new Map<string, T>();
  a.forEach((x) => out.set(key(x), x));
  b.forEach((y) => {
    const k = key(y);
    const x = out.get(k);
    out.set(k, x === undefined ? y : prefer(x, y));
  });
  return Array.from(out.values());
}

// An entry that has been analysed beats the same entry still waiting.
const richerEntry = (x: StoredHistoryEntry, y: StoredHistoryEntry) =>
  (!x.analysis && y.analysis) || (!x.aspirationStep && y.aspirationStep) ? y : x;

// The belief with more evidence, or updated more recently, is the newer one.
const newerBelief = (x: StoredBelief, y: StoredBelief) => {
  if ((y.evidenceCount ?? 0) !== (x.evidenceCount ?? 0)) return (y.evidenceCount ?? 0) > (x.evidenceCount ?? 0) ? y : x;
  return (y.lastUpdatedAt ?? "") > (x.lastUpdatedAt ?? "") ? y : x;
};

const byDate = (a: { date: string }, b: { date: string }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export function mergeStores(local: Store, cloud: Store): Store {
  const laterAspiration = (cloud.aspirationSetDate ?? "") > (local.aspirationSetDate ?? "") ? cloud : local;
  const merged: Store = {
    ...cloud,
    // This device's own choices.
    settings: local.settings,
    account: local.account ?? cloud.account,
    aiConsent: local.aiConsent ?? cloud.aiConsent,
    // Shared content, joined.
    history: capHistory(unionBy(local.history, cloud.history, (e) => e.id, richerEntry).sort(byDate)),
    beliefs: unionBy(local.beliefs, cloud.beliefs, (b) => b.id, newerBelief),
    hypotheses: unionBy(local.hypotheses, cloud.hypotheses, (h) => h.id),
    assumptions: unionBy(local.assumptions, cloud.assumptions, (a) => a.id, (x, y) => ((y.count ?? 0) > (x.count ?? 0) ? y : x)),
    connections: unionBy(local.connections, cloud.connections, (c) => [c.a, c.b].sort().join("|") + c.type),
    driftNotes: unionBy(local.driftNotes, cloud.driftNotes, (d) => `${d.date}|${d.note}`).sort(byDate).slice(-20),
    lensSessions: unionBy(local.lensSessions, cloud.lensSessions, (l) => l.id),
    goals: local.goals.length >= cloud.goals.length ? local.goals : cloud.goals,
    pendingBeliefCandidates: unionBy(local.pendingBeliefCandidates ?? [], cloud.pendingBeliefCandidates ?? [], (p) => p.id),
    aspiration: laterAspiration.aspiration,
    aspirationSetDate: laterAspiration.aspirationSetDate,
    entryCount: Math.max(local.entryCount, cloud.entryCount),
    isPro: local.isPro || cloud.isPro,
  };
  return sanitizeStore(merged);
}
