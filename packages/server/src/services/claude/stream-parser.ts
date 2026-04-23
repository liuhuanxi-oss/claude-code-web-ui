import { createInterface } from 'readline'
import type { ChildProcess } from 'child_process'

export interface StreamEvent {
  type: 'system.init' | 'status' | 'text.delta' | 'thinking.delta' |
    'tool.started' | 'tool.completed' | 'assistant.message' |
    'user.tool_result' | 'run.completed' | 'run.failed'
  [key: string]: unknown
}

export function parseStream(
  proc: ChildProcess,
  onEvent: (evt: StreamEvent) => void,
  onError?: (err: Error) => void
): void {
  const rl = createInterface({ input: proc.stdout! })

  rl.on('line', (line: string) => {
    if (!line.trim()) return

    let obj: any
    try {
      obj = JSON.parse(line)
    } catch {
      return
    }

    try {
      switch (obj.type) {
        case 'system': {
          if (obj.subtype === 'init') {
            onEvent({
              type: 'system.init',
              sessionId: obj.session_id,
              tools: obj.tools,
              model: obj.model,
              cwd: obj.cwd,
            })
          } else if (obj.subtype === 'status') {
            onEvent({ type: 'status', status: obj.status })
          }
          break
        }

        case 'stream_event': {
          const evt = obj.event
          if (!evt) break

          switch (evt.type) {
            case 'content_block_start': {
              // no-op, track for context
              break
            }
            case 'content_block_delta': {
              const delta = evt.delta
              if (delta?.type === 'text_delta' && delta.text) {
                onEvent({ type: 'text.delta', text: delta.text })
              } else if (delta?.type === 'thinking_delta' && delta.thinking) {
                onEvent({ type: 'thinking.delta', thinking: delta.thinking })
              } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
                // tool input streaming - we'll get full args from assistant message
              }
              break
            }
            case 'content_block_stop': {
              break
            }
            case 'message_delta': {
              break
            }
            case 'message_stop': {
              break
            }
          }
          break
        }

        case 'assistant': {
          const msg = obj.message
          if (msg?.content) {
            const toolUses = msg.content.filter((b: any) => b.type === 'tool_use')
            for (const block of toolUses) {
              onEvent({
                type: 'tool.started',
                toolId: block.id,
                toolName: block.name,
                toolArgs: block.input,
              })
            }

            // Full assistant message for non-streaming fallback
            const textBlocks = msg.content.filter((b: any) => b.type === 'text')
            const thinkingBlocks = msg.content.filter((b: any) => b.type === 'thinking')
            if (textBlocks.length || thinkingBlocks.length) {
              onEvent({
                type: 'assistant.message',
                content: textBlocks.map((b: any) => b.text).join(''),
                thinking: thinkingBlocks.map((b: any) => b.thinking).join(''),
                model: msg.model,
                stopReason: msg.stop_reason,
                usage: msg.usage,
              })
            }
          }
          break
        }

        case 'user': {
          const msg = obj.message
          if (msg?.content) {
            for (const block of msg.content) {
              if (block.type === 'tool_result') {
                onEvent({
                  type: 'tool.completed',
                  toolId: block.tool_use_id,
                  result: typeof block.content === 'string'
                    ? block.content
                    : JSON.stringify(block.content),
                  isError: !!block.is_error,
                })
              }
            }
          }
          // Also check for tool_use_result (richer result format)
          if (obj.tool_use_result) {
            const tur = obj.tool_use_result
            onEvent({
              type: 'tool.completed',
              toolId: obj.sourceToolAssistantUUID || '',
              toolName: tur.type || '',
              result: tur.content || tur.stdout || '',
              filePath: tur.filePath,
              isError: false,
            })
          }
          break
        }

        case 'result': {
          if (obj.subtype === 'success') {
            onEvent({
              type: 'run.completed',
              sessionId: obj.session_id,
              result: obj.result,
              totalCostUsd: obj.total_cost_usd,
              durationMs: obj.duration_ms,
              numTurns: obj.num_turns,
              usage: {
                inputTokens: obj.usage?.input_tokens || 0,
                outputTokens: obj.usage?.output_tokens || 0,
                cacheReadInputTokens: obj.usage?.cache_read_input_tokens || 0,
              },
              modelUsage: obj.modelUsage,
            })
          } else {
            onEvent({
              type: 'run.failed',
              error: obj.api_error_status || obj.result || 'Unknown error',
              sessionId: obj.session_id,
            })
          }
          break
        }
      }
    } catch (err) {
      onError?.(err as Error)
    }
  })

  proc.stderr?.on('data', (data: Buffer) => {
    // CLI stderr - log but don't forward
    const msg = data.toString().trim()
    if (msg && onError) {
      onError(new Error(`CLI stderr: ${msg}`))
    }
  })
}
