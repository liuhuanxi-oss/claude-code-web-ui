import type { Middleware } from 'koa'

export function requireAuth(authToken: string | null, authDisabled: boolean): Middleware {
  return async (ctx, next) => {
    if (authDisabled || !authToken) {
      return next()
    }

    const auth = ctx.headers.authorization
    if (auth === `Bearer ${authToken}`) {
      return next()
    }

    // Also check query param for SSE (EventSource doesn't support headers)
    if (ctx.query.token === authToken) {
      return next()
    }

    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
  }
}
