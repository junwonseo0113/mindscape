import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Extracts the "===JSON===" marker convention shared by both endpoints —
// the model reasons in prose first, then the marker, then the final
// object; reading from after the marker (falling back to brace-matching
// the whole response if it's ever missing) means a stray brace inside the
// reasoning text can't confuse extraction.
function extractJsonAfterMarker(rawText: string): any | null {
  const markerIdx = rawText.indexOf('===JSON===')
  const jsonSource = markerIdx >= 0 ? rawText.slice(markerIdx + '===JSON==='.length) : rawText
  const jsonMatch = jsonSource.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  return JSON.parse(jsonMatch[0])
}

function analyzeApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'analyze-api',
    configureServer(server) {
      // Powers the "disagree -> give me a genuinely different reading of
      // the same evidence" loop: takes the interpretation the user just
      // rejected plus everything already rejected before it, and either
      // returns a real alternative or explicitly says there isn't one
      // (exhausted) instead of inventing a cosmetic rewording.
      server.middlewares.use('/api/reinterpret', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        const apiKey = env.ANTHROPIC_API_KEY
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set. Create a .env file in the project root with your key, then restart the server.' }))
          return
        }

        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', async () => {
          try {
            const { currentText, evidenceQuotes, rejectedTexts } = JSON.parse(raw || '{}')
            if (!currentText || typeof currentText !== 'string' || !currentText.trim()) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'There is nothing to reinterpret.' }))
              return
            }
            const quotes: string[] = Array.isArray(evidenceQuotes) ? evidenceQuotes.filter((q: any) => typeof q === 'string') : []
            const rejected: string[] = Array.isArray(rejectedTexts) ? rejectedTexts.filter((t: any) => typeof t === 'string') : []

            const prompt = `You are a self-reflection tool that draws on CBT (cognitive behavioral therapy) and ACT (acceptance and commitment therapy) concepts. The user disagreed with the following interpretation.

Interpretation just rejected: "${currentText}"
${rejected.length > 0 ? `Interpretations already rejected before this one (never repeat these): ${JSON.stringify(rejected)}` : ""}

The actual entries this interpretation was based on:
${quotes.length > 0 ? quotes.map((q) => `- "${q}"`).join("\n") : "(no supporting entries)"}

[Rules]
- Looking at the same evidence, offer an interpretation that is genuinely different from the one just rejected AND from every interpretation rejected before it. A reworded restatement of the same idea doesn't count — it needs to be a fundamentally different angle.
- Do not force a new interpretation into existence. If there is truly no more meaningfully different reading the evidence can support, set exhausted to true and leave interpretation/confidence as null.
- Do not diagnose or draw conclusions. Keep a tentative tone ("it seems like," "this may suggest"). Write from a third-person observer's point of view (not a first-person sentence the user would say about themselves).

Write one line reading "===JSON===", then output only the final JSON below it. No other explanation or code block.

{
  "interpretation": "string or null (null if exhausted is true)",
  "confidence": "integer 30-65 or null (null if exhausted is true)",
  "exhausted": "boolean",
  "note": "one sentence to show the user — why this interpretation differs from the earlier ones, or why there isn't a further one if exhausted"
}`

            const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-5',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
              }),
            })

            if (!apiRes.ok) {
              const errText = await apiRes.text()
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: `The AI call failed (${apiRes.status}): ${errText.slice(0, 300)}` }))
              return
            }

            const data: any = await apiRes.json()
            const block = data.content?.find((c: any) => c.type === 'text')
            const parsed = extractJsonAfterMarker(block?.text ?? '')
            if (!parsed) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: "Couldn't parse the AI response." }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(parsed))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err?.message ?? 'An unknown error occurred.' }))
          }
        })
      })

      server.middlewares.use('/api/analyze', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        const apiKey = env.ANTHROPIC_API_KEY
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set. Create a .env file in the project root with your key, then restart the server.' }))
          return
        }

        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', async () => {
          try {
            const { text, matchableBeliefs, matchablePending, priorAssumptions, priorConnections, aspiration, name } = JSON.parse(raw || '{}')
            if (!text || typeof text !== 'string' || !text.trim()) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'There is no text to analyze.' }))
              return
            }

            const beliefList = Array.isArray(matchableBeliefs) ? matchableBeliefs : []
            const pendingList = Array.isArray(matchablePending) ? matchablePending : []
            const hasHistory = beliefList.length > 0 || pendingList.length > 0
            const networkSize = beliefList.length + (Array.isArray(priorConnections) ? priorConnections.length : 0)
            const historyBlock = hasHistory
              ? `These are the patterns already confirmed for this person (already past the evidence bar) and the candidate patterns still being watched because there isn't enough evidence yet. Pending candidates are NOT beliefs yet — never treat them as one.

Confirmed patterns (matchableBeliefs — reuse each item's id exactly as given): ${JSON.stringify(beliefList)}
Candidates still short on evidence (matchablePending — reuse each item's id exactly as given): ${JSON.stringify(pendingList)}
Existing recurring automatic interpretations: ${JSON.stringify(priorAssumptions ?? [])}
Existing connections (relationships between patterns): ${JSON.stringify(priorConnections ?? [])}
`
              : `There is no existing record for this person yet. This is their first entry.
`

            const aspirationBlock = typeof aspiration === 'string' && aspiration.trim()
              ? `\nWhat this person has said, in their own words, they want to become: "${aspiration.trim()}"\n`
              : ''

            const addressTerm = typeof name === 'string' && name.trim() ? name.trim() : 'you'

            const prompt = `You are a self-reflection tool that draws on CBT (cognitive behavioral therapy) and ACT (acceptance and commitment therapy) concepts to help people observe their own thought patterns. This is not therapy or diagnosis — never give advice or draw conclusions.

[Principles of this tool — follow these strictly]
- Always keep observation, interpretation, and hypothesis separate. Treat observation as plain fact, interpretation as a possibility, and hypothesis as "not yet settled."
- Never state a hypothesis as fact. Use neutral, tentative language like "it seems like," "this may suggest," "based on what's been recorded so far," "there isn't enough evidence yet."
- Never declare a core belief from a single entry. Even if something looks like a new pattern, don't call it "an already-recurring pattern" — treat it only as one signal observed in this entry. Becoming an actual belief requires at least 3 similar entries, and that call is made automatically by the system counting evidence, never by you.
- Never diagnose a mental health condition. Don't infer trauma, attachment style, personality disorder, repression, archetypes, or unconscious motives. Don't construct a backstory for why this person turned out this way — observe carefully only what's actually shown right now.
- Only use schema-therapy concepts (the [reference: long-term pattern categories] below) for patterns that are ALREADY confirmed (present in matchableBeliefs, i.e. already backed by 3+ pieces of evidence), and even then only as a secondary reference tag. Never use them for a pattern that's newly spotted or still a low-evidence candidate.

[Cognitive pattern list — possibleCognitivePatterns must only pick from this list; empty array if none apply]
All-or-nothing thinking, Overgeneralization, Catastrophizing, Personalization, Emotional reasoning, Should statements, Mental filtering, Jumping to conclusions, Discounting the positive

[Value domain examples — relatedValues, reference only, other phrasing is fine too]
Relationships, Work/Career, Health, Growth/Learning, Autonomy, Security, Leisure, Community, Self-expression

[Reference: long-term pattern categories — only for already-confirmed patterns, per the principle above, and only when it's genuinely useful]
Deprivation/Abandonment, Mistrust/Hurt, Sensitivity to failure, Subjugation/Compliance, Unrelenting standards, Isolation/Disconnection

${historyBlock}${aspirationBlock}
Below is something this person just said freely, without trying to organize it.

[First, think this through — this part is never shown to the user, so take your time and actually reason]
1. Separated out, what's the situation and the automatic thought (automaticThought) they had in that situation?
2. What emotions are present, and at what intensity? What did they want to do / actually do in that moment (actionUrge)?
3. Does anything in the [cognitive pattern list] above genuinely apply? Don't force a fit — an empty array is the right answer if nothing does.
4. Is this action/thought moving toward a value this person seems to care about, away from it, or is that unclear?
5. Look at the matchableBeliefs and matchablePending lists — does this entry show the same underlying pattern as one of them, in actual meaning rather than surface topic? If so: does it reinforce that pattern (supports), or does it show the opposite in behavior/thought (contradicts)? Don't force in an item that isn't actually related.
6. If nothing matches, can this entry alone cautiously suggest a new candidate pattern? (This is not a belief statement — just one observational candidate.)
Write this analysis in 2-4 short sentences. Then write a line reading "===JSON===", and output only the final result JSON below it.

[Matching and evidence-citing rules]
- If you found a match, put that item's id exactly as given into hypothesisCandidate.matchedCandidateId, and "belief" or "pending" into matchedCandidateKind. Otherwise, both are null.
- directness (0.0-1.0) is how directly this entry shows the pattern — close to 1 for an explicit statement, close to 0 for a weak inference cautiously drawn from behavior. You do not compute the confidence number yourself (the system computes it from evidence count and directness) — you only need to accurately judge the observation, the direction (relation), and directness.
- Leave existing items alone if they're clearly unrelated to this entry. Don't force a fit just because it seems related.
- If nothing pattern-like is present in this entry at all, leave hypothesisCandidate.candidateBelief as an empty string "".

[Updating beliefs/automatic interpretations — assumptions]
- assumptions are the automatic interpretation this person makes in a specific situation (trigger). If the same trigger/interpretation as an existing item appears again, just increment its count by 1; if it's new, add it with count 1. Keep at most 4.

[Connections — relationships between patterns]
- If a pair within matchableBeliefs appears to come from the same root (the same underlying cause, fear, or need), add a connection with type "root". Don't connect them just because they share a topic — the root cause needs to genuinely be the same.
- If a pair within matchableBeliefs is actually in tension or contradicts itself (e.g. saying A matters while the actual repeated choices point the opposite way), add it with type "contradiction". This isn't a judgment — it's meant only to show, side by side, that "you said this, and you also said that." Don't conclude which one is correct.
- Don't recreate a pair that's already in the existing connections. Write note as one specific sentence about why they connect (root) or what the tension is (contradiction) — no vague language.
- If there isn't enough evidence, leave connections as an empty array.

[Naming the thought — thoughtLabelSuggestion]
- If hypothesisCandidate.candidateBelief is not empty, name that thought with a short noun phrase (e.g. "a perfectionism thought," "a safety-seeking thought," "a self-blame thought"). This isn't a judgment of the person themselves, like "this person is incompetent" — it's a name that puts distance between the person and the thought, treating it as one passing event, like "a thought of inadequacy." Null if candidateBelief is empty.

[Distanced restatement — distancedReframeSuggestion]
- If hypothesisCandidate.candidateBelief is not empty, rewrite that sentence with "${addressTerm}" as the subject instead of first person ("I..."). This is based on distanced self-talk research — simply addressing yourself by name or in the second person creates real emotional distance.
  - The meaning must stay identical to candidateBelief — don't add a new interpretation or advice, just change who's speaking.
  - Keep the same cautious, tentative tone as candidateBelief (e.g. if candidateBelief is "I'm going to fail no matter what," → "${addressTerm} seems to feel like ${addressTerm === 'you' ? 'you are' : `${addressTerm} is`} going to fail no matter what").
  - Null if candidateBelief is empty.

[Meta-insight — deepens as patterns accumulate]
- The number of confirmed patterns plus existing connections is ${networkSize} so far. Only when there are 4+ confirmed patterns AND 2+ connections, and only if there's a genuinely higher-level observation that cuts across multiple patterns, put it in metaInsight — always keep the "this may be the case" tone. If the condition isn't met, metaInsight must be null.
- If metaInsight is not null, also fill in metaInsightConfidence (integer 0-100), metaInsightDomains (2-3 related domain words), metaInsightBeliefStatements (2-4 statements from matchableBeliefs that support this, copied exactly), and metaInsightThoughtLabel (a short noun phrase for this whole insight, same style as [Naming the thought] above). If null, all four are null.

${aspirationBlock ? `[Distance from who they want to be — Identity Drift]\n- Compare what this person has said they want to become with the actual tendency shown in their confirmed patterns. If there's a concrete behavioral gap, note it in driftNote in one or two sentences, carefully pointing out only the visible difference between "what they said" and "the pattern that actually keeps repeating." Null if it's hard to tell.\n` : '- No "who they want to become" has been set for this request, so driftNote must always be null.\n'}
[Other]
- changeNote: one sentence on what was observed this time (e.g. "An entry matching an existing pattern was confirmed again," or "A new candidate was observed," or the fact that a contradiction/connection was found). Null if this is the very first entry with no prior record.

The final JSON must match the schema below exactly. Starting from the line after "===JSON===", there must be nothing but this one JSON object — no other explanation or code block.

{
  "observation": {
    "situation": "third-person observer's point of view, one sentence",
    "automaticThought": "as close to the original wording as possible, one sentence",
    "emotions": [ { "label": "emotion word", "intensity": "integer 0-10" } ],
    "actionUrge": "one sentence"
  },
  "interpretation": {
    "possibleCognitivePatterns": ["array of strings chosen only from the [cognitive pattern list] above, empty array if none apply"],
    "valueDirection": { "relatedValues": ["array of strings"], "towardOrAway": "toward | away | unclear", "explanation": "one sentence, observational tone" }
  },
  "hypothesisCandidate": {
    "matchedCandidateId": "string or null",
    "matchedCandidateKind": "belief | pending | null",
    "relation": "supports | contradicts",
    "candidateBelief": "third-person observer's point of view, cautious/tentative tone. Empty string if no pattern",
    "domain": "one-word domain",
    "directness": "0.0-1.0",
    "reasoningSummary": "2-4 sentences, including at least one of the [neutral phrasing] examples above",
    "schemaDomainLabelSuggestion": "only when matchedCandidateKind is belief, one of the [reference: long-term pattern categories] above, or null",
    "thoughtLabelSuggestion": "a short noun phrase in the [Naming the thought] style, null if candidateBelief is empty",
    "distancedReframeSuggestion": "one sentence rewritten in the [Distanced restatement] style, null if candidateBelief is empty"
  },
  "assumptions": [ { "trigger": "short", "interpretation": "one sentence", "count": "integer" } ],
  "connections": [ { "aStatement": "exactly matches a statement from matchableBeliefs", "bStatement": "exactly matches a statement from matchableBeliefs", "type": "root | contradiction", "note": "one sentence" } ],
  "reflection": "one or two sentences to hand back to this person. Don't draw a conclusion — end on a question-like tone.",
  "changeNote": "string or null",
  "metaInsight": "string or null",
  "metaInsightConfidence": "integer 0-100 or null",
  "metaInsightDomains": "string[] or null",
  "metaInsightBeliefStatements": "string[] or null",
  "metaInsightThoughtLabel": "string or null",
  "driftNote": "string or null"
}

New entry:
"""
${text.trim()}
"""`

            const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-5',
                max_tokens: 3072,
                messages: [{ role: 'user', content: prompt }],
              }),
            })

            if (!apiRes.ok) {
              const errText = await apiRes.text()
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: `The AI call failed (${apiRes.status}): ${errText.slice(0, 300)}` }))
              return
            }

            const data: any = await apiRes.json()
            const block = data.content?.find((c: any) => c.type === 'text')
            const parsed = extractJsonAfterMarker(block?.text ?? '')
            if (!parsed) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: "Couldn't parse the AI response." }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(parsed))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err?.message ?? 'An unknown error occurred.' }))
          }
        })
      })

      // Feature 3 — a separate, deliberately narrow call from /api/analyze:
      // pure restatement of what was said, no interpretation/labels (those
      // stay in /api/analyze's own output). Called in parallel with
      // /api/analyze from ScreenProcessing; the caller treats a failure
      // here as "no summary this time," never as a reason to fail the
      // whole session.
      server.middlewares.use('/api/summarize-session', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        const apiKey = env.ANTHROPIC_API_KEY
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set. Create a .env file in the project root with your key, then restart the server.' }))
          return
        }

        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', async () => {
          try {
            const { text } = JSON.parse(raw || '{}')
            if (!text || typeof text !== 'string' || !text.trim()) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'There is no text to summarize.' }))
              return
            }

            const prompt = `In this self-reflection app, your only job is to summarize what the user just said freely. This is not interpretation or diagnosis — it's a "recap," nothing more than reflecting their own words back to them.

[Absolute rules — follow these strictly]
- Only reconstruct what the user actually said. Do not add a new interpretation, advice, or psychological label (like a cognitive-distortion name) — that's already handled by a separate analysis pipeline, so don't duplicate it here.
- Do not diagnose or draw conclusions. No definitive statements like "you are the kind of person who..."
- Do not judge. No good/bad, right/wrong evaluation.
- Keep a first-person observer's tone — write as if speaking directly to the user, in a "you said..." voice.
- Write 3-5 sentences, as one paragraph.

[What the user just said]
"""
${text.trim()}
"""

Write one line reading "===JSON===", then output only the final result JSON below it. No other explanation or code block.

{
  "summary": "a 3-5 sentence summary paragraph"
}`

            const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-5',
                max_tokens: 512,
                messages: [{ role: 'user', content: prompt }],
              }),
            })

            if (!apiRes.ok) {
              const errText = await apiRes.text()
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: `The AI call failed (${apiRes.status}): ${errText.slice(0, 300)}` }))
              return
            }

            const data: any = await apiRes.json()
            const block = data.content?.find((c: any) => c.type === 'text')
            const parsed = extractJsonAfterMarker(block?.text ?? '')
            if (!parsed || typeof parsed.summary !== 'string') {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: "Couldn't parse the AI response." }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ summary: parsed.summary }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err?.message ?? 'An unknown error occurred.' }))
          }
        })
      })
      // Feature 4 — the Home screen's "Where you might be headed" widget.
      // Takes the recurring unconscious beliefs the Brain Map has already
      // surfaced (domain + statement + evidence count only — no raw entry
      // text, same minimal-payload spirit as /api/reinterpret) and infers a
      // few forward-looking growth directions. Called only when the belief
      // set has changed since the last computation (see App.tsx's
      // HomeGoalsWidget) — not on every Home visit.
      server.middlewares.use('/api/infer-goals', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        const apiKey = env.ANTHROPIC_API_KEY
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set. Create a .env file in the project root with your key, then restart the server.' }))
          return
        }

        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', async () => {
          try {
            const { beliefs } = JSON.parse(raw || '{}')
            const list: { domain: string; statement: string; evidenceCount: number }[] = Array.isArray(beliefs)
              ? beliefs
                  .filter((b: any) => b && typeof b.domain === 'string' && typeof b.statement === 'string')
                  .map((b: any) => ({ domain: b.domain, statement: b.statement, evidenceCount: typeof b.evidenceCount === 'number' ? b.evidenceCount : 0 }))
              : []
            if (list.length === 0) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'No beliefs to work from.' }))
              return
            }

            const prompt = `You are a self-reflection tool that draws on CBT (cognitive behavioral therapy) and ACT (acceptance and commitment therapy) concepts. Below are a user's recurring unconscious beliefs, each inferred from patterns across many things they've written over time.

[Recurring unconscious beliefs]
${list.map((b) => `- (${b.domain}, seen in ${b.evidenceCount} entries) "${b.statement}"`).join("\n")}

[Task]
Infer 2-3 concrete, forward-looking personal growth directions — small, specific things this person could actually notice or try, that would represent movement away from what's limiting in these patterns (not generic self-help advice, and not just restating a belief back to them).

[Rules]
- Ground every goal in at least one of the beliefs above; name which domain(s) it's based on.
- Do not diagnose or draw conclusions about who this person is. No definitive "you are" statements.
- Keep a tentative, second-person-but-gentle tone — an invitation, not an instruction. ("Notice...", "Try...", "Let...") One sentence each.
- Do not repeat the same growth direction twice in different words.

Write one line reading "===JSON===", then output only the final JSON below it. No other explanation or code block.

{
  "goals": [
    { "statement": "one sentence", "basedOnDomains": ["domain from the list above"] }
  ]
}`

            const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-5',
                max_tokens: 512,
                messages: [{ role: 'user', content: prompt }],
              }),
            })

            if (!apiRes.ok) {
              const errText = await apiRes.text()
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: `The AI call failed (${apiRes.status}): ${errText.slice(0, 300)}` }))
              return
            }

            const data: any = await apiRes.json()
            const block = data.content?.find((c: any) => c.type === 'text')
            const parsed = extractJsonAfterMarker(block?.text ?? '')
            const goals = Array.isArray(parsed?.goals)
              ? parsed.goals
                  .filter((g: any) => g && typeof g.statement === 'string')
                  .map((g: any) => ({ statement: g.statement, basedOnDomains: Array.isArray(g.basedOnDomains) ? g.basedOnDomains.filter((d: any) => typeof d === 'string') : [] }))
              : null
            if (!goals || goals.length === 0) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: "Couldn't parse the AI response." }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ goals }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err?.message ?? 'An unknown error occurred.' }))
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), analyzeApiPlugin(env)],
    // Without this, Vite's dev server binds only to whatever `localhost`
    // resolves to on this machine — which turned out to be the IPv6
    // loopback ([::1]) only, not IPv4 (127.0.0.1). Node/curl fall back to
    // IPv6 automatically so `curl localhost:5173` still worked, but a
    // browser that resolves `localhost` to 127.0.0.1 first gets a flat
    // connection refused with nothing on screen. `host: true` binds every
    // interface (both protocols), which is what actually fixed it.
    server: {
      host: true,
    },
  }
})
