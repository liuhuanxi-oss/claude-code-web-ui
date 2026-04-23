import Router from '@koa/router'

export function createHealthRouter(): Router {
  const router = new Router()

  router.get('/health', async (ctx) => {
    ctx.body = { status: 'ok', timestamp: Date.now() }
  })

  return router
}
