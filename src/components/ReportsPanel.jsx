import { useEffect, useState } from 'react'
import { Check, Loader2, Mail, Send } from 'lucide-react'
import { callReport } from '../reportApi'
import { formatHours, formatWeekStart } from '../format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-label="Weekly report" className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail size={22} aria-hidden="true" /> Weekly report
          </DialogTitle>
          <DialogDescription>
            Emails each client who had tasks logged for the week of <strong className="text-foreground">{formatWeekStart(weekStart)}</strong>{' '}
            a summary with an Excel attachment. To pick a different week, close this and select it in the Weeks list.
          </DialogDescription>
        </DialogHeader>

        {editingKey && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-key">Report key</Label>
            {/* type=text + CSS masking (not type=password) so Chrome and
                password managers don't offer to save it as a login. */}
            <Input
              id="report-key"
              type="text"
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              autoFocus
              value={adminKey}
              placeholder="The REPORT_ADMIN_KEY you set"
              style={{ WebkitTextSecurity: 'disc' }}
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
          </div>
        )}

        {busy && !preview && <p className="text-sm text-muted-foreground">Checking who gets a report…</p>}

        {preview && preview.length > 0 && (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {preview.map((c) => (
              <li key={c.clientId} className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 text-sm">
                <span className="font-semibold text-foreground">{c.name}</span>
                <span className="text-muted-foreground">
                  {formatHours(c.hours)} · {c.tasks} task{c.tasks === 1 ? '' : 's'}
                </span>
                <Badge
                  variant={c.alreadySent ? 'success' : c.email ? 'default' : 'destructive'}
                  className="ml-auto max-w-full truncate"
                >
                  {c.alreadySent ? 'Already sent' : c.email ? c.email : 'No email yet'}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        {message && (
          <p className={cn('rounded-md px-3 py-2 text-sm', message.type === 'ok' ? 'bg-primary/10 text-primary' : 'bg-destructive/15 text-destructive')}>
            {message.text}
          </p>
        )}

        <div className="flex justify-end">
          <Button disabled={busy || ready.length === 0} onClick={() => run(sendAll)}>
            {busy && preview ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            Send to {ready.length} client{ready.length === 1 ? '' : 's'}
          </Button>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-border pt-3.5 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span>Send a test to</span>
            <Input
              type="email"
              value={testTo}
              placeholder="you@yourcompany.com"
              aria-label="Email address for the test report"
              className="h-8 flex-1 basis-[180px] text-sm"
              onChange={(e) => {
                setTestTo(e.target.value)
                writeStored(TEST_STORAGE, e.target.value)
              }}
            />
            {preview && preview.length > 1 && (
              <Select value={testClientId} onValueChange={setTestClientId}>
                <SelectTrigger size="sm" aria-label="Client whose data the test email uses">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {preview.map((c) => (
                    <SelectItem key={c.clientId} value={c.clientId}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="link"
              className="h-auto p-0 text-primary"
              disabled={busy || !preview || preview.length === 0}
              onClick={() => run(sendTest)}
            >
              Send test
            </Button>
          </div>
          {!editingKey && (
            <div className="flex flex-wrap items-center gap-2 text-success">
              <Check size={16} aria-hidden="true" /> Report key saved on this device
              <Button variant="link" className="h-auto p-0 text-primary" onClick={() => setEditingKey(true)}>
                Change
              </Button>
              <Button
                variant="link"
                className="h-auto p-0 text-primary"
                onClick={() => {
                  setAdminKey('')
                  writeStored(KEY_STORAGE, '')
                  setPreview(null)
                  setEditingKey(true)
                }}
              >
                Forget
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
