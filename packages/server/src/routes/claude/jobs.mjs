import Router from '@koa/router'
import { randomBytes } from 'crypto'
import { spawn } from 'child_process'
import { homedir } from 'os'
import { listJobs, createJob, updateJob, deleteJob, addJobLog, getJobLogs } from '../../db/usage-store.mjs'

const activeCrons = new Map()

export function createJobsRouter(config) {
  const router = new Router({ prefix: '/api/claude/jobs' })

  router.get('/', async (ctx) => {
    ctx.body = { jobs: listJobs() }
  })

  router.post('/', async (ctx) => {
    const { name, prompt, cron, model, cwd, enabled } = ctx.request.body
    if (!name || !prompt || !cron) { ctx.status = 400; ctx.body = { error: 'name, prompt, cron required' }; return }
    const job = { id: randomBytes(8).toString('hex'), name, prompt, cron, model: model || '', cwd: cwd || '', enabled: enabled !== false }
    createJob(job)
    if (job.enabled) scheduleJob(job, config)
    ctx.body = job
  })

  router.put('/:id', async (ctx) => {
    const updates = ctx.request.body
    updateJob(ctx.params.id, updates)
    if (updates.enabled !== undefined || updates.cron) {
      unscheduleJob(ctx.params.id)
      const jobs = listJobs()
      const job = jobs.find(j => j.id === ctx.params.id)
      if (job && job.enabled) scheduleJob(job, config)
    }
    ctx.body = { success: true }
  })

  router.delete('/:id', async (ctx) => {
    unscheduleJob(ctx.params.id)
    deleteJob(ctx.params.id)
    ctx.body = { success: true }
  })

  router.post('/:id/run', async (ctx) => {
    const jobs = listJobs()
    const job = jobs.find(j => j.id === ctx.params.id)
    if (!job) { ctx.status = 404; ctx.body = { error: 'Job not found' }; return }

    const startedAt = Date.now()
    const args = ['--print', '--output-format', 'json']
    if (job.model) args.push('--model', job.model)
    args.push(job.prompt)

    try {
      const result = await new Promise((resolve, reject) => {
        const proc = spawn(config.claudeBinPath, args, { cwd: job.cwd || homedir(), env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] })
        let stdout = '', stderr = ''
        proc.stdout.on('data', d => stdout += d)
        proc.stderr.on('data', d => stderr += d)
        proc.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || `Exit ${code}`)))
        proc.on('error', reject)
      })

      const parsed = JSON.parse(result)
      const log = { jobId: job.id, startedAt, completedAt: Date.now(), result: parsed.result?.slice(0, 500), costUsd: parsed.total_cost_usd }
      addJobLog(log)
      updateJob(job.id, { last_run_at: startedAt, last_result: parsed.result?.slice(0, 200) })
      ctx.body = log
    } catch (err) {
      const log = { jobId: job.id, startedAt, completedAt: Date.now(), error: err.message }
      addJobLog(log)
      ctx.status = 500
      ctx.body = log
    }
  })

  router.get('/:id/logs', async (ctx) => {
    ctx.body = { logs: getJobLogs(ctx.params.id) }
  })

  return router
}

async function scheduleJob(job, config) {
  if (activeCrons.has(job.id)) return
  try {
    const { CronJob } = await import('cron')
    const cj = new CronJob(job.cron, () => {
      // Auto-run the job on schedule
      const startedAt = Date.now()
      const args = ['--print', '--output-format', 'json']
      if (job.model) args.push('--model', job.model)
      args.push(job.prompt)
      const proc = spawn(config.claudeBinPath, args, { cwd: job.cwd || homedir(), env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      proc.stdout.on('data', d => stdout += d)
      proc.on('close', () => {
        try {
          const parsed = JSON.parse(stdout)
          addJobLog({ jobId: job.id, startedAt, completedAt: Date.now(), result: parsed.result?.slice(0, 500), costUsd: parsed.total_cost_usd })
          updateJob(job.id, { last_run_at: startedAt, last_result: parsed.result?.slice(0, 200) })
        } catch {
          addJobLog({ jobId: job.id, startedAt, completedAt: Date.now(), error: 'Parse error' })
        }
      })
    })
    cj.start()
    activeCrons.set(job.id, cj)
  } catch (e) {
    console.error(`Failed to schedule job ${job.id}:`, e.message)
  }
}

function unscheduleJob(id) {
  const cj = activeCrons.get(id)
  if (cj) { cj.stop(); activeCrons.delete(id) }
}
