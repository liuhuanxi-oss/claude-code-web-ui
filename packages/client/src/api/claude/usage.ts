export async function fetchUsageSummary() {
  const res = await fetch('/api/claude/usage/summary')
  return res.json()
}

export async function fetchDailyUsage(days = 30) {
  const res = await fetch(`/api/claude/usage/daily?days=${days}`)
  return res.json()
}

export async function fetchModelUsage() {
  const res = await fetch('/api/claude/usage/models')
  return res.json()
}
