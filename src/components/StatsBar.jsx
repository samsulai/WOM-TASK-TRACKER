import { formatHours } from '../format'

export default function StatsBar({ weeksCount, tasksOpen, tasksDone, hoursTotal }) {
  const stats = [
    { label: 'Weeks logged', value: weeksCount },
    { label: 'Tasks open', value: tasksOpen, className: 'stat-tile-value-blue' },
    { label: 'Tasks done', value: tasksDone, className: 'stat-tile-value-green' },
    { label: 'Hours total', value: formatHours(hoursTotal), className: 'stat-tile-value-blue' },
  ]

  return (
    <div className="stats-bar">
      {stats.map((s) => (
        <div key={s.label} className="stat-tile">
          <p className="eyebrow">{s.label}</p>
          <span className={`stat-tile-value${s.className ? ` ${s.className}` : ''}`}>{s.value}</span>
        </div>
      ))}
    </div>
  )
}
