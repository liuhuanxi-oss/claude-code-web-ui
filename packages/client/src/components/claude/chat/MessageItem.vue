<template>
  <div class="message-item" :class="`message-item--${message.role}`">
    <div class="message-avatar">
      <span v-if="message.role === 'user'">U</span>
      <span v-else class="message-avatar--assistant">✦</span>
    </div>
    <div class="message-body">
      <div class="message-header">
        <span class="message-role">{{ message.role === 'user' ? '你' : 'Claude' }}</span>
        <span v-if="message.model" class="message-model">{{ message.model }}</span>
        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
      </div>

      <!-- Thinking block -->
      <ThinkingBlock v-if="message.thinking" :thinking="message.thinking" />

      <!-- Tool calls -->
      <div v-if="message.toolCalls?.length" class="message-tool-calls">
        <ToolCallBlock
          v-for="tc in message.toolCalls"
          :key="tc.id"
          :tool-call="tc"
        />
      </div>

      <!-- Text content -->
      <div v-if="message.content" class="message-content">
        <MarkdownRenderer :content="message.content" />
      </div>

      <!-- Streaming indicator -->
      <span v-if="message.isStreaming" class="message-cursor">▊</span>

      <!-- Usage -->
      <div v-if="message.usage && !message.isStreaming" class="message-usage">
        <span>{{ message.usage.inputTokens }}in / {{ message.usage.outputTokens }}out</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '@/stores/claude/chat'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ToolCallBlock from './ToolCallBlock.vue'
import ThinkingBlock from './ThinkingBlock.vue'

defineProps<{ message: ChatMessage }>()

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style lang="scss" scoped>
.message-item {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;

  &--assistant {
    .message-avatar--assistant {
      color: var(--primary-color);
      font-size: 20px;
    }
  }
}

.message-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-role {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.message-model {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 1px 6px;
  border-radius: 4px;
}

.message-time {
  font-size: 11px;
  color: var(--text-secondary);
}

.message-tool-calls {
  margin: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.message-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.message-cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  color: var(--primary-color);
  font-size: 14px;
}

.message-usage {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

@keyframes blink {
  50% { opacity: 0; }
}
</style>
