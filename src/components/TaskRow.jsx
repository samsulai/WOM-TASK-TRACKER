const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Blocked', 'Done']

function statusSlug(status) {
  return status.toLowerCase().replace(/\s+/g, '-')
}

export default function TaskRow({ task, saving, error, onFieldChange, onFlush, onDelete }) {
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

  const rowClass = ['task-row', task.done && 'task-row-done', error && 'task-row-error']
    .filter(Boolean)
    .join(' ')

  return (
    <tr className={rowClass}>
      <td>
        <input
          type="text"
          value={task.project}
          placeholder="Project"
          onChange={handleText('project')}
          onBlur={() => onFlush(task.id)}
        />
      </td>
      <td>
        <select
          className={`status-select status-${statusSlug(task.status)}`}
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td>
        <div className="hours-field">
          <input
            type="number"
            min="0"
            max="168"
            step="0.25"
            value={task.hours}
            onChange={handleHours}
            onBlur={() => onFlush(task.id)}
          />
          <span className="hours-suffix">hrs</span>
        </div>
      </td>
      <td>
        <input
          className="notes-input"
          type="text"
          value={task.notes}
          placeholder="Notes"
          onChange={handleText('notes')}
          onBlur={() => onFlush(task.id)}
        />
      </td>
      <td className="task-done-cell">
        <label className="check-control">
          <input
            type="checkbox"
            checked={task.done}
            onChange={(e) => handleDoneChange(e.target.checked)}
          />
          <span className="check-box" aria-hidden="true" />
        </label>
      </td>
      <td>
        <div className="row-end">
          {saving && <span className="row-status">Saving…</span>}
          {error && (
            <span className="row-status row-status-error">
              Failed to save
              <button onClick={() => onFlush(task.id)}>Retry</button>
            </span>
          )}
          <button
            className="icon-btn icon-btn-ghost"
            aria-label="Delete task"
            title="Delete task"
            onClick={() => onDelete(task.id)}
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  )
}
