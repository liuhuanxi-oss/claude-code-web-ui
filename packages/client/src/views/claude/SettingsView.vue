<template>
  <div class="settings-view">
    <h2 class="page-title">⚙️ 设置</h2>

    <div class="settings-section">
      <h3>模型</h3>
      <div class="setting-row">
        <label>默认模型</label>
        <select v-model="defaultModel" class="setting-select">
          <option value="sonnet">Sonnet (推荐)</option>
          <option value="opus">Opus</option>
          <option value="haiku">Haiku</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <h3>聊天</h3>
      <div class="setting-row">
        <label>流式输出</label>
        <n-switch v-model:value="streaming" />
      </div>
      <div class="setting-row">
        <label>显示思考过程</label>
        <n-switch v-model:value="showThinking" />
      </div>
      <div class="setting-row">
        <label>紧凑模式</label>
        <n-switch v-model:value="compactMode" />
      </div>
      <div class="setting-row">
        <label>最大预算 (USD)</label>
        <n-input-number v-model:value="maxBudget" :min="0" :step="0.1" size="small" style="width:150px" />
      </div>
    </div>

    <div class="settings-section">
      <h3>工作目录</h3>
      <div class="setting-row">
        <label>默认目录</label>
        <n-input v-model:value="defaultCwd" placeholder="/Users/xxx/project" size="small" style="width:300px" />
      </div>
    </div>

    <div class="settings-section">
      <h3>显示</h3>
      <div class="setting-row">
        <label>暗色主题</label>
        <n-switch v-model:value="darkTheme" />
      </div>
      <div class="setting-row">
        <label>语言</label>
        <select v-model="language" class="setting-select">
          <option value="zh">中文</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <h3>Claude Code CLI</h3>
      <div class="setting-row">
        <label>CLI 路径</label>
        <n-input :value="cliPath" disabled size="small" style="width:300px" />
      </div>
      <div class="setting-row">
        <label>状态</label>
        <span :class="cliAvailable ? 'status-ok' : 'status-err'">{{ cliAvailable ? '✓ 可用' : '✗ 不可用' }}</span>
      </div>
    </div>

    <div class="settings-section">
      <h3>认证</h3>
      <div class="setting-row">
        <label>Auth Token</label>
        <div class="token-display">
          <code>{{ authToken ? authToken.slice(0, 12) + '...' : '未设置' }}</code>
          <n-button size="tiny" @click="copyToken">复制</n-button>
        </div>
      </div>
      <div class="setting-row">
        <label>禁用认证</label>
        <n-switch v-model:value="authDisabled" />
        <span class="setting-hint">设置环境变量 AUTH_DISABLED=1 重启生效</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useChatStore } from '@/stores/claude/chat'

const store = useChatStore()

const defaultModel = ref(store.currentModel)
const streaming = ref(true)
const showThinking = ref(true)
const compactMode = ref(false)
const maxBudget = ref(0)
const defaultCwd = ref(store.currentCwd)
const darkTheme = ref(false)
const language = ref('zh')
const cliPath = ref('claude')
const cliAvailable = ref(false)
const authToken = ref('')
const authDisabled = ref(false)

watch(defaultModel, (v) => { store.currentModel = v })
watch(defaultCwd, (v) => { store.currentCwd = v })

function copyToken() {
  if (authToken.value) {
    navigator.clipboard.writeText(authToken.value)
  }
}

onMounted(async () => {
  try {
    const res = await fetch('/api/claude/status')
    const data = await res.json()
    cliAvailable.value = data.available
    cliPath.value = data.binPath
  } catch { /* ignore */ }

  // Load settings from localStorage
  const saved = localStorage.getItem('claude-web-ui-settings')
  if (saved) {
    try {
      const s = JSON.parse(saved)
      if (s.defaultModel) defaultModel.value = s.defaultModel
      if (s.defaultCwd) defaultCwd.value = s.defaultCwd
      if (s.darkTheme !== undefined) darkTheme.value = s.darkTheme
      if (s.language) language.value = s.language
      if (s.showThinking !== undefined) showThinking.value = s.showThinking
      if (s.compactMode !== undefined) compactMode.value = s.compactMode
      if (s.maxBudget !== undefined) maxBudget.value = s.maxBudget
    } catch { /* ignore */ }
  }
})

// Save settings on change
watch([defaultModel, defaultCwd, darkTheme, language, showThinking, compactMode, maxBudget], () => {
  localStorage.setItem('claude-web-ui-settings', JSON.stringify({
    defaultModel: defaultModel.value,
    defaultCwd: defaultCwd.value,
    darkTheme: darkTheme.value,
    language: language.value,
    showThinking: showThinking.value,
    compactMode: compactMode.value,
    maxBudget: maxBudget.value,
  }))
}, { deep: true })
</script>

<style lang="scss" scoped>
.settings-view { padding: 24px; max-width: 700px; margin: 0 auto; }
.page-title { margin-bottom: 20px; color: var(--text-primary); }
.settings-section {
  margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--border-color);
  h3 { margin-bottom: 12px; color: var(--text-primary); font-size: 15px; }
}
.setting-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; font-size: 14px;
  label { color: var(--text-primary); flex-shrink: 0; }
}
.setting-select {
  padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px;
  font-size: 13px; background: var(--bg-secondary); color: var(--text-primary); outline: none;
  &:focus { border-color: var(--primary-color); }
}
.setting-hint { font-size: 11px; color: var(--text-secondary); margin-left: 8px; }
.token-display { display: flex; align-items: center; gap: 8px; code { font-size: 12px; color: var(--text-secondary); background: var(--bg-secondary); padding: 3px 8px; border-radius: 4px; } }
.status-ok { color: #22c55e; font-weight: 600; }
.status-err { color: #ef4444; font-weight: 600; }
</style>
