<template>
  <div class="usage-view">
    <h2 class="page-title">📊 用量分析</h2>

    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-label">总会话数</div>
        <div class="stat-value">{{ summary.sessionCount || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">输入 Tokens</div>
        <div class="stat-value">{{ formatTokens(summary.inputTokens) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">输出 Tokens</div>
        <div class="stat-value">{{ formatTokens(summary.outputTokens) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总费用</div>
        <div class="stat-value">${{ (summary.totalCostUsd || 0).toFixed(4) }}</div>
      </div>
    </div>

    <div class="section">
      <h3>30 天用量趋势</h3>
      <div class="chart-container">
        <div class="bar-chart">
          <div
            v-for="day in dailyData"
            :key="day.date"
            class="bar-wrapper"
          >
            <div
              class="bar"
              :style="{ height: barHeight(day) + '%' }"
              :title="`${day.date}: $${day.total_cost_usd?.toFixed(4) || 0}`"
            />
            <span class="bar-label">{{ day.date.slice(5) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>模型分布</h3>
      <div v-if="modelData.length === 0" class="empty">暂无数据</div>
      <div v-else class="model-table">
        <table>
          <thead><tr><th>模型</th><th>会话数</th><th>输入</th><th>输出</th><th>费用</th></tr></thead>
          <tbody>
            <tr v-for="m in modelData" :key="m.model">
              <td>{{ m.model || 'unknown' }}</td>
              <td>{{ m.sessionCount }}</td>
              <td>{{ formatTokens(m.inputTokens) }}</td>
              <td>{{ formatTokens(m.outputTokens) }}</td>
              <td>${{ (m.totalCostUsd || 0).toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchUsageSummary, fetchDailyUsage, fetchModelUsage } from '@/api/claude/usage'

const summary = ref<any>({})
const dailyData = ref<any[]>([])
const modelData = ref<any[]>([])

const maxDailyCost = computed(() => {
  if (!dailyData.value.length) return 1
  return Math.max(...dailyData.value.map(d => d.total_cost_usd || 0), 0.01)
})

function barHeight(day: any) {
  return Math.max(((day.total_cost_usd || 0) / maxDailyCost.value) * 100, 2)
}

function formatTokens(n: number) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

onMounted(async () => {
  try {
    const [s, d, m] = await Promise.all([fetchUsageSummary(), fetchDailyUsage(), fetchModelUsage()])
    summary.value = s
    dailyData.value = d.data || []
    modelData.value = m.models || []
  } catch (e) { console.error('Failed to load usage:', e) }
})
</script>

<style lang="scss" scoped>
.usage-view { padding: 24px; max-width: 1000px; margin: 0 auto; }
.page-title { margin-bottom: 20px; color: var(--text-primary); }
.stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
.stat-card {
  background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px;
  padding: 16px; text-align: center;
}
.stat-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 24px; font-weight: 700; color: var(--primary-color); }
.section { margin-bottom: 32px; h3 { margin-bottom: 12px; color: var(--text-primary); } }
.chart-container { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }
.bar-chart { display: flex; align-items: flex-end; gap: 2px; height: 200px; }
.bar-wrapper { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
.bar { width: 100%; max-width: 20px; background: var(--primary-color); border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.3s; cursor: pointer; &:hover { opacity: 0.8; } }
.bar-label { font-size: 9px; color: var(--text-secondary); margin-top: 4px; }
.model-table { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; }
table { width: 100%; border-collapse: collapse; th, td { padding: 10px 16px; text-align: left; font-size: 13px; } th { background: var(--bg-secondary); color: var(--text-secondary); font-weight: 600; } td { color: var(--text-primary); border-top: 1px solid var(--border-color); } }
.empty { color: var(--text-secondary); text-align: center; padding: 24px; }
</style>
