import { formatHours, formatWeekStart } from '../format'
import { cn } from '@/lib/utils'

export default function WeekNav({ weeks, weekHoursById, selectedWeekId, currentWeekStart, onSelect, clients, scopeName }) {
  // Only show the owner tag when the list is mixing weeks from more than
  // one owner (the default combined admin view) -- once already filtered
  // to a single client, every row would say the same thing.
  const showOwnerTag = !scopeName

  const ownerLabel = (week) => {
    if (!week.client_id) return 'Internal'
    return clients?.find((c) => c.id === week.client_id)?.name || 'Client'
  }

  return (
    <aside className="sticky top-16 h-[calc(100vh-64px)] w-[272px] flex-none overflow-y-auto border-r border-border bg-sidebar p-5 py-5 max-[860px]:static max-[860px]:order-2 max-[860px]:h-auto max-[860px]:w-full max-[860px]:border-r-0 max-[860px]:border-t">
      <div className="flex items-center justify-between gap-2 px-3">
        <p className="text-sm font-semibold text-foreground">Weeks</p>
        {scopeName && (
          <span className="max-w-[140px] truncate rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {scopeName}
          </span>
        )}
      </div>
      <nav className="mt-3 flex flex-col gap-0.5">
        {weeks.map((week) => {
          const isCurrent = week.week_start === currentWeekStart
          const isActive = week.id === selectedWeekId
          return (
            <button
              key={week.id}
              type="button"
              onClick={() => onSelect(week.id)}
              className={cn(
                'flex items-center justify-between gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                isActive && 'bg-primary/10 font-semibold text-foreground hover:bg-primary/10'
              )}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate">{week.label || formatWeekStart(week.week_start, { year: false })}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {isCurrent && <span className="text-xs font-semibold text-primary">This week</span>}
                  {showOwnerTag && (
                    <span
                      className={cn(
                        'rounded-sm bg-muted px-2 py-px text-xs font-medium text-muted-foreground',
                        week.client_id && 'bg-primary/10 text-primary'
                      )}
                    >
                      {ownerLabel(week)}
                    </span>
                  )}
                </span>
              </span>
              <span className={cn('flex-none text-sm font-medium text-muted-foreground', isActive && 'text-primary')}>
                {formatHours(weekHoursById.get(week.id) || 0)}
              </span>
            </button>
          )
        })}
        {weeks.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted-foreground">{scopeName ? `No weeks for ${scopeName} yet` : 'No weeks yet'}</p>
        )}
      </nav>
    </aside>
  )
}
