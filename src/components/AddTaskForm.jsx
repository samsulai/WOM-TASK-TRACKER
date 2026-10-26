import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DurationInput from './DurationInput'
import { STATUS_OPTIONS } from './TaskRow'

function todayAsDateInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// A proper, explicit form for logging a new task -- nothing reaches the
// database until "Save task" is clicked, unlike the old approach (insert a
// blank row immediately, then silently clean it up if abandoned). Project,
// date and status are all editable up front here, instead of being filled
// in piecemeal after an empty row already exists.
export default function AddTaskForm({ onSave, onCancel }) {
  const [project, setProject] = useState('')
  const [date, setDate] = useState(todayAsDateInput)
  const [status, setStatus] = useState('Not Started')
  const [hours, setHours] = useState(0)
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const ok = await onSave({ project, date, status, hours })
    setSaving(false)
    if (!ok) return
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-lg border border-border p-4">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Project</span>
          <Input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="e.g. Landing page redesign"
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none transition-colors hover:border-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full justify-between">
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
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Time spent</span>
          <DurationInput value={hours} onCommit={setHours} max={168} ariaLabel="Time spent" />
          <span className="text-xs text-muted-foreground">Enter hours and minutes</span>
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          Save task
        </Button>
      </div>
    </form>
  )
}
