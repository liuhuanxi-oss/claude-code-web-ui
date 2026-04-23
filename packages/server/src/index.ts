import Koa from 'koa'
import cors from '@koa/cors'
import bodyParser from '@koa/bodyparser'
import { resolve, join } from 'path'
import { existsSync } from 'fs'
import { loadConfig, type ServerConfig, DEFAULT_PORT } from './config.js'
import { requireAuth } from './services/auth.js'
import { createChatRouter } from './routes/claude/chat.js'
import { createSessionsRouter } from './routes/claude/sessions.js'
import { createFilesRouter } from './routes/claude/files.js'
import { createHealthRouter } from './routes/health.js'

export async function startServer(): Promise<void> {
  const config = loadConfig()
  const app = new Koa()

  app.use(cors())
  app.use(bodyParser())
  app.use(requireAuth(config.authToken, config.authDisabled))

  // API routes
  app.use(createHealthRouter().routes())
  app.use(createChatRouter(config).routes())
  app.use(createSessionsRouter().routes())
  app.use(createFilesRouter().routes())

  // Serve static files (built frontend)
  const clientDist = resolve(import.meta.dirname || __dirname, '../../client')
  const rootDist = resolve(import.meta.dirname || __dirname, '../../../dist/client')

  const staticDir = existsSync(clientDist) ? clientDist : rootDist
  if (existsSync(staticDir)) {
    const koaStatic = (await import('koa-static')).default
    app.use(koaStatic(staticDir))

    // SPA fallback
    app.use(async (ctx) => {
      if (!ctx.path.startsWith('/api') && !ctx.path.startsWith('/ws')) {
        ctx.type = 'html'
        ctx.body = await import('fs').then(fs =>
          fs.readFileSync(join(staticDir, 'index.html'), 'utf-8')
        )
      }
    })
  }

  const port = config.port || DEFAULT_PORT
  app.listen(port, () => {
    console.log(`\n  Claude Code Web UI running at http://localhost:${port}`)
    if (config.authToken) {
      console.log(`  Auth token: ${config.authToken}\n`)
    }
  })
}

// Auto-start when run directly
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  startServer().catch(console.error)
}
