export async function fetchJobs() {
  const res = await fetch('/api/claude/jobs')
  return res.json()
}

export async function createJob(job: { name: string; prompt: string; cron: string; model?: string; cwd?: string; enabled?: boolean }) {
  const res = await fetch('/api/claude/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job),
  })
  return res.json()
}

export async function updateJob(id: string, updates: Record<string, any>) {
  const res = await fetch(`/api/claude/jobs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  return res.json()
}

export async function deleteJob(id: string) {
  const res = await fetch(`/api/claude/jobs/${id}`, { method: 'DELETE' })
  return res.json()
}

export async function runJob(id: string) {
  const res = await fetch(`/api/claude/jobs/${id}/run`, { method: 'POST' })
  return res.json()
}

export async function fetchJobLogs(id: string) {
  const res = await fetch(`/api/claude/jobs/${id}/logs`)
  return res.json()
}
