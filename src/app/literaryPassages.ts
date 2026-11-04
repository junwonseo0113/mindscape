// ── "For where you are now" — Premium's literary-passage feature ───────────
//
// Readings are selected only from verified, eligible curated records.
// All four editorial records currently remain placeholders: they are kept
// for future verification but are never ranked, cached or displayed.
// Matching is specific to the selected discovery and its evidence. A
// content signature preserves stable selections and refreshes changed data.
// The separate opening quote library is not imported here.

import type { Store, StoredBelief, StoredLiteraryMatch, StoredLiterarySelection } from './types';

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

export type LiteraryTarget = {kind:'belief'|'hypothesis';id:string};
export const eligiblePassages = (library: LiteraryPassage[] = LITERARY_PASSAGES) => library.filter(passage => passage.rightsStatus === 'public-domain' || passage.rightsStatus === 'licensed');

function beliefContent(belief: StoredBelief) {
  return {id:belief.id,domain:belief.domain,statement:belief.discoveryInterpretationOverride??belief.statement,thoughtLabel:belief.thoughtLabel,confidence:belief.confidence,status:belief.status,possibleCognitivePatterns:belief.possibleCognitivePatterns,evidence:belief.evidenceQuotes,supporting:belief.supportingEntryIds,contradictory:belief.contradictoryEntryIds};
}

/** Unrelated beliefs affect only the original minimum-data eligibility. */
function discoveryContext(store: Store, target: LiteraryTarget) {
  const hypothesis=target.kind==='hypothesis'?store.hypotheses.find(item=>item.id===target.id):undefined;
  const belief=target.kind==='belief'?store.beliefs.find(item=>item.id===target.id&&item.userReaction!=='rejected'):undefined;
  if(!hypothesis&&!belief)return null;
  const related=belief?[belief]:store.beliefs.filter(item=>hypothesis!.relatedBeliefIds.includes(item.id)&&item.userReaction!=='rejected');
  const entryIds=new Set(related.flatMap(item=>[...(item.supportingEntryIds??[]),...(item.contradictoryEntryIds??[])]));
  const entries=store.history.filter(entry=>entryIds.has(entry.id)).map(entry=>({id:entry.id,date:entry.date,text:entry.text})).sort((a,b)=>a.id.localeCompare(b.id));
  const selected=belief?beliefContent(belief):{id:hypothesis!.id,domain:hypothesis!.domains.join(' '),statement:hypothesis!.title,thoughtLabel:hypothesis!.thoughtLabel,confidence:hypothesis!.confidence,evidence:hypothesis!.evidence,relatedBeliefIds:hypothesis!.relatedBeliefIds,investigate:hypothesis!.investigate};
  const quotes=hypothesis?.evidence?.length?hypothesis.evidence:related.flatMap(item=>item.evidenceQuotes);
  return {selected,related:related.map(beliefContent).sort((a,b)=>a.id.localeCompare(b.id)),entries,quotes,eligible:store.beliefs.filter(item=>item.userReaction!=='rejected').length>=MIN_BELIEFS_FOR_LITERARY_MATCH};
}

export function literarySignature(store: Store, target: LiteraryTarget, library: LiteraryPassage[] = LITERARY_PASSAGES): string {
  return JSON.stringify({version:2,target,context:discoveryContext(store,target),library:eligiblePassages(library).slice().sort((a,b)=>a.id.localeCompare(b.id))});
}

/** Discovery text leads; only its own evidence can add matching signal.
 * Broader unrelated themes cannot force a reading or break a relevance tie. */
export function selectLiteraryPassage(store: Store, target: LiteraryTarget, library: LiteraryPassage[] = LITERARY_PASSAGES): LiteraryMatchResult | null {
  const context=discoveryContext(store,target);
  if(!context?.eligible)return null;
  const selectedScores=extractUserThemes({beliefs:[context.selected]});
  const evidenceText=[...context.quotes.map(quote=>quote.quote),...context.entries.map(entry=>entry.text)].join(' ');
  const evidenceScores=extractUserThemes({beliefs:[{domain:'',statement:evidenceText,confidence:50}]});
  const scores=new Map<string,number>();
  selectedScores.forEach(item=>scores.set(item.theme,item.score*4));
  evidenceScores.forEach(item=>scores.set(item.theme,(scores.get(item.theme)??0)+item.score));
  const themeScores=[...scores].map(([theme,score])=>({theme,score,supportingBeliefIds:context.related.map(item=>item.id)})).sort((a,b)=>b.score-a.score||a.theme.localeCompare(b.theme));
  let best:LiteraryPassage|null=null,bestScore=0;
  for(const passage of eligiblePassages(library)) {
    const score=passage.themes.reduce((sum,theme)=>sum+(scores.get(theme)??0),0);
    if(score>bestScore||(score>0&&score===bestScore&&best&&passage.id<best.id)){best=passage;bestScore=score;}
  }
  if(!best||bestScore<=0)return null;
  const matchedThemes=themeScores.filter(item=>best!.themes.includes(item.theme)).slice(0,3);
  return {passage:best,themes:matchedThemes.map(item=>item.theme),topThemeScores:matchedThemes};
}

export function validLiteraryMatch(value: unknown, library: LiteraryPassage[] = LITERARY_PASSAGES): StoredLiteraryMatch | null {
  if(!value||typeof value!=='object')return null;
  const candidate=value as Partial<StoredLiteraryMatch>;
  if(typeof candidate.passageId!=='string'||!eligiblePassages(library).some(passage=>passage.id===candidate.passageId)||!Array.isArray(candidate.themes)||candidate.themes.some(theme=>typeof theme!=='string')||typeof candidate.selectedDate!=='string')return null;
  return {passageId:candidate.passageId,themes:candidate.themes,selectedDate:candidate.selectedDate};
}

export function sanitizeLiterarySelections(value: unknown): Record<string, StoredLiterarySelection> {
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key,item])=>{
    if(!/^(belief|hypothesis):/.test(key)||!item||typeof item!=='object'||typeof item.signature!=='string')return [];
    const match=validLiteraryMatch(item.match);
    return item.match===null||match?[[key,{signature:item.signature,match}]]:[];
  }));
}

export function resolveLiterarySelection(store: Store, target: LiteraryTarget, selectedDate: string, library: LiteraryPassage[] = LITERARY_PASSAGES) {
  const key=`${target.kind}:${target.id}`,signature=literarySignature(store,target,library),cached=store.literarySelections?.[key];
  const valid=cached?.match===null||!!validLiteraryMatch(cached?.match,library);
  if(cached?.signature===signature&&valid)return {key,selection:cached,needsSave:false};
  const result=selectLiteraryPassage(store,target,library);
  return {key,selection:{signature,match:result?{passageId:result.passage.id,themes:result.themes,selectedDate}:null} satisfies StoredLiterarySelection,needsSave:true};
}

export function buildWhyThisFoundYou(themes: string[]): string {
  if(!themes.length)return '';
  return `This discovery and its supporting material touch on ${themes.join(' and ')}. This reading shares ${themes.length===1?'that theme':'those themes'}; it is an invitation to reflect, not evidence for the interpretation.`;
}
