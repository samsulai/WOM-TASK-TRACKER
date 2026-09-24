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
}) {
  const weekHours = tasks.reduce((sum, t) => sum + Number(t.hours || 0), 0)
  const doneCount = tasks.filter((t) => t.done).length
  const weekError = fieldErrors.get(`week:${week.id}`)

  return (
    <section className="week-card">
      <div className="week-card-header">
        <div className="week-heading">
          <p className="eyebrow">Week of</p>
          <input
            className="week-date-input"
            type="date"
            value={week.week_start}
            onChange={(e) => onUpdateWeekField(week.id, { week_start: e.target.value })}
          />
          <input
            className="week-label-input"
            type="text"
            placeholder="Add a label…"
            value={week.label}
            onChange={(e) => onUpdateWeekField(week.id, { label: e.target.value })}
          />
          {clients && (
            <label className="week-client-field">
              <span className="week-client-label">Assign this week to:</span>
              <select
                className="week-client-select"
                value={week.client_id || ''}
                title="Assign this whole week to a client, or keep it internal"
                onChange={(e) => onUpdateWeekField(week.id, { client_id: e.target.value || null })}
              >
                <option value="">Internal (not assigned to a client)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
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
        <button
          className="icon-btn icon-btn-danger"
          aria-label="Delete week"
          title="Delete week"
          onClick={() => onDeleteWeek(week.id)}
        >
          Del
        </button>
      </div>

      <table className="task-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Status</th>
            <th>Hours</th>
            <th>Notes</th>
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

      <button className="add-task-btn" onClick={() => onAddTask(week.id)}>
        + Add task
      </button>
    </section>
  )
}
