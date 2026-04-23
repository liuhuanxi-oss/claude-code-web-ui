import { spawn, type ChildProcess } from 'child_process'

export interface ClaudeCliOptions {
  prompt: string
  sessionId?: string
  model?: string
  cwd?: string
  systemPrompt?: string
  maxBudgetUsd?: number
  name?: string
  continueSession?: boolean
  includePartialMessages?: boolean
  allowedTools?: string[]
  permissionMode?: string
}

export interface ClaudeResult {
  type: 'result'
  subtype: 'success' | 'error'
  result: string
  session_id: string
  duration_ms: number
  total_cost_usd: number
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens: number
    cache_creation_input_tokens: number
  }
  modelUsage: Record<string, {
    inputTokens: number
    outputTokens: number
    costUSD: number
    contextWindow: number
  }>
}

export class ClaudeCli {
  private binPath: string

  constructor(binPath: string = 'claude') {
    this.binPath = binPath
  }

  spawnStream(opts: ClaudeCliOptions): ChildProcess {
    const args: string[] = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
    ]

    if (opts.includePartialMessages !== false) {
      args.push('--include-partial-messages')
    }

    if (opts.sessionId) {
      args.push('--resume', opts.sessionId)
    }

    if (opts.continueSession) {
      args.push('--continue')
    }

    if (opts.model) {
      args.push('--model', opts.model)
    }

    if (opts.systemPrompt) {
      args.push('--system-prompt', opts.systemPrompt)
    }

    if (opts.maxBudgetUsd !== undefined) {
      args.push('--max-budget-usd', String(opts.maxBudgetUsd))
    }

    if (opts.name) {
      args.push('--name', opts.name)
    }

    if (opts.allowedTools?.length) {
      args.push('--allowedTools', ...opts.allowedTools)
    }

    if (opts.permissionMode) {
      args.push('--permission-mode', opts.permissionMode)
    }

    args.push(opts.prompt)

    const proc = spawn(this.binPath, args, {
      cwd: opts.cwd || process.env.HOME,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    return proc
  }

  async runOnce(opts: ClaudeCliOptions): Promise<ClaudeResult> {
    return new Promise((resolve, reject) => {
      const args: string[] = [
        '--print',
        '--output-format', 'json',
      ]

      if (opts.sessionId) {
        args.push('--resume', opts.sessionId)
      }

      if (opts.model) {
        args.push('--model', opts.model)
      }

      if (opts.systemPrompt) {
        args.push('--system-prompt', opts.systemPrompt)
      }

      if (opts.maxBudgetUsd !== undefined) {
        args.push('--max-budget-usd', String(opts.maxBudgetUsd))
      }

      args.push(opts.prompt)

      const proc = spawn(this.binPath, args, {
        cwd: opts.cwd || process.env.HOME,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`))
          return
        }

        try {
          resolve(JSON.parse(stdout) as ClaudeResult)
        } catch (err) {
          reject(new Error(`Failed to parse Claude CLI output: ${stdout.slice(0, 200)}`))
        }
      })

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn Claude CLI: ${err.message}`))
      })
    })
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.binPath, ['--version'], { stdio: 'pipe' })
      proc.on('close', (code) => resolve(code === 0))
      proc.on('error', () => resolve(false))
    })
  }
}
