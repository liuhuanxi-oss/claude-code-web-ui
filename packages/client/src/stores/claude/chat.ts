import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string
  toolCalls?: ToolCallInfo[]
  model?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  timestamp: number
  isStreaming?: boolean
}

export interface ToolCallInfo {
  id: string
  name: string
  args: unknown
  result?: string
  isError?: boolean
  isComplete?: boolean
}

export interface ChatSession {
  id: string
  title: string
  lastActiveAt: number
  model: string
  cwd: string
  messageCount: number
  totalCostUsd: number
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const currentModel = ref<string>('sonnet')
  const currentCwd = ref<string>('')
  const isStreaming = ref(false)
  const streamText = ref('')
  const streamThinking = ref('')
  const activeToolCalls = ref<Map<string, ToolCallInfo>>(new Map())
  const totalCostUsd = ref(0)
  const lastUsage = ref<{ inputTokens: number; outputTokens: number } | null>(null)

  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  )

  function addUserMessage(content: string) {
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    })
  }

  function startAssistantMessage() {
    isStreaming.value = true
    streamText.value = ''
    streamThinking.value = ''
    activeToolCalls.value.clear()

    messages.value.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    })
  }

  function appendStreamText(text: string) {
    streamText.value += text
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg?.role === 'assistant') {
      lastMsg.content = streamText.value
    }
  }

  function appendStreamThinking(thinking: string) {
    streamThinking.value += thinking
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg?.role === 'assistant') {
      lastMsg.thinking = streamThinking.value
    }
  }

  function addToolCall(toolId: string, name: string, args: unknown) {
    const info: ToolCallInfo = { id: toolId, name, args, isComplete: false }
    activeToolCalls.value.set(toolId, info)

    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg?.role === 'assistant') {
      if (!lastMsg.toolCalls) lastMsg.toolCalls = []
      lastMsg.toolCalls.push(info)
    }
  }

  function completeToolCall(toolId: string, result: string, isError: boolean) {
    const info = activeToolCalls.value.get(toolId)
    if (info) {
      info.result = result
      info.isError = isError
      info.isComplete = true
    }

    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg?.toolCalls) {
      const tc = lastMsg.toolCalls.find(t => t.id === toolId)
      if (tc) {
        tc.result = result
        tc.isError = isError
        tc.isComplete = true
      }
    }
  }

  function completeAssistantMessage(data: {
    sessionId?: string
    usage?: { inputTokens: number; outputTokens: number }
    totalCostUsd?: number
    model?: string
  }) {
    isStreaming.value = false
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg?.role === 'assistant') {
      lastMsg.isStreaming = false
      lastMsg.content = streamText.value
      lastMsg.thinking = streamThinking.value || undefined
      lastMsg.usage = data.usage
      lastMsg.model = data.model
    }

    if (data.sessionId) currentSessionId.value = data.sessionId
    if (data.usage) lastUsage.value = data.usage
    if (data.totalCostUsd !== undefined) totalCostUsd.value += data.totalCostUsd
  }

  function failAssistantMessage(error: string) {
    isStreaming.value = false
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg?.role === 'assistant') {
      lastMsg.isStreaming = false
      lastMsg.content = `Error: ${error}`
    }
  }

  function clearMessages() {
    messages.value = []
    currentSessionId.value = null
    streamText.value = ''
    streamThinking.value = ''
    activeToolCalls.value.clear()
  }

  function setSessions(list: ChatSession[]) {
    sessions.value = list
  }

  function loadSessionMessages(sessionMessages: ChatMessage[]) {
    messages.value = sessionMessages
  }

  return {
    messages,
    sessions,
    currentSessionId,
    currentModel,
    currentCwd,
    isStreaming,
    totalCostUsd,
    lastUsage,
    sortedSessions,
    addUserMessage,
    startAssistantMessage,
    appendStreamText,
    appendStreamThinking,
    addToolCall,
    completeToolCall,
    completeAssistantMessage,
    failAssistantMessage,
    clearMessages,
    setSessions,
    loadSessionMessages,
  }
})
