import Router from '@koa/router'
import { SessionManager } from '../../services/claude/session-manager.js'

export function createSessionsRouter(): Router {
  const router = new Router({ prefix: '/api/claude/sessions' })
  const sessionManager = new SessionManager()

  router.get('/', async (ctx) => {
    const limit = parseInt(ctx.query.limit as string) || 100
    const sessions = sessionManager.listSessions(limit)
    ctx.body = { sessions }
  })

  router.get('/:id', async (ctx) => {
    const messages = sessionManager.getSessionMessages(ctx.params.id)
    if (messages.length === 0) {
      ctx.status = 404
      ctx.body = { error: 'Session not found' }
      return
    }
    ctx.body = { sessionId: ctx.params.id, messages }
  })

  router.delete('/:id', async (ctx) => {
    sessionManager.deleteSession(ctx.params.id)
    ctx.body = { success: true }
  })

  return router
}
