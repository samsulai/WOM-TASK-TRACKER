import { Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import DurationInput from './DurationInput'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatWeekStart } from '../format'
import { cn } from '@/lib/utils'

export const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Blocked', 'Done']

// Status color, as a filled pill -- a tinted background in the status
// color plus matching text, no border. Kept as explicit classes (not
// derived from the shared brand palette) because Blocked/Done need to stay
// red/green regardless of the one-accent-color rule everywhere else in
// the app.
const STATUS_PILL = {
  'Not Started': 'bg-muted text-muted-foreground',
  'In Progress': 'bg-primary/10 text-primary',
  Blocked: 'bg-destructive/10 text-destructive',
  Done: 'bg-success/10 text-success',
}
const STATUS_DOT = {
  'Not Started': 'bg-muted-foreground',
  'In Progress': 'bg-primary',
  Blocked: 'bg-destructive',
  Done: 'bg-success',
}

export default function TaskRow({ task, saving, error, onFieldChange, onFlush, onDelete, onVerify, readOnly }) {
  const handleText = (field) => (e) => onFieldChange(task.id, { [field]: e.target.value })
  const handleImmediate = (patch) => onFieldChange(task.id, patch, { immediate: true })

  // Status and the Done checkbox are kept in lockstep: either one can drive
  // the other, but they can never disagree.
  const handleStatusChange = (status) => handleImmediate({ status, done: status === 'Done' })
  const handleDoneChange = (done) =>
    handleImmediate({ done, status: done ? 'Done' : task.status === 'Done' ? 'In Progress' : task.status })

  // A task logged via Slack arrives unverified and is held out of this
  // client's Google Sheet until approved here -- see App.jsx's verifyTask.
  // A task created in the app is always verified from the start, so this
  // never shows for anything but a Slack-submitted entry.
  const pending = task.verified === false

  return (
    <tr
      className={cn(
        'group border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30',
        'max-sm:mb-2.5 max-sm:block max-sm:rounded-lg max-sm:border max-sm:border-border max-sm:p-2.5 max-sm:last:mb-0',
        error ? 'bg-destructive/5' : pending && 'bg-warning/5'
      )}
    >
      <td className="p-2 max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:before:w-16 max-sm:before:flex-none max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]" data-label="Project">
        <div className="flex min-w-0 flex-col gap-1">
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
          {pending && (
            <span className="ml-3 inline-flex w-fit items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[0.68rem] font-semibold text-warning">
              <span className="size-1.5 flex-none rounded-full bg-warning" aria-hidden="true" />
              Pending review
            </span>
          )}
        </div>
      </td>
      <td className="p-2 text-muted-foreground max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:before:w-16 max-sm:before:flex-none max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]" data-label="Date">
        {formatWeekStart(task.created_at.slice(0, 10), { year: false })}
      </td>
      <td className="p-2 max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:before:w-16 max-sm:before:flex-none max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]" data-label="Status">
        <Select value={task.status} disabled={readOnly} onValueChange={handleStatusChange}>
          <SelectTrigger
            className={cn(
              'w-fit justify-start gap-1.5 rounded-full border-none px-3 py-1 font-semibold duration-200 hover:not-disabled:brightness-95',
              STATUS_PILL[task.status],
              readOnly && 'disabled:opacity-100 disabled:hover:brightness-100'
            )}
          >
            <SelectValue>{task.status}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                <span className={cn('mr-1.5 inline-block size-2 flex-none rounded-full', STATUS_DOT[s])} aria-hidden="true" />
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2 max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:before:w-16 max-sm:before:flex-none max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]" data-label="Hours">
        <DurationInput
          value={task.hours}
          disabled={readOnly}
          ariaLabel="Hours"
          max={168}
          onCommit={(hours) => handleImmediate({ hours })}
          className="ml-auto text-[1.05rem] font-semibold max-sm:ml-0"
        />
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
          {!readOnly && pending && onVerify && (
            <Button
              variant="outline"
              size="sm"
              className="whitespace-nowrap border-warning/40 text-warning hover:bg-warning/10"
              onClick={() => onVerify(task.id)}
            >
              <Check size={14} aria-hidden="true" /> Approve
            </Button>
          )}
          {!readOnly && (
            <Button
              variant="destructive"
              size="icon"
              className="size-9 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100"
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
