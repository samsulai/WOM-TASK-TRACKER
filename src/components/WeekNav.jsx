import { formatHours, formatWeekStart } from '../format'

export default function WeekNav({
  weeks,
  weekHoursById,
  selectedWeekId,
  currentWeekStart,
  onSelect,
  clients,
  viewingClientName,
  onClearViewingClient,
}) {
  // Only show the owner tag when the list is mixing weeks from more than
  // one owner (the default combined admin view) -- once already filtered
  // to a single client, every row would say the same thing.
  const showOwnerTag = !viewingClientName

  const ownerLabel = (week) => {
    if (!week.client_id) return 'Internal'
    return clients?.find((c) => c.id === week.client_id)?.name || 'Client'
  }
  return (
    <aside className="week-nav-panel">
      <div className="week-nav-header">
        <p className="eyebrow">Weeks</p>
        {viewingClientName && (
          <button
            className="viewing-client-pill"
            onClick={onClearViewingClient}
            title={`Viewing only ${viewingClientName} — click to show everything again`}
          >
            <span aria-hidden="true">👁</span> {viewingClientName} <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>
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
                <span className="week-nav-tags">
                  {isCurrent && <span className="week-nav-badge">This week</span>}
                  {showOwnerTag && (
                    <span className={`week-nav-owner${week.client_id ? ' week-nav-owner-client' : ''}`}>
                      {ownerLabel(week)}
                    </span>
                  )}
                </span>
              </span>
              <span className="week-nav-hours">{formatHours(weekHoursById.get(week.id) || 0)}</span>
            </button>
          )
        })}
        {weeks.length === 0 && (
          <p className="week-nav-empty">
            {viewingClientName ? `No weeks for ${viewingClientName} yet` : 'No weeks yet'}
          </p>
        )}
      </nav>
    </aside>
  )
}
