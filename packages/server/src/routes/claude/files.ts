import Router from '@koa/router'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync } from 'fs'
import { join, basename, dirname, relative } from 'path'
import { homedir } from 'os'

export function createFilesRouter(): Router {
  const router = new Router({ prefix: '/api/claude/files' })

  // List directory
  router.get('/', async (ctx) => {
    const dirPath = (ctx.query.path as string) || homedir()
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
    } catch (err: any) {
      ctx.status = 400
      ctx.body = { error: err.message }
    }
  })

  // Read file content
  router.get('/content', async (ctx) => {
    const filePath = ctx.query.path as string
    if (!filePath || !existsSync(filePath)) {
      ctx.status = 404
      ctx.body = { error: 'File not found' }
      return
    }
    try {
      const content = readFileSync(filePath, 'utf-8')
      ctx.body = { path: filePath, content }
    } catch (err: any) {
      ctx.status = 400
      ctx.body = { error: err.message }
    }
  })

  // Write file content
  router.put('/content', async (ctx) => {
    const { path: filePath, content } = ctx.request.body as { path: string; content: string }
    if (!filePath) {
      ctx.status = 400
      ctx.body = { error: 'path is required' }
      return
    }
    try {
      const dir = dirname(filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, content, 'utf-8')
      ctx.body = { success: true }
    } catch (err: any) {
      ctx.status = 400
      ctx.body = { error: err.message }
    }
  })

  // Create directory
  router.post('/mkdir', async (ctx) => {
    const { path: dirPath } = ctx.request.body as { path: string }
    if (!dirPath) {
      ctx.status = 400
      ctx.body = { error: 'path is required' }
      return
    }
    try {
      mkdirSync(dirPath, { recursive: true })
      ctx.body = { success: true }
    } catch (err: any) {
      ctx.status = 400
      ctx.body = { error: err.message }
    }
  })

  // Delete file or directory
  router.delete('/', async (ctx) => {
    const filePath = ctx.query.path as string
    if (!filePath) {
      ctx.status = 400
      ctx.body = { error: 'path is required' }
      return
    }
    try {
      unlinkSync(filePath)
      ctx.body = { success: true }
    } catch (err: any) {
      ctx.status = 400
      ctx.body = { error: err.message }
    }
  })

  return router
}
