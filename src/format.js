export function formatHours(hours) {
  const rounded = Math.round(hours * 100) / 100
  const trimmed = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${trimmed} ${rounded === 1 ? 'hr' : 'hrs'}`
}

export function formatWeekStart(dateStr, { year = true } = {}) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(
    undefined,
    year ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' }
  )
}
