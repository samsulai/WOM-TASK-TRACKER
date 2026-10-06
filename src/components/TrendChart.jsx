import { formatHours, formatWeekStart } from '../format'
import { Card } from '@/components/ui/card'
import Tooltip from './Tooltip'

// Hours logged per week, change-over-time for a single series (whichever
// scope is currently in view) -- a magnitude job, so one hue (the brand
// accent) rather than a categorical palette; no adjacent-hue CVD check is
// needed since there's only one series to tell apart from itself.
export default function TrendChart({ data, currentWeekStart }) {
  const max = Math.max(1, ...data.map((d) => d.hours))
  const hasAnyHours = data.some((d) => d.hours > 0)

  return (
    <Card className="mb-4">
      <p className="text-xs font-medium text-muted-foreground">Last {data.length} weeks</p>
      <h2 className="mb-4 text-lg font-medium">Hours logged</h2>

      {!hasAnyHours ? (
        <p className="text-muted-foreground">No hours logged in this range yet.</p>
      ) : (
        <div className="flex h-28 items-end gap-2" role="img" aria-label="Hours logged per week, most recent weeks">
          {data.map((d) => {
            const isCurrent = d.weekStart === currentWeekStart
            // A visible stub for zero weeks (not literally 0px) so an empty
            // week still reads as "a week with nothing logged," not a gap.
            const pct = Math.max(3, (d.hours / max) * 100)
            return (
              <Tooltip key={d.weekStart} text={`${formatWeekStart(d.weekStart, { year: false })}: ${formatHours(d.hours)}`}>
                <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                  <div className="flex h-full w-full items-end">
                    <div
                      className="w-full rounded-t-[4px] bg-primary transition-[height] duration-500 ease-out"
                      style={{ height: `${pct}%`, opacity: d.hours === 0 ? 0.25 : 1 }}
                    />
                  </div>
                  {/* Full "Mon DD" label down to sm; below that there isn't room
                      for 8 unbreakable labels side by side, so just the day shows. */}
                  <span
                    className={`whitespace-nowrap text-xs ${isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                  >
                    <span className="hidden sm:inline">
                      {formatWeekStart(d.weekStart, { year: false }).replace(' ', ' ')}
                    </span>
                    <span className="sm:hidden">{Number(d.weekStart.slice(8, 10))}</span>
                  </span>
                </div>
              </Tooltip>
            )
          })}
        </div>
      )}
    </Card>
  )
}
