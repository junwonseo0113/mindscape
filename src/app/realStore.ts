// ── Real, on-device user data ────────────────────────────────────────────────
// The one place this app keeps real, accumulating state instead of curated
// demo data. Every analysis feeds the current graph back to the model so it
// can tell "new pattern" apart from "this again, reinforce it", and links
// beliefs that share a root cause so the graph gets richer the longer
// someone actually uses the app. A brand-new real user's store is just
// emptyStore() — no beliefs, no history, no hypotheses — until they record
// their first thought.
//
// Belief creation specifically follows src/app/analysisFramework.ts: a
// pattern only becomes a visible StoredBelief once
// MIN_SUPPORTING_ENTRIES_FOR_BELIEF similar entries support it (tracked as
// a PendingBeliefCandidate until then), status/confidence are always
// recomputed from actual evidence counts rather than trusted from the
// model, and a rejected belief is excluded from future matching so it
// can't keep quietly absorbing new "supporting" entries.

import {
  EntryAnalysis,
  PendingBeliefCandidate,
  Store,
  StoredAssumption,
  StoredBelief,
  StoredConnection,
  StoredDriftNote,
  StoredHistoryEntry,
  ThoughtInterpretation,
  ThoughtObservation,
  defaultSettings,
  emptyStore,
  formatDateDots,
} from "./types";
import { MIN_SUPPORTING_ENTRIES_FOR_BELIEF, deriveStatus, initialConfidenceOnPromotion, nextConfidence } from "./analysisFramework";
import { computeLanguageObservation } from "./cognitiveLexicon";

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
      pendingBeliefCandidates: Array.isArray(parsed.pendingBeliefCandidates) ? parsed.pendingBeliefCandidates : [],
      isPro: typeof parsed.isPro === "boolean" ? parsed.isPro : false,
      proPlan: parsed.proPlan === "monthly" || parsed.proPlan === "yearly" ? parsed.proPlan : undefined,
      hasSeenUpgradePrompt: typeof parsed.hasSeenUpgradePrompt === "boolean" ? parsed.hasSeenUpgradePrompt : false,
      goals: Array.isArray(parsed.goals)
        ? parsed.goals.filter((g: any) => g && typeof g.id === "string" && typeof g.statement === "string")
        : [],
      goalsBeliefSnapshot: typeof parsed.goalsBeliefSnapshot === "number" ? parsed.goalsBeliefSnapshot : undefined,
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

function parseObservation(raw: any): ThoughtObservation {
  return {
    situation: typeof raw?.situation === "string" ? raw.situation : "",
    automaticThought: typeof raw?.automaticThought === "string" ? raw.automaticThought : "",
    emotions: Array.isArray(raw?.emotions)
      ? raw.emotions
          .filter((e: any) => e && typeof e.label === "string")
          .map((e: any) => ({ label: e.label, intensity: typeof e.intensity === "number" ? e.intensity : 0 }))
      : [],
    actionUrge: typeof raw?.actionUrge === "string" ? raw.actionUrge : "",
  };
}

function parseInterpretation(raw: any): ThoughtInterpretation {
  const towardOrAway = raw?.valueDirection?.towardOrAway;
  return {
    possibleCognitivePatterns: Array.isArray(raw?.possibleCognitivePatterns)
      ? raw.possibleCognitivePatterns.filter((p: any) => typeof p === "string")
      : [],
    valueDirection: {
      relatedValues: Array.isArray(raw?.valueDirection?.relatedValues)
        ? raw.valueDirection.relatedValues.filter((v: any) => typeof v === "string")
        : [],
      towardOrAway: towardOrAway === "toward" || towardOrAway === "away" ? towardOrAway : "unclear",
      explanation: typeof raw?.valueDirection?.explanation === "string" ? raw.valueDirection.explanation : "",
    },
  };
}

// Crisis path only: a crisis-flagged entry never reaches /api/analyze at
// all (see crisisDetection.ts and the "think" case's onDone in App.tsx),
// regardless of tier, so it has no analysis field of any kind.
// languageObservation is still computed (it's a local word-count pass, not
// an LLM call — see cognitiveLexicon.ts) since it's part of "recording,"
// not "analysis."
export function appendUnanalyzedEntry(prev: Store, rawText: string): Store {
  const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const historyEntry: StoredHistoryEntry = {
    id: entryId,
    date: formatDateDots(new Date()),
    text: rawText,
    languageObservation: computeLanguageObservation(rawText),
  };
  return {
    ...prev,
    history: [...prev.history, historyEntry].slice(-50),
    entryCount: prev.entryCount + 1,
  };
}

// Home's one-tap "How are you feeling?" check-in — no /api/analyze call at
// all (there's no text to send), just the tapped mood stored directly as
// this entry's own observation.emotions, the same field EmotionDistribution
// (and every other emotion-reading screen) already reads. interpretation/
// hypothesis are present but deliberately inert (empty pattern list, an
// "insufficient_data" hypothesis with no candidateBelief) — structurally
// identical to how a free-tier or no-signal Pro entry already looks, which
// is exactly the point: a mood tap is real data, but on its own it's never
// enough to claim a recurring pattern, so it can't accidentally create a
// pending belief candidate or feed the network the way a real "Speak your
// mind" analysis result can. `text` is a short natural sentence (not left
// empty) purely so every existing text-first UI — the journal card's
// quote, History's search, ScreenHistoryDetail's heading — renders this
// like any other entry without needing a special case anywhere.
export function appendMoodCheckIn(prev: Store, label: string, intensity: number): Store {
  const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const text = `Checked in feeling ${label.toLowerCase()}.`;
  const historyEntry: StoredHistoryEntry = {
    id: entryId,
    date: formatDateDots(new Date()),
    text,
    analysis: {
      observation: { situation: "", automaticThought: "", emotions: [{ label, intensity }], actionUrge: "" },
      interpretation: { possibleCognitivePatterns: [], valueDirection: { relatedValues: [], towardOrAway: "unclear", explanation: "" } },
      hypothesis: { candidateBelief: "", confidence: 0, status: "insufficient_data", supportingEntryIds: [], contradictoryEntryIds: [], reasoningSummary: "" },
    },
    languageObservation: computeLanguageObservation(text),
  };
  // Deliberately does NOT increment entryCount — that counter drives the
  // free tier's exact-equality upsell trigger (store.entryCount + 1 ===
  // UPSELL_PROMPT_AT_ENTRY_COUNT, checked only from a real "Speak your
  // mind" submission) and Profile's "Thoughts logged"/share-stats copy,
  // both of which assume a substantive reflection. Counting quick mood
  // taps there would let check-ins push a user's real 3rd entry past the
  // exact count the trigger checks for (silently skipping the one-time
  // upsell), and would overstate what "3 thoughts logged" actually means.
  // The entry still lands in history — the journal, heatmap, and emotion
  // distribution all read that directly, not entryCount.
  return {
    ...prev,
    history: [...prev.history, historyEntry].slice(-50),
  };
}

// The model matches beliefs/connections by content (statement text), not by
// id — it has no reliable way to keep bookkeeping ids consistent across
// calls. Identity/id assignment happens here instead: exact (domain,
// statement) match reuses the prior id (so a bubble/node keeps its identity
// as it strengthens); anything unmatched is a genuinely new node.
//
// `accumulate` is the free/Pro line: every tier now gets a real
// /api/analyze call and sees this entry's own observation/interpretation
// (the "one-time" read on what was just said) — but only when accumulate
// is true does this entry get to feed the belief/hypothesis/connection/
// assumption/drift network (the "accumulated" pattern-finding that
// actually requires seeing many entries together). Free tier passes
// accumulate=false: it still parses observation/interpretation into
// `analysis` below (so History can show it, same as Pro), it just never
// touches beliefs/pendingBeliefCandidates/assumptions/connections/
// hypotheses/driftNotes, which all stay exactly prev.x.
export function mergeAnalysisIntoStore(prev: Store, result: any, rawText: string, sessionSummary?: string, accumulate: boolean = true): Store {
  const today = formatDateDots(new Date());
  const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // ── Observation & interpretation are stored close to verbatim — they're
  // this one entry's direct read, not a claim about a recurring pattern,
  // so no evidence threshold applies to them.
  const observation = parseObservation(result?.observation);
  const interpretation = parseInterpretation(result?.interpretation);

  // ── The hypothesis candidate is where the hard rules live: status and
  // belief-eligibility are always recomputed here from real evidence
  // counts, never trusted as-is from the model's own guess.
  const rawCandidate = result?.hypothesisCandidate ?? {};
  const candidateBelief = typeof rawCandidate.candidateBelief === "string" ? rawCandidate.candidateBelief.trim() : "";
  const candidateDomain = typeof rawCandidate.domain === "string" && rawCandidate.domain.trim() ? rawCandidate.domain.trim() : "Life overall";
  const reasoningSummary = typeof rawCandidate.reasoningSummary === "string" ? rawCandidate.reasoningSummary : "";
  const directness = typeof rawCandidate.directness === "number" ? rawCandidate.directness : 0.4;
  const relation: "supports" | "contradicts" = rawCandidate.relation === "contradicts" ? "contradicts" : "supports";
  const matchedId: string | null = typeof rawCandidate.matchedCandidateId === "string" ? rawCandidate.matchedCandidateId : null;
  const matchedKind: "belief" | "pending" | null =
    rawCandidate.matchedCandidateKind === "belief" || rawCandidate.matchedCandidateKind === "pending" ? rawCandidate.matchedCandidateKind : null;
  // Secondary, longitudinal-only, optional — only ever applied to an
  // already-visible belief (which by construction already cleared
  // MIN_SUPPORTING_ENTRIES_FOR_BELIEF), never to a pending/new candidate.
  const schemaDomainLabelSuggestion: string | null =
    typeof rawCandidate.schemaDomainLabelSuggestion === "string" && rawCandidate.schemaDomainLabelSuggestion.trim()
      ? rawCandidate.schemaDomainLabelSuggestion.trim()
      : null;
  // ACT-style defusion label ("Perfectionism thought") — see analysisFramework's
  // thoughtLabel field doc. Purely a display reframe, so it's fine to just
  // take the model's suggestion as-is rather than re-deriving it.
  const thoughtLabelSuggestion: string | null =
    typeof rawCandidate.thoughtLabelSuggestion === "string" && rawCandidate.thoughtLabelSuggestion.trim()
      ? rawCandidate.thoughtLabelSuggestion.trim()
      : null;
  // Distanced self-talk (Kross & Ayduk) — same pattern as thoughtLabelSuggestion:
  // taken as-is from the model, never re-derived client-side (Korean 1st->2nd
  // person conversion needs real conjugation, not string substitution).
  const distancedReframeSuggestion: string | null =
    typeof rawCandidate.distancedReframeSuggestion === "string" && rawCandidate.distancedReframeSuggestion.trim()
      ? rawCandidate.distancedReframeSuggestion.trim()
      : null;
  const quoteSource = (observation.automaticThought || rawText).trim();
  const quote = quoteSource ? quoteSource.slice(0, 160) : null;

  let beliefs = prev.beliefs;
  let pendingBeliefCandidates = prev.pendingBeliefCandidates ?? [];
  let hypothesisNote: EntryAnalysis["hypothesis"] | null = null;

  if (accumulate && candidateBelief) {
    // Case 1: matches an already-visible (and not-rejected) belief.
    const matchedBelief = matchedKind === "belief" && matchedId
      ? beliefs.find((b) => b.id === matchedId && b.userReaction !== "rejected")
      : undefined;

    if (matchedBelief) {
      const supportingEntryIds = relation === "supports" ? [...(matchedBelief.supportingEntryIds ?? []), entryId] : (matchedBelief.supportingEntryIds ?? []);
      const contradictoryEntryIds = relation === "contradicts" ? [...(matchedBelief.contradictoryEntryIds ?? []), entryId] : (matchedBelief.contradictoryEntryIds ?? []);
      const confidence = nextConfidence(matchedBelief.confidence, relation, directness);
      const status = deriveStatus(supportingEntryIds.length, contradictoryEntryIds.length);
      const evidenceQuotes = quote ? [...matchedBelief.evidenceQuotes, { date: today, quote }].slice(-4) : matchedBelief.evidenceQuotes;
      // Longitudinal drift (Level 4) — only append when confidence actually
      // moved, so the history reads as real change points, not one per
      // entry regardless of whether anything shifted.
      const confidenceHistory = confidence !== matchedBelief.confidence
        ? [...(matchedBelief.confidenceHistory ?? []), { date: today, value: confidence }].slice(-30)
        : matchedBelief.confidenceHistory;
      beliefs = beliefs.map((b) =>
        b.id === matchedBelief.id
          ? {
              ...b,
              confidence,
              evidenceCount: supportingEntryIds.length,
              evidenceQuotes,
              status,
              supportingEntryIds,
              contradictoryEntryIds,
              possibleCognitivePatterns: interpretation.possibleCognitivePatterns.length > 0 ? interpretation.possibleCognitivePatterns : b.possibleCognitivePatterns,
              lastUpdatedAt: today,
              schemaDomainLabel: schemaDomainLabelSuggestion ?? b.schemaDomainLabel,
              thoughtLabel: thoughtLabelSuggestion ?? b.thoughtLabel,
              distancedReframe: distancedReframeSuggestion ?? b.distancedReframe,
              confidenceHistory,
            }
          : b
      );
      hypothesisNote = { candidateBelief: matchedBelief.statement, confidence, status, supportingEntryIds, contradictoryEntryIds, reasoningSummary };
    }

    // Case 2: matches a not-yet-visible pending candidate.
    const matchedPending = !hypothesisNote && matchedKind === "pending" && matchedId
      ? pendingBeliefCandidates.find((p) => p.id === matchedId)
      : undefined;

    if (matchedPending) {
      const supportingEntryIds = relation === "supports" ? [...matchedPending.supportingEntryIds, entryId] : matchedPending.supportingEntryIds;
      const contradictoryEntryIds = relation === "contradicts" ? [...matchedPending.contradictoryEntryIds, entryId] : matchedPending.contradictoryEntryIds;

      if (supportingEntryIds.length >= MIN_SUPPORTING_ENTRIES_FOR_BELIEF && supportingEntryIds.length > contradictoryEntryIds.length) {
        // Crosses the evidence bar for the first time — becomes a real,
        // visible belief. Keeps the pending candidate's id so it doesn't
        // read as a disconnected, brand-new object.
        const status = deriveStatus(supportingEntryIds.length, contradictoryEntryIds.length);
        const promotedConfidence = initialConfidenceOnPromotion(directness);
        const promoted: StoredBelief = {
          id: matchedPending.id,
          domain: matchedPending.domain,
          statement: matchedPending.statement,
          confidence: promotedConfidence,
          evidenceCount: supportingEntryIds.length,
          evidenceQuotes: quote ? [{ date: today, quote }] : [],
          status,
          supportingEntryIds,
          contradictoryEntryIds,
          possibleCognitivePatterns: interpretation.possibleCognitivePatterns,
          lastUpdatedAt: today,
          userReaction: null,
          thoughtLabel: thoughtLabelSuggestion ?? undefined,
          distancedReframe: distancedReframeSuggestion ?? undefined,
          // First point on this belief's drift history — its very first
          // confidence value, the moment it became visible at all.
          confidenceHistory: [{ date: today, value: promotedConfidence }],
        };
        beliefs = [promoted, ...beliefs];
        pendingBeliefCandidates = pendingBeliefCandidates.filter((p) => p.id !== matchedPending.id);
        hypothesisNote = { candidateBelief: promoted.statement, confidence: promoted.confidence, status, supportingEntryIds, contradictoryEntryIds, reasoningSummary };
      } else {
        const updated: PendingBeliefCandidate = {
          ...matchedPending,
          supportingEntryIds,
          contradictoryEntryIds,
          possibleCognitivePatterns: interpretation.possibleCognitivePatterns.length > 0 ? interpretation.possibleCognitivePatterns : matchedPending.possibleCognitivePatterns,
          reasoningSummary,
          lastUpdatedAt: today,
        };
        pendingBeliefCandidates = pendingBeliefCandidates.map((p) => (p.id === matchedPending.id ? updated : p));
        hypothesisNote = {
          candidateBelief: updated.statement,
          confidence: 0, // not confidence-tracked while unconfirmed — never implies certainty for a pattern that hasn't cleared the bar
          status: deriveStatus(supportingEntryIds.length, contradictoryEntryIds.length),
          supportingEntryIds,
          contradictoryEntryIds,
          reasoningSummary,
        };
      }
    }

    // Case 3: genuinely new — starts life as a pending candidate, never a
    // belief, no matter how confident the model's language sounds. One
    // entry is never enough.
    if (!hypothesisNote) {
      const fresh: PendingBeliefCandidate = {
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        domain: candidateDomain,
        statement: candidateBelief,
        supportingEntryIds: relation === "contradicts" ? [] : [entryId],
        contradictoryEntryIds: relation === "contradicts" ? [entryId] : [],
        possibleCognitivePatterns: interpretation.possibleCognitivePatterns,
        reasoningSummary,
        lastUpdatedAt: today,
      };
      pendingBeliefCandidates = [...pendingBeliefCandidates, fresh];
      hypothesisNote = {
        candidateBelief: fresh.statement,
        confidence: 0,
        status: "insufficient_data",
        supportingEntryIds: fresh.supportingEntryIds,
        contradictoryEntryIds: fresh.contradictoryEntryIds,
        reasoningSummary,
      };
    }
  }

  const hasObservationContent = !!(observation.situation || observation.automaticThought);
  const analysis: EntryAnalysis | undefined =
    hypothesisNote || hasObservationContent
      ? {
          observation,
          interpretation,
          hypothesis:
            hypothesisNote ?? { candidateBelief: "", confidence: 0, status: "insufficient_data", supportingEntryIds: [], contradictoryEntryIds: [], reasoningSummary: "" },
        }
      : undefined;

  // Feature 2 — computed locally from the raw text alone, no LLM call and
  // no dependency on how the analysis itself turned out, so it's always
  // available even on entries where the model found no belief/hypothesis
  // worth recording.
  const languageObservation = computeLanguageObservation(rawText);
  const historyEntry: StoredHistoryEntry = { id: entryId, date: today, text: rawText, analysis, languageObservation, sessionSummary };
  const history: StoredHistoryEntry[] = [...prev.history, historyEntry].slice(-50);

  // ── Assumptions: unchanged mechanism — the model still returns the full
  // updated list directly (repeat trigger -> count+1, new trigger -> new
  // entry), matched by (trigger, interpretation) content since the model
  // has no reliable way to keep its own ids consistent across calls.
  // Skipped entirely when !accumulate — an automatic-interpretation trend
  // is exactly the kind of "seen across many entries" pattern the free
  // tier doesn't get.
  const assumptionKey = (a: { trigger: string; interpretation: string }) => `${a.trigger}::${a.interpretation}`;
  const prevAssumptionByKey = new Map(prev.assumptions.map((a) => [assumptionKey(a), a]));
  const rawAssumptions: any[] = accumulate && Array.isArray(result?.assumptions) ? result.assumptions : prev.assumptions;
  const assumptions: StoredAssumption[] = accumulate
    ? rawAssumptions.map((a, i) => {
        const prevMatch = prevAssumptionByKey.get(assumptionKey(a));
        return {
          id: prevMatch?.id ?? `assumption-${Date.now()}-${i}`,
          trigger: a.trigger,
          interpretation: a.interpretation,
          count: typeof a.count === "number" ? a.count : prevMatch?.count ?? 1,
        };
      })
    : prev.assumptions;

  // ── Connections: only ever link currently-visible beliefs (rejected or
  // still-pending patterns can't participate), same matching-by-statement
  // approach as before. Skipped when !accumulate (beliefs never change on
  // that path anyway, so there's nothing new to connect).
  const idByStatement = new Map(beliefs.map((b) => [b.statement, b.id]));
  const rawConnections: any[] = accumulate && Array.isArray(result?.connections) ? result.connections : [];
  const newConnections: StoredConnection[] = rawConnections
    .map((c) => ({
      a: idByStatement.get(c.aStatement) ?? "",
      b: idByStatement.get(c.bStatement) ?? "",
      note: c.note ?? "",
      type: c.type === "contradiction" ? ("contradiction" as const) : ("root" as const),
    }))
    .filter((c) => c.a && c.b && c.a !== c.b);

  const stillValidIds = new Set(beliefs.map((b) => b.id));
  const carriedOver = prev.connections.filter((c) => stillValidIds.has(c.a) && stillValidIds.has(c.b));
  const seenPairs = new Set(carriedOver.map((c) => [c.a, c.b].sort().join("::")));
  const connections = [...carriedOver];
  for (const c of newConnections) {
    const pairKey = [c.a, c.b].sort().join("::");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    connections.push({ ...c, createdAt: today });
  }

  // A metaInsight only ever appears once the belief network is big enough
  // to support one (see the server prompt) — treat each as a real,
  // reactable hypothesis instead of a demo one, same shape so both screens
  // can render either without a special case.
  let hypotheses = prev.hypotheses;
  if (accumulate && typeof result?.metaInsight === "string" && result.metaInsight.trim()) {
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
          thoughtLabel: typeof result?.metaInsightThoughtLabel === "string" && result.metaInsightThoughtLabel.trim() ? result.metaInsightThoughtLabel.trim() : undefined,
        },
        ...prev.hypotheses,
      ].slice(0, 8);
    }
  }

  // Drift (distance from the stated aspiration) is itself an accumulated,
  // longitudinal read — skipped when !accumulate for the same reason as
  // assumptions/connections/hypotheses above.
  const driftNotes: StoredDriftNote[] = accumulate && typeof result?.driftNote === "string" && result.driftNote.trim()
    ? [...prev.driftNotes, { date: today, note: result.driftNote.trim() }].slice(-20)
    : prev.driftNotes;

  // Spread-then-override, not a hand-enumerated field list — the latter
  // used to silently drop isPro/proPlan/hasSeenUpgradePrompt (and would
  // have done the same to `goals`) every time this ran, since a hand-
  // enumerated object literal isn't checked against Store's full field
  // list even with tsconfig in place (it only catches a MISSING required
  // field if the object is used somewhere its type is inferred/asserted,
  // not a silently-narrower return type here).
  return {
    ...prev,
    beliefs,
    assumptions,
    connections,
    history,
    hypotheses,
    driftNotes,
    pendingBeliefCandidates,
    entryCount: prev.entryCount + 1,
  };
}
