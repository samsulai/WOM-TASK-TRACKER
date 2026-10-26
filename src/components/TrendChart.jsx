import { formatHours, formatWeekStart } from '../format'
import { Card } from '@/components/ui/card'
import Tooltip from './Tooltip'
import { cn } from '@/lib/utils'

// Hours logged per week, change-over-time for a single series (whichever
// scope is currently in view) -- a magnitude job, so one hue (the brand
// accent) rather than a categorical palette; no adjacent-hue CVD check is
// needed since there's only one series to tell apart from itself.
//
// `hoursBought` (optional, only for a single scoped client) adds a dashed
// reference line at that threshold -- a week whose OWN hours alone exceed
// the client's all-time bought total is unusual enough to be worth calling
// out, so that week's bar splits into a blue "within" segment and a red
// "over" segment stacked on top of it. This is a per-week comparison, not a
// running cumulative total -- the all-time cumulative comparison already
// lives in the stats cards and the Retainer balance card above.
export default function TrendChart({ data, currentWeekStart, hoursBought }) {
  const hasAnyHours = data.some((d) => d.hours > 0)
  const max = Math.max(1, ...data.map((d) => d.hours), hoursBought || 0)
  const linePct = hoursBought > 0 ? Math.min(100, (hoursBought / max) * 100) : null

  return (
    <Card className="mb-4">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">Hours logged</h2>
        <p className="text-xs font-medium text-muted-foreground">Last {data.length} weeks</p>
      </div>

      {!hasAnyHours ? (
        <p className="text-muted-foreground">No hours logged in this range yet.</p>
      ) : (
        <>
          <div className="relative h-24" role="img" aria-label="Hours logged per week, most recent weeks">
            {linePct !== null && (
              <div
                className="absolute inset-x-0 border-t border-dashed border-muted-foreground/50"
                style={{ bottom: `${linePct}%` }}
              >
                <span className="absolute -top-[15px] right-0 whitespace-nowrap bg-card pl-1.5 text-[10px] font-medium text-muted-foreground">
                  {formatHours(hoursBought)} bought
                </span>
              </div>
            )}
            <div className="flex h-full items-end gap-2">
              {data.map((d) => {
                const isCurrent = d.weekStart === currentWeekStart
                // A visible stub for zero weeks (not literally 0px) so an
                // empty week still reads as "a week with nothing logged,"
                // not a gap.
                const within = hoursBought ? Math.min(d.hours, hoursBought) : d.hours
                const over = hoursBought && d.hours > hoursBought ? d.hours - hoursBought : 0
                const withinPct = Math.max(d.hours === 0 ? 3 : 0, (within / max) * 100)
                const overPct = (over / max) * 100
                return (
                  <Tooltip key={d.weekStart} text={`${formatWeekStart(d.weekStart, { year: false })}: ${formatHours(d.hours)}`}>
                    {/* Reversed so the DOM order (within, then over) stacks
                        visually bottom-to-top -- both get a rounded top so
                        the common case (no over segment) still looks right,
                        since whichever one ends up on top shows its own
                        rounding; when over IS present, within's rounded top
                        just sits hidden underneath it. */}
                    <div className="flex h-full min-w-0 flex-1 flex-col-reverse items-stretch">
                      <div
                        className="w-full rounded-t-[4px] bg-primary transition-[height] duration-500 ease-out"
                        style={{ height: `${withinPct}%`, opacity: d.hours === 0 ? 0.25 : isCurrent ? 1 : 0.6 }}
                      />
                      {overPct > 0 && (
                        <div
                          className="w-full rounded-t-[4px] bg-destructive transition-[height] duration-500 ease-out"
                          style={{ height: `${overPct}%` }}
                        />
                      )}
                    </div>
                  </Tooltip>
                )
              })}
            </div>
          </div>
          <div className="mt-1.5 flex gap-2">
            {data.map((d) => {
              const isCurrent = d.weekStart === currentWeekStart
              return (
                <div key={d.weekStart} className="min-w-0 flex-1 text-center">
                  <span
                    className={cn(
                      'whitespace-nowrap text-xs',
                      isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {formatWeekStart(d.weekStart, { year: false })}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
