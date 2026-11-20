// Files prefixed with `_` under /api are never turned into their own
// endpoint by Vercel — this is shared plumbing for the four sibling
// functions in this folder, not a route.
import type { HandlerResult } from '../src/server/aiHandlers'

// The iOS app (Capacitor) serves its pages from capacitor://localhost, a
// different origin from this API, so the browser engine asks first
// (OPTIONS) and needs these headers back. Only the app's own origins are
// allowed; the website itself is same-origin and doesn't need them.
const APP_ORIGINS = new Set(['capacitor://localhost', 'ionic://localhost', 'http://localhost', 'https://localhost'])

// Returns true when the request was a preflight and has been answered.
export function applyCors(req: any, res: any): boolean {
  const origin = req.headers?.origin
  if (origin && APP_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

export function withApiRoute(handler: (apiKey: string, body: any) => Promise<HandlerResult>) {
  return async (req: any, res: any) => {
    if (applyCors(req, res)) return
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
