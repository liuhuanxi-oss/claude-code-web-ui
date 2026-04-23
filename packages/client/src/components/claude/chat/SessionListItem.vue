<template>
  <div class="session-item" :class="{ 'session-item--active': active }">
    <div class="session-item-title">{{ session.title || '新会话' }}</div>
    <div class="session-item-meta">
      <span v-if="session.model" class="session-model">{{ session.model }}</span>
      <span class="session-time">{{ formatTime(session.lastActiveAt) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatSession } from '@/stores/claude/chat'

defineProps<{ session: ChatSession; active: boolean }>()

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style lang="scss" scoped>
.session-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 2px;

  &:hover { background: var(--bg-secondary); }

  &--active {
    background: rgba(217, 119, 6, 0.1);
  }
}

.session-item-title {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.session-model {
  font-size: 10px;
  color: var(--primary-color);
}

.session-time {
  font-size: 10px;
  color: var(--text-secondary);
}
</style>
