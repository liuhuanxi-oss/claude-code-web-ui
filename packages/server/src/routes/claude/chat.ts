import Router from '@koa/router'
import { ClaudeCli } from '../../services/claude/claude-cli.js'
import { parseStream } from '../../services/claude/stream-parser.js'
import type { ServerConfig } from '../../config.js'

export interface ChatRequest {
  prompt: string
  sessionId?: string
  model?: string
  cwd?: string
  systemPrompt?: string
  maxBudgetUsd?: number
  resume?: boolean
}

export function createChatRouter(config: ServerConfig): Router {
  const router = new Router({ prefix: '/api/claude' })
  const cli = new ClaudeCli(config.claudeBinPath)

  // SSE streaming chat
  router.post('/chat', async (ctx) => {
    const req = ctx.request.body as ChatRequest

    if (!req.prompt?.trim()) {
      ctx.status = 400
      ctx.body = { error: 'prompt is required' }
      return
    }

    // Set SSE headers
    ctx.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    ctx.status = 200
    ctx.flushHeaders()

    const proc = cli.spawnStream({
      prompt: req.prompt,
      sessionId: req.resume ? req.sessionId : undefined,
      model: req.model,
      cwd: req.cwd,
      systemPrompt: req.systemPrompt,
      maxBudgetUsd: req.maxBudgetUsd,
    })

    // Handle client disconnect
    let closed = false
    ctx.req.on('close', () => {
      closed = true
      proc.kill('SIGTERM')
    })

    parseStream(proc, (evt) => {
      if (closed) return
      try {
        ctx.res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`)
      } catch {
        closed = true
      }
    }, (err) => {
      if (closed) return
      ctx.res.write(`event: run.failed\ndata: ${JSON.stringify({ error: err.message })}\n\n`)
    })

    await new Promise<void>((resolve) => {
      proc.on('close', () => {
        if (!closed) {
          ctx.res.end()
        }
        resolve()
      })
    })
  })

  // Check Claude CLI availability
  router.get('/status', async (ctx) => {
    const available = await cli.isAvailable()
    ctx.body = { available, binPath: config.claudeBinPath }
  })

  // Non-streaming chat (for jobs etc.)
  router.post('/chat/sync', async (ctx) => {
    const req = ctx.request.body as ChatRequest

    if (!req.prompt?.trim()) {
      ctx.status = 400
      ctx.body = { error: 'prompt is required' }
      return
    }

    try {
      const result = await cli.runOnce({
        prompt: req.prompt,
        sessionId: req.sessionId,
        model: req.model,
        cwd: req.cwd,
        systemPrompt: req.systemPrompt,
        maxBudgetUsd: req.maxBudgetUsd,
      })
      ctx.body = result
    } catch (err: any) {
      ctx.status = 500
      ctx.body = { error: err.message }
    }
  })

  return router
}
