<template>
  <div class="chat-input-container">
    <div class="chat-input-wrapper">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="chat-textarea"
        :placeholder="disabled ? '等待回复中...' : '输入消息，Enter 发送，Shift+Enter 换行'"
        :disabled="disabled"
        rows="1"
        @keydown="handleKeydown"
        @input="autoResize"
      />
      <n-button
        class="send-btn"
        type="primary"
        :disabled="!inputText.trim() || disabled"
        @click="handleSend"
      >
        <template #icon>↵</template>
      </n-button>
    </div>
    <div class="chat-input-footer">
      <span class="model-badge">{{ model }}</span>
      <span v-if="cwd" class="cwd-badge">{{ cwd }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '@/stores/claude/chat'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ send: [prompt: string] }>()

const store = useChatStore()
const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const model = store.currentModel
const cwd = store.currentCwd

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend() {
  const text = inputText.value.trim()
  if (!text || props.disabled) return
  emit('send', text)
  inputText.value = ''
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}
</script>

<style lang="scss" scoped>
.chat-input-container {
  border-top: 1px solid var(--border-color);
  padding: 12px 24px 16px;
  background: var(--bg-primary);
}

.chat-input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);

  &:focus-within {
    border-color: var(--primary-color);
  }
}

.chat-textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  max-height: 200px;

  &::placeholder {
    color: var(--text-secondary);
  }
}

.send-btn {
  flex-shrink: 0;
}

.chat-input-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding-left: 4px;
}

.model-badge, .cwd-badge {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 4px;
}
</style>
