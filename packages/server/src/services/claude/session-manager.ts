import { readFileSync, existsSync, readdirSync, unlinkSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'

export interface SessionSummary {
  id: string
  title: string
  startedAt: number
  lastActiveAt: number
  model: string
  cwd: string
  messageCount: number
  totalCostUsd: number
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
  model?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  toolCalls?: Array<{
    id: string
    name: string
    args: unknown
    result?: string
    isError?: boolean
  }>
}

export class SessionManager {
  private claudeDir: string
  private historyPath: string

  constructor() {
    this.claudeDir = join(homedir(), '.claude')
    this.historyPath = join(this.claudeDir, 'history.jsonl')
  }

  listSessions(limit = 100): SessionSummary[] {
    if (!existsSync(this.historyPath)) return []

    const content = readFileSync(this.historyPath, 'utf-8')
    const lines = content.split('\n').filter(Boolean)
    const seen = new Set<string>()
    const sessions: SessionSummary[] = []

    // Read in reverse (most recent first)
    for (let i = lines.length - 1; i >= 0 && sessions.length < limit; i--) {
      try {
        const entry = JSON.parse(lines[i])
        const id = entry.sessionId
        if (!id || seen.has(id)) continue
        seen.add(id)

        sessions.push({
          id,
          title: (entry.display || entry.query || '').slice(0, 80) || 'New Session',
          startedAt: entry.timestamp || 0,
          lastActiveAt: entry.timestamp || 0,
          model: entry.model || '',
          cwd: entry.project || '',
          messageCount: 0,
          totalCostUsd: 0,
        })
      } catch {
        // skip malformed lines
      }
    }

    return sessions
  }

  getSessionMessages(sessionId: string): SessionMessage[] {
    const sessionFile = this.findSessionFile(sessionId)
    if (!sessionFile || !existsSync(sessionFile)) return []

    const content = readFileSync(sessionFile, 'utf-8')
    const lines = content.split('\n').filter(Boolean)
    const messages: SessionMessage[] = []

    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        if (obj.type === 'user' && obj.message?.content) {
          const textContent = obj.message.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('')
          if (textContent) {
            messages.push({ role: 'user', content: textContent })
          }
        } else if (obj.type === 'assistant' && obj.message?.content) {
          const textContent = obj.message.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('')
          const toolCalls = obj.message.content
            .filter((b: any) => b.type === 'tool_use')
            .map((b: any) => ({ id: b.id, name: b.name, args: b.input }))

          if (textContent || toolCalls.length) {
            messages.push({
              role: 'assistant',
              content: textContent,
              model: obj.message.model,
              usage: obj.message.usage ? {
                inputTokens: obj.message.usage.input_tokens || 0,
                outputTokens: obj.message.usage.output_tokens || 0,
              } : undefined,
              toolCalls,
            })
          }
        }
      } catch {
        // skip
      }
    }

    return messages
  }

  deleteSession(sessionId: string): boolean {
    const sessionFile = this.findSessionFile(sessionId)
    if (sessionFile && existsSync(sessionFile)) {
      unlinkSync(sessionFile)
    }

    // Remove from history.jsonl
    if (existsSync(this.historyPath)) {
      const content = readFileSync(this.historyPath, 'utf-8')
      const lines = content.split('\n').filter(Boolean)
      const filtered = lines.filter((line) => {
        try {
          return JSON.parse(line).sessionId !== sessionId
        } catch {
          return true
        }
      })
      writeFileSync(this.historyPath, filtered.join('\n') + '\n', 'utf-8')
    }

    return true
  }

  private findSessionFile(sessionId: string): string | null {
    const projectsDir = join(this.claudeDir, 'projects')
    if (!existsSync(projectsDir)) return null

    const projectDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)

    for (const projectDir of projectDirs) {
      const candidate = join(projectsDir, projectDir, `${sessionId}.jsonl`)
      if (existsSync(candidate)) return candidate
    }

    return null
  }
}
