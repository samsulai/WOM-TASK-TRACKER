import { useState } from 'react'
import { ArrowRightLeft, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import Tooltip from './Tooltip'
import TaskRow from './TaskRow'
import AddTaskForm from './AddTaskForm'
import { formatHours } from '../format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export default function WeekCard({
  week,
  tasks,
  savingIds,
  fieldErrors,
  onUpdateTaskField,
  onAddTask,
  onDeleteTask,
  onVerifyTask,
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
  const weekError = fieldErrors.get(`week:${week.id}`)
  const [addingTask, setAddingTask] = useState(false)
  const saveNewTask = async (taskData) => {
    const ok = await onAddTask(week.id, taskData)
    if (ok) setAddingTask(false)
    return ok
  }

  return (
    <Card className="week-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
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
          <div className="flex items-center gap-1.5">
            <Button onClick={() => setAddingTask(true)} disabled={addingTask}>
              <Plus size={18} aria-hidden="true" /> Add task
            </Button>
            <Button variant="destructive" onClick={() => onDeleteWeek(week.id)}>
              <Trash2 size={16} aria-hidden="true" /> Delete week
            </Button>
          </div>
        )}
      </div>

      {/* Week-level facts as a plain, borderless block -- the hours/done
          counts already live in the stat cards above and the Tasks table's
          own footer total, so this is just what's editable: the date,
          an optional label, and (admin-only) who the week belongs to. */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <input
            type="date"
            value={week.week_start}
            disabled={readOnly}
            onChange={(e) => onUpdateWeekField(week.id, { week_start: e.target.value })}
            className="block w-full max-w-[220px] rounded-md border-none bg-transparent px-1.5 py-0.5 text-xl font-medium text-foreground outline-none transition-colors hover:not-disabled:bg-accent focus-visible:not-disabled:bg-accent disabled:opacity-100"
          />
          <input
            type="text"
            placeholder="Add a label for this week…"
            value={week.label}
            disabled={readOnly}
            onChange={(e) => onUpdateWeekField(week.id, { label: e.target.value })}
            className="mt-1 block w-60 max-w-full border-0 border-b border-border bg-transparent px-1.5 py-1 text-sm text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:not-disabled:border-muted-foreground focus-visible:not-disabled:border-muted-foreground disabled:opacity-100"
          />
          {weekError && <p className="mt-2 text-sm text-destructive">{weekError}</p>}
        </div>
        {clients && <WeekOwner week={week} clients={clients} onMove={(clientId) => onMoveWeek(week.id, clientId)} />}
      </div>

      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-medium">Tasks</h3>
        {!readOnly && tasks.length > 0 && !addingTask && (
          <p className="text-xs text-muted-foreground">Tick a task to mark it done</p>
        )}
      </div>

      {addingTask && <AddTaskForm onSave={saveNewTask} onCancel={() => setAddingTask(false)} />}

      {/* Below sm: collapses to stacked cards (each td shows its data-label
          as a caption) instead of a cramped, horizontally-scrolling table. */}
      <div className="overflow-hidden rounded-lg border border-border max-sm:overflow-visible max-sm:rounded-none max-sm:border-none">
        <table className="task-table w-full border-collapse text-sm max-sm:block">
          <thead className="max-sm:hidden">
            <tr className="border-b border-border bg-muted/50">
              <th className="p-2 pb-2.5 pl-3.5 text-left text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">Project</th>
              <th className="p-2 pb-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
              <th className="p-2 pb-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
              <th className="p-2 pb-2.5 pr-3.5 text-right text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">Hours</th>
              <th className="p-2 pb-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">Done</th>
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
                onVerify={onVerifyTask}
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
          {tasks.length > 0 && (
            <tfoot className="max-sm:block">
              <tr className="border-t border-border bg-muted/30 max-sm:flex max-sm:items-center max-sm:justify-between max-sm:p-2.5">
                <td className="p-2 pl-3.5 max-sm:p-0" colSpan={3}>
                  {!readOnly && !addingTask && (
                    <button
                      type="button"
                      onClick={() => setAddingTask(true)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      <Plus size={16} aria-hidden="true" /> Add task
                    </button>
                  )}
                </td>
                <td className="p-2 pr-3.5 text-right max-sm:p-0" colSpan={3}>
                  <span className="font-semibold text-foreground">{formatHours(weekHours)}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">total</span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!readOnly && tasks.length === 0 && !addingTask && (
        <Button variant="secondary" className="mx-auto mt-4 flex" onClick={() => setAddingTask(true)}>
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
    <div className="flex flex-wrap items-center gap-2">
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
