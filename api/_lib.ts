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

// ── Abuse limits ──
// These endpoints spend the project's Anthropic credit, and anyone who
// finds the URL can call them. Two cheap guards:
//  · a request body over 64 KB is refused (a diary entry is a few KB);
//  · each caller (by IP) gets RATE_LIMIT requests per RATE_WINDOW_MS.
// The counter lives in this server instance's memory, so it's a speed bump
// against scripts, not an exact quota; for a hard limit put Vercel's
// firewall rate limiting (or a KV-backed counter) in front.
const MAX_BODY_BYTES = 64 * 1024
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 10 * 60 * 1000
const hits = new Map<string, number[]>()

function clientIp(req: any): string {
  const fwd = req.headers?.['x-forwarded-for']
  return (Array.isArray(fwd) ? fwd[0] : typeof fwd === 'string' ? fwd.split(',')[0] : req.socket?.remoteAddress ?? 'unknown').trim()
}

export function rateLimited(req: any, now = Date.now()): boolean {
  const ip = clientIp(req)
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > RATE_WINDOW_MS) hits.delete(k)
  return recent.length > RATE_LIMIT
}

export function withApiRoute(handler: (apiKey: string, body: any, authorization?: string) => Promise<HandlerResult>) {
  return async (req: any, res: any) => {
    if (applyCors(req, res)) return
    if (req.method !== 'POST') {
      res.status(405).end('Method not allowed')
      return
    }
    res.setHeader('Cache-Control', 'no-store')
    if (Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8') > MAX_BODY_BYTES) {
      res.status(413).json({ error: 'This entry is too long to analyze in one go. Try splitting it in two.' })
      return
    }
    if (rateLimited(req)) {
      res.setHeader('Retry-After', String(Math.ceil(RATE_WINDOW_MS / 1000)))
      res.status(429).json({ error: 'Too many requests in a short time. Please wait a few minutes and try again.' })
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
      const { status, json } = await handler(apiKey, req.body ?? {}, req.headers?.authorization)
      res.status(status).json(json)
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'An unknown error occurred.' })
    }
  }
}
