<template>
  <n-config-provider :theme="isDark ? darkTheme : undefined" :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <n-loading-bar-provider>
            <div class="app-container" :class="{ 'app-container--dark': isDark }">
              <AppSidebar
                v-model:collapsed="sidebarCollapsed"
                @new-chat="handleNewChat"
              />
              <main class="app-main">
                <router-view />
              </main>
            </div>
          </n-loading-bar-provider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { darkTheme, zhCN, dateZhCN } from 'naive-ui'
import AppSidebar from './components/layout/AppSidebar.vue'

const isDark = ref(false)
const sidebarCollapsed = ref(false)

function handleNewChat() {
  // Will be connected to chat store
}
</script>

<style lang="scss">
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #f5f5f5;
}

.app-container--dark {
  background: #101014;
}

.app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
