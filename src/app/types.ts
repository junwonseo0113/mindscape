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

export type StoredBelief = {
  id: string;
  domain: string;
  statement: string;
  confidence: number;
  evidenceCount: number;
  evidenceQuotes: StoredEvidenceQuote[];
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
  date: string;
  text: string;
  // Only demo entries carry a recorded duration today.
  duration?: string;
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
