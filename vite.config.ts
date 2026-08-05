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
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY가 설정되어 있지 않아요. 프로젝트 루트에 .env 파일을 만들고 키를 넣은 뒤 서버를 다시 시작하세요.' }))
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
              res.end(JSON.stringify({ error: '재해석할 대상이 없습니다.' }))
              return
            }
            const quotes: string[] = Array.isArray(evidenceQuotes) ? evidenceQuotes.filter((q: any) => typeof q === 'string') : []
            const rejected: string[] = Array.isArray(rejectedTexts) ? rejectedTexts.filter((t: any) => typeof t === 'string') : []

            const prompt = `당신은 CBT(인지행동치료)와 ACT(수용전념치료)의 개념을 참고한 자기성찰 도구입니다. 사용자가 다음 해석에 동의하지 않았습니다.

방금 거부된 해석: "${currentText}"
${rejected.length > 0 ? `이전에 이미 거부된 해석들 (절대 반복하지 마세요): ${JSON.stringify(rejected)}` : ""}

이 해석의 근거가 된 실제 기록:
${quotes.length > 0 ? quotes.map((q) => `- "${q}"`).join("\n") : "(근거 기록 없음)"}

[규칙]
- 같은 근거를 놓고, 방금 거부된 해석 및 이전에 거부된 모든 해석과 실질적으로 다른 해석이 있다면 제시하세요. 단어만 바꾼 재탕, 같은 의미를 다르게 표현한 것은 안 됩니다 — 근본적으로 다른 관점이어야 합니다.
- 억지로 새 해석을 지어내지 마세요. 근거에서 정말로 나올 수 있는, 의미 있게 다른 해석이 더 이상 없다면 exhausted를 true로 하고 interpretation/confidence는 null로 두세요.
- 진단하거나 결론을 내리지 마세요. "~인 것 같습니다" 같은 조심스러운 어조를 유지하세요. 3인칭 관찰자 시점으로 서술하세요 (사용자가 스스로 말할 법한 1인칭 문장이 아닐 것).

"===JSON===" 한 줄을 쓰고, 그 아래에 최종 결과 JSON만 출력하세요. 그 외 설명이나 코드블록은 없어야 합니다.

{
  "interpretation": "string 또는 null (exhausted가 true면 null)",
  "confidence": "정수 30-65 또는 null (exhausted가 true면 null)",
  "exhausted": "boolean",
  "note": "사용자에게 보여줄 한 문장 — 왜 이 해석이 이전과 다른지, 또는 exhausted라면 왜 더 없는지"
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
              res.end(JSON.stringify({ error: `AI 호출에 실패했어요 (${apiRes.status}): ${errText.slice(0, 300)}` }))
              return
            }

            const data: any = await apiRes.json()
            const block = data.content?.find((c: any) => c.type === 'text')
            const parsed = extractJsonAfterMarker(block?.text ?? '')
            if (!parsed) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'AI 응답을 해석하지 못했어요.' }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(parsed))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err?.message ?? '알 수 없는 오류가 발생했어요.' }))
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
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY가 설정되어 있지 않아요. 프로젝트 루트에 .env 파일을 만들고 키를 넣은 뒤 서버를 다시 시작하세요.' }))
          return
        }

        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', async () => {
          try {
            const { text, matchableBeliefs, matchablePending, priorAssumptions, priorConnections, aspiration } = JSON.parse(raw || '{}')
            if (!text || typeof text !== 'string' || !text.trim()) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: '분석할 텍스트가 없습니다.' }))
              return
            }

            const beliefList = Array.isArray(matchableBeliefs) ? matchableBeliefs : []
            const pendingList = Array.isArray(matchablePending) ? matchablePending : []
            const hasHistory = beliefList.length > 0 || pendingList.length > 0
            const networkSize = beliefList.length + (Array.isArray(priorConnections) ? priorConnections.length : 0)
            const historyBlock = hasHistory
              ? `이 사람에 대해 지금까지 확인된(증거 기준을 이미 통과한) 패턴과, 아직 근거가 부족해 지켜보는 중인 후보 패턴입니다. 후보(pending)는 아직 신념이 아닙니다 — 절대 신념처럼 취급하지 마세요.

확인된 패턴 (matchableBeliefs, 각 항목의 id를 그대로 사용하세요): ${JSON.stringify(beliefList)}
아직 근거가 부족한 후보 (matchablePending, 각 항목의 id를 그대로 사용하세요): ${JSON.stringify(pendingList)}
기존 반복되는 자동 해석: ${JSON.stringify(priorAssumptions ?? [])}
기존 연결(패턴들 사이의 관계): ${JSON.stringify(priorConnections ?? [])}
`
              : `이 사람에 대한 기존 기록은 아직 없습니다. 이번이 첫 기록입니다.
`

            const aspirationBlock = typeof aspiration === 'string' && aspiration.trim()
              ? `\n이 사람이 스스로 되고 싶다고 밝힌 모습: "${aspiration.trim()}"\n`
              : ''

            const prompt = `당신은 CBT(인지행동치료)와 ACT(수용전념치료)의 개념을 참고해 사람들이 스스로의 사고 패턴을 관찰하도록 돕는 자기성찰 도구입니다. 이것은 치료나 진단이 아닙니다 — 조언하거나 결론을 내리지 마세요.

[이 도구의 원칙 — 반드시 지키세요]
- 관찰(observation)과 해석(interpretation)과 가설(hypothesis)을 항상 분리하세요. 관찰은 있는 그대로, 해석은 가능성으로, 가설은 "아직 확정되지 않은 것"으로 다루세요.
- 가설을 사실처럼 서술하지 마세요. "~인 것 같습니다", "이런 가능성이 있습니다", "현재 기록에서는", "아직 근거가 충분하지 않습니다" 같은 중립적이고 조심스러운 표현을 쓰세요.
- 이번 한 번의 기록만으로 핵심 신념을 단정하지 마세요. 새로운 패턴처럼 보여도 그것이 "이미 반복되는 패턴"이라고 말하지 말고, 그저 이번 기록에서 관찰된 하나의 신호로만 다루세요 — 실제로 신념이 되려면 최소 3번의 유사한 기록이 필요하며, 그 판단은 당신이 아니라 시스템이 근거 개수로 자동 결정합니다.
- 정신 질환을 진단하지 마세요. 트라우마, 애착 유형, 성격장애, 억압, 원형(archetype), 무의식적 동기를 추론하지 마세요. 이 사람이 왜 이렇게 됐는지에 대한 서사를 만들지 마세요 — 지금 드러난 것만 조심스럽게 관찰하세요.
- 스키마 치료 개념(아래 [참고용 장기 패턴 분류])은 오직 이미 확인된(matchableBeliefs에 있는, 즉 이미 3번 이상 근거가 쌓인) 패턴에 대해서만, 그것도 부가적인 참고 태그로만 사용하세요. 이번이 처음 발견된 패턴이거나 아직 근거가 부족한 후보라면 절대 사용하지 마세요.

[인지 패턴 목록 — possibleCognitivePatterns는 이 목록에서만 고르세요, 해당 없으면 빈 배열]
흑백사고, 과잉일반화, 재앙화, 개인화, 감정적 추론, 당위적 사고, 정신적 여과, 성급한 결론, 긍정 축소

[가치 영역 예시 — relatedValues, 참고용이며 자유롭게 다른 표현도 가능]
관계, 일/커리어, 건강, 성장/배움, 자율성, 안정감, 여가, 공동체, 자기표현

[참고용 장기 패턴 분류 — 위 원칙에서 설명한 대로 이미 확인된 패턴에만, 그것도 선택적으로만]
결핍/유기, 불신/상처, 실패에 대한 예민함, 복종/맞춤, 엄격한 기준, 고립/단절

${historyBlock}${aspirationBlock}
아래는 이 사람이 방금 정리하지 않고 자유롭게 적은 새 생각입니다.

[먼저, 분석하세요 — 이 부분은 사용자에게 보이지 않으니 서두르지 말고 실제로 생각하세요]
1. 이 텍스트에서 상황(situation)과 그 상황에서의 자동적 사고(automaticThought)를 분리해서 보면 무엇인가요?
2. 어떤 감정이, 어느 정도 강도로 함께 있나요? 그 순간 하고 싶었던/실제로 한 행동(actionUrge)은 무엇인가요?
3. 위 [인지 패턴 목록] 중 실제로 해당하는 것이 있나요? 억지로 끼워 맞추지 마세요 — 없으면 빈 배열이 맞습니다.
4. 이 행동/생각은 이 사람이 중요하게 여길 만한 가치를 향해 가는 것(toward)인가요, 그 가치로부터 멀어지는 것(away)인가요, 아니면 판단하기 어려운가요(unclear)?
5. matchableBeliefs와 matchablePending 목록을 보세요 — 이번 텍스트가 그중 하나와 의미상 같은 패턴을 보여주나요? 표면적 주제가 아니라 실제 의미로 판단하세요. 같다면: 그 패턴을 다시 보여주는 것(supports)인가요, 정반대로 행동/생각한 것(contradicts)인가요? 관련 없는 항목까지 억지로 끌어오지 마세요.
6. 일치하는 것이 없다면, 이번 텍스트만으로 새로운 후보 패턴이라고 조심스럽게 말할 수 있나요? (이건 신념 선언이 아니라 그저 하나의 관찰 후보입니다.)
이 분석을 2~4문장으로 간단히 적으세요. 그 다음 "===JSON===" 한 줄을 쓰고, 그 아래에 최종 결과 JSON만 출력하세요.

[매칭 및 근거 표기 규칙]
- 매칭되는 항목을 찾았다면 hypothesisCandidate.matchedCandidateId에 그 항목의 id를 정확히 그대로, matchedCandidateKind에 "belief" 또는 "pending"을 넣으세요. 없다면 둘 다 null.
- directness(0.0~1.0)는 이번 텍스트가 그 패턴을 얼마나 직접적으로 보여주는지입니다 — 명시적 진술이면 1에 가깝게, 행동에서 조심스레 추론한 약한 암시면 0에 가깝게. confidence 수치 자체는 당신이 계산하지 않습니다 (시스템이 근거 개수와 directness로 계산합니다) — 당신은 관찰과 방향(relation)과 직접성(directness)만 정확히 판단하면 됩니다.
- 이번 텍스트와 명확히 관련 없는 기존 항목은 손대지 마세요. 관련 있어 보인다고 억지로 끼워 맞추지 마세요.
- 패턴이라 할 만한 것이 이번 텍스트에 전혀 없다면 hypothesisCandidate.candidateBelief를 빈 문자열 ""로 두세요.

[신념/자동 해석 갱신 — assumptions]
- assumptions는 이 사람이 특정 상황(trigger)에서 자동으로 하게 되는 해석(interpretation)입니다. 기존 목록과 같은 trigger/interpretation이 다시 나타나면 count만 1 늘리고, 새로운 것이면 count 1로 추가하세요. 최대 4개까지만 남기세요.

[연결 — 패턴들 사이의 관계]
- matchableBeliefs 중 서로 같은 뿌리(근본 원인·근본 두려움·근본 욕구)에서 나온 것으로 보이는 쌍이 있다면 connections에 추가하세요. 단순히 같은 주제라는 이유만으로는 연결하지 마세요 — 근본 원인이 실제로 같아야 합니다.
- 이미 기존 연결에 있는 쌍은 다시 만들지 마세요. note는 왜 연결되는지 한 문장으로, 막연한 말 없이 구체적으로.
- 근거가 부족하면 connections는 빈 배열로 두세요.

[메타 통찰 — 패턴이 쌓일수록 깊어짐]
- 확인된 패턴 수 + 기존 연결 수가 지금까지 ${networkSize}개였습니다. 확인된 패턴이 4개 이상이고 연결이 2개 이상일 때만, 여러 패턴을 가로지르는 더 높은 차원의 관찰이 있다면 metaInsight에 담으세요 — 반드시 "이런 가능성이 있습니다" 톤을 유지하세요. 조건을 만족하지 않으면 metaInsight는 반드시 null로 두세요.
- metaInsight가 null이 아니면 metaInsightConfidence(정수 0-100), metaInsightDomains(관련 영역 단어 2~3개), metaInsightBeliefStatements(근거가 된 matchableBeliefs의 statement를 정확히 그대로 2~4개)도 함께 채우세요. null이면 셋 다 null.

${aspirationBlock ? `[되고 싶은 모습과의 거리 — Identity Drift]\n- 이 사람이 되고 싶다고 말한 모습과, 확인된 패턴에 드러난 실제 경향을 비교하세요. 구체적인 행동상의 간극이 보이면 driftNote에 한두 문장으로, "말한 것"과 "실제로 반복되는 패턴" 사이의 눈에 보이는 차이만 조심스럽게 짚으세요. 판단하기 어려우면 null.\n` : '- 이번 요청에는 "되고 싶은 모습"이 설정되어 있지 않으므로 driftNote는 항상 null로 두세요.\n'}
[기타]
- changeNote: 이번에 무엇이 관찰됐는지 한 문장 (예: "기존 패턴과 일치하는 기록이 한 번 더 확인됐어요." 또는 "새로운 후보가 관찰됐어요." 또는 모순/연결이 발견됐다면 그 사실). 기존 기록이 없던 첫 기록이면 null.

최종 JSON은 아래 스키마와 정확히 동일한 구조여야 합니다. "===JSON===" 다음 줄부터는 이 JSON 객체 하나만 있어야 하며, 그 외 설명이나 코드블록은 없어야 합니다.

{
  "observation": {
    "situation": "3인칭 관찰자 시점, 한 문장",
    "automaticThought": "원문에 최대한 가깝게, 한 문장",
    "emotions": [ { "label": "감정 단어", "intensity": "정수 0-10" } ],
    "actionUrge": "한 문장"
  },
  "interpretation": {
    "possibleCognitivePatterns": ["위 [인지 패턴 목록]에서만 선택한 문자열 배열, 해당 없으면 빈 배열"],
    "valueDirection": { "relatedValues": ["문자열 배열"], "towardOrAway": "toward | away | unclear", "explanation": "한 문장, 관찰 톤" }
  },
  "hypothesisCandidate": {
    "matchedCandidateId": "string 또는 null",
    "matchedCandidateKind": "belief | pending | null",
    "relation": "supports | contradicts",
    "candidateBelief": "3인칭 관찰자 시점, 조심스러운 가정형 어조의 문장. 패턴이 없으면 빈 문자열",
    "domain": "한 단어 영역",
    "directness": "0.0-1.0",
    "reasoningSummary": "2~4문장, 위 [중립적 표현] 중 하나 이상 포함",
    "schemaDomainLabelSuggestion": "matchedCandidateKind가 belief일 때만, 위 [참고용 장기 패턴 분류] 중 하나 또는 null"
  },
  "assumptions": [ { "trigger": "짧게", "interpretation": "한 문장", "count": "정수" } ],
  "connections": [ { "aStatement": "matchableBeliefs의 statement와 정확히 동일", "bStatement": "matchableBeliefs의 statement와 정확히 동일", "note": "한 문장" } ],
  "reflection": "이 사람에게 되돌려줄 한두 문장. 결론을 내리지 말고 질문 톤으로 끝날 것.",
  "changeNote": "string 또는 null",
  "metaInsight": "string 또는 null",
  "metaInsightConfidence": "정수 0-100 또는 null",
  "metaInsightDomains": "string[] 또는 null",
  "metaInsightBeliefStatements": "string[] 또는 null",
  "driftNote": "string 또는 null"
}

새 텍스트:
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
              res.end(JSON.stringify({ error: `AI 호출에 실패했어요 (${apiRes.status}): ${errText.slice(0, 300)}` }))
              return
            }

            const data: any = await apiRes.json()
            const block = data.content?.find((c: any) => c.type === 'text')
            const parsed = extractJsonAfterMarker(block?.text ?? '')
            if (!parsed) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'AI 응답을 해석하지 못했어요.' }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(parsed))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err?.message ?? '알 수 없는 오류가 발생했어요.' }))
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
  }
})
