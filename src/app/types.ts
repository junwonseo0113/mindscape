// ── Shared data shapes ───────────────────────────────────────────────────────
// One Store shape for both real (on-device, accumulated) data and demo
// (curated example) data — screens read this shape and never need to know
// which source it came from. A few fields are optional specifically because
// only the richer demo data populates them today (a per-hypothesis custom
// question, explicit evidence quotes, the "investigate" deep-dive, assumption
// domain tags, per-entry duration, aspiration examples): real data simply
// omits them until the backend grows to produce them, and the renderer
// already treats their absence as "nothing to show here" rather than an
// error.

export type StoredEvidenceQuote = { date: string; quote: string };

// ── The app's default psychological analysis framework ──────────────────────
// Per-entry extraction, grounded in CBT (situation → automatic thought →
// cognitive pattern) and ACT (values direction), with Schema Therapy used
// only as an optional, secondary label on well-established longitudinal
// patterns — see src/app/analysisFramework.ts for the actual rules
// (evidence thresholds, confidence math, rejection handling). This is a
// self-reflection aid, not a diagnostic instrument: nothing here infers
// trauma, attachment style, personality disorder, or unconscious motive.

export type EmotionRating = { label: string; intensity: number };

export type ThoughtObservation = {
  situation: string;
  automaticThought: string;
  emotions: EmotionRating[];
  actionUrge: string;
};

export type ValueDirection = {
  relatedValues: string[];
  towardOrAway: "toward" | "away" | "unclear";
  explanation: string;
};

export type ThoughtInterpretation = {
  possibleCognitivePatterns: string[];
  valueDirection: ValueDirection;
};

export type HypothesisStatus = "insufficient_data" | "emerging" | "supported" | "conflicted";

// The per-entry read on whether this thought supports a recurring pattern —
// never a claim that the pattern IS real ("candidate", never "confirmed
// belief"). Whether it actually becomes a visible, recurring StoredBelief
// is decided separately by analysisFramework.ts's evidence threshold.
export type ThoughtHypothesisNote = {
  candidateBelief: string;
  confidence: number;
  status: HypothesisStatus;
  supportingEntryIds: string[];
  contradictoryEntryIds: string[];
  reasoningSummary: string;
};

export type EntryAnalysis = {
  observation: ThoughtObservation;
  interpretation: ThoughtInterpretation;
  hypothesis: ThoughtHypothesisNote;
};

// A recurring pattern that hasn't yet cleared the evidence bar to become a
// visible StoredBelief (see MIN_SUPPORTING_ENTRIES_FOR_BELIEF) — tracked so
// the second and third similar entries can find and reinforce it, but
// intentionally not surfaced in the belief map/brain graph until then. One
// entry is never enough to hypothesize a pattern.
export type PendingBeliefCandidate = {
  id: string;
  domain: string;
  statement: string;
  supportingEntryIds: string[];
  contradictoryEntryIds: string[];
  possibleCognitivePatterns: string[];
  reasoningSummary: string;
  lastUpdatedAt: string;
};

export type StoredBelief = {
  id: string;
  domain: string;
  statement: string;
  confidence: number;
  evidenceCount: number;
  evidenceQuotes: StoredEvidenceQuote[];
  // Evidence-framework fields (optional so demo data and any legacy belief
  // objects without them still render fine — the belief map/brain graph
  // never required these). Once present, they're what the framework itself
  // relies on: which entries actually support or contradict this belief,
  // its status per those rules, and whether the user has explicitly
  // accepted or rejected it. A rejected belief is excluded from future
  // matching — see analysisFramework.ts — so new entries can't silently
  // keep reinforcing something the user said wasn't accurate; only an
  // independently-accumulated new pattern (3 fresh entries of its own) can
  // re-establish it.
  status?: HypothesisStatus;
  supportingEntryIds?: string[];
  contradictoryEntryIds?: string[];
  possibleCognitivePatterns?: string[];
  lastUpdatedAt?: string;
  userReaction?: "accepted" | "rejected" | null;
  // Optional, secondary, longitudinal-only Schema Therapy taxonomy label —
  // never set from a single entry, and never framed as a diagnosis.
  schemaDomainLabel?: string;
  // Separate from userReaction above: this tracks agreement with this
  // belief specifically when it surfaces as "오늘의 발견" (the Analysis
  // page's reflection step), not the permanent "reject from 무의식적 패턴"
  // action — a belief can be disagreed with here without being hidden.
  discoveryReaction?: "agree" | "disagree" | null;
  // Disagreeing as "오늘의 발견" now actually asks the model for a genuinely
  // different reading of the same evidence instead of just recording a
  // reason — these track that loop. rejectedStatements accumulates every
  // interpretation the user has already said no to (so the model never
  // repeats one), and discoveryExhausted flips true once the model says
  // there's no meaningfully different interpretation left to offer.
  // discoveryInterpretationOverride is deliberately separate from
  // `statement`: `statement` is the belief's canonical wording, referenced
  // everywhere else (belief map, 3D brain, connections) and backed by its
  // full evidence history, so a disagreement on today's discovery framing
  // reframes only what the discovery card shows, never the belief itself.
  rejectedStatements?: string[];
  discoveryExhausted?: boolean;
  discoveryInterpretationOverride?: string;
};

export type StoredAssumption = {
  id: string;
  trigger: string;
  interpretation: string;
  count: number;
  // Only demo assumptions carry this today — real ones aren't tagged by
  // domain yet.
  domains?: string[];
};

export type StoredConnection = { a: string; b: string; note: string };

export type StoredHistoryEntry = {
  // Stable id, independent of array position or date — this is what
  // supportingEntryIds/contradictoryEntryIds reference, and what lets a
  // rejected belief's future matching exclude exactly the entries it was
  // built from without disturbing anything else.
  id: string;
  date: string;
  text: string;
  // Only demo entries carry a recorded duration today.
  duration?: string;
  // The raw entry and the AI's read on it are stored side by side but kept
  // conceptually separate: `text` is exactly what the person said, never
  // edited by analysis; `analysis` is the AI's observation/interpretation/
  // hypothesis for this entry, correctable/rejectable independent of the
  // raw text itself.
  analysis?: EntryAnalysis;
};

// The "investigate" deep-dive is its own optional sub-object rather than a
// flag, so a hypothesis either has one to walk through or it doesn't — the
// "더 깊이 알아보기" button already only renders when this is present.
export type StoredHypothesisInvestigation = {
  origin: StoredEvidenceQuote;
  originNote: string;
  compareLabel1: string;
  compareSteps1: string[];
  compareLabel2: string;
  compareSteps2: string[];
  related: string;
};

export type StoredHypothesis = {
  id: string;
  title: string;
  confidence: number;
  domains: string[];
  reaction: "agree" | "disagree" | null;
  createdDate: string;
  relatedBeliefIds: string[];
  // Optional richer content: a hypothesis-specific reflective question
  // (falls back to a generic one), explicit evidence quotes (falls back to
  // deriving quotes from relatedBeliefIds), and the investigate walkthrough.
  question?: string;
  evidence?: StoredEvidenceQuote[];
  investigate?: StoredHypothesisInvestigation;
  // Same reinterpretation loop as StoredBelief.rejectedStatements/
  // discoveryExhausted, applied to a hypothesis's title instead of a
  // belief's statement — see analysisFramework's reinterpret endpoint.
  rejectedTitles?: string[];
  exhausted?: boolean;
};

export type StoredDriftNote = { date: string; note: string };

export type StoredSettings = {
  dailyReminder: boolean;
  newHypothesisAlert: boolean;
  weeklySummary: boolean;
};

// Local-only mock account — there's no backend, so this is just a gate on
// top of the one on-device dataset, not real auth.
export type StoredAccount = { name: string; email: string; password: string };

// Shown on 목표와의 거리 only while the user hasn't set an aspiration yet, and
// only ever populated by demo data — real data has nothing to put here until
// an aspiration is actually set, at which point driftNotes takes over.
export type AspirationExample = {
  said: string;
  saidDate: string;
  label: string;
  target: number;
  actual: number;
  note: string;
};

export type Store = {
  beliefs: StoredBelief[];
  assumptions: StoredAssumption[];
  connections: StoredConnection[];
  history: StoredHistoryEntry[];
  hypotheses: StoredHypothesis[];
  aspiration: string | null;
  aspirationSetDate: string | null;
  aspirationExamples?: AspirationExample[];
  driftNotes: StoredDriftNote[];
  settings: StoredSettings;
  account: StoredAccount | null;
  entryCount: number;
  // Candidate recurring patterns below the visibility threshold — see
  // PendingBeliefCandidate. Internal bookkeeping only; no screen renders
  // this directly.
  pendingBeliefCandidates?: PendingBeliefCandidate[];
};

export function formatDateDots(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultSettings(): StoredSettings {
  return { dailyReminder: true, newHypothesisAlert: true, weeklySummary: false };
}

export function emptyStore(): Store {
  return {
    beliefs: [],
    assumptions: [],
    connections: [],
    history: [],
    hypotheses: [],
    aspiration: null,
    aspirationSetDate: null,
    driftNotes: [],
    settings: defaultSettings(),
    account: null,
    entryCount: 0,
  };
}
