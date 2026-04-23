<template>
  <div class="jobs-view">
    <div class="jobs-header">
      <h2 class="page-title">⏰ 定时任务</h2>
      <n-button type="primary" @click="showForm = true">新建任务</n-button>
    </div>

    <div v-if="jobs.length === 0" class="empty">暂无定时任务，点击上方按钮创建</div>

    <div class="jobs-list">
      <div v-for="job in jobs" :key="job.id" class="job-card">
        <div class="job-card-header">
          <span class="job-name">{{ job.name }}</span>
          <n-tag :type="job.enabled ? 'success' : 'default'" size="small">{{ job.enabled ? '启用' : '暂停' }}</n-tag>
        </div>
        <div class="job-meta">
          <span class="job-cron">{{ job.cron }}</span>
          <span class="job-model" v-if="job.model">{{ job.model }}</span>
        </div>
        <div class="job-prompt">{{ job.prompt.slice(0, 100) }}{{ job.prompt.length > 100 ? '...' : '' }}</div>
        <div class="job-actions">
          <n-button size="tiny" @click="handleRun(job.id)">立即执行</n-button>
          <n-button size="tiny" @click="handleToggle(job)">{{ job.enabled ? '暂停' : '启用' }}</n-button>
          <n-button size="tiny" type="error" @click="handleDelete(job.id)">删除</n-button>
        </div>
      </div>
    </div>

    <n-modal v-model:show="showForm" title="新建定时任务" preset="card" style="max-width: 500px;">
      <n-form ref="formRef" :model="form">
        <n-form-item label="任务名称"><n-input v-model:value="form.name" placeholder="如：每日代码审查" /></n-form-item>
        <n-form-item label="提示词"><n-input v-model:value="form.prompt" type="textarea" :rows="3" placeholder="发送给 Claude 的提示词" /></n-form-item>
        <n-form-item label="Cron 表达式"><n-input v-model:value="form.cron" placeholder="0 9 * * 1-5" />
          <template #feedback>
            <span style="font-size:11px;color:var(--text-secondary)">预设: 每天9点=0 9 * * *, 工作日=0 9 * * 1-5, 每小时=0 * * * *</span>
          </template>
        </n-form-item>
        <n-form-item label="模型"><n-select v-model:value="form.model" :options="modelOptions" clearable /></n-form-item>
        <n-form-item label="工作目录"><n-input v-model:value="form.cwd" placeholder="/Users/xxx/project" /></n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showForm = false">取消</n-button>
        <n-button type="primary" @click="handleCreate" :disabled="!form.name || !form.prompt || !form.cron">创建</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchJobs, createJob, updateJob, deleteJob, runJob } from '@/api/claude/jobs'

const jobs = ref<any[]>([])
const showForm = ref(false)
const form = ref({ name: '', prompt: '', cron: '0 9 * * 1-5', model: '', cwd: '' })

const modelOptions = [
  { label: 'Sonnet (默认)', value: 'sonnet' },
  { label: 'Opus', value: 'opus' },
  { label: 'Haiku', value: 'haiku' },
]

async function loadJobs() {
  try {
    const data = await fetchJobs()
    jobs.value = data.jobs || []
  } catch (e) { console.error(e) }
}

async function handleCreate() {
  try {
    await createJob({ ...form.value, enabled: true })
    showForm.value = false
    form.value = { name: '', prompt: '', cron: '0 9 * * 1-5', model: '', cwd: '' }
    await loadJobs()
  } catch (e) { console.error(e) }
}

async function handleRun(id: string) {
  try {
    await runJob(id)
    await loadJobs()
  } catch (e) { console.error(e) }
}

async function handleToggle(job: any) {
  try {
    await updateJob(job.id, { enabled: !job.enabled })
    await loadJobs()
  } catch (e) { console.error(e) }
}

async function handleDelete(id: string) {
  try {
    await deleteJob(id)
    await loadJobs()
  } catch (e) { console.error(e) }
}

onMounted(loadJobs)
</script>

<style lang="scss" scoped>
.jobs-view { padding: 24px; max-width: 900px; margin: 0 auto; }
.jobs-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { color: var(--text-primary); }
.empty { color: var(--text-secondary); text-align: center; padding: 48px; }
.jobs-list { display: flex; flex-direction: column; gap: 12px; }
.job-card { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }
.job-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.job-name { font-weight: 600; color: var(--text-primary); }
.job-meta { display: flex; gap: 8px; margin-bottom: 8px; font-size: 12px; }
.job-cron { color: var(--primary-color); font-family: monospace; background: rgba(217,119,6,0.1); padding: 2px 8px; border-radius: 4px; }
.job-model { color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; }
.job-prompt { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5; }
.job-actions { display: flex; gap: 8px; }
</style>
