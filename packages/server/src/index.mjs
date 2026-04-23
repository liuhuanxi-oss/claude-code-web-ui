import Koa from 'koa'
import cors from '@koa/cors'
import bodyParser from '@koa/bodyparser'
import Router from '@koa/router'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { randomBytes } from 'crypto'
import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { homedir } from 'os'
import { recordSessionUsage } from './db/usage-store.mjs'
import { createUsageRouter } from './routes/claude/usage.mjs'
import { createJobsRouter } from './routes/claude/jobs.mjs'
import { setupTerminalWebSocket } from './routes/claude/terminal.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PORT = 8648
const DATA_DIR = join(homedir(), '.claude-code-web-ui')
const AUTH_TOKEN_PATH = join(DATA_DIR, '.token')

// ─── Config ───
function loadConfig() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
    mkdirSync(join(DATA_DIR, 'data'), { recursive: true })
  }

  let authToken = null
  if (process.env.AUTH_TOKEN) {
    authToken = process.env.AUTH_TOKEN
  } else if (existsSync(AUTH_TOKEN_PATH)) {
    authToken = readFileSync(AUTH_TOKEN_PATH, 'utf-8').trim()
  } else if (process.env.AUTH_DISABLED !== '1') {
    authToken = randomBytes(24).toString('hex')
    writeFileSync(AUTH_TOKEN_PATH, authToken, 'utf-8')
  }

  return {
    port: parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
    authToken,
    authDisabled: process.env.AUTH_DISABLED === '1',
    claudeBinPath: process.env.CLAUDE_BIN_PATH || 'claude',
  }
}

// ─── Auth middleware ───
function requireAuth(authToken, authDisabled) {
  return async (ctx, next) => {
    if (authDisabled || !authToken) return next()
    // Allow static assets and HTML page (frontend handles auth UI)
    if (ctx.path === '/' || ctx.path === '/index.html' || ctx.path.startsWith('/assets/')) return next()
    const auth = ctx.headers.authorization
    if (auth === `Bearer ${authToken}`) return next()
    if (ctx.query.token === authToken) return next()
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
  }
}

// ─── Claude CLI ───
function spawnClaudeStream(opts) {
  const args = ['--print', '--output-format', 'stream-json', '--verbose', '--include-partial-messages']
  if (opts.sessionId) args.push('--resume', opts.sessionId)
  if (opts.model) args.push('--model', opts.model)
  if (opts.systemPrompt) args.push('--system-prompt', opts.systemPrompt)
  if (opts.maxBudgetUsd !== undefined) args.push('--max-budget-usd', String(opts.maxBudgetUsd))
  if (opts.name) args.push('--name', opts.name)
  if (opts.allowedTools?.length) args.push('--allowedTools', ...opts.allowedTools)
  args.push(opts.prompt)

  return spawn(opts.binPath || 'claude', args, {
    cwd: opts.cwd || homedir(),
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ─── Stream parser ───
function parseStream(proc, onEvent, onError) {
  const rl = createInterface({ input: proc.stdout })
  rl.on('line', (line) => {
    if (!line.trim()) return
    let obj
    try { obj = JSON.parse(line) } catch { return }

    try {
      if (obj.type === 'system') {
        if (obj.subtype === 'init') {
          onEvent({ type: 'system.init', sessionId: obj.session_id, tools: obj.tools, model: obj.model, cwd: obj.cwd })
        } else if (obj.subtype === 'status') {
          onEvent({ type: 'status', status: obj.status })
        }
      } else if (obj.type === 'stream_event') {
        const evt = obj.event
        if (!evt) return
        if (evt.type === 'content_block_delta') {
          const delta = evt.delta
          if (delta?.type === 'text_delta' && delta.text) {
            onEvent({ type: 'text.delta', text: delta.text })
          } else if (delta?.type === 'thinking_delta' && delta.thinking) {
            onEvent({ type: 'thinking.delta', thinking: delta.thinking })
          }
        }
      } else if (obj.type === 'assistant') {
        const msg = obj.message
        if (msg?.content) {
          const toolUses = msg.content.filter(b => b.type === 'tool_use')
          for (const block of toolUses) {
            onEvent({ type: 'tool.started', toolId: block.id, toolName: block.name, toolArgs: block.input })
          }
          const textBlocks = msg.content.filter(b => b.type === 'text')
          const thinkingBlocks = msg.content.filter(b => b.type === 'thinking')
          if (textBlocks.length || thinkingBlocks.length) {
            onEvent({
              type: 'assistant.message',
              content: textBlocks.map(b => b.text).join(''),
              thinking: thinkingBlocks.map(b => b.thinking).join(''),
              model: msg.model,
              stopReason: msg.stop_reason,
              usage: msg.usage,
            })
          }
        }
      } else if (obj.type === 'user') {
        const msg = obj.message
        if (msg?.content) {
          for (const block of msg.content) {
            if (block.type === 'tool_result') {
              onEvent({
                type: 'tool.completed',
                toolId: block.tool_use_id,
                result: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
                isError: !!block.is_error,
              })
            }
          }
        }
        if (obj.tool_use_result) {
          const tur = obj.tool_use_result
          onEvent({
            type: 'tool.completed',
            toolId: obj.sourceToolAssistantUUID || '',
            toolName: tur.type || '',
            result: tur.content || tur.stdout || '',
            filePath: tur.filePath,
            isError: false,
          })
        }
      } else if (obj.type === 'result') {
        if (obj.subtype === 'success') {
          onEvent({
            type: 'run.completed',
            sessionId: obj.session_id,
            result: obj.result,
            totalCostUsd: obj.total_cost_usd,
            durationMs: obj.duration_ms,
            numTurns: obj.num_turns,
            usage: {
              inputTokens: obj.usage?.input_tokens || 0,
              outputTokens: obj.usage?.output_tokens || 0,
              cacheReadInputTokens: obj.usage?.cache_read_input_tokens || 0,
            },
            modelUsage: obj.modelUsage,
          })
        } else {
          onEvent({ type: 'run.failed', error: obj.api_error_status || obj.result || 'Unknown error', sessionId: obj.session_id })
        }
      }
    } catch (err) { onError?.(err) }
  })
}

// ─── Session manager ───
function listSessions(limit = 100) {
  const historyPath = join(homedir(), '.claude', 'history.jsonl')
  if (!existsSync(historyPath)) return []
  const content = readFileSync(historyPath, 'utf-8')
  const lines = content.split('\n').filter(Boolean)
  const seen = new Set()
  const sessions = []
  for (let i = lines.length - 1; i >= 0 && sessions.length < limit; i--) {
    try {
      const entry = JSON.parse(lines[i])
      const id = entry.sessionId
      if (!id || seen.has(id)) continue
      seen.add(id)
      sessions.push({
        id,
        title: (entry.display || entry.query || '').slice(0, 80) || 'New Session',
        startedAt: entry.timestamp || 0,
        lastActiveAt: entry.timestamp || 0,
        model: entry.model || '',
        cwd: entry.project || '',
        messageCount: 0,
        totalCostUsd: 0,
      })
    } catch { /* skip */ }
  }
  return sessions
}

function findSessionFile(sessionId) {
  const projectsDir = join(homedir(), '.claude', 'projects')
  if (!existsSync(projectsDir)) return null
  const projectDirs = readdirSync(projectsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
  for (const projectDir of projectDirs) {
    const candidate = join(projectsDir, projectDir, `${sessionId}.jsonl`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

function getSessionMessages(sessionId) {
  const sessionFile = findSessionFile(sessionId)
  if (!sessionFile || !existsSync(sessionFile)) return []
  const content = readFileSync(sessionFile, 'utf-8')
  const lines = content.split('\n').filter(Boolean)
  const messages = []
  for (const line of lines) {
    try {
      const obj = JSON.parse(line)
      if (obj.type === 'user' && obj.message?.content) {
        const text = obj.message.content.filter(b => b.type === 'text').map(b => b.text).join('')
        if (text) messages.push({ role: 'user', content: text })
      } else if (obj.type === 'assistant' && obj.message?.content) {
        const text = obj.message.content.filter(b => b.type === 'text').map(b => b.text).join('')
        const toolCalls = obj.message.content.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, args: b.input }))
        if (text || toolCalls.length) {
          messages.push({ role: 'assistant', content: text, model: obj.message.model, toolCalls })
        }
      }
    } catch { /* skip */ }
  }
  return messages
}

// ─── Routes ───
function createHealthRouter() {
  const router = new Router()
  router.get('/health', async (ctx) => { ctx.body = { status: 'ok', timestamp: Date.now() } })
  return router
}

function createChatRouter(config) {
  const router = new Router({ prefix: '/api/claude' })

  router.post('/chat', async (ctx) => {
    const req = ctx.request.body
    if (!req.prompt?.trim()) { ctx.status = 400; ctx.body = { error: 'prompt is required' }; return }

    ctx.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    ctx.status = 200
    ctx.flushHeaders()

    const proc = spawnClaudeStream({
      binPath: config.claudeBinPath,
      prompt: req.prompt,
      sessionId: req.resume ? req.sessionId : undefined,
      model: req.model,
      cwd: req.cwd,
      systemPrompt: req.systemPrompt,
      maxBudgetUsd: req.maxBudgetUsd,
    })

    let closed = false
    ctx.req.on('close', () => { closed = true; proc.kill('SIGTERM') })

    parseStream(proc, (evt) => {
      if (closed) return
      try { ctx.res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`) } catch { closed = true }
      // Record usage on completion
      if (evt.type === 'run.completed' && evt.sessionId) {
        try {
          recordSessionUsage(evt.sessionId, {
            inputTokens: evt.usage?.inputTokens || 0,
            outputTokens: evt.usage?.outputTokens || 0,
            cacheReadInputTokens: evt.usage?.cacheReadInputTokens || 0,
            totalCostUsd: evt.totalCostUsd || 0,
            model: evt.modelUsage ? Object.keys(evt.modelUsage)[0] : '',
            cwd: req.cwd || '',
          })
        } catch (e) { console.error('Failed to record usage:', e.message) }
      }
    }, (err) => {
      if (closed) return
      ctx.res.write(`event: run.failed\ndata: ${JSON.stringify({ error: err.message })}\n\n`)
    })

    await new Promise(resolve => proc.on('close', () => { if (!closed) ctx.res.end(); resolve() }))
  })

  router.get('/status', async (ctx) => {
    const available = await new Promise(resolve => {
      const p = spawn(config.claudeBinPath, ['--version'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
    ctx.body = { available, binPath: config.claudeBinPath }
  })

  return router
}

function createSessionsRouter() {
  const router = new Router({ prefix: '/api/claude/sessions' })

  router.get('/', async (ctx) => {
    const limit = parseInt(ctx.query.limit) || 100
    ctx.body = { sessions: listSessions(limit) }
  })

  router.get('/:id', async (ctx) => {
    const messages = getSessionMessages(ctx.params.id)
    if (!messages.length) { ctx.status = 404; ctx.body = { error: 'Session not found' }; return }
    ctx.body = { sessionId: ctx.params.id, messages }
  })

  router.delete('/:id', async (ctx) => {
    const sessionFile = findSessionFile(ctx.params.id)
    if (sessionFile && existsSync(sessionFile)) unlinkSync(sessionFile)
    const historyPath = join(homedir(), '.claude', 'history.jsonl')
    if (existsSync(historyPath)) {
      const lines = readFileSync(historyPath, 'utf-8').split('\n').filter(Boolean)
      const filtered = lines.filter(line => { try { return JSON.parse(line).sessionId !== ctx.params.id } catch { return true } })
      writeFileSync(historyPath, filtered.join('\n') + '\n', 'utf-8')
    }
    ctx.body = { success: true }
  })

  return router
}

function createFilesRouter() {
  const router = new Router({ prefix: '/api/claude/files' })

  router.get('/', async (ctx) => {
    const dirPath = ctx.query.path || homedir()
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true })
      const files = entries.map(entry => ({
        name: entry.name,
        path: join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        size: entry.isFile() ? statSync(join(dirPath, entry.name)).size : undefined,
        modifiedAt: statSync(join(dirPath, entry.name)).mtimeMs,
      }))
      ctx.body = { path: dirPath, files }
    } catch (err) { ctx.status = 400; ctx.body = { error: err.message } }
  })

  router.get('/content', async (ctx) => {
    const filePath = ctx.query.path
    if (!filePath || !existsSync(filePath)) { ctx.status = 404; ctx.body = { error: 'File not found' }; return }
    try { ctx.body = { path: filePath, content: readFileSync(filePath, 'utf-8') } }
    catch (err) { ctx.status = 400; ctx.body = { error: err.message } }
  })

  router.put('/content', async (ctx) => {
    const { path: filePath, content } = ctx.request.body
    if (!filePath) { ctx.status = 400; ctx.body = { error: 'path is required' }; return }
    try {
      const dir = dirname(filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, content, 'utf-8')
      ctx.body = { success: true }
    } catch (err) { ctx.status = 400; ctx.body = { error: err.message } }
  })

  router.post('/mkdir', async (ctx) => {
    const { path: dirPath } = ctx.request.body
    if (!dirPath) { ctx.status = 400; ctx.body = { error: 'path is required' }; return }
    try { mkdirSync(dirPath, { recursive: true }); ctx.body = { success: true } }
    catch (err) { ctx.status = 400; ctx.body = { error: err.message } }
  })

  return router
}

// ─── Start server ───
async function startServer() {
  const config = loadConfig()
  const app = new Koa()

  app.use(cors())
  app.use(bodyParser())
  app.use(requireAuth(config.authToken, config.authDisabled))

  app.use(createHealthRouter().routes())
  app.use(createChatRouter(config).routes())
  app.use(createSessionsRouter().routes())
  app.use(createFilesRouter().routes())
  app.use(createUsageRouter().routes())
  app.use(createJobsRouter(config).routes())

  // Serve static frontend
  const staticDir = resolve(__dirname, '../../../dist/client')
  if (existsSync(staticDir)) {
    const koaStatic = (await import('koa-static')).default
    app.use(koaStatic(staticDir))
    app.use(async (ctx) => {
      if (!ctx.path.startsWith('/api') && !ctx.path.startsWith('/ws')) {
        ctx.type = 'html'
        ctx.body = readFileSync(join(staticDir, 'index.html'), 'utf-8')
      }
    })
  }

  const port = config.port || DEFAULT_PORT
  const server = app.listen(port, () => {
    console.log(`\n  ✦ Claude Code Web UI running at http://localhost:${port}`)
    if (config.authToken) {
      console.log(`  Auth token: ${config.authToken}\n`)
    }
  })

  // Setup WebSocket terminal
  try { setupTerminalWebSocket(server) } catch (e) { console.log('  (Web terminal disabled - node-pty not available)') }
}

startServer().catch(console.error)
