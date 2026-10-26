import { formatHours } from '../format'
import { Card } from '@/components/ui/card'

export default function Totals({ projectTotals, grandTotal }) {
  return (
    <Card className="totals-card mb-4">
      <h2 className="mb-4 text-lg font-medium">Hours by project</h2>

      {projectTotals.length === 0 ? (
        <p className="text-muted-foreground">No hours logged yet — add a task to start the ledger.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {projectTotals.map(([project, hours]) => {
            const pct = grandTotal > 0 ? (hours / grandTotal) * 100 : 0
            return (
              <li key={project}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-foreground">{project}</span>
                  <span className="flex-none text-muted-foreground">
                    <span className="font-medium text-foreground">{formatHours(hours)}</span>{' '}
                    <span className="inline-block w-9 text-right">{pct.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
