import { formatHours } from '../format'
import { useFlashOnChange } from '../hooks/useFlashOnChange'
import { cn } from '@/lib/utils'

export default function StatsBar({ weeksCount, tasksOpen, tasksDone, hoursTotal }) {
  const bumpWeeks = useFlashOnChange(weeksCount)
  const bumpOpen = useFlashOnChange(tasksOpen)
  const bumpDone = useFlashOnChange(tasksDone)
  const bumpHours = useFlashOnChange(hoursTotal)

  const stats = [
    { label: 'Weeks logged', value: weeksCount, bump: bumpWeeks },
    { label: 'Tasks open', value: tasksOpen, tone: 'text-primary', bump: bumpOpen },
    { label: 'Tasks done', value: tasksDone, tone: 'text-success', bump: bumpDone },
    { label: 'Hours total', value: formatHours(hoursTotal), tone: 'text-primary', bump: bumpHours },
  ]

  return (
    <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="border-border p-4 [&:nth-child(-n+2)]:border-b [&:nth-child(odd)]:border-r sm:border-b-0 sm:px-5 sm:py-4 sm:[&:nth-child(odd)]:border-r-0 sm:[&:not(:last-child)]:border-r"
        >
          <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
          <span
            className={cn(
              'inline-block text-[1.85rem] font-medium leading-tight text-foreground transition-transform duration-200 ease-out',
              s.tone,
              s.bump && 'scale-110'
            )}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  )
}
