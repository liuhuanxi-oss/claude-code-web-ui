<template>
  <div class="chat-view">
    <div class="chat-messages" ref="messagesContainer">
      <div v-if="messages.length === 0" class="chat-empty">
        <div class="chat-empty-icon">✦</div>
        <h2>Claude Code Web UI</h2>
        <p>输入消息开始与 Claude Code 对话</p>
      </div>
      <MessageItem
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
      <div v-if="isStreaming && messages.length > 0 && messages[messages.length - 1]?.role !== 'assistant'" class="chat-streaming-indicator">
        <n-spin size="small" /> 思考中...
      </div>
    </div>
    <ChatInput @send="handleSend" :disabled="isStreaming" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useChatStore } from '@/stores/claude/chat'
import { streamChat } from '@/api/claude/chat'
import { isTextDelta, isThinkingDelta, isToolStarted, isToolCompleted, isRunCompleted, isRunFailed, isSystemInit } from '@/shared/stream-parser'
import MessageItem from '@/components/claude/chat/MessageItem.vue'
import ChatInput from '@/components/claude/chat/ChatInput.vue'

const store = useChatStore()
const messages = store.messages
const isStreaming = store.isStreaming
const messagesContainer = ref<HTMLElement | null>(null)
let abortController: AbortController | null = null

function handleSend(prompt: string) {
  store.addUserMessage(prompt)
  store.startAssistantMessage()

  abortController = new AbortController()

  streamChat(
    {
      prompt,
      sessionId: store.currentSessionId || undefined,
      model: store.currentModel,
      cwd: store.currentCwd || undefined,
      resume: !!store.currentSessionId,
    },
    (evt) => {
      if (isTextDelta(evt)) {
        store.appendStreamText(evt.text)
      } else if (isThinkingDelta(evt)) {
        store.appendStreamThinking(evt.thinking)
      } else if (isToolStarted(evt)) {
        store.addToolCall(evt.toolId, evt.toolName, evt.toolArgs)
      } else if (isToolCompleted(evt)) {
        store.completeToolCall(evt.toolId, evt.result, evt.isError)
      } else if (isSystemInit(evt)) {
        if (evt.sessionId) store.currentSessionId = evt.sessionId
        if (evt.cwd) store.currentCwd = evt.cwd
      } else if (isRunCompleted(evt)) {
        store.completeAssistantMessage({
          sessionId: evt.sessionId,
          usage: evt.usage,
          totalCostUsd: evt.totalCostUsd,
          model: evt.modelUsage ? Object.keys(evt.modelUsage)[0] : undefined,
        })
      } else if (isRunFailed(evt)) {
        store.failAssistantMessage(evt.error)
      }
    },
    (err) => {
      store.failAssistantMessage(err.message)
    },
    abortController.signal
  )
}

// Auto-scroll to bottom on new messages
watch(
  () => messages.length,
  async () => {
    await nextTick()
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }
)
</script>

<style lang="scss" scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);

  .chat-empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    color: var(--primary-color);
  }

  h2 {
    margin-bottom: 8px;
    color: var(--text-primary);
  }
}

.chat-streaming-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
