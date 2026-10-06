import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Blocked', 'Done']

// Tonal pill colors per status -- kept as explicit classes (not derived from
// the shared brand palette) because Blocked/Done need to stay red/green
// regardless of the one-accent-color rule everywhere else in the app.
const STATUS_STYLES = {
  'Not Started': 'bg-muted text-muted-foreground',
  'In Progress': 'bg-primary/10 text-primary',
  Blocked: 'bg-destructive/15 text-destructive',
  Done: 'bg-success/15 text-success',
}

export default function TaskRow({ task, saving, error, onFieldChange, onFlush, onDelete, readOnly }) {
  const handleText = (field) => (e) => onFieldChange(task.id, { [field]: e.target.value })
  const handleHours = (e) => {
    const value = e.target.value === '' ? 0 : Number(e.target.value)
    if (Number.isNaN(value)) return
    onFieldChange(task.id, { hours: value })
  }
  const handleImmediate = (patch) => onFieldChange(task.id, patch, { immediate: true })

  // Status and the Done checkbox are kept in lockstep: either one can drive
  // the other, but they can never disagree.
  const handleStatusChange = (status) => handleImmediate({ status, done: status === 'Done' })
  const handleDoneChange = (done) =>
    handleImmediate({ done, status: done ? 'Done' : task.status === 'Done' ? 'In Progress' : task.status })

  return (
    <tr
      className={cn(
        'border-b border-border/60 last:border-0',
        'max-sm:mb-2.5 max-sm:block max-sm:rounded-lg max-sm:border max-sm:border-border max-sm:p-2.5 max-sm:last:mb-0',
        error && 'bg-destructive/5'
      )}
    >
      <td className="p-2 max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:before:w-16 max-sm:before:flex-none max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]" data-label="Project">
        <Input
          value={task.project}
          placeholder="Project"
          disabled={readOnly}
          onChange={handleText('project')}
          onBlur={() => onFlush(task.id)}
          className={cn(
            'border-transparent bg-transparent font-semibold',
            task.done && 'text-muted-foreground line-through'
          )}
        />
      </td>
      <td className="p-2 max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:before:w-16 max-sm:before:flex-none max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]" data-label="Notes">
        <Input
          value={task.notes}
          placeholder="Notes"
          disabled={readOnly}
          onChange={handleText('notes')}
          onBlur={() => onFlush(task.id)}
          className={cn('border-transparent bg-transparent text-muted-foreground', task.done && 'line-through')}
        />
      </td>
      <td className="p-2 max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:before:w-16 max-sm:before:flex-none max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]" data-label="Status">
        <Select value={task.status} disabled={readOnly} onValueChange={handleStatusChange}>
          <SelectTrigger
            className={cn(
              'w-fit justify-start gap-1.5 rounded-full border-none font-semibold duration-200',
              STATUS_STYLES[task.status],
              readOnly && 'disabled:opacity-100'
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2 max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:before:w-16 max-sm:before:flex-none max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]" data-label="Hours">
        <div className="relative ml-auto w-[116px] max-sm:ml-0 max-sm:w-auto max-sm:flex-1">
          <Input
            type="number"
            min="0"
            max="168"
            step="0.25"
            value={task.hours}
            disabled={readOnly}
            onChange={handleHours}
            onBlur={() => onFlush(task.id)}
            className="border-transparent bg-transparent pr-9 text-right text-[1.05rem] font-semibold max-sm:text-left"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            hrs
          </span>
        </div>
      </td>
      <td className="p-2 text-center max-sm:text-left max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:before:w-16 max-sm:before:flex-none max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]" data-label="Done">
        <Checkbox checked={task.done} disabled={readOnly} onCheckedChange={handleDoneChange} />
      </td>
      <td className="p-2 max-sm:flex max-sm:before:hidden" data-label="">
        <div className="flex items-center justify-end gap-2">
          {saving && <span className="whitespace-nowrap text-xs text-muted-foreground">Saving…</span>}
          {error && (
            <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-destructive">
              Failed to save
              <button
                className="rounded-full border border-current px-2 py-0.5 text-[0.68rem] font-semibold"
                onClick={() => onFlush(task.id)}
              >
                Retry
              </button>
            </span>
          )}
          {!readOnly && (
            <Button
              variant="destructive"
              size="icon"
              className="size-9"
              aria-label="Delete task"
              title="Delete task"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}
