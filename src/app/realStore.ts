// ── Real, on-device user data ────────────────────────────────────────────────
// The one place this app keeps real, accumulating state instead of curated
// demo data. Every analysis feeds the current graph back to the model so it
// can tell "new belief" apart from "this again, reinforce it", and links
// beliefs that share a root cause so the graph gets richer the longer
// someone actually uses the app. A brand-new real user's store is just
// emptyStore() — no beliefs, no history, no hypotheses — until they record
// their first thought.

import { Store, StoredBelief, StoredAssumption, StoredConnection, StoredHistoryEntry, StoredDriftNote, defaultSettings, emptyStore, formatDateDots } from "./types";

const STORE_KEY = "mijeong.store.v6";

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return {
      beliefs: Array.isArray(parsed.beliefs) ? parsed.beliefs : [],
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      hypotheses: Array.isArray(parsed.hypotheses) ? parsed.hypotheses : [],
      aspiration: typeof parsed.aspiration === "string" ? parsed.aspiration : null,
      aspirationSetDate: typeof parsed.aspirationSetDate === "string" ? parsed.aspirationSetDate : null,
      driftNotes: Array.isArray(parsed.driftNotes) ? parsed.driftNotes : [],
      settings: parsed.settings && typeof parsed.settings === "object" ? { ...defaultSettings(), ...parsed.settings } : defaultSettings(),
      account: parsed.account && typeof parsed.account === "object" ? parsed.account : null,
      entryCount: typeof parsed.entryCount === "number" ? parsed.entryCount : 0,
    };
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // private-mode / storage-full — non-fatal, just don't persist
  }
}

// The model matches beliefs/connections by content (statement text), not by
// id — it has no reliable way to keep bookkeeping ids consistent across
// calls. Identity/id assignment happens here instead: exact (domain,
// statement) match reuses the prior id (so a bubble/node keeps its identity
// as it strengthens); anything unmatched is a genuinely new node.
export function mergeAnalysisIntoStore(prev: Store, result: any, rawText: string): Store {
  const today = formatDateDots(new Date());

  const beliefKey = (b: { domain: string; statement: string }) => `${b.domain}::${b.statement}`;
  const prevBeliefByKey = new Map(prev.beliefs.map((b) => [beliefKey(b), b]));
  const rawBeliefs: any[] = Array.isArray(result?.beliefs) ? result.beliefs : prev.beliefs;
  const beliefs: StoredBelief[] = rawBeliefs.map((b, i) => {
    const prevMatch = prevBeliefByKey.get(beliefKey(b));
    const priorQuotes = prevMatch?.evidenceQuotes ?? [];
    const newQuote = typeof b.quote === "string" && b.quote.trim() ? b.quote.trim() : null;
    const evidenceQuotes = newQuote ? [...priorQuotes, { date: today, quote: newQuote }].slice(-4) : priorQuotes;
    return {
      id: prevMatch?.id ?? `belief-${Date.now()}-${i}`,
      domain: b.domain,
      statement: b.statement,
      confidence: typeof b.confidence === "number" ? b.confidence : prevMatch?.confidence ?? 50,
      evidenceCount: typeof b.evidenceCount === "number" ? b.evidenceCount : prevMatch?.evidenceCount ?? 1,
      evidenceQuotes,
    };
  });

  const assumptionKey = (a: { trigger: string; interpretation: string }) => `${a.trigger}::${a.interpretation}`;
  const prevAssumptionByKey = new Map(prev.assumptions.map((a) => [assumptionKey(a), a]));
  const rawAssumptions: any[] = Array.isArray(result?.assumptions) ? result.assumptions : prev.assumptions;
  const assumptions: StoredAssumption[] = rawAssumptions.map((a, i) => {
    const prevMatch = prevAssumptionByKey.get(assumptionKey(a));
    return {
      id: prevMatch?.id ?? `assumption-${Date.now()}-${i}`,
      trigger: a.trigger,
      interpretation: a.interpretation,
      count: typeof a.count === "number" ? a.count : prevMatch?.count ?? 1,
    };
  });

  const idByStatement = new Map(beliefs.map((b) => [b.statement, b.id]));
  const rawConnections: any[] = Array.isArray(result?.connections) ? result.connections : [];
  const newConnections: StoredConnection[] = rawConnections
    .map((c) => ({ a: idByStatement.get(c.aStatement) ?? "", b: idByStatement.get(c.bStatement) ?? "", note: c.note ?? "" }))
    .filter((c) => c.a && c.b && c.a !== c.b);

  const stillValidIds = new Set(beliefs.map((b) => b.id));
  const carriedOver = prev.connections.filter((c) => stillValidIds.has(c.a) && stillValidIds.has(c.b));
  const seenPairs = new Set(carriedOver.map((c) => [c.a, c.b].sort().join("::")));
  const connections = [...carriedOver];
  for (const c of newConnections) {
    const pairKey = [c.a, c.b].sort().join("::");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    connections.push(c);
  }

  const history: StoredHistoryEntry[] = [...prev.history, { date: today, text: rawText }].slice(-50);

  // A metaInsight only ever appears once the belief network is big enough
  // to support one (see the server prompt) — treat each as a real,
  // reactable hypothesis instead of a demo one, same shape so both screens
  // can render either without a special case.
  let hypotheses = prev.hypotheses;
  if (typeof result?.metaInsight === "string" && result.metaInsight.trim()) {
    const alreadyHave = prev.hypotheses.some((h) => h.title === result.metaInsight.trim());
    if (!alreadyHave) {
      const relatedStatements: string[] = Array.isArray(result?.metaInsightBeliefStatements) ? result.metaInsightBeliefStatements : [];
      const relatedBeliefIds = relatedStatements
        .map((s) => beliefs.find((b) => b.statement === s)?.id)
        .filter((id): id is string => !!id);
      const domains = Array.isArray(result?.metaInsightDomains) && result.metaInsightDomains.length > 0
        ? result.metaInsightDomains
        : relatedBeliefIds.length > 0
          ? [...new Set(relatedBeliefIds.map((id) => beliefs.find((b) => b.id === id)!.domain))]
          : [...new Set(beliefs.map((b) => b.domain))].slice(0, 3);
      hypotheses = [
        {
          id: `hyp-${Date.now()}`,
          title: result.metaInsight.trim(),
          confidence: typeof result?.metaInsightConfidence === "number" ? result.metaInsightConfidence : 60,
          domains,
          reaction: null,
          createdDate: today,
          relatedBeliefIds,
        },
        ...prev.hypotheses,
      ].slice(0, 8);
    }
  }

  const driftNotes: StoredDriftNote[] = typeof result?.driftNote === "string" && result.driftNote.trim()
    ? [...prev.driftNotes, { date: today, note: result.driftNote.trim() }].slice(-20)
    : prev.driftNotes;

  return {
    beliefs,
    assumptions,
    connections,
    history,
    hypotheses,
    aspiration: prev.aspiration,
    aspirationSetDate: prev.aspirationSetDate,
    driftNotes,
    settings: prev.settings,
    account: prev.account,
    entryCount: prev.entryCount + 1,
  };
}
