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
            const { text, priorBeliefs, priorAssumptions } = JSON.parse(raw || '{}')
            if (!text || typeof text !== 'string' || !text.trim()) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: '분석할 텍스트가 없습니다.' }))
              return
            }

            const hasHistory = Array.isArray(priorBeliefs) && priorBeliefs.length > 0
            const historyBlock = hasHistory
              ? `이 사람에 대해 지금까지 누적된 신념/가정입니다:

기존 신념: ${JSON.stringify(priorBeliefs ?? [])}
기존 가정: ${JSON.stringify(priorAssumptions ?? [])}
`
              : `이 사람에 대한 기존 기록은 아직 없습니다. 이번이 첫 기록입니다.
`

            const prompt = `당신은 사람들이 스스로의 사고 패턴을 발견하도록 돕는 조용한 관찰자입니다. 조언하거나 위로하지 않습니다.

${historyBlock}
아래는 이 사람이 방금 정리하지 않고 자유롭게 적은 새 생각입니다. 사건이 아니라 그 뒤에 깔린 사고방식(신념, 자동적인 해석 습관)을 분석해서, 기존 목록에 통합한 "갱신된 전체 목록"을 만드세요. 갱신 규칙:
- 새 텍스트가 기존 신념 중 하나와 본질적으로 같은 믿음을 다시 보여준다면: 그 신념을 새로 추가하지 말고, 같은 문장을 유지한 채 confidence를 5~15 사이로 올리고 evidenceCount를 1 늘리세요.
- 기존 목록에 없는 진짜 새로운 신념이 드러난다면: confidence 40~60, evidenceCount 1로 새 항목을 추가하세요.
- assumptions도 동일한 방식(반복이면 count만 +1, 새로운 것이면 count 1로 추가)으로 갱신하세요.
- 최종 beliefs는 confidence 높은 순으로 최대 5개, assumptions는 최대 4개까지만 남기세요.
- changeNote: 이번에 무엇이 달라졌는지 한 문장 (예: "'완벽해야 시작할 수 있다'는 신념이 이번이 3번째로 확인됐어요." 또는 "새로운 신념이 발견됐어요: ..."). 기존 기록이 없던 첫 기록이면 null로 두세요.

아래 JSON 스키마와 정확히 동일한 구조로만 응답하세요. 설명, 코드블록, 그 외 텍스트 없이 JSON 객체 하나만 출력하세요.

{
  "beliefs": [ { "domain": "한 단어 영역, 예: 커리어/관계/돈/일/자기인식", "statement": "신념 자체를 말하는 문장 (있었던 일의 요약이 아닐 것)", "confidence": 정수 0-100, "evidenceCount": 정수 } ],
  "assumptions": [ { "trigger": "이 가정이 발동되는 상황을 짧게, 예: 불확실함이 나타날 때", "interpretation": "자동으로 하게 되는 해석 한 문장", "count": 정수 } ],
  "reflection": "이 사람에게 되돌려줄 한두 문장. 결론을 내리지 말고, '이게 도움이 되고 있나요, 아니면 제한하고 있나요' 같은 톤의 질문으로 끝날 것.",
  "changeNote": "string 또는 null"
}

새 텍스트가 너무 짧거나 근거가 부족하면 beliefs/assumptions는 기존 목록을 그대로 반환하세요 (강제로 새 항목을 만들지 마세요).

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
