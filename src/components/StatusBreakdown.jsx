import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Status is a state, not an identity, so this reuses the app's reserved
// status colors (same tokens as TaskRow's pills) instead of a categorical
// palette, and always pairs color with a text label -- never color alone --
// in the grid below the bar.
const STATUSES = [
  { key: 'Not Started', bar: 'bg-muted-foreground/40', dot: 'bg-muted-foreground' },
  { key: 'In Progress', bar: 'bg-primary', dot: 'bg-primary' },
  { key: 'Blocked', bar: 'bg-destructive', dot: 'bg-destructive' },
  { key: 'Done', bar: 'bg-success', dot: 'bg-success' },
]

export default function StatusBreakdown({ counts, total }) {
  return (
    <Card className="mb-4">
      <h2 className="mb-4 text-lg font-medium">Task status</h2>

      {total === 0 ? (
        <p className="text-muted-foreground">No tasks logged yet.</p>
      ) : (
        <>
          <div className="mb-4 flex h-2 w-full gap-0.5" role="img" aria-label="Task status breakdown">
            {STATUSES.map((s) => {
              const count = counts[s.key] || 0
              const pct = (count / total) * 100
              if (pct === 0) return null
              return (
                <span
                  key={s.key}
                  className={cn('h-full rounded-full transition-opacity hover:opacity-80', s.bar)}
                  title={`${s.key}: ${count}`}
                  style={{ width: `${pct}%` }}
                />
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {STATUSES.map((s) => {
              const count = counts[s.key] || 0
              return (
                <div
                  key={s.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2 truncate text-sm text-foreground">
                    <span className={cn('size-2 flex-none rounded-full', s.dot)} aria-hidden="true" />
                    {s.key}
                  </span>
                  <span className="flex-none font-semibold text-foreground">{count}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
