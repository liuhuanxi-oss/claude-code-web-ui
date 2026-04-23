<template>
  <div class="terminal-view">
    <div class="terminal-header">
      <h2 class="page-title">⌨️ Web 终端</h2>
      <n-button size="small" @click="connect" :disabled="!!ws">连接</n-button>
      <n-button size="small" @click="disconnect" :disabled="!ws">断开</n-button>
    </div>
    <div class="terminal-body" ref="terminalContainer">
      <div class="terminal-fallback" v-if="!xtermLoaded">
        <p>终端组件加载中...</p>
        <div class="terminal-fallback-output" ref="fallbackOutput">
          <div v-for="(line, i) in outputLines" :key="i" class="terminal-line">{{ line }}</div>
        </div>
        <div class="terminal-fallback-input">
          <input
            v-model="inputLine"
            @keydown.enter="sendInput"
            class="terminal-input"
            placeholder="输入命令..."
            :disabled="!ws"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const ws = ref<WebSocket | null>(null)
const outputLines = ref<string[]>([])
const inputLine = ref('')
const xtermLoaded = ref(false)
const terminalContainer = ref<HTMLElement | null>(null)
const fallbackOutput = ref<HTMLElement | null>(null)

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${window.location.host}/ws/claude/terminal`
  const socket = new WebSocket(url)

  socket.onopen = () => {
    outputLines.value.push('$ Connected to terminal')
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'output') {
        // Split by newlines to render properly
        const lines = data.data.split('\n')
        for (const line of lines) {
          outputLines.value.push(line)
        }
        // Keep last 500 lines
        if (outputLines.value.length > 500) {
          outputLines.value = outputLines.value.slice(-500)
        }
        // Auto-scroll
        setTimeout(() => {
          if (fallbackOutput.value) {
            fallbackOutput.value.scrollTop = fallbackOutput.value.scrollHeight
          }
        }, 10)
      } else if (data.type === 'exit') {
        outputLines.value.push(`$ Process exited with code ${data.exitCode}`)
        socket.close()
      }
    } catch { /* ignore */ }
  }

  socket.onclose = () => {
    ws.value = null
    outputLines.value.push('$ Disconnected')
  }

  socket.onerror = () => {
    outputLines.value.push('$ Connection error')
  }

  ws.value = socket
}

function disconnect() {
  ws.value?.close()
  ws.value = null
}

function sendInput() {
  if (!ws.value || !inputLine.value) return
  ws.value.send(JSON.stringify({ type: 'input', data: inputLine.value + '\n' }))
  inputLine.value = ''
}

onMounted(() => {
  connect()
})

onUnmounted(() => {
  disconnect()
})
</script>

<style lang="scss" scoped>
.terminal-view { padding: 24px; height: 100%; display: flex; flex-direction: column; }
.terminal-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; .page-title { margin: 0; color: var(--text-primary); } }
.terminal-body { flex: 1; overflow: hidden; background: #1a1a2e; border-radius: 12px; border: 1px solid var(--border-color); }
.terminal-fallback { height: 100%; display: flex; flex-direction: column; }
.terminal-fallback-output {
  flex: 1; overflow-y: auto; padding: 12px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 13px; line-height: 1.5; color: #e0e0e0; white-space: pre-wrap; word-break: break-all;
}
.terminal-line { min-height: 1.5em; }
.terminal-fallback-input { border-top: 1px solid #333; padding: 8px 12px; display: flex; align-items: center; }
.terminal-input {
  flex: 1; background: transparent; border: none; outline: none; color: #e0e0e0;
  font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px;
  &::placeholder { color: #666; }
}
p { color: #666; padding: 12px; }
</style>
