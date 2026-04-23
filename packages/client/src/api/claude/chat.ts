import type { StreamEvent } from '@/shared/stream-parser'

export interface ChatRequest {
  prompt: string
  sessionId?: string
  model?: string
  cwd?: string
  systemPrompt?: string
  maxBudgetUsd?: number
  resume?: boolean
}

export function streamChat(
  req: ChatRequest,
  onEvent: (evt: StreamEvent) => void,
  onError?: (err: Error) => void,
  signal?: AbortSignal
): void {
  const base = window.location.origin
  const url = new URL('/api/claude/chat', base)
  // Pass token via query for EventSource compatibility
  const token = localStorage.getItem('auth_token')
  if (token) url.searchParams.set('token', token)

  // Use fetch + ReadableStream for SSE (more flexible than EventSource)
  fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
    signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            try {
              const data = JSON.parse(dataStr)
              onEvent({ ...data, type: currentEvent || data.type })
            } catch {
              // skip malformed data
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError?.(err)
      }
    })
}

export async function checkClaudeStatus(): Promise<{ available: boolean; binPath: string }> {
  const res = await fetch('/api/claude/status')
  return res.json()
}

export async function fetchSessions(limit = 100) {
  const res = await fetch(`/api/claude/sessions?limit=${limit}`)
  return res.json()
}

export async function fetchSessionMessages(sessionId: string) {
  const res = await fetch(`/api/claude/sessions/${sessionId}`)
  return res.json()
}

export async function deleteSession(sessionId: string) {
  const res = await fetch(`/api/claude/sessions/${sessionId}`, { method: 'DELETE' })
  return res.json()
}
