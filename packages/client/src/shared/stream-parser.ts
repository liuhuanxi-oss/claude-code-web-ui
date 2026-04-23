export interface StreamEvent {
  type: string
  [key: string]: unknown
}

// Type guards for specific event types
export function isTextDelta(evt: StreamEvent): evt is StreamEvent & { type: 'text.delta'; text: string } {
  return evt.type === 'text.delta'
}

export function isThinkingDelta(evt: StreamEvent): evt is StreamEvent & { type: 'thinking.delta'; thinking: string } {
  return evt.type === 'thinking.delta'
}

export function isToolStarted(evt: StreamEvent): evt is StreamEvent & {
  type: 'tool.started'; toolId: string; toolName: string; toolArgs: unknown
} {
  return evt.type === 'tool.started'
}

export function isToolCompleted(evt: StreamEvent): evt is StreamEvent & {
  type: 'tool.completed'; toolId: string; result: string; isError: boolean; toolName?: string
} {
  return evt.type === 'tool.completed'
}

export function isRunCompleted(evt: StreamEvent): evt is StreamEvent & {
  type: 'run.completed'; sessionId: string; totalCostUsd: number; durationMs: number;
  usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number };
  modelUsage: Record<string, { inputTokens: number; outputTokens: number; costUsd: number }>
} {
  return evt.type === 'run.completed'
}

export function isRunFailed(evt: StreamEvent): evt is StreamEvent & { type: 'run.failed'; error: string } {
  return evt.type === 'run.failed'
}

export function isSystemInit(evt: StreamEvent): evt is StreamEvent & {
  type: 'system.init'; sessionId: string; tools: string[]; model: string; cwd: string
} {
  return evt.type === 'system.init'
}
