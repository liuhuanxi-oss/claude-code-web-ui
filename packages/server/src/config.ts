import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomBytes } from 'crypto'

export const DEFAULT_PORT = 8648
export const DATA_DIR = join(homedir(), '.claude-code-web-ui')
export const DB_PATH = join(DATA_DIR, 'data', 'claude-code-web-ui.db')
export const AUTH_TOKEN_PATH = join(DATA_DIR, '.token')
export const LOG_DIR = join(DATA_DIR, 'logs')

export interface ServerConfig {
  port: number
  authToken: string | null
  authDisabled: boolean
  claudeBinPath: string
  logLevel: string
}

export function loadConfig(): ServerConfig {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
    mkdirSync(join(DATA_DIR, 'data'), { recursive: true })
    mkdirSync(LOG_DIR, { recursive: true })
  }

  let authToken: string | null = null
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
    logLevel: process.env.LOG_LEVEL || 'info',
  }
}
