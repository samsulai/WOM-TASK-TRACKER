import { formatHours, formatWeekStart } from '../format'
import { useFlashOnChange } from '../hooks/useFlashOnChange'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

// Two modes, same 4-card layout:
// - 'default' (Everything / Internal only): weeks + tasks + total hours --
//   aggregate rollups across multiple clients/weeks.
// - 'client' (a single client in view): Hours logged / Hours bought / Hours
//   left (or Over budget, called out with its own red card) / Tasks done --
//   the budget comparison a single client's page is actually about.
export default function StatsBar({
  mode = 'default',
  weeksCount,
  tasksOpen,
  tasksDone,
  hoursTotal,
  hoursUsed,
  hoursBought,
  purchases = [],
}) {
  const totalTasks = tasksOpen + tasksDone
  const over = mode === 'client' && hoursBought > 0 && hoursUsed > hoursBought
  const remaining = Math.abs(hoursBought - hoursUsed)
  const pctUsed = hoursBought > 0 ? Math.round((hoursUsed / hoursBought) * 100) : null

  const bumpPrimary = useFlashOnChange(mode === 'client' ? hoursUsed : weeksCount)
  const bumpOpen = useFlashOnChange(tasksOpen)
  const bumpDone = useFlashOnChange(tasksDone)
  const bumpQuaternary = useFlashOnChange(mode === 'client' ? remaining : hoursTotal)

  const tiles =
    mode === 'client'
      ? [
          {
            label: 'Hours logged',
            value: formatHours(hoursUsed),
            sub: `${totalTasks} task${totalTasks === 1 ? '' : 's'} logged`,
            bump: bumpPrimary,
          },
          {
            label: 'Hours bought',
            value: formatHours(hoursBought),
            sub: purchases.length
              ? `${purchases.length} purchase${purchases.length === 1 ? '' : 's'} · last ${formatWeekStart(purchases[0].purchased_on, { year: false })}`
              : 'None yet',
          },
          {
            label: hoursBought > 0 ? (over ? 'Over budget' : 'Hours left') : 'Hours left',
            value: hoursBought > 0 ? formatHours(remaining) : '—',
            sub: hoursBought > 0 ? `${pctUsed}% of bought hours used` : 'No hours bought yet',
            tone: over ? 'text-destructive' : hoursBought > 0 ? 'text-success' : undefined,
            danger: over,
            bump: bumpQuaternary,
          },
          {
            label: 'Tasks done',
            value: `${tasksDone} of ${totalTasks}`,
            progress: totalTasks > 0 ? (tasksDone / totalTasks) * 100 : 0,
            bump: bumpDone,
          },
        ]
      : [
          { label: 'Weeks logged', value: weeksCount, bump: bumpPrimary },
          { label: 'Tasks open', value: tasksOpen, tone: 'text-primary', bump: bumpOpen },
          {
            label: 'Tasks done',
            value: `${tasksDone} of ${totalTasks}`,
            progress: totalTasks > 0 ? (tasksDone / totalTasks) * 100 : 0,
            bump: bumpDone,
          },
          { label: 'Hours total', value: formatHours(hoursTotal), tone: 'text-primary', bump: bumpQuaternary },
        ]

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={cn(
            'rounded-xl border p-4 shadow-[var(--elev-1)] transition-colors duration-200',
            t.danger ? 'border-destructive/30 bg-destructive/10' : 'border-border bg-card'
          )}
        >
          <p
            className={cn(
              'text-[0.7rem] font-semibold uppercase tracking-wide',
              t.danger ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {t.label}
          </p>
          <span
            className={cn(
              'inline-block text-[1.85rem] font-bold leading-tight text-foreground transition-transform duration-200 ease-out',
              t.tone,
              t.bump && 'scale-110'
            )}
          >
            {t.value}
          </span>
          {t.sub && (
            <p className={cn('mt-0.5 text-xs font-normal', t.danger ? 'text-destructive' : 'text-muted-foreground')}>
              {t.sub}
            </p>
          )}
          {t.progress != null && <Progress value={t.progress} className="mt-2 h-1.5" />}
        </div>
      ))}
    </div>
  )
}
