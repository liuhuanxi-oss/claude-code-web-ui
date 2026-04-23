import Router from '@koa/router'
import { getUsageSummary, getDailyUsage, getModelUsage, recordSessionUsage } from '../../db/usage-store.mjs'

export function createUsageRouter() {
  const router = new Router({ prefix: '/api/claude/usage' })

  router.get('/summary', async (ctx) => {
    ctx.body = getUsageSummary()
  })

  router.get('/daily', async (ctx) => {
    const days = parseInt(ctx.query.days) || 30
    ctx.body = { days, data: getDailyUsage(days) }
  })

  router.get('/models', async (ctx) => {
    ctx.body = { models: getModelUsage() }
  })

  router.post('/record', async (ctx) => {
    const { sessionId, usage } = ctx.request.body
    if (!sessionId || !usage) { ctx.status = 400; ctx.body = { error: 'sessionId and usage required' }; return }
    recordSessionUsage(sessionId, usage)
    ctx.body = { success: true }
  })

  return router
}
