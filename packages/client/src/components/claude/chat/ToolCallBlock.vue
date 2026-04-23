<template>
  <div class="tool-call" :class="{ 'tool-call--error': toolCall.isError }">
    <div class="tool-call-header" @click="expanded = !expanded">
      <span class="tool-call-icon">{{ toolIcon }}</span>
      <span class="tool-call-name">{{ toolCall.name }}</span>
      <span class="tool-call-summary">{{ toolSummary }}</span>
      <span class="tool-call-status">
        <n-spin v-if="!toolCall.isComplete" size="tiny" />
        <span v-else>{{ toolCall.isError ? '✗' : '✓' }}</span>
      </span>
      <span class="tool-call-toggle">{{ expanded ? '▾' : '▸' }}</span>
    </div>
    <div v-if="expanded" class="tool-call-body">
      <div v-if="toolCall.args" class="tool-call-args">
        <div class="tool-call-label">参数</div>
        <pre><code>{{ formatArgs(toolCall.args) }}</code></pre>
      </div>
      <div v-if="toolCall.result" class="tool-call-result">
        <div class="tool-call-label">结果</div>
        <pre><code>{{ truncate(toolCall.result, 2000) }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ToolCallInfo } from '@/stores/claude/chat'

const props = defineProps<{ toolCall: ToolCallInfo }>()
const expanded = ref(false)

const toolIcon = computed(() => {
  const name = props.toolCall.name
  if (name === 'Bash') return '⚡'
  if (name === 'Read' || name === 'Write') return '📄'
  if (name === 'Edit') return '✏️'
  if (name === 'Grep' || name === 'Glob') return '🔍'
  if (name === 'WebFetch' || name === 'WebSearch') return '🌐'
  return '🔧'
})

const toolSummary = computed(() => {
  const args = props.toolCall.args as any
  if (!args) return ''
  const name = props.toolCall.name
  if (name === 'Bash' && args.command) return args.command.slice(0, 60)
  if (name === 'Read' && args.file_path) return args.file_path
  if (name === 'Write' && args.file_path) return args.file_path
  if (name === 'Edit' && args.file_path) return args.file_path
  if (name === 'Grep' && args.pattern) return args.pattern
  if (name === 'Glob' && args.pattern) return args.pattern
  return ''
})

function formatArgs(args: unknown): string {
  try {
    return JSON.stringify(args, null, 2)
  } catch {
    return String(args)
  }
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '\n... (truncated)'
}
</script>

<style lang="scss" scoped>
.tool-call {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;

  &--error {
    border-color: #e53e3e;
  }
}

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  background: var(--bg-secondary);

  &:hover { background: rgba(0,0,0,0.03); }
}

.tool-call-icon { font-size: 14px; }
.tool-call-name { font-weight: 600; color: var(--text-primary); }
.tool-call-summary {
  flex: 1;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'SF Mono', monospace;
  font-size: 12px;
}
.tool-call-status { flex-shrink: 0; }
.tool-call-toggle { flex-shrink: 0; color: var(--text-secondary); }

.tool-call-body {
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
}

.tool-call-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

pre {
  margin: 0;
  code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
