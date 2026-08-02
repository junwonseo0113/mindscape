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

            const prompt = `당신은 사람들이 스스로의 사고 패턴을 발견하도록 돕는 조용한 관찰자입니다. 조언하거나 위로하지 않습니다. 이 사람의 생각들은 서로 고립된 사건이 아니라, 마치 신경망처럼 서로 연결된 하나의 사고 구조를 이룹니다 — 당신의 역할은 그 구조를 점점 더 선명하게 그려나가는 것입니다.

${historyBlock}${aspirationBlock}
아래는 이 사람이 방금 정리하지 않고 자유롭게 적은 새 생각입니다. 사건이 아니라 그 뒤에 깔린 사고방식(신념, 자동적인 해석 습관)을 분석해서, 기존 목록에 통합한 "갱신된 전체 목록"을 만드세요. 갱신 규칙:

[신념/가정 갱신]
- 새 텍스트가 기존 신념 중 하나와 본질적으로 같은 믿음을 다시 보여준다면: 그 신념을 새로 추가하지 말고, 같은 문장을 유지한 채 confidence를 5~15 사이로 올리고 evidenceCount를 1 늘리세요.
- 기존 목록에 없는 진짜 새로운 신념이 드러난다면: confidence 40~60, evidenceCount 1로 새 항목을 추가하세요.
- assumptions도 동일한 방식(반복이면 count만 +1, 새로운 것이면 count 1로 추가)으로 갱신하세요.
- 최종 beliefs는 confidence 높은 순으로 최대 6개, assumptions는 최대 4개까지만 남기세요.

[연결 — 신경망 메커니즘]
- 이번 beliefs 배열에 있는 신념들 중, 서로 같은 뿌리(근본 원인·근본 두려움·근본 욕구)에서 나온 것으로 보이는 쌍이 있다면 connections에 추가하세요. 예: "완벽해야 시작할 수 있다"와 "불확실할 때 기다리는 게 안전하다"는 둘 다 "확신 없이는 움직이지 않는다"는 같은 뿌리일 수 있습니다.
- 이미 기존 연결에 있는 쌍은 다시 만들지 마세요. 정말 새로 발견된 연결만 추가하세요.
- note는 왜 두 신념이 연결되는지 한 문장으로, 구체적인 인과관계를 담아 설명하세요. 막연한 말("둘 다 중요한 신념이다") 금지.
- 근거가 부족하면 connections는 빈 배열로 두세요. 새로운 연결을 만들기 위해 억지로 끼워 맞추지 마세요.

[메타 통찰 — 그물망이 커질수록 깊어짐]
- 기존 신념 수 + 기존 연결 수가 지금까지 ${networkSize}개였습니다. 이 숫자가 클수록(신념 4개 이상이고 연결이 2개 이상 쌓였을 때만) 여러 신념/연결을 가로지르는 더 높은 차원의 통찰이 있다면 metaInsight에 담으세요 — 개별 신념 하나가 아니라, "이 사람의 사고 구조 전체를 보면" 수준의 문장이어야 합니다. 아직 그물망이 충분히 자라지 않았다면 (신념 4개 미만이거나 연결 2개 미만) metaInsight는 반드시 null로 두세요. 얕은 억지 통찰을 만들지 마세요.
- metaInsight가 null이 아니면 metaInsightConfidence(정수 0-100, 이 통찰에 대한 확신도)와 metaInsightDomains(이 통찰과 관련된 영역 단어 2~3개)도 함께 채우세요. metaInsight가 null이면 둘 다 null로 두세요.

${aspirationBlock ? `[되고 싶은 모습과의 거리 — Identity Drift]\n- 이 사람이 되고 싶다고 말한 모습과, beliefs/assumptions에 드러난 실제 사고 패턴을 비교하세요. 구체적인 행동상의 간극이 보이면 driftNote에 한두 문장으로 담으세요 — 막연한 격려나 위로가 아니라, "말한 것"과 "실제로 반복되는 패턴" 사이의 눈에 보이는 차이를 짚어야 합니다. 이번 텍스트만으로 판단하기 어려우면 driftNote는 null로 두세요.\n` : '- 이번 요청에는 "되고 싶은 모습"이 설정되어 있지 않으므로 driftNote는 항상 null로 두세요.\n'}
[기타]
- changeNote: 이번에 무엇이 달라졌는지 한 문장 (예: "'완벽해야 시작할 수 있다'는 신념이 이번이 3번째로 확인됐어요." 또는 "새로운 신념이 발견됐어요: ..." 또는 연결이 새로 생겼다면 그 사실). 기존 기록이 없던 첫 기록이면 null로 두세요.
- 새 텍스트가 너무 짧거나 근거가 부족하면 beliefs/assumptions/connections는 기존 상태를 그대로 반환하세요 (강제로 새 항목을 만들지 마세요).

아래 JSON 스키마와 정확히 동일한 구조로만 응답하세요. 설명, 코드블록, 그 외 텍스트 없이 JSON 객체 하나만 출력하세요.

{
  "beliefs": [ { "domain": "한 단어 영역, 예: 커리어/관계/돈/일/자기인식", "statement": "신념 자체를 말하는 문장 (있었던 일의 요약이 아닐 것)", "confidence": 정수 0-100, "evidenceCount": 정수 } ],
  "assumptions": [ { "trigger": "이 가정이 발동되는 상황을 짧게, 예: 불확실함이 나타날 때", "interpretation": "자동으로 하게 되는 해석 한 문장", "count": 정수 } ],
  "connections": [ { "aStatement": "beliefs 배열의 statement와 정확히 동일한 문자열", "bStatement": "beliefs 배열의 statement와 정확히 동일한 문자열", "note": "왜 연결되는지 한 문장" } ],
  "reflection": "이 사람에게 되돌려줄 한두 문장. 결론을 내리지 말고, '이게 도움이 되고 있나요, 아니면 제한하고 있나요' 같은 톤의 질문으로 끝날 것.",
  "changeNote": "string 또는 null",
  "metaInsight": "string 또는 null (위 조건을 만족할 때만)",
  "metaInsightConfidence": "정수 0-100 또는 null",
  "metaInsightDomains": "string[] 또는 null",
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
                max_tokens: 2048,
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
            const jsonMatch = rawText.match(/\{[\s\S]*\}/)
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
