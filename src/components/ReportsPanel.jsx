import { useEffect, useState } from 'react'
import { Check, Mail, Send, X } from 'lucide-react'
import { callReport } from '../reportApi'
import { formatHours, formatWeekStart } from '../format'

const KEY_STORAGE = 'wtt-report-key'
const TEST_STORAGE = 'wtt-report-test-to'

function readStored(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}
function writeStored(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable -- the field simply won't be remembered
  }
}

async function fetchPreview(weekStart, key) {
  if (!key.trim()) throw new Error('Enter the report key first.')
  const data = await callReport({ mode: 'preview', weekStart }, key.trim())
  return data.clients
}

// Weekly client report: shows who would get it for the selected week (loaded
// automatically), sends it with one button, and keeps the rarely-needed bits
// (test email, report key) out of the way underneath. Each client is only
// ever emailed once per week (the server enforces that).
export default function ReportsPanel({ weekStart, onClose }) {
  const [adminKey, setAdminKey] = useState(() => readStored(KEY_STORAGE))
  const [editingKey, setEditingKey] = useState(() => !readStored(KEY_STORAGE))
  const [testTo, setTestTo] = useState(() => readStored(TEST_STORAGE))
  const [preview, setPreview] = useState(null)
  const [testClientId, setTestClientId] = useState('')
  // Starts busy when a key is already saved, because the list loads straight away.
  const [busy, setBusy] = useState(() => Boolean(readStored(KEY_STORAGE)))
  const [message, setMessage] = useState(null) // { type: 'ok' | 'error', text }

  const run = async (fn) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
    } catch (err) {
      if (/wrong report key/i.test(err.message)) setEditingKey(true)
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const applyPreview = (clients) => {
    setPreview(clients)
    setTestClientId((prev) => (clients.some((c) => c.clientId === prev) ? prev : clients[0]?.clientId || ''))
  }
  const loadPreview = async (key = adminKey) => applyPreview(await fetchPreview(weekStart, key))

  // Load the list as soon as the window opens (if a key is already saved).
  useEffect(() => {
    if (!readStored(KEY_STORAGE)) return undefined
    let cancelled = false
    fetchPreview(weekStart, readStored(KEY_STORAGE))
      .then((clients) => {
        if (cancelled) return
        setPreview(clients)
        setTestClientId(clients[0]?.clientId || '')
      })
      .catch((err) => {
        if (cancelled) return
        if (/wrong report key/i.test(err.message)) setEditingKey(true)
        setMessage({ type: 'error', text: err.message })
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [weekStart])

  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const ready = (preview || []).filter((c) => c.email && !c.alreadySent)
  const missingEmail = (preview || []).filter((c) => !c.email && !c.alreadySent)

  const sendTest = async () => {
    if (!adminKey.trim()) throw new Error('Enter the report key first.')
    if (!/^\S+@\S+\.\S+$/.test(testTo.trim())) throw new Error('Enter your own email address for the test.')
    const data = await callReport(
      { mode: 'test', weekStart, testTo: testTo.trim(), clientId: testClientId || undefined },
      adminKey.trim()
    )
    setMessage({ type: 'ok', text: `Test sent to ${data.testSentTo} (using ${data.usingClient}'s data). Nothing went to any client.` })
  }

  const sendAll = async () => {
    const list = ready.map((c) => `• ${c.name} → ${c.email}`).join('\n')
    if (!window.confirm(`Email these ${ready.length} client(s) their report for the week of ${formatWeekStart(weekStart)}?\n\n${list}`)) return
    const data = await callReport({ mode: 'send', weekStart, clientIds: ready.map((c) => c.clientId) }, adminKey.trim())
    const sent = data.results.filter((r) => r.status === 'sent').length
    const failed = data.results.filter((r) => r.status === 'failed')
    await loadPreview()
    setMessage({
      type: failed.length ? 'error' : 'ok',
      text:
        `Sent ${sent} report${sent === 1 ? '' : 's'}.` +
        (failed.length ? ` Failed: ${failed.map((f) => `${f.name} (${f.detail})`).join('; ')}` : ''),
    })
  }

  let hint = null
  if (preview && preview.length === 0) {
    hint = 'No client has tasks logged for this week yet, so there is nothing to send.'
  } else if (preview && ready.length === 0) {
    hint = missingEmail.length
      ? 'Add each client’s email in the Clients window to send their report.'
      : 'Everyone with tasks this week has already been sent their report.'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="clients-panel reports-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Weekly report"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clients-panel-header">
          <p className="eyebrow report-heading">
            <Mail size={22} aria-hidden="true" /> Weekly report
          </p>
          <button className="icon-btn icon-btn-ghost" onClick={onClose} aria-label="Close weekly report">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="clients-panel-hint">
          Emails each client who had tasks logged for the week of <strong>{formatWeekStart(weekStart)}</strong> a summary
          with an Excel attachment. To pick a different week, close this and select it in the Weeks list.
        </p>

        {editingKey && (
          <label className="report-field report-key-field">
            <span>Report key</span>
            {/* type=text + CSS masking (not type=password) so Chrome and
                password managers don't offer to save it as a login. */}
            <input
              type="text"
              className="secret-input"
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              autoFocus
              value={adminKey}
              placeholder="The REPORT_ADMIN_KEY you set"
              onChange={(e) => {
                setAdminKey(e.target.value)
                writeStored(KEY_STORAGE, e.target.value)
              }}
              onBlur={() => {
                if (!adminKey.trim()) return
                setEditingKey(false)
                run(() => loadPreview(adminKey))
              }}
            />
          </label>
        )}

        {busy && !preview && <p className="report-loading">Checking who gets a report…</p>}

        {preview && preview.length > 0 && (
          <ul className="report-preview">
            {preview.map((c) => (
              <li key={c.clientId}>
                <span className="report-preview-name">{c.name}</span>
                <span className="report-preview-meta">
                  {formatHours(c.hours)} · {c.tasks} task{c.tasks === 1 ? '' : 's'}
                </span>
                <span
                  className={`report-badge ${
                    c.alreadySent ? 'report-badge-sent' : c.email ? 'report-badge-ready' : 'report-badge-missing'
                  }`}
                >
                  {c.alreadySent ? 'Already sent' : c.email ? c.email : 'No email yet'}
                </span>
              </li>
            ))}
          </ul>
        )}

        {hint && <p className="report-hint">{hint}</p>}
        {message && <p className={`report-message report-message-${message.type}`}>{message.text}</p>}

        <div className="report-main-action">
          <button
            type="button"
            className="add-task-btn add-task-btn-primary"
            disabled={busy || ready.length === 0}
            onClick={() => run(sendAll)}
          >
            <Send size={16} aria-hidden="true" /> Send to {ready.length} client{ready.length === 1 ? '' : 's'}
          </button>
        </div>

        <div className="report-footer">
          <div className="report-test-row">
            <span>Send a test to</span>
            <input
              type="email"
              value={testTo}
              placeholder="you@yourcompany.com"
              aria-label="Email address for the test report"
              onChange={(e) => {
                setTestTo(e.target.value)
                writeStored(TEST_STORAGE, e.target.value)
              }}
            />
            {preview && preview.length > 1 && (
              <select
                className="report-test-client"
                value={testClientId}
                onChange={(e) => setTestClientId(e.target.value)}
                aria-label="Client whose data the test email uses"
              >
                {preview.map((c) => (
                  <option key={c.clientId} value={c.clientId}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="report-link-btn"
              disabled={busy || !preview || preview.length === 0}
              onClick={() => run(sendTest)}
            >
              Send test
            </button>
          </div>
          {!editingKey && (
            <div className="report-key-saved">
              <Check size={16} aria-hidden="true" /> Report key saved on this device
              <button type="button" className="report-link-btn" onClick={() => setEditingKey(true)}>
                Change
              </button>
              <button
                type="button"
                className="report-link-btn"
                onClick={() => {
                  setAdminKey('')
                  writeStored(KEY_STORAGE, '')
                  setPreview(null)
                  setEditingKey(true)
                }}
              >
                Forget
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
