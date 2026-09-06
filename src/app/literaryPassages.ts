// ── "For where you are now" — Premium's literary-passage feature ───────────
//
// The core rule this whole file exists to enforce: the app SELECTS a real
// passage from this curated library — it never generates, paraphrases, or
// reconstructs one from memory. See selectLiteraryPassage below for the
// pipeline (extract themes from real user data → score candidate passages
// against those themes → pick the strongest match), and App.tsx's
// LiteraryReflectionPanel for where the result is displayed and persisted
// (store.literaryMatch — see types.ts) so it doesn't reshuffle every time
// Premium opens.
//
// COPYRIGHT / ACCURACY — every entry below is currently a clearly-marked
// PLACEHOLDER (rightsStatus: "placeholder"), not a verified quotation. The
// author/work/theme pairings are real editorial intent (Nin on freedom vs.
// security and becoming, Rilke on uncertainty and patience, Woolf on
// independence and self-perception, Camus on meaning and change genuinely
// fit those themes) — but the exact_text of a real passage has to come from
// an actual verified source, not an LLM's memory of how a famous line
// probably goes, so none of these are eligible to render as a genuine
// quotation yet. exactText is deliberately kept excerpt-length (what a real
// curated passage would actually be — a few lines, not a paragraph) and
// self-marks as pending via plain brackets, rather than through a second
// on-screen badge — see App.tsx's LiteraryReflectionPanel, which no longer
// duplicates that signal as a separate "PLACEHOLDER" caption; one quiet
// marker, not two competing ones. Replacing a placeholder is a one-line
// edit: swap exactText/source and flip rightsStatus to "public-domain" or
// "licensed" once a passage has actually been checked against a real
// edition and its rights confirmed.

export type PassageRightsStatus = "public-domain" | "licensed" | "placeholder";

export type LiteraryPassage = {
  id: string;
  exactText: string;
  author: string;
  // Stable key for looking up this author's portrait — see App.tsx's
  // AUTHOR_PORTRAITS registry. Deliberately separate from `author` (the
  // display name) so a portrait can be added/swapped without touching the
  // passage data, and so the display component never hardcodes a specific
  // author — see LiteraryReflectionPanel/AuthorPortrait.
  authorId: string;
  work: string;
  source: string;
  rightsStatus: PassageRightsStatus;
  // Lowercase theme tags — see THEME_KEYWORDS for the same vocabulary
  // extractUserThemes scores the user's own data against.
  themes: string[];
};

export const LITERARY_PASSAGES: LiteraryPassage[] = [
  {
    id: "nin-becoming",
    exactText: "[Excerpt pending rights clearance — Anaïs Nin, on choosing to become rather than staying safe.]",
    author: "Anaïs Nin",
    authorId: "anais-nin",
    work: "The Diary of Anaïs Nin",
    source: "pending verification",
    rightsStatus: "placeholder",
    themes: ["freedom vs security", "becoming", "waiting", "independence", "change"],
  },
  {
    id: "rilke-questions",
    exactText: "[Excerpt pending rights clearance — Rilke, on living inside the unanswered questions.]",
    author: "Rainer Maria Rilke",
    authorId: "rilke",
    work: "Letters to a Young Poet",
    source: "pending verification",
    rightsStatus: "placeholder",
    themes: ["uncertainty", "waiting", "identity", "meaning"],
  },
  {
    id: "woolf-room",
    exactText: "[Excerpt pending rights clearance — Woolf, on the room and independence a mind requires.]",
    author: "Virginia Woolf",
    authorId: "virginia-woolf",
    work: "A Room of One's Own",
    source: "pending verification",
    rightsStatus: "placeholder",
    themes: ["independence", "identity", "self-perception", "belonging", "recognition"],
  },
  {
    id: "camus-absurd",
    exactText: "[Excerpt pending rights clearance — Camus, on finding footing without certainty.]",
    author: "Albert Camus",
    authorId: "camus",
    work: "The Myth of Sisyphus",
    source: "pending verification",
    rightsStatus: "placeholder",
    themes: ["meaning", "change", "fear", "ambition", "uncertainty"],
  },
];

// The same vocabulary the brief's own theme list uses — each mapped to the
// substrings worth checking a belief's domain/statement/thoughtLabel (all
// lowercased) for. Deliberately plain substring matching, not a fake
// "semantic" pass — see extractUserThemes for how these get weighted and
// corroborated across beliefs rather than just keyword-counted.
const THEME_KEYWORDS: Record<string, string[]> = {
  "uncertainty": ["uncertain", "not sure", "unsure", "doubt", "unclear", "wait"],
  "freedom vs security": ["freedom", "free ", "safety", "security", "safe"],
  "perfectionism": ["perfect", "all-or-nothing"],
  "independence": ["alone", "independent", "on my own", "by myself", "myself"],
  "identity": ["who i am", "identity"],
  "ambition": ["ambition", "succeed", "achieve", "work hard", "eventually"],
  "recognition": ["recognized", "recognition", "acknowledge", "seen"],
  "loneliness": ["alone", "lonely", "isolat"],
  "change": ["change", "different", "become", "becoming"],
  "fear": ["fear", "afraid", "scared", "anxious", "anxiety"],
  "belonging": ["belong", "fit in", "accepted"],
  "relationships": ["relationship", "reach out", "connect"],
  "meaning": ["meaning", "purpose", "matters"],
  "self-perception": ["i see myself", "self-image", "how i see"],
};

export type ThemeScore = { theme: string; score: number; supportingBeliefIds: string[] };

// Pure function of the user's own data — no randomness, no clock — so the
// same store always produces the same themes (and therefore the same
// passage match). Each belief that mentions a theme's keywords contributes
// confidence-weighted signal, PLUS a flat corroboration bonus so two
// separate beliefs pointing at the same theme outweigh one strongly-worded
// one — a recurring tension across multiple beliefs is exactly what "where
// you are now" should surface, not just whichever single belief happens to
// have the highest confidence. A belief still actively "conflicted" gets a
// small extra bump for the same reason: unresolved tension is more alive
// than a settled pattern.
export function extractUserThemes(store: { beliefs: { domain: string; statement: string; thoughtLabel?: string; confidence: number; status?: string; possibleCognitivePatterns?: string[] }[] }): ThemeScore[] {
  const scores = new Map<string, { score: number; ids: Set<string> }>();
  store.beliefs.forEach((b, i) => {
    if ((b as any).userReaction === "rejected") return;
    const haystack = `${b.domain} ${b.statement} ${b.thoughtLabel ?? ""}`.toLowerCase();
    const patterns = (b.possibleCognitivePatterns ?? []).map((p) => p.toLowerCase());
    Object.entries(THEME_KEYWORDS).forEach(([theme, keywords]) => {
      const keywordHit = keywords.some((k) => haystack.includes(k));
      // "should statements" is too general a CBT pattern to specifically
      // mean perfectionism (it shows up on plenty of unrelated beliefs —
      // see e.g. the demo's safety belief) — only "all-or-nothing
      // thinking" is a genuinely perfectionism-specific signal.
      const patternHit = theme === "perfectionism" && patterns.some((p) => p.includes("all-or-nothing"));
      if (!keywordHit && !patternHit) return;
      const cur = scores.get(theme) ?? { score: 0, ids: new Set<string>() };
      cur.score += b.confidence / 100 + 0.3 + (b.status === "conflicted" ? 0.2 : 0) + (patternHit ? 0.3 : 0);
      cur.ids.add((b as any).id ?? String(i));
      scores.set(theme, cur);
    });
  });
  return Array.from(scores.entries())
    .map(([theme, { score, ids }]) => ({ theme, score, supportingBeliefIds: Array.from(ids) }))
    .sort((a, b) => b.score - a.score || (a.theme < b.theme ? -1 : 1)); // score desc, then alphabetical — deterministic tie-break
}

// Below this, there just isn't enough recurring signal yet for a match to
// mean anything — same "don't pretend to have personalized this" rule
// GoalDirectionsPanel's MIN_BELIEFS_FOR_GOALS follows.
export const MIN_BELIEFS_FOR_LITERARY_MATCH = 3;

export type LiteraryMatchResult = { passage: LiteraryPassage; themes: string[]; topThemeScores: ThemeScore[] };

// Ranks every candidate passage by how much its own theme tags overlap
// with the user's top themes (weighted by each theme's score, so a
// passage matching the #1 theme outweighs one only matching a distant
// #4th) — the closest this gets to "semantic ranking" without an actual
// embedding model, but it's real overlap against real extracted themes,
// not a coin flip. Ties break on passage id, so the result is stable.
export function selectLiteraryPassage(store: Parameters<typeof extractUserThemes>[0]): LiteraryMatchResult | null {
  if (store.beliefs.filter((b) => (b as any).userReaction !== "rejected").length < MIN_BELIEFS_FOR_LITERARY_MATCH) return null;
  const themeScores = extractUserThemes(store);
  if (themeScores.length === 0) return null;
  const topThemes = themeScores.slice(0, 3);
  const weightOf = (theme: string) => topThemes.find((t) => t.theme === theme)?.score ?? 0;

  let best: LiteraryPassage | null = null;
  let bestScore = -1;
  for (const passage of LITERARY_PASSAGES) {
    const overlapScore = passage.themes.reduce((sum, t) => sum + weightOf(t), 0);
    if (overlapScore > bestScore || (overlapScore === bestScore && best && passage.id < best.id)) {
      best = passage;
      bestScore = overlapScore;
    }
  }
  if (!best || bestScore <= 0) return null;
  return { passage: best, themes: topThemes.map((t) => t.theme), topThemeScores: topThemes };
}

// Composed from templates, not free-generated text — deterministic, and
// grounded in the actual themes that won (see selectLiteraryPassage) rather
// than an LLM improvising an explanation. Takes just the theme names (what
// StoredLiteraryMatch persists — see types.ts) rather than the full
// LiteraryMatchResult, so this reads back correctly from a saved store on a
// later visit, not only right after a fresh computation. Hedged language
// throughout per the brief: observation, never diagnosis or certainty.
export function buildWhyThisFoundYou(themes: string[]): string {
  const [first, second] = themes;
  if (!first) return "";
  if (second) {
    return `Your recent thoughts return several times to ${first}, alongside a quieter thread around ${second}. This passage reflects a tension that shows up between the two.`;
  }
  return `You've returned several times to ${first} in what you've written. This passage reflects that pattern back, without settling it.`;
}
