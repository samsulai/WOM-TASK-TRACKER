import { ArrowRightLeft, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import Tooltip from './Tooltip'
import TaskRow from './TaskRow'
import { formatHours } from '../format'
import { useFlashOnChange } from '../hooks/useFlashOnChange'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export default function WeekCard({
  week,
  tasks,
  savingIds,
  fieldErrors,
  onUpdateTaskField,
  onAddTask,
  onDeleteTask,
  onUpdateWeekField,
  onDeleteWeek,
  onFlushTask,
  clients,
  onMoveWeek,
  onPrevWeek,
  onNextWeek,
  onToday,
  readOnly,
}) {
  const weekHours = tasks.reduce((sum, t) => sum + Number(t.hours || 0), 0)
  const doneCount = tasks.filter((t) => t.done).length
  const weekError = fieldErrors.get(`week:${week.id}`)
  const bumpHours = useFlashOnChange(weekHours)

  return (
    <Card className="week-card">
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-md"
            aria-label="Previous week"
            title="Previous week"
            disabled={!onPrevWeek}
            onClick={onPrevWeek}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-md"
            aria-label="Next week"
            title="Next week"
            disabled={!onNextWeek}
            onClick={onNextWeek}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </Button>
          <Button variant="outline" className="h-9 rounded-md" disabled={!onToday} onClick={onToday}>
            Today
          </Button>
        </div>
        {!readOnly && (
          <Button onClick={() => onAddTask(week.id)}>
            <Plus size={18} aria-hidden="true" /> Add task
          </Button>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 max-sm:w-full max-sm:flex-none">
          <p className="eyebrow mb-0.5 text-xs font-medium text-muted-foreground">Week of</p>
          <input
            type="date"
            value={week.week_start}
            disabled={readOnly}
            onChange={(e) => onUpdateWeekField(week.id, { week_start: e.target.value })}
            className="-ml-1.5 block rounded-md border-none bg-transparent px-1.5 py-0.5 text-2xl font-medium text-foreground outline-none transition-colors hover:not-disabled:bg-accent focus-visible:not-disabled:bg-accent disabled:opacity-100"
          />
          <input
            type="text"
            placeholder="Add a label…"
            value={week.label}
            disabled={readOnly}
            onChange={(e) => onUpdateWeekField(week.id, { label: e.target.value })}
            className="mt-1 block w-60 max-w-full border-0 border-b border-border bg-transparent py-1 text-sm text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:not-disabled:border-muted-foreground focus-visible:not-disabled:border-muted-foreground disabled:opacity-100"
          />
          {clients && <WeekOwner week={week} clients={clients} onMove={(clientId) => onMoveWeek(week.id, clientId)} />}
          {weekError && <p className="mt-2 text-sm text-destructive">{weekError}</p>}
        </div>
        <div className="flex-none text-right max-sm:order-1 max-sm:text-left">
          <span
            className={cn(
              'inline-block text-2xl font-medium text-primary transition-transform duration-200 ease-out',
              bumpHours && 'scale-110'
            )}
          >
            {formatHours(weekHours)}
          </span>
          <span className="block text-xs font-medium text-muted-foreground">logged</span>
          {tasks.length > 0 && (
            <div className="mt-1.5 flex items-center justify-end gap-2">
              <Progress value={(doneCount / tasks.length) * 100} className="h-1 w-12" />
              <span className="text-xs font-medium text-muted-foreground">
                {doneCount}/{tasks.length}
              </span>
            </div>
          )}
        </div>
        {!readOnly && (
          <Button variant="destructive" onClick={() => onDeleteWeek(week.id)}>
            <Trash2 size={16} aria-hidden="true" /> Delete week
          </Button>
        )}
      </div>

      {/* Below sm: collapses to stacked cards (each td shows its data-label
          as a caption) instead of a cramped, horizontally-scrolling table. */}
      <table className="task-table w-full border-collapse text-sm max-sm:block">
        <thead className="max-sm:hidden">
          <tr>
            <th className="p-2 pb-2.5 text-left text-xs font-medium text-muted-foreground">Project</th>
            <th className="p-2 pb-2.5 text-left text-xs font-medium text-muted-foreground">Notes</th>
            <th className="p-2 pb-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="p-2 pb-2.5 pr-3.5 text-right text-xs font-medium text-muted-foreground">Hours</th>
            <th className="p-2 pb-2.5 text-left text-xs font-medium text-muted-foreground">Done</th>
            <th></th>
          </tr>
        </thead>
        <tbody className="max-sm:block">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              saving={savingIds.has(task.id)}
              error={fieldErrors.get(task.id)}
              onFieldChange={onUpdateTaskField}
              onFlush={onFlushTask}
              onDelete={onDeleteTask}
              readOnly={readOnly}
            />
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={6} className="p-4 italic text-muted-foreground">
                No tasks logged this week yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!readOnly && (
        <Button variant="secondary" className="mx-auto mt-4 flex" onClick={() => onAddTask(week.id)}>
          <Plus size={18} aria-hidden="true" /> Add task
        </Button>
      )}
    </Card>
  )
}

// Who this week belongs to, plus an explicit "Move…" action to change it.
// Deliberately NOT a plain dropdown: an always-visible select looked like a
// "switch client" control, but it edits data.
function WeekOwner({ week, clients, onMove }) {
  const ownerName = week.client_id ? clients.find((c) => c.id === week.client_id)?.name || 'Client' : 'Internal'
  const options = [{ id: null, name: 'Internal (no client)' }, ...clients]

  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Belongs to</span>
      <span
        className={cn(
          'rounded-md bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground',
          week.client_id && 'bg-primary/10 text-primary'
        )}
      >
        {ownerName}
      </span>
      <DropdownMenu>
        <Tooltip text="Reassigns this whole week to a different client (or Internal). Doesn't move or change any tasks.">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <ArrowRightLeft size={14} aria-hidden="true" /> Move…
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start" className="min-w-[230px]">
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Move this whole week to:</p>
          {options.map((o) => {
            const current = (week.client_id || null) === o.id
            return (
              <DropdownMenuItem
                key={o.id || 'internal'}
                disabled={current}
                onSelect={() => onMove(o.id)}
                className={cn('gap-2', current && 'text-muted-foreground')}
              >
                <span className="flex w-4 flex-none text-primary">{current && <Check size={16} />}</span>
                {o.name}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
