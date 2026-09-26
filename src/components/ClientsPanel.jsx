import { useEffect, useState } from 'react'
import { formatHours } from '../format'
import { Check, Copy, Eye, Plus, Trash2, X } from 'lucide-react'

export default function ClientsPanel({
  clients,
  clientStats,
  onAddClient,
  onDeleteClient,
  onViewClient,
  onUpdateClientEmail,
  onClose,
}) {
  const [name, setName] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const copyLink = async (id) => {
    const url = `${window.location.origin}${window.location.pathname}?client=${id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copy this link:', url)
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1600)
  }

  const handleAdd = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAddClient(trimmed)
    setName('')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="clients-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Clients"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clients-panel-header">
          <p className="eyebrow">Clients</p>
          <button className="icon-btn icon-btn-ghost" onClick={onClose} aria-label="Close clients panel">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="clients-panel-hint">
          Click a client to view only their weeks. Use the copy button for their shareable link, or the bin to remove them.
        </p>

        <form className="clients-add-form" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="New client name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="add-task-btn">
            <Plus size={18} aria-hidden="true" /> Add
          </button>
        </form>

        <ul className="clients-list">
          {clients.map((c) => {
            const stats = clientStats.get(c.id)
            return (
              <li key={c.id}>
                <button
                  className="clients-list-info"
                  onClick={() => onViewClient(c.id)}
                  title={`View only ${c.name}'s weeks`}
                >
                  <span className="clients-list-name">
                    <Eye size={15} className="clients-list-view-icon" aria-hidden="true" />
                    {c.name}
                  </span>
                  <span className="clients-list-stats">
                    {stats
                      ? `${formatHours(stats.hoursTotal)} · ${stats.weeksCount} week${stats.weeksCount === 1 ? '' : 's'} · ${stats.tasksOpen} open · ${stats.tasksDone} done`
                      : 'No weeks yet'}
                  </span>
                </button>
                <div className="clients-list-actions">
                  <button
                    className="icon-btn icon-btn-copy"
                    aria-label={`Copy link for ${c.name}`}
                    title="Copy link"
                    onClick={() => copyLink(c.id)}
                  >
                    {copiedId === c.id ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                  </button>
                  <button
                    className="icon-btn icon-btn-danger"
                    aria-label={`Delete ${c.name}`}
                    title={`Delete ${c.name}`}
                    onClick={() => onDeleteClient(c.id)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
                <input
                  key={`${c.id}:${c.email || ''}`}
                  type="email"
                  className="clients-list-email"
                  aria-label={`Report email for ${c.name}`}
                  placeholder="Email for weekly reports"
                  defaultValue={c.email || ''}
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    if (value !== (c.email || '')) onUpdateClientEmail(c.id, value)
                  }}
                />
              </li>
            )
          })}
          {clients.length === 0 && <p className="empty-row">No clients yet.</p>}
        </ul>
      </div>
    </div>
  )
}
