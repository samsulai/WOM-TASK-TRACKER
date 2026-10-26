// Slack slash-command + modal Edge Function for logging tasks directly
// from Slack (see README "Slack task logging" for setup). Staff run
// /log-task, get a modal (Client -- a real client or "Internal", Project,
// Date, Status, Time spent), and submitting it inserts a normal task row --
// from there it's indistinguishable from a task created in the app itself:
// it shows up via the app's realtime subscription and, if that client has
// Google Sheet sync on, the existing tasks-insert trigger fires sheet-sync
// for it automatically, same as any other insert.
//
// Two request shapes hit this one endpoint (both from the same Slack app,
// both form-encoded): a slash command (has a `command` field -- we open
// the modal via views.open) and a modal submission (has a `payload` field,
// a JSON string, sent when "Save task" is clicked -- we insert the task).
//
// Auth: Slack signs every request with HMAC-SHA256 over the raw body
// (verifySlackSignature) -- no shared secret to invent, unlike sheet-sync.
// Access to the command itself is further restricted to an explicit
// allowlist of Slack user ids (SLACK_ALLOWED_USER_IDS), since a slash
// command is otherwise runnable by anyone in the workspace.
//
// Everything above Deno.serve is plain functions with no Deno/network
// dependency at import time, so it can be unit-tested outside Supabase.

export const INTERNAL_VALUE = '__internal__'
export const SHORTCUT_CALLBACK_ID = 'log_task_shortcut'
export const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Blocked', 'Done']

// ---------------------------------------------------------------- pure logic

// Monday of the calendar week containing `dateStr` -- mirrors the app's own
// todayAsWeekStart() (src/App.jsx), just for an arbitrary date instead of
// always "now". Plain UTC date math throughout, so this never shifts a day
// depending on which timezone the function happens to run in.
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString().slice(0, 10)
}

export function hmToHours(h: number, m: number): number {
  return (Number.isFinite(h) ? h : 0) + (Number.isFinite(m) ? m : 0) / 60
}

// The modal's Client dropdown always offers "Internal" first (matching the
// app's own "Internal (no client)" option when moving a week), followed by
// every real client. A client's id doubles as the option's value; Internal
// uses a sentinel that can never collide with a real uuid.
export function buildClientOptions(clients: { id: string; name: string }[]) {
  const toOption = (text: string, value: string) => ({ text: { type: 'plain_text', text }, value })
  return [toOption('Internal', INTERNAL_VALUE), ...clients.map((c) => toOption(c.name, c.id))]
}

// Slack's modal value -> this app's client_id: the Internal sentinel maps
// to null (exactly like a week with no client_id today), anything else is
// a real client's uuid, passed through unchanged.
export function resolveClientId(selectedValue: string): string | null {
  return selectedValue === INTERNAL_VALUE ? null : selectedValue
}

// Builds the full Block Kit modal -- pure and testable, so the tricky bits
// (which block/action ids the submission parser has to match back up,
// which option is pre-selected) are pinned down by plain test cases rather
// than only verified by hand against a live Slack modal.
export function buildModalView(clients: { id: string; name: string }[], today: string) {
  return {
    type: 'modal',
    callback_id: 'log_task_modal',
    title: { type: 'plain_text', text: 'Log a task' },
    submit: { type: 'plain_text', text: 'Save task' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'client_block',
        label: { type: 'plain_text', text: 'Client' },
        element: {
          type: 'static_select',
          action_id: 'client_select',
          placeholder: { type: 'plain_text', text: 'Select a client' },
          options: buildClientOptions(clients),
        },
      },
      {
        type: 'input',
        block_id: 'project_block',
        label: { type: 'plain_text', text: 'Project' },
        element: {
          type: 'plain_text_input',
          action_id: 'project_input',
          placeholder: { type: 'plain_text', text: 'e.g. Landing page redesign' },
        },
      },
      {
        type: 'input',
        block_id: 'date_block',
        label: { type: 'plain_text', text: 'Date' },
        element: { type: 'datepicker', action_id: 'date_picker', initial_date: today },
      },
      {
        type: 'input',
        block_id: 'status_block',
        label: { type: 'plain_text', text: 'Status' },
        element: {
          type: 'static_select',
          action_id: 'status_select',
          initial_option: { text: { type: 'plain_text', text: STATUS_OPTIONS[0] }, value: STATUS_OPTIONS[0] },
          options: STATUS_OPTIONS.map((s) => ({ text: { type: 'plain_text', text: s }, value: s })),
        },
      },
      {
        type: 'input',
        block_id: 'hours_block',
        label: { type: 'plain_text', text: 'Hours' },
        element: {
          type: 'number_input',
          action_id: 'hours_input',
          is_decimal_allowed: false,
          min_value: '0',
          initial_value: '0',
        },
      },
      {
        type: 'input',
        block_id: 'minutes_block',
        label: { type: 'plain_text', text: 'Minutes' },
        element: {
          type: 'number_input',
          action_id: 'minutes_input',
          is_decimal_allowed: false,
          min_value: '0',
          max_value: '59',
          initial_value: '0',
        },
      },
    ],
  }
}

// Pulls the five answers back out of Slack's view.state.values shape (see
// buildModalView for the matching block/action ids) into a flat, easy-to-use
// object. Returns null if the shape doesn't match what's expected --
// defensive against a stale modal somehow still being submitted after this
// function's blocks have since changed.
export function parseSubmission(values: any): {
  clientValue: string
  project: string
  date: string
  status: string
  hours: number
  minutes: number
} | null {
  try {
    const clientValue = values.client_block.client_select.selected_option.value
    const project = values.project_block.project_input.value
    const date = values.date_block.date_picker.selected_date
    const status = values.status_block.status_select.selected_option.value
    const hours = Number(values.hours_block.hours_input.value)
    const minutes = Number(values.minutes_block.minutes_input.value)
    if (!clientValue || !project || !date || !status) return null
    return { clientValue, project, date, status, hours, minutes }
  } catch {
    return null
  }
}

// Builds the exact `tasks` insert body -- mirrors the app's own addTask
// (src/App.jsx): created_at fixed to noon UTC on the chosen date (avoids
// any local/UTC day-shift risk), done follows status exactly like the
// in-app Status <-> Done lockstep (src/components/TaskRow.jsx).
// verified is always false here -- Slack is the one task-entry path with
// no admin review before the data lands in the database, so it's held
// back from Google Sheet sync (see sheet-sync's loadClientTasks) until an
// admin approves it in the app.
export function buildTaskInsertPayload(params: {
  weekId: string
  project: string
  status: string
  hours: number
  minutes: number
  date: string
}) {
  return {
    week_id: params.weekId,
    project: params.project.trim(),
    status: params.status,
    hours: hmToHours(params.hours, params.minutes),
    notes: '',
    done: params.status === 'Done',
    created_at: `${params.date}T12:00:00.000Z`,
    verified: false,
  }
}

// ------------------------------------------------------------------- plumbing

const env = (name: string) => (globalThis as any).Deno?.env.get(name) ?? ''

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Slack's own signature scheme: HMAC-SHA256 over "v0:<timestamp>:<raw body>"
// using the app's Signing Secret, compared against the X-Slack-Signature
// header. The timestamp check (reject anything older than 5 minutes) is
// Slack's documented replay-protection recommendation.
async function verifySlackSignature(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get('x-slack-signature') || ''
  const timestamp = req.headers.get('x-slack-request-timestamp') || ''
  if (!signature || !timestamp) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 60 * 5) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env('SLACK_SIGNING_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`v0:${timestamp}:${rawBody}`))
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return safeEqual(`v0=${hex}`, signature)
}

async function rest(path: string, init: RequestInit = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Database ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function slackApi(method: string, body: unknown) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('SLACK_BOT_TOKEN')}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`Slack ${method} failed: ${data.error}`)
  return data
}

function isAllowed(userId: string): boolean {
  const allowed = env('SLACK_ALLOWED_USER_IDS')
    .split(',')
    .map((id: string) => id.trim())
    .filter(Boolean)
  return allowed.includes(userId)
}

// Finds the existing week for this client covering `dateStr`'s calendar
// week, or creates one -- staff logging a task from Slack should never be
// blocked on an admin having pre-created the week in the app first.
async function resolveWeekId(clientId: string | null, dateStr: string): Promise<string> {
  const weekStart = mondayOf(dateStr)
  const clientFilter = clientId ? `client_id=eq.${clientId}` : 'client_id=is.null'
  const existing: { id: string }[] = await rest(`weeks?select=id&week_start=eq.${weekStart}&${clientFilter}&limit=1`)
  if (existing[0]) return existing[0].id
  const created: { id: string }[] = await rest('weeks', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ week_start: weekStart, label: '', client_id: clientId }),
  })
  return created[0].id
}

// Shared by both ways of opening the modal -- the slash command and the
// global shortcut (see handleGlobalShortcut). trigger_id expires ~3 seconds
// after it's issued, so this always has to run inline, never queued.
async function openLogTaskModal(triggerId: string): Promise<void> {
  const clients: { id: string; name: string }[] = await rest('clients?select=id,name&order=name.asc')
  const today = new Date().toISOString().slice(0, 10)
  await slackApi('views.open', { trigger_id: triggerId, view: buildModalView(clients, today) })
}

async function handleSlashCommand(params: URLSearchParams): Promise<Response> {
  const userId = params.get('user_id') || ''
  const triggerId = params.get('trigger_id') || ''
  if (!isAllowed(userId)) {
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: "You're not set up to log tasks here -- ask an admin to add your Slack user id to the allowlist.",
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
  await openLogTaskModal(triggerId)
  return new Response('', { status: 200 })
}

// A Global Shortcut gives staff a "click here to start" entry point (the
// lightning-bolt/shortcuts menu, or Slack's ⌘K search), instead of having
// to remember and type /log-task. Opens the exact same modal -- same
// allowlist, same clients, same everything -- just a different trigger.
async function handleGlobalShortcut(payload: any): Promise<Response> {
  const userId = payload.user?.id || ''
  const triggerId = payload.trigger_id || ''
  // Unlike a slash command, a shortcut has no built-in ephemeral-response
  // channel to explain a rejection in -- silently no-op instead (anyone not
  // on the allowlist simply sees nothing happen when they click it).
  if (!isAllowed(userId)) return new Response('', { status: 200 })
  await openLogTaskModal(triggerId)
  return new Response('', { status: 200 })
}

async function handleViewSubmission(payload: any): Promise<Response> {
  const userId = payload.user?.id || ''
  if (!isAllowed(userId)) {
    // Shouldn't normally be reachable (the modal never opens for someone
    // not on the allowlist), but checked again here in case a trigger_id
    // somehow got reused outside the original slash-command flow.
    return new Response('', { status: 200 })
  }
  const parsed = parseSubmission(payload.view?.state?.values)
  if (!parsed) return new Response('', { status: 200 })

  try {
    const clientId = resolveClientId(parsed.clientValue)
    const weekId = await resolveWeekId(clientId, parsed.date)
    const task = buildTaskInsertPayload({
      weekId,
      project: parsed.project,
      status: parsed.status,
      hours: parsed.hours,
      minutes: parsed.minutes,
      date: parsed.date,
    })
    await rest('tasks', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(task) })
    const im = await slackApi('conversations.open', { users: userId })
    await slackApi('chat.postMessage', {
      channel: im.channel.id,
      text: `Logged ${parsed.hours}h ${parsed.minutes}m on "${parsed.project}" ✅ (pending admin review before it syncs to the Sheet)`,
    })
  } catch (err) {
    try {
      const im = await slackApi('conversations.open', { users: userId })
      await slackApi('chat.postMessage', { channel: im.channel.id, text: `Couldn't log that task: ${(err as Error).message}` })
    } catch {
      // Best-effort notification -- the modal still closes either way, so
      // the user isn't left staring at a stuck form if even this fails.
    }
  }
  // An empty body is Slack's documented way to accept a view_submission
  // and close the modal (as opposed to responding with response_action:
  // "errors" to show inline field errors instead).
  return new Response('', { status: 200 })
}

// --------------------------------------------------------------------- server

export async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 })
  const rawBody = await req.text()
  if (!(await verifySlackSignature(req, rawBody))) return new Response('Invalid signature.', { status: 401 })

  const params = new URLSearchParams(rawBody)
  if (params.has('command')) return handleSlashCommand(params)
  if (params.has('payload')) {
    const payload = JSON.parse(params.get('payload') || '{}')
    if (payload.type === 'view_submission') return handleViewSubmission(payload)
    if (payload.type === 'shortcut' && payload.callback_id === SHORTCUT_CALLBACK_ID) return handleGlobalShortcut(payload)
    return new Response('', { status: 200 })
  }
  return new Response('Unrecognized request.', { status: 400 })
}

;(globalThis as any).Deno?.serve(async (req: Request) => {
  try {
    return await handle(req)
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
})
