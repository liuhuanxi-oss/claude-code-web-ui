import Database from 'better-sqlite3'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync } from 'fs'

const DATA_DIR = join(homedir(), '.claude-code-web-ui', 'data')
const DB_PATH = join(DATA_DIR, 'claude-code-web-ui.db')

let db = null

export function getDb() {
  if (db) return db
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_usage (
      session_id TEXT PRIMARY KEY,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost_usd REAL NOT NULL DEFAULT 0,
      model TEXT DEFAULT '',
      cwd TEXT DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_usage (
      date TEXT PRIMARY KEY,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost_usd REAL NOT NULL DEFAULT 0,
      session_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      cron TEXT NOT NULL,
      model TEXT DEFAULT '',
      cwd TEXT DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at INTEGER,
      last_result TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS job_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      result TEXT,
      error TEXT,
      cost_usd REAL,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );
  `)
  return db
}

export function recordSessionUsage(sessionId, usage) {
  const db = getDb()
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)

  const existing = db.prepare('SELECT * FROM session_usage WHERE session_id = ?').get(sessionId)
  if (existing) {
    db.prepare(`
      UPDATE session_usage SET
        input_tokens = input_tokens + ?, output_tokens = output_tokens + ?,
        cache_read_input_tokens = cache_read_input_tokens + ?,
        total_cost_usd = total_cost_usd + ?, updated_at = ?
      WHERE session_id = ?
    `).run(usage.inputTokens || 0, usage.outputTokens || 0, usage.cacheReadInputTokens || 0, usage.totalCostUsd || 0, now, sessionId)
  } else {
    db.prepare(`
      INSERT INTO session_usage (session_id, input_tokens, output_tokens, cache_read_input_tokens, total_cost_usd, model, cwd, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, usage.inputTokens || 0, usage.outputTokens || 0, usage.cacheReadInputTokens || 0, usage.totalCostUsd || 0, usage.model || '', usage.cwd || '', now, now)
  }

  // Update daily usage
  const daily = db.prepare('SELECT * FROM daily_usage WHERE date = ?').get(today)
  if (daily) {
    db.prepare(`
      UPDATE daily_usage SET
        input_tokens = input_tokens + ?, output_tokens = output_tokens + ?,
        total_cost_usd = total_cost_usd + ?, session_count = session_count + 1
      WHERE date = ?
    `).run(usage.inputTokens || 0, usage.outputTokens || 0, usage.totalCostUsd || 0, today)
  } else {
    db.prepare(`
      INSERT INTO daily_usage (date, input_tokens, output_tokens, total_cost_usd, session_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(today, usage.inputTokens || 0, usage.outputTokens || 0, usage.totalCostUsd || 0, 1)
  }
}

export function getUsageSummary() {
  const db = getDb()
  const total = db.prepare('SELECT SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens, SUM(total_cost_usd) as totalCostUsd, COUNT(*) as sessionCount FROM session_usage').get()
  return total || { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, sessionCount: 0 }
}

export function getDailyUsage(days = 30) {
  const db = getDb()
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  return db.prepare('SELECT * FROM daily_usage WHERE date >= ? ORDER BY date ASC').all(since)
}

export function getModelUsage() {
  const db = getDb()
  return db.prepare('SELECT model, SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens, SUM(total_cost_usd) as totalCostUsd, COUNT(*) as sessionCount FROM session_usage GROUP BY model').all()
}

// Jobs CRUD
export function listJobs() {
  return getDb().prepare('SELECT * FROM jobs ORDER BY created_at DESC').all()
}

export function createJob(job) {
  const db = getDb()
  const now = Date.now()
  db.prepare('INSERT INTO jobs (id, name, prompt, cron, model, cwd, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(job.id, job.name, job.prompt, job.cron, job.model || '', job.cwd || '', job.enabled ? 1 : 0, now, now)
  return job
}

export function updateJob(id, updates) {
  const db = getDb()
  const fields = []
  const values = []
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'id' || k === 'created_at') continue
    fields.push(`${k} = ?`)
    values.push(v)
  }
  if (fields.length === 0) return
  values.push(Date.now().toString()) // updated_at
  fields.push('updated_at = ?')
  values.push(id)
  db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteJob(id) {
  getDb().prepare('DELETE FROM jobs WHERE id = ?').run(id)
  getDb().prepare('DELETE FROM job_logs WHERE job_id = ?').run(id)
}

export function addJobLog(log) {
  getDb().prepare('INSERT INTO job_logs (job_id, started_at, completed_at, result, error, cost_usd) VALUES (?, ?, ?, ?, ?, ?)')
    .run(log.jobId, log.startedAt, log.completedAt || null, log.result || null, log.error || null, log.costUsd || null)
}

export function getJobLogs(jobId, limit = 50) {
  return getDb().prepare('SELECT * FROM job_logs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?').all(jobId, limit)
}
