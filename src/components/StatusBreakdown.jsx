import { AlertTriangle, CheckCircle2, Circle, PlayCircle } from 'lucide-react'
import { useFlashOnChange } from '../hooks/useFlashOnChange'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Status is a state, not an identity, so this reuses the app's reserved
// status colors (same tokens as TaskRow's pills) instead of a categorical
// palette, and always pairs color with an icon + label -- never color alone.
const STATUSES = [
  { key: 'Not Started', icon: Circle, bar: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
  { key: 'In Progress', icon: PlayCircle, bar: 'bg-primary', text: 'text-primary' },
  { key: 'Blocked', icon: AlertTriangle, bar: 'bg-destructive', text: 'text-destructive' },
  { key: 'Done', icon: CheckCircle2, bar: 'bg-success', text: 'text-success' },
]

export default function StatusBreakdown({ counts, total }) {
  const bump = useFlashOnChange(total)

  return (
    <Card className="mb-4">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">This period</p>
          <h2 className="text-lg font-medium">Task status</h2>
        </div>
        <div className="text-right">
          <span
            className={cn(
              'inline-block text-[2.3rem] font-medium leading-none text-foreground transition-transform duration-200 ease-out',
              bump && 'scale-110'
            )}
          >
            {total}
          </span>
          <span className="mt-1 block text-xs font-medium text-muted-foreground">{total === 1 ? 'task' : 'tasks'}</span>
        </div>
      </div>

      {total === 0 ? (
        <p className="pt-3 text-muted-foreground">No tasks logged yet.</p>
      ) : (
        <>
          <div className="my-5 flex h-3 max-w-md gap-0.5" role="img" aria-label="Task status breakdown">
            {STATUSES.map((s) => {
              const count = counts[s.key] || 0
              const pct = (count / total) * 100
              if (pct === 0) return null
              return (
                <span
                  key={s.key}
                  className={cn('h-full rounded-[4px] transition-opacity hover:opacity-80', s.bar)}
                  title={`${s.key}: ${count}`}
                  style={{ width: `${pct}%` }}
                />
              )
            })}
          </div>

          <ul className="flex flex-col">
            {STATUSES.map((s) => {
              const count = counts[s.key] || 0
              const pct = total > 0 ? (count / total) * 100 : 0
              const Icon = s.icon
              return (
                <li key={s.key} className="-mx-2 flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                  <Icon className={cn('size-4 flex-none', s.text)} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{s.key}</span>
                  <span className="w-10 text-right text-muted-foreground">{pct.toFixed(0)}%</span>
                  <span className="w-10 text-right font-medium text-foreground">{count}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}
