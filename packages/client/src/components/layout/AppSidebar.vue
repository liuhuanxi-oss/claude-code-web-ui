<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar-header">
      <span v-if="!collapsed" class="sidebar-title">Claude Code</span>
      <n-button quaternary size="small" @click="$emit('update:collapsed', !collapsed)">
        {{ collapsed ? '▸' : '◂' }}
      </n-button>
    </div>

    <div class="sidebar-actions" v-if="!collapsed">
      <n-button type="primary" block @click="$emit('new-chat')">
        新对话
      </n-button>
    </div>

    <div class="sidebar-nav">
      <div
        v-for="item in navItems"
        :key="item.path"
        class="sidebar-nav-item"
        :class="{ 'sidebar-nav-item--active': currentRoute === item.path }"
        @click="router.push(item.path)"
      >
        <span class="sidebar-nav-icon">{{ item.icon }}</span>
        <span v-if="!collapsed" class="sidebar-nav-label">{{ item.label }}</span>
      </div>
    </div>

    <div class="sidebar-sessions" v-if="!collapsed">
      <div class="sidebar-section-header">
        <span class="sidebar-section-title">历史会话</span>
      </div>
      <div class="sidebar-search">
        <input
          v-model="searchQuery"
          class="sidebar-search-input"
          placeholder="搜索会话... (Ctrl+K)"
          @keydown.ctrl.k.prevent="$refs.searchInput?.focus()"
        />
      </div>
      <div v-if="loading" class="sidebar-loading">加载中...</div>
      <div v-else-if="filteredSessions.length === 0" class="sidebar-empty">暂无会话</div>
      <SessionListItem
        v-for="session in filteredSessions"
        :key="session.id"
        :session="session"
        :active="session.id === currentSessionId"
        @click="handleSessionClick(session.id)"
        @delete="handleDeleteSession(session.id)"
      />
    </div>

    <div class="sidebar-footer" v-if="!collapsed">
      <select v-model="currentModel" class="model-select">
        <option value="sonnet">Sonnet</option>
        <option value="opus">Opus</option>
        <option value="haiku">Haiku</option>
      </select>
      <div class="sidebar-cost" v-if="totalCostUsd > 0">
        总计: ${{ totalCostUsd.toFixed(4) }}
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '@/stores/claude/chat'
import { fetchSessions, fetchSessionMessages, deleteSession } from '@/api/claude/chat'
import SessionListItem from '@/components/claude/chat/SessionListItem.vue'

defineProps<{ collapsed: boolean }>()
defineEmits<{ 'update:collapsed': [value: boolean]; 'new-chat': [] }>()

const router = useRouter()
const route = useRoute()
const store = useChatStore()

const currentRoute = computed(() => route.path)
const sortedSessions = store.sortedSessions
const currentSessionId = store.currentSessionId
const currentModel = store.currentModel
const totalCostUsd = store.totalCostUsd

const searchQuery = ref('')
const loading = ref(false)

const filteredSessions = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return sortedSessions.value.slice(0, 30)
  return sortedSessions.value
    .filter(s => s.title.toLowerCase().includes(q) || s.cwd.toLowerCase().includes(q))
    .slice(0, 30)
})

const navItems = [
  { path: '/', icon: '💬', label: '聊天' },
  { path: '/files', icon: '📁', label: '文件' },
  { path: '/terminal', icon: '⌨️', label: '终端' },
  { path: '/jobs', icon: '⏰', label: '定时任务' },
  { path: '/usage', icon: '📊', label: '用量' },
  { path: '/settings', icon: '⚙️', label: '设置' },
]

async function loadSessions() {
  loading.value = true
  try {
    const data = await fetchSessions(100)
    store.setSessions(data.sessions || [])
  } catch (e) {
    console.error('Failed to load sessions:', e)
  } finally {
    loading.value = false
  }
}

async function handleSessionClick(sessionId: string) {
  if (store.currentSessionId === sessionId) return
  try {
    const data = await fetchSessionMessages(sessionId)
    store.loadSessionMessages(
      (data.messages || []).map((m: any) => ({
        id: crypto.randomUUID(),
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        model: m.model,
        timestamp: Date.now(),
      }))
    )
    store.currentSessionId = sessionId
    router.push('/')
  } catch (e) {
    console.error('Failed to load session:', e)
  }
}

async function handleDeleteSession(sessionId: string) {
  try {
    await deleteSession(sessionId)
    store.setSessions(store.sessions.filter(s => s.id !== sessionId))
    if (store.currentSessionId === sessionId) {
      store.clearMessages()
    }
  } catch (e) {
    console.error('Failed to delete session:', e)
  }
}

onMounted(loadSessions)
</script>

<style lang="scss" scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  transition: width 0.2s;
  &--collapsed { width: var(--sidebar-collapsed-width); align-items: center; }
}
.sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border-color);
}
.sidebar-title { font-weight: 700; font-size: 16px; color: var(--primary-color); }
.sidebar-actions { padding: 12px 16px; }
.sidebar-nav { padding: 8px 8px; }
.sidebar-nav-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  border-radius: 8px; cursor: pointer; font-size: 14px; color: var(--text-primary);
  transition: background 0.15s;
  &:hover { background: var(--bg-secondary); }
  &--active { background: rgba(217, 119, 6, 0.1); color: var(--primary-color); font-weight: 600; }
}
.sidebar-nav-icon { font-size: 16px; }
.sidebar-sessions { flex: 1; overflow-y: auto; padding: 0 8px; }
.sidebar-section-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px 4px; }
.sidebar-section-title { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.sidebar-search { padding: 4px 12px 8px; }
.sidebar-search-input {
  width: 100%; padding: 5px 10px; border: 1px solid var(--border-color); border-radius: 6px;
  font-size: 12px; background: var(--bg-secondary); color: var(--text-primary); outline: none;
  &:focus { border-color: var(--primary-color); }
}
.sidebar-loading, .sidebar-empty { padding: 12px; font-size: 12px; color: var(--text-secondary); text-align: center; }
.sidebar-footer { padding: 12px 16px; border-top: 1px solid var(--border-color); }
.model-select {
  width: 100%; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px;
  font-size: 13px; background: var(--bg-secondary); color: var(--text-primary); outline: none;
  &:focus { border-color: var(--primary-color); }
}
.sidebar-cost { margin-top: 8px; font-size: 11px; color: var(--text-secondary); }
</style>
