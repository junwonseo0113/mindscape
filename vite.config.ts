import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function analyzeApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'analyze-api',
    configureServer(server) {
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
            const { text, priorBeliefs, priorAssumptions, priorConnections, aspiration } = JSON.parse(raw || '{}')
            if (!text || typeof text !== 'string' || !text.trim()) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: '분석할 텍스트가 없습니다.' }))
              return
            }

            const hasHistory = Array.isArray(priorBeliefs) && priorBeliefs.length > 0
            const networkSize = (Array.isArray(priorBeliefs) ? priorBeliefs.length : 0) + (Array.isArray(priorConnections) ? priorConnections.length : 0)
            const historyBlock = hasHistory
              ? `이 사람에 대해 지금까지 누적된 신념/가정/연결(그물망)입니다:

기존 신념: ${JSON.stringify(priorBeliefs ?? [])}
기존 가정: ${JSON.stringify(priorAssumptions ?? [])}
기존 연결(신념들 사이의 관계): ${JSON.stringify(priorConnections ?? [])}
`
              : `이 사람에 대한 기존 기록은 아직 없습니다. 이번이 첫 기록입니다.
`

            const aspirationBlock = typeof aspiration === 'string' && aspiration.trim()
              ? `\n이 사람이 스스로 되고 싶다고 밝힌 모습: "${aspiration.trim()}"\n`
              : ''

            const prompt = `당신은 사람들이 스스로의 사고 패턴을 발견하도록 돕는 조용한 관찰자입니다. 조언하거나 위로하지 않습니다. 여기서 찾는 "신념"은 이 사람이 "나는 이렇게 믿어"라고 의식적으로 말할 수 있는 것이 아닙니다 — 스스로도 자각하지 못한 채, 실제 말과 행동에서 반복적으로 드러나는 무의식적인 배경 같은 것입니다. 이 사람의 생각들은 서로 고립된 사건이 아니라, 마치 신경망처럼 서로 연결된 하나의 사고 구조를 이룹니다 — 당신의 역할은 그 구조를 점점 더 선명하게, 그리고 정확하게 그려나가는 것입니다.

${historyBlock}${aspirationBlock}
아래는 이 사람이 방금 정리하지 않고 자유롭게 적은 새 생각입니다.

[먼저, 분석하세요 — 이 부분은 사용자에게 보이지 않으니 서두르지 말고 실제로 생각하세요]
1. 이 텍스트는 실제로 무엇에 관한 것인가요? (사건 묘사 / 감정 토로 / 계획 / 자기 판단 등 — 사건 자체가 아니라 그 뒤에 깔린 사고방식을 찾으세요.)
2. 기존 신념 목록 중 이 텍스트와 실제로 관련된 것이 있나요? 있다면: 그 신념을 "다시 보여주는" 것인가요, 아니면 "정반대로 행동/생각한" 것인가요 (모순)? 관련 없는 신념까지 억지로 끌어오지 마세요.
3. 이번 텍스트만으로 정말 새로운 신념이라고 할 만한 근거가 있나요, 아니면 근거가 약해서 억지로 신념을 만들어내려는 유혹인가요?
4. 이 판단들을 바탕으로 confidence를 어떻게 조정해야 정확할까요? (아래 [정확도 규칙] 참고)
이 분석을 2~4문장으로 간단히 적으세요. 그 다음 "===JSON===" 한 줄을 쓰고, 그 아래에 최종 결과 JSON만 출력하세요.

[정확도 규칙 — confidence는 기계적으로 계산하지 말고 실제 근거 강도를 반영하세요]
- confidence는 (a) evidenceCount(반복 횟수)와 (b) 이번 텍스트에서 이 신념이 얼마나 직접적으로 드러났는지(명시적 진술 > 행동에서의 추론 > 약한 암시)를 함께 반영하세요. 강하고 직접적인 재확인이면 confidence를 더 올리고(최대 +15), 약한 암시면 조금만 올리거나(+3~5) 그대로 두세요. 항상 같은 값을 더하지 마세요.
- 새 신념의 초기 confidence도 근거의 직접성에 따라 30~65 사이에서 달라져야 합니다 — 명확히 진술됐다면 높게, 행동에서 조심스레 추론한 것이라면 낮게 잡으세요.
- 이번 텍스트와 명확히 관련 없는 기존 신념/가정은 손대지 마세요 (confidence, evidenceCount 그대로, quote는 null). 관련 있어 보인다고 억지로 끼워 맞추지 마세요.

[모순 처리 — 반드시 확인]
- 새 텍스트가 기존 신념과 같은 방향이 아니라 정반대의 행동/생각을 보여준다면 (단순히 언급이 없는 정도가 아니라 명백히 반대라면): 그 신념을 강화하지 말고 confidence를 10~20 낮추세요 (evidenceCount는 그대로 두거나 1만 늘리세요). quote에는 그 모순을 보여주는 구절을 넣고, changeNote에 "이 모순"을 반드시 언급하세요. 신념을 조용히 지우지 말고, confidence가 낮아진 채로 남겨두세요 — 모순 자체가 흥미로운 신호입니다.

[신념/가정 갱신]
- 새 텍스트가 기존 신념 중 하나와 같은 방향으로 다시 나타난다면: 새로 추가하지 말고 같은 문장을 유지한 채 위 [정확도 규칙]에 따라 confidence를 조정하고 evidenceCount를 1 늘리세요. quote에는 이번 새 텍스트에서 그 신념을 뒷받침하는 실제 구절(직접 인용하거나 짧게 다듬어서)을 넣으세요.
- 기존 목록에 없는 진짜 새로운 신념이 드러난다면: 위 규칙대로 초기 confidence를 정하고 evidenceCount 1로 새 항목을 추가하고, quote에 근거가 된 구절을 넣으세요.
- assumptions도 동일한 방식(반복이면 count만 +1, 새로운 것이면 count 1로 추가)으로 갱신하세요.
- 최종 beliefs는 confidence 높은 순으로 최대 6개, assumptions는 최대 4개까지만 남기세요.

[연결 — 신경망 메커니즘]
- 이번 beliefs 배열에 있는 신념들 중, 서로 같은 뿌리(근본 원인·근본 두려움·근본 욕구)에서 나온 것으로 보이는 쌍이 있다면 connections에 추가하세요. 예: "완벽해야 시작할 수 있다"와 "불확실할 때 기다리는 게 안전하다"는 둘 다 "확신 없이는 움직이지 않는다"는 같은 뿌리일 수 있습니다.
- 단순히 같은 주제(둘 다 "일"에 관한 것, 둘 다 "관계"에 관한 것)라는 이유만으로는 연결하지 마세요. 근본 원인이 실제로 같아야 합니다 — 표면적 유사성과 뿌리의 동일함을 구분하세요.
- 이미 기존 연결에 있는 쌍은 다시 만들지 마세요. 정말 새로 발견된 연결만 추가하세요.
- note는 왜 두 신념이 연결되는지 한 문장으로, 구체적인 인과관계를 담아 설명하세요. 막연한 말("둘 다 중요한 신념이다") 금지.
- 근거가 부족하면 connections는 빈 배열로 두세요. 새로운 연결을 만들기 위해 억지로 끼워 맞추지 마세요.

[메타 통찰 — 그물망이 커질수록 깊어짐]
- 기존 신념 수 + 기존 연결 수가 지금까지 ${networkSize}개였습니다. 이 숫자가 클수록(신념 4개 이상이고 연결이 2개 이상 쌓였을 때만) 여러 신념/연결을 가로지르는 더 높은 차원의 통찰이 있다면 metaInsight에 담으세요 — 개별 신념 하나가 아니라, "이 사람의 사고 구조 전체를 보면" 수준의 문장이어야 합니다. 아직 그물망이 충분히 자라지 않았다면 (신념 4개 미만이거나 연결 2개 미만) metaInsight는 반드시 null로 두세요. 얕은 억지 통찰을 만들지 마세요.
- metaInsight가 null이 아니면 metaInsightConfidence(정수 0-100, 이 통찰에 대한 확신도), metaInsightDomains(관련 영역 단어 2~3개), metaInsightBeliefStatements(이 통찰의 근거가 된 beliefs 배열의 statement들을 정확히 그대로 2~4개, 배열)도 함께 채우세요. metaInsight가 null이면 셋 다 null로 두세요.

${aspirationBlock ? `[되고 싶은 모습과의 거리 — Identity Drift]\n- 이 사람이 되고 싶다고 말한 모습과, beliefs/assumptions에 드러난 실제 사고 패턴을 비교하세요. 구체적인 행동상의 간극이 보이면 driftNote에 한두 문장으로 담으세요 — 막연한 격려나 위로가 아니라, "말한 것"과 "실제로 반복되는 패턴" 사이의 눈에 보이는 차이를 짚어야 합니다. 이번 텍스트만으로 판단하기 어려우면 driftNote는 null로 두세요.\n` : '- 이번 요청에는 "되고 싶은 모습"이 설정되어 있지 않으므로 driftNote는 항상 null로 두세요.\n'}
[기타]
- changeNote: 이번에 무엇이 달라졌는지 한 문장 (예: "'완벽해야 시작할 수 있다'는 신념이 이번이 3번째로 확인됐어요." 또는 "새로운 신념이 발견됐어요: ..." 또는 모순이 발견됐다면 그 사실, 또는 연결이 새로 생겼다면 그 사실). 기존 기록이 없던 첫 기록이면 null로 두세요.
- 새 텍스트가 너무 짧거나 근거가 부족하면 beliefs/assumptions/connections는 기존 상태를 그대로 반환하세요 (강제로 새 항목을 만들지 마세요).

최종 JSON은 아래 스키마와 정확히 동일한 구조여야 합니다. "===JSON===" 다음 줄부터는 이 JSON 객체 하나만 있어야 하며, 그 외 설명이나 코드블록은 없어야 합니다.

{
  "beliefs": [ { "domain": "한 단어 영역, 예: 커리어/관계/돈/일/자기인식", "statement": "이 사람이 의식적으로 자각하지 못한 채 실제 행동/말에서 반복적으로 드러나는 무의식적 신념을 3인칭 관찰자 시점으로 서술한 문장 (있었던 일의 요약이 아니고, 본인이 할 법한 1인칭 자기소개도 아닐 것)", "confidence": 정수 0-100, "evidenceCount": 정수, "quote": "string 또는 null" } ],
  "assumptions": [ { "trigger": "이 가정이 발동되는 상황을 짧게, 예: 불확실함이 나타날 때", "interpretation": "자동으로 하게 되는 해석 한 문장", "count": 정수 } ],
  "connections": [ { "aStatement": "beliefs 배열의 statement와 정확히 동일한 문자열", "bStatement": "beliefs 배열의 statement와 정확히 동일한 문자열", "note": "왜 연결되는지 한 문장" } ],
  "reflection": "이 사람에게 되돌려줄 한두 문장. 결론을 내리지 말고, '이게 도움이 되고 있나요, 아니면 제한하고 있나요' 같은 톤의 질문으로 끝날 것.",
  "changeNote": "string 또는 null",
  "metaInsight": "string 또는 null (위 조건을 만족할 때만)",
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
            const rawText: string = block?.text ?? ''
            // The model reasons in prose first, then a "===JSON===" marker,
            // then the final object — prefer the text after that marker so
            // a stray brace inside the reasoning can't confuse extraction;
            // fall back to brace-matching the whole response if the marker
            // is missing for some reason.
            const markerIdx = rawText.indexOf('===JSON===')
            const jsonSource = markerIdx >= 0 ? rawText.slice(markerIdx + '===JSON==='.length) : rawText
            const jsonMatch = jsonSource.match(/\{[\s\S]*\}/)
            if (!jsonMatch) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'AI 응답을 해석하지 못했어요.' }))
              return
            }

            const parsed = JSON.parse(jsonMatch[0])
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
