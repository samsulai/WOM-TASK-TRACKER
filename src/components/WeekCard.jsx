import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import TaskRow from './TaskRow'
import { formatHours } from '../format'

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

  return (
    <section className="week-card">
      <div className="week-toolbar">
        <div className="week-stepper">
          <button
            type="button"
            className="stepper-btn"
            aria-label="Previous week"
            title="Previous week"
            disabled={!onPrevWeek}
            onClick={onPrevWeek}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="stepper-btn"
            aria-label="Next week"
            title="Next week"
            disabled={!onNextWeek}
            onClick={onNextWeek}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <button type="button" className="today-btn" disabled={!onToday} onClick={onToday}>
            Today
          </button>
        </div>
        {!readOnly && (
          <button className="add-task-btn add-task-btn-primary" onClick={() => onAddTask(week.id)}>
            <Plus size={18} aria-hidden="true" /> Add task
          </button>
        )}
      </div>
      <div className="week-card-header">
        <div className="week-heading">
          <p className="eyebrow">Week of</p>
          <input
            className="week-date-input"
            type="date"
            value={week.week_start}
            disabled={readOnly}
            onChange={(e) => onUpdateWeekField(week.id, { week_start: e.target.value })}
          />
          <input
            className="week-label-input"
            type="text"
            placeholder="Add a label…"
            value={week.label}
            disabled={readOnly}
            onChange={(e) => onUpdateWeekField(week.id, { label: e.target.value })}
          />
          {clients && (
            <WeekOwner week={week} clients={clients} onMove={(clientId) => onMoveWeek(week.id, clientId)} />
          )}
          {weekError && <p className="week-error">{weekError}</p>}
        </div>
        <div className="week-card-stat">
          <span className="stat-value">{formatHours(weekHours)}</span>
          <span className="stat-caption">logged</span>
          {tasks.length > 0 && (
            <div className="week-progress">
              <span className="week-progress-track">
                <span
                  className="week-progress-fill"
                  style={{ width: `${(doneCount / tasks.length) * 100}%` }}
                />
              </span>
              <span className="week-progress-label">
                {doneCount}/{tasks.length}
              </span>
            </div>
          )}
        </div>
        {!readOnly && (
          <button
            className="icon-btn icon-btn-danger"
            aria-label="Delete week"
            title="Delete week"
            onClick={() => onDeleteWeek(week.id)}
          >
            <Trash2 size={16} aria-hidden="true" /> Delete week
          </button>
        )}
      </div>

      <table className="task-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Notes</th>
            <th>Status</th>
            <th className="th-hours">Hours</th>
            <th>Done</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
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
              <td colSpan={6} className="empty-row">
                No tasks logged this week yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!readOnly && (
        <button className="add-task-btn" onClick={() => onAddTask(week.id)}>
          <Plus size={18} aria-hidden="true" /> Add task
        </button>
      )}
    </section>
  )
}

// Who this week belongs to, plus an explicit "Move…" action to change it.
// Deliberately NOT a plain dropdown: an always-visible select looked like a
// "switch client" control, but it edits data.
function WeekOwner({ week, clients, onMove }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const ownerName = week.client_id ? clients.find((c) => c.id === week.client_id)?.name || 'Client' : 'Internal'
  const options = [{ id: null, name: 'Internal (no client)' }, ...clients]

  return (
    <div className="week-owner" ref={rootRef}>
      <span className="week-owner-label">Belongs to</span>
      <span className={`week-owner-chip${week.client_id ? ' week-owner-chip-client' : ''}`}>{ownerName}</span>
      <button
        type="button"
        className="week-owner-move"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ArrowRightLeft size={14} aria-hidden="true" /> Move…
      </button>
      {open && (
        <div className="week-owner-menu" role="menu">
          <p className="week-owner-menu-title">Move this whole week to:</p>
          {options.map((o) => {
            const current = (week.client_id || null) === o.id
            return (
              <button
                key={o.id || 'internal'}
                type="button"
                role="menuitem"
                className={`week-owner-option${current ? ' week-owner-option-current' : ''}`}
                disabled={current}
                onClick={() => {
                  setOpen(false)
                  onMove(o.id)
                }}
              >
                <span className="week-owner-check" aria-hidden="true">{current && <Check size={16} />}</span> {o.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
