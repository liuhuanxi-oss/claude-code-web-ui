<template>
  <div class="thinking-block" :class="{ 'thinking-block--expanded': expanded }">
    <div class="thinking-header" @click="expanded = !expanded">
      <span class="thinking-icon">💭</span>
      <span class="thinking-label">思考过程</span>
      <span class="thinking-toggle">{{ expanded ? '▾' : '▸' }}</span>
    </div>
    <div v-if="expanded" class="thinking-body">
      {{ thinking }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ thinking: string }>()
const expanded = ref(false)
</script>

<style lang="scss" scoped>
.thinking-block {
  margin: 6px 0;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);

  &:hover { background: rgba(0,0,0,0.02); }
}

.thinking-label { flex: 1; }
.thinking-toggle { color: var(--text-secondary); }

.thinking-body {
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  border-top: 1px dashed var(--border-color);
  max-height: 300px;
  overflow-y: auto;
}
</style>
