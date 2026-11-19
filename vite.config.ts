import { handleIdealSelf } from "./src/server/idealSelf/service"
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  handleAnalyze,
  handleReinterpret,
  handleSummarizeSession,
  handleInferGoals,
  type HandlerResult,
} from './src/server/aiHandlers'

// Dev-only mirror of the Vercel serverless functions under /api — same
// handler functions, so behavior can't drift between `npm run dev` and
// production. Vite's dev-server middleware hook doesn't exist at all in a
// production `vite build` (it's a static bundle with no server), which is
// exactly why the actual logic lives in src/server/aiHandlers.ts instead
// of here: this file is just the local-dev adapter for it.
function apiRoute(
  env: Record<string, string>,
  handler: (apiKey: string, body: any) => Promise<HandlerResult>
) {
  return async (req: IncomingMessage, res: ServerResponse) => {
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
        const body = JSON.parse(raw || '{}')
        const { status, json } = await handler(apiKey, body)
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(json))
      } catch (err: any) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: err?.message ?? 'An unknown error occurred.' }))
      }
    })
  }
}

function idealSelfApiRoute(env: Record<string, string>) {
  return (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    let raw = ''; let tooLarge = false;
    req.on('data', chunk => { if (tooLarge) return; raw += chunk; if (Buffer.byteLength(raw, 'utf8') > 65536) { tooLarge = true; res.statusCode = 413; res.end(JSON.stringify({code:'input_too_large',error:'This request is too large.'})); } });
    req.on('end', async () => {
      if (tooLarge) return;
      let body: unknown;
      try { body = JSON.parse(raw || '{}'); } catch { res.statusCode = 400; res.end(JSON.stringify({code:'invalid_json',error:'Invalid JSON request.'})); return; }
      const result = await handleIdealSelf({method:req.method,authorization:req.headers.authorization,body}, env);
      res.statusCode = result.status; res.end(JSON.stringify(result.json));
    });
    req.on('error', () => { if (!res.writableEnded) { res.statusCode=400; res.end(JSON.stringify({code:'request_failed',error:'Could not read the request.'})); } });
  };
}

function analyzeApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'analyze-api',
    configureServer(server) {
      server.middlewares.use('/api/ideal-self', idealSelfApiRoute(env))
      server.middlewares.use('/api/reinterpret', apiRoute(env, handleReinterpret))
      server.middlewares.use('/api/analyze', apiRoute(env, handleAnalyze))
      server.middlewares.use('/api/summarize-session', apiRoute(env, handleSummarizeSession))
      server.middlewares.use('/api/infer-goals', apiRoute(env, handleInferGoals))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), analyzeApiPlugin(env)],
    resolve: {
      // shadcn/BKlit UI generated components import via "@/..." — this
      // mirrors the same alias declared in tsconfig.app.json so both the
      // TS compiler and Vite's bundler resolve it the same way.
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
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
