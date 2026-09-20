import { formatHours, formatWeekStart } from '../format'

export default function WeekNav({ weeks, weekHoursById, selectedWeekId, currentWeekStart, onSelect }) {
  return (
    <aside className="week-nav-panel">
      <p className="eyebrow">Weeks</p>
      <nav className="week-nav">
        {weeks.map((week) => {
          const isCurrent = week.week_start === currentWeekStart
          const isActive = week.id === selectedWeekId
          return (
            <button
              key={week.id}
              type="button"
              className={`week-nav-item${isActive ? ' week-nav-item-active' : ''}`}
              onClick={() => onSelect(week.id)}
            >
              <span className="week-nav-main">
                <span className="week-nav-date">
                  {week.label || formatWeekStart(week.week_start, { year: false })}
                </span>
                {isCurrent && <span className="week-nav-badge">This week</span>}
              </span>
              <span className="week-nav-hours">{formatHours(weekHoursById.get(week.id) || 0)}</span>
            </button>
          )
        })}
        {weeks.length === 0 && <p className="week-nav-empty">No weeks yet</p>}
      </nav>
    </aside>
  )
}
