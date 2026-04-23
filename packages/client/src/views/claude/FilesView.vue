<template>
  <div class="files-view">
    <div class="files-header">
      <h2 class="page-title">📁 文件浏览器</h2>
      <div class="files-path-bar">
        <span v-for="(seg, i) in pathSegments" :key="i" class="path-seg" @click="navigateTo(seg.path)">
          {{ seg.name }}<span v-if="i < pathSegments.length - 1" class="path-sep">/</span>
        </span>
      </div>
      <n-button size="small" @click="goUp" :disabled="currentPath === '/'">上级目录</n-button>
    </div>

    <div class="files-body">
      <div v-if="loading" class="files-loading">加载中...</div>
      <div v-else-if="files.length === 0" class="files-empty">空目录</div>
      <table v-else class="files-table">
        <thead>
          <tr>
            <th class="col-name">名称</th>
            <th class="col-size">大小</th>
            <th class="col-modified">修改时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in sortedFiles" :key="f.path" @click="handleClick(f)" class="file-row" :class="{ 'file-row--dir': f.isDirectory }">
            <td class="col-name">
              <span class="file-icon">{{ f.isDirectory ? '📂' : fileIcon(f.name) }}</span>
              {{ f.name }}
            </td>
            <td class="col-size">{{ f.size ? formatSize(f.size) : '-' }}</td>
            <td class="col-modified">{{ formatDate(f.modifiedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- File content viewer -->
    <n-modal v-model:show="showContent" :title="viewingFile?.name || ''" preset="card" style="max-width: 800px; max-height: 80vh;">
      <div class="file-content-viewer">
        <pre><code>{{ fileContent }}</code></pre>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const currentPath = ref('/Users/detianziben')
const files = ref<any[]>([])
const loading = ref(false)
const showContent = ref(false)
const viewingFile = ref<any>(null)
const fileContent = ref('')

const pathSegments = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean)
  return parts.map((name, i) => ({
    name,
    path: '/' + parts.slice(0, i + 1).join('/'),
  }))
})

const sortedFiles = computed(() =>
  [...files.value].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
)

function fileIcon(name: string) {
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return '📄'
  if (name.endsWith('.js') || name.endsWith('.jsx')) return '📄'
  if (name.endsWith('.vue')) return '💚'
  if (name.endsWith('.json')) return '📋'
  if (name.endsWith('.md')) return '📝'
  if (name.endsWith('.css') || name.endsWith('.scss')) return '🎨'
  if (name.endsWith('.py')) return '🐍'
  if (name.endsWith('.sh')) return '⚡'
  return '📄'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(ts: number) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function loadDir(path: string) {
  loading.value = true
  currentPath.value = path
  try {
    const res = await fetch(`/api/claude/files?path=${encodeURIComponent(path)}`)
    const data = await res.json()
    files.value = data.files || []
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

function navigateTo(path: string) { loadDir(path) }
function goUp() {
  const parts = currentPath.value.split('/')
  parts.pop()
  loadDir(parts.join('/') || '/')
}

async function handleClick(f: any) {
  if (f.isDirectory) {
    loadDir(f.path)
  } else {
    viewingFile.value = f
    try {
      const res = await fetch(`/api/claude/files/content?path=${encodeURIComponent(f.path)}`)
      const data = await res.json()
      fileContent.value = data.content || '(empty)'
      showContent.value = true
    } catch (e) { console.error(e) }
  }
}

onMounted(() => loadDir(currentPath.value))
</script>

<style lang="scss" scoped>
.files-view { padding: 24px; max-width: 1000px; margin: 0 auto; height: 100%; display: flex; flex-direction: column; }
.files-header { margin-bottom: 16px; .page-title { margin-bottom: 8px; color: var(--text-primary); } }
.files-path-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; margin-bottom: 12px; font-size: 13px; font-family: monospace; }
.path-seg { color: var(--primary-color); cursor: pointer; &:hover { text-decoration: underline; } }
.path-sep { color: var(--text-secondary); margin: 0 1px; }
.files-body { flex: 1; overflow-y: auto; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; }
.files-loading, .files-empty { padding: 48px; text-align: center; color: var(--text-secondary); }
.files-table { width: 100%; border-collapse: collapse; th, td { padding: 8px 16px; text-align: left; font-size: 13px; } th { background: var(--bg-secondary); color: var(--text-secondary); font-weight: 600; position: sticky; top: 0; } }
.file-row { cursor: pointer; &:hover { background: var(--bg-secondary); } border-bottom: 1px solid var(--border-color); }
.col-name { .file-icon { margin-right: 8px; } }
.col-size { width: 100px; color: var(--text-secondary); }
.col-modified { width: 160px; color: var(--text-secondary); }
.file-content-viewer { max-height: 60vh; overflow: auto; pre { margin: 0; code { font-family: 'SF Mono', monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; } } }
</style>
