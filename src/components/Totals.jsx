import { formatHours } from '../format'
import { useFlashOnChange } from '../hooks/useFlashOnChange'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// A monochrome blue ramp, light to dark -- one accent color throughout
// rather than mixed hues, consistent with the rest of the app.
const SEGMENT_COLORS = ['var(--seg-1)', 'var(--seg-2)', 'var(--seg-3)', 'var(--seg-4)', 'var(--seg-5)']

export default function Totals({ projectTotals, grandTotal }) {
  const bumpTotal = useFlashOnChange(grandTotal)

  return (
    <Card className="totals-card mb-4">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">This period</p>
          <h2 className="text-lg font-medium">Totals by project</h2>
        </div>
        <div className="text-right">
          <span
            className={cn(
              'inline-block text-[2.3rem] font-medium leading-none text-primary transition-transform duration-200 ease-out',
              bumpTotal && 'scale-110'
            )}
          >
            {formatHours(grandTotal)}
          </span>
          <span className="mt-1 block text-xs font-medium text-muted-foreground">total logged</span>
        </div>
      </div>

      {projectTotals.length === 0 ? (
        <p className="pt-3 text-muted-foreground">No hours logged yet — add a task to start the ledger.</p>
      ) : (
        <>
          <div className="my-5 flex h-3 max-w-md gap-0.5" role="img" aria-label="Hours distribution by project">
            {projectTotals.map(([project, hours], i) => {
              const pct = grandTotal > 0 ? (hours / grandTotal) * 100 : 0
              if (pct === 0) return null
              return (
                <span
                  key={project}
                  className="h-full rounded-[4px] transition-opacity hover:opacity-80"
                  title={`${project}: ${formatHours(hours)}`}
                  style={{ width: `${pct}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                />
              )
            })}
          </div>

          <ul className="flex flex-col">
            {projectTotals.map(([project, hours], i) => {
              const pct = grandTotal > 0 ? (hours / grandTotal) * 100 : 0
              return (
                <li key={project} className="flex items-center gap-3 rounded-sm px-2 py-1.5 -mx-2 text-sm hover:bg-accent">
                  <span
                    className="h-2.5 w-2.5 flex-none rounded-[3px]"
                    style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-foreground">{project}</span>
                  <span className="w-10 text-right text-muted-foreground">{pct.toFixed(0)}%</span>
                  <span className="w-[72px] text-right font-medium text-foreground">{formatHours(hours)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}
