// HH:MM:SS <-> decimal-hours conversions for the duration-formatted hours
// inputs (task hours, purchase hours) -- matches how staff already log time
// in Slack (e.g. "04:23:00"), so there's no mental conversion between the
// two surfaces. The app's own storage/math stays plain decimal hours
// throughout (budget totals, Sheet sync, weekly-report email) -- this is
// purely a display/input format layer, nothing deeper changes.

export function hoursToDuration(hours) {
  const n = Number(hours)
  const totalSeconds = Math.max(0, Math.round((Number.isFinite(n) ? n : 0) * 3600))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (v) => String(v).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

// Accepts "H", "H:M", or "H:M:S" (each part a plain number -- not
// necessarily zero-padded or capped at 60; "01:90:00" is just treated as
// 2.5 hours, no stricter validation needed for a staff-facing input).
// Returns null for anything that doesn't parse as numbers, so the caller
// can leave the field unchanged rather than commit garbage.
export function durationToHours(input) {
  const trimmed = String(input ?? '').trim()
  if (trimmed === '') return null
  const parts = trimmed.split(':').map((p) => Number(p.trim()))
  if (parts.length > 3 || parts.some((p) => !Number.isFinite(p))) return null
  const [h = 0, m = 0, s = 0] = parts
  return h + m / 60 + s / 3600
}

// Hours <-> separate {h, m} fields -- no seconds, since every real duration
// this app has seen (Slack logs, the Sheet) always uses :00 seconds; a
// two-field H/M input is friendlier to type into than HH:MM:SS text, and
// rounds to the nearest whole minute (losing nothing anyone actually enters).
export function hoursToHM(hours) {
  const n = Number(hours)
  const totalMinutes = Math.max(0, Math.round((Number.isFinite(n) ? n : 0) * 60))
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 }
}

export function hmToHours(h, m) {
  const hh = Number(h)
  const mm = Number(m)
  return (Number.isFinite(hh) ? hh : 0) + (Number.isFinite(mm) ? mm : 0) / 60
}
