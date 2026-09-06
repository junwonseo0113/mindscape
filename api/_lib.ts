// Files prefixed with `_` under /api are never turned into their own
// endpoint by Vercel — this is shared plumbing for the four sibling
// functions in this folder, not a route.
import type { HandlerResult } from '../src/server/aiHandlers'

export function withApiRoute(handler: (apiKey: string, body: any) => Promise<HandlerResult>) {
  return async (req: any, res: any) => {
    if (req.method !== 'POST') {
      res.status(405).end('Method not allowed')
      return
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set. Add it in the Vercel project’s Environment Variables, then redeploy.' })
      return
    }

    try {
      // Vercel parses a JSON request body into req.body automatically for
      // Node.js functions; req.body is already an object, never a string,
      // when Content-Type is application/json.
      const { status, json } = await handler(apiKey, req.body ?? {})
      res.status(status).json(json)
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'An unknown error occurred.' })
    }
  }
}
