#!/usr/bin/env node
import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const command = process.argv[2] || 'start'

if (command === 'start') {
  const serverPath = resolve(__dirname, '../packages/server/src/index.mjs')
  const proc = spawn('node', [serverPath, ...process.argv.slice(3)], {
    stdio: 'inherit',
    env: { ...process.env },
  })
  proc.on('exit', (code) => process.exit(code || 0))
  process.on('SIGINT', () => proc.kill('SIGINT'))
  process.on('SIGTERM', () => proc.kill('SIGTERM'))
} else if (command === 'dev') {
  const proc = spawn('npm', ['run', 'dev'], {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
  })
  proc.on('exit', (code) => process.exit(code || 0))
} else if (command === 'build') {
  const proc = spawn('npx', ['vite', 'build'], {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
  })
  proc.on('exit', (code) => process.exit(code || 0))
} else {
  console.log(`
  Claude Code Web UI

  Usage:
    claude-code-web-ui start    Start the server
    claude-code-web-ui dev      Start in development mode
    claude-code-web-ui build    Build the frontend

  Environment:
    PORT          Server port (default: 8648)
    AUTH_TOKEN    Auth token (auto-generated if not set)
    AUTH_DISABLED Set to "1" to disable auth
    CLAUDE_BIN_PATH  Path to claude CLI (default: "claude")
  `)
}
