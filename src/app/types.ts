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
  // belief specifically when it surfaces as "Today's Discovery" (the Analysis
  // page's reflection step), not the permanent "reject from Unconscious Patterns"
  // action — a belief can be disagreed with here without being hidden.
  discoveryReaction?: "agree" | "disagree" | null;
  // Disagreeing as "Today's Discovery" now actually asks the model for a genuinely
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
  // An ACT-style "defusion" label — a short noun phrase naming the thought
  // as a recurring visitor ("Perfectionism thought") rather than restating it as a
  // first-person fact. Purely a display reframe alongside `statement`,
  // never a replacement for it — nothing downstream (matching, confidence,
  // evidence) reads this field.
  thoughtLabel?: string;
  // Distanced self-talk (Kross & Ayduk) — the same belief statement restated
  // in the person's name or 2nd person instead of 1st ("I'll end up failing"
  // -> "{name} feels like they'll end up failing"), which measurably
  // creates emotional distance on its own. Purely a display reframe
  // alongside `statement`, same as thoughtLabel — nothing downstream reads it.
  distancedReframe?: string;
  // Longitudinal drift tracking — one point appended every time confidence
  // actually changes (see mergeAnalysisIntoStore), never backfilled or
  // interpolated. Purely observational ("this is how your confidence in
  // this pattern has moved"), not a trend the app claims to predict.
  confidenceHistory?: { date: string; value: number }[];
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

// `type` defaults to "root" (mutually-reinforcing, same underlying cause)
// when absent — every connection created before this field existed reads
// as "root". "contradiction" is a distinct relationship (belief-network
// Level 5): two beliefs in real tension, shown side-by-side without
// judgment (motivational interviewing's "discrepancy" technique) rather
// than folded into the "shares a root cause" narrative.
export type StoredConnection = {
  a: string;
  b: string;
  note: string;
  type?: "root" | "contradiction";
  // Stamped only when realStore.ts actually creates a new connection —
  // never backfilled onto ones that already existed. Powers the
  // rumination-possibility check (isLikelyRuminating in
  // analysisFramework.ts): "no *new* root connection recently" needs to
  // know when a connection appeared, not just whether one currently
  // exists. Absent on any connection older than this field, which is the
  // correct fallback (treat as "not recent").
  createdAt?: string;
};

// Pure word-frequency counts over one session's raw text — see
// src/app/cognitiveLexicon.ts for the actual word lists and the counting/
// trend logic. Deliberately just counts, never a score or a verdict:
// nothing here says whether more or fewer of either category is "good."
export type LanguageObservation = {
  wordCount: number;
  cognitiveVerbCount: number;
  // Per-100-words rate, not a raw count — session length varies a lot
  // (a 30-second entry vs. a 5-minute one), so only a normalized rate is
  // actually comparable across sessions for the trend comparison below.
  cognitiveVerbPerHundredWords: number;
  firstPersonSingularCount: number;
  collectiveOrOtherCount: number;
};

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
  // Computed locally (no LLM call) the moment the entry is recorded — see
  // computeLanguageObservation in cognitiveLexicon.ts. Stored per-entry
  // (not just shown once and discarded) specifically so a session-summary
  // card can compare "this session vs. the last 3" and so a future
  // longitudinal timeline can chart it the same way confidenceHistory does
  // for beliefs.
  languageObservation?: LanguageObservation;
  // Feature 3 — a short (3-5 sentence) restatement of what was said, from
  // a separate LLM call kept deliberately free of interpretation/labels
  // (see analysisFramework's SESSION_SUMMARY_PROMPT). Optional because it
  // requires its own API round trip that can fail independently of the
  // main analysis; stored here so past-session previews can reuse it.
  sessionSummary?: string;
};

// The "investigate" deep-dive is its own optional sub-object rather than a
// flag, so a hypothesis either has one to walk through or it doesn't — the
// "Dig deeper" button already only renders when this is present.
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
  // Same defusion reframe as StoredBelief.thoughtLabel, applied to this
  // hypothesis's title.
  thoughtLabel?: string;
};

export type StoredDriftNote = { date: string; note: string };

export type StoredSettings = {
  dailyReminder: boolean;
  // 24-hour "HH:mm", local time — only read while dailyReminder is true.
  dailyReminderTime: string;
  newHypothesisAlert: boolean;
  weeklySummary: boolean;
};

// A forward-looking growth direction inferred from the recurring unconscious
// beliefs the Brain Map has actually surfaced — not something the user typed
// themselves (that's `aspiration`), and not a single belief restated, but
// what moving away from a few of them together might look like. Recomputed
// (see App.tsx's HomeGoalsWidget) only when the belief set has actually
// changed since the last computation, not on every render.
export type StoredGoal = {
  id: string;
  statement: string;
  basedOnDomains: string[];
  createdDate: string;
};

// Local-only mock account — there's no backend, so this is just a gate on
// top of the one on-device dataset, not real auth.
export type StoredAccount = { name: string; email: string; password: string };

// Shown on Distance from Your Goal only while the user hasn't set an aspiration yet, and
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
  // Free tier only records entries (see appendUnanalyzedEntry in
  // realStore.ts) — no AI analysis call, so no beliefs/hypotheses/
  // connections/drift ever get created. Pro unlocks the analysis call
  // itself, not just its display, so a free store's beliefs/hypotheses
  // arrays stay genuinely empty rather than hidden-but-populated. Mocked
  // locally (no real billing) — see ScreenCheckout's onSubscribed in App.tsx.
  isPro: boolean;
  // Which plan a mock Pro upgrade was made under — cosmetic only (drives
  // Profile's "Yearly plan" text and ScreenManageSubscription) until real
  // billing exists. Always undefined while isPro is false.
  proPlan?: "monthly" | "yearly";
  // One-time soft-paywall interstitial (ScreenSoftPaywall in App.tsx) —
  // fires once, right after the free tier's 3rd recorded entry, then never
  // again regardless of how many more free entries follow. Set the instant
  // it's shown (not just "would have shown"), so dismissing it with "Not
  // now" still permanently retires it — this is a single nudge, not a
  // recurring nag.
  hasSeenUpgradePrompt?: boolean;
  goals: StoredGoal[];
  // beliefs.length at the moment `goals` was last computed — recompute only
  // once the belief set has actually grown/shrunk since then, not on every
  // Home render. undefined means "never computed."
  goalsBeliefSnapshot?: number;
};

export function formatDateDots(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultSettings(): StoredSettings {
  return { dailyReminder: true, dailyReminderTime: "20:00", newHypothesisAlert: true, weeklySummary: false };
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
    isPro: false,
    goals: [],
  };
}
