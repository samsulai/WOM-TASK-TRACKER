// Weekly report Edge Function.
//
// Emails each client a summary (and an Excel attachment) of the tasks logged
// for them in a given week. Only clients who actually had tasks that week are
// included, and only clients with an email address on file are sent to.
//
// POST body: { mode: 'preview' | 'test' | 'send', weekStart?: 'YYYY-MM-DD', ... }
//   preview  -> who WOULD get a report (no emails sent)
//   test     -> { testTo, clientId? } send ONE report to testTo, marked [TEST]
//   send     -> { clientIds? } send to the clients (each client+week only once)
// weekStart defaults to the current week's Monday (UTC) -- that's what a
// scheduled Friday run uses.
//
// Auth: the caller must send the shared secret in an `x-report-key` header.
// See README "Weekly reports" for setup (secrets, Resend, scheduling).
//
// Everything above `Deno.serve` is plain functions with no Deno/network
// dependency at import time, so it can be unit-tested outside Supabase.

export type Client = { id: string; name: string; email: string | null }
export type Week = { id: string; week_start: string; label: string; client_id: string | null }
export type Task = {
  id: string
  week_id: string
  project: string
  status: string
  hours: number | string
  notes: string
  done: boolean
  created_at?: string
}
export type Report = {
  client: Client
  weekStart: string
  weekLabel: string
  tasks: Task[]
  totalHours: number
  done: number
  open: number
  byProject: { project: string; hours: number; tasks: number }[]
}

// ---------------------------------------------------------------- report data

export function buildReports(weeks: Week[], tasks: Task[], clients: Client[]): Report[] {
  const clientById = new Map(clients.map((c) => [c.id, c]))
  const reports: Report[] = []
  for (const week of weeks) {
    const client = week.client_id ? clientById.get(week.client_id) : undefined
    if (!client) continue
    const weekTasks = tasks
      .filter((t) => t.week_id === week.id)
      .sort((a, b) => (a.project || '').localeCompare(b.project || '') || (a.created_at || '').localeCompare(b.created_at || ''))
    if (weekTasks.length === 0) continue // nothing logged -> no report

    const projects = new Map<string, { project: string; hours: number; tasks: number }>()
    for (const t of weekTasks) {
      const name = (t.project || '').trim() || '(no project)'
      const entry = projects.get(name) || { project: name, hours: 0, tasks: 0 }
      entry.hours += Number(t.hours || 0)
      entry.tasks += 1
      projects.set(name, entry)
    }
    const done = weekTasks.filter((t) => t.done).length
    reports.push({
      client,
      weekStart: week.week_start,
      weekLabel: week.label || '',
      tasks: weekTasks,
      totalHours: weekTasks.reduce((sum, t) => sum + Number(t.hours || 0), 0),
      done,
      open: weekTasks.length - done,
      byProject: [...projects.values()].sort((a, b) => b.hours - a.hours),
    })
  }
  return reports.sort((a, b) => a.client.name.localeCompare(b.client.name))
}

// ------------------------------------------------------------------ rendering

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export function formatHours(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return rounded === 1 ? '1 hr' : `${rounded} hrs`
}

const dateFmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  d.toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })

export function weekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`)
  const end = new Date(start.getTime() + 6 * 86400000)
  return `${dateFmt(start, { month: 'short', day: 'numeric' })} – ${dateFmt(end, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

const BRAND_NAVY = '#14173a'
const BRAND_BLUE = '#0169ff'
const STATUS_COLORS: Record<string, string> = {
  Done: '#12a35a',
  Blocked: '#d92c46',
  'In Progress': BRAND_BLUE,
  'Not Started': '#666d99',
}

export function renderEmail(
  report: Report,
  opts: { appUrl: string; senderName: string; test?: boolean }
): { subject: string; html: string; text: string } {
  const range = weekRange(report.weekStart)
  const link = `${opts.appUrl.replace(/\/$/, '')}/?client=${report.client.id}`
  const subject = `${opts.test ? '[TEST] ' : ''}Weekly report: ${report.client.name} — ${range}`

  const rows = report.tasks
    .map((t) => {
      const color = STATUS_COLORS[t.status] || '#666d99'
      return `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eceef6;vertical-align:top;">
          <div style="font-weight:600;color:${BRAND_NAVY};">${esc(t.project || '(no project)')}</div>
          ${t.notes ? `<div style="font-size:13px;color:#666d99;margin-top:2px;">${esc(t.notes)}</div>` : ''}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #eceef6;vertical-align:top;white-space:nowrap;font-size:13px;font-weight:600;color:${color};">${esc(t.status)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eceef6;vertical-align:top;text-align:right;white-space:nowrap;font-weight:600;color:${BRAND_NAVY};">${esc(formatHours(Number(t.hours || 0)))}</td>
      </tr>`
    })
    .join('')

  const stat = (label: string, value: string) =>
    `<td style="width:33%;padding:14px 16px;background:#f3f5fb;border-radius:6px;">
      <div style="font-size:12px;color:#666d99;">${label}</div>
      <div style="font-size:22px;font-weight:700;color:${BRAND_NAVY};">${value}</div>
    </td>`

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8f9fd;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fd;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e1e4ef;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="padding:28px 28px 8px;">
          <div style="font-size:13px;color:#666d99;">${esc(opts.senderName)}</div>
          <h1 style="margin:6px 0 4px;font-size:22px;color:${BRAND_NAVY};">Your weekly report</h1>
          <div style="font-size:15px;color:#4a507d;">${esc(report.client.name)} · ${esc(range)}${report.weekLabel ? ` · ${esc(report.weekLabel)}` : ''}</div>
        </td></tr>
        <tr><td style="padding:16px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="8" style="margin:0 -8px;">
            <tr>
              ${stat('Hours logged', esc(formatHours(report.totalHours)))}
              ${stat('Tasks done', String(report.done))}
              ${stat('Still open', String(report.open))}
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            <tr>
              <th align="left" style="padding:8px;font-size:12px;color:#666d99;border-bottom:1px solid #e1e4ef;">Task</th>
              <th align="left" style="padding:8px;font-size:12px;color:#666d99;border-bottom:1px solid #e1e4ef;">Status</th>
              <th align="right" style="padding:8px;font-size:12px;color:#666d99;border-bottom:1px solid #e1e4ef;">Hours</th>
            </tr>
            ${rows}
          </table>
        </td></tr>
        <tr><td style="padding:20px 28px 8px;font-size:14px;color:#4a507d;line-height:1.5;">
          The full week is attached as an Excel spreadsheet. You can also see everything we've logged for you, any time:
        </td></tr>
        <tr><td style="padding:8px 28px 28px;">
          <a href="${esc(link)}" style="display:inline-block;background:${BRAND_BLUE};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:6px;">View your hours log</a>
        </td></tr>
      </table>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8b8fa3;padding:14px;">Sent by ${esc(opts.senderName)}</div>
    </td></tr>
  </table>
</body></html>`

  const text = [
    `Weekly report — ${report.client.name}`,
    range,
    '',
    `Hours logged: ${formatHours(report.totalHours)}   Done: ${report.done}   Open: ${report.open}`,
    '',
    ...report.tasks.map(
      (t) =>
        `- ${t.project || '(no project)'} [${t.status}] ${formatHours(Number(t.hours || 0))}${t.notes ? ` — ${t.notes}` : ''}`
    ),
    '',
    `View your hours log: ${link}`,
  ].join('\n')

  return { subject, html, text }
}

// ---------------------------------------------------------------- spreadsheet

// Same layout as the in-app export (src/exportXlsx.js): a Tasks sheet plus a
// per-project summary. Duplicated here because a deployed Edge Function can't
// import from the app's source tree.
async function buildXlsxBase64(report: Report): Promise<string> {
  // Imported lazily so the pure functions above stay importable in tests.
  // @ts-ignore -- npm: specifiers are resolved by the Deno runtime
  const { default: writeXlsxFile } = await import('npm:write-excel-file@4.1.1/universal')
  const HEADER = { fontWeight: 'bold', backgroundColor: '#14173a', textColor: '#ffffff' }
  const TOTAL = { fontWeight: 'bold', backgroundColor: '#eef2ff' }
  const head = (labels: string[]) => labels.map((value) => ({ value, ...HEADER }))

  const tasksSheet = {
    sheet: 'Tasks',
    columns: [{ width: 12 }, { width: 26 }, { width: 13 }, { width: 9 }, { width: 44 }, { width: 7 }],
    stickyRowsCount: 1,
    data: [
      head(['Week start', 'Project', 'Status', 'Hours', 'Notes', 'Done']),
      ...report.tasks.map((t) => [
        { value: new Date(`${report.weekStart}T00:00:00Z`), type: Date, format: 'yyyy-mm-dd' },
        t.project || null,
        t.status,
        { value: Number(t.hours || 0), format: '0.00' },
        t.notes || null,
        t.done ? 'Yes' : 'No',
      ]),
      [
        { value: 'Total', ...TOTAL },
        { value: null, ...TOTAL },
        { value: null, ...TOTAL },
        { value: report.totalHours, format: '0.00', ...TOTAL },
        { value: null, ...TOTAL },
        { value: null, ...TOTAL },
      ],
    ],
  }
  const projectSheet = {
    sheet: 'By project',
    columns: [{ width: 30 }, { width: 10 }, { width: 8 }],
    stickyRowsCount: 1,
    data: [
      head(['Project', 'Hours', 'Tasks']),
      ...report.byProject.map((p) => [p.project, { value: p.hours, format: '0.00' }, p.tasks]),
      [
        { value: 'Total', ...TOTAL },
        { value: report.totalHours, format: '0.00', ...TOTAL },
        { value: report.tasks.length, ...TOTAL },
      ],
    ],
  }

  const blob: Blob = await writeXlsxFile([tasksSheet, projectSheet]).toBlob()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

// ------------------------------------------------------------------- plumbing

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-report-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const env = (name: string) => (globalThis as any).Deno?.env.get(name) ?? ''
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function currentMondayUtc(): string {
  const now = new Date()
  const day = (now.getUTCDay() + 6) % 7 // Monday = 0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day))
  return monday.toISOString().slice(0, 10)
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

async function loadReports(weekStart: string): Promise<Report[]> {
  const weeks: Week[] = await rest(
    `weeks?select=id,week_start,label,client_id&week_start=eq.${weekStart}&client_id=not.is.null`
  )
  if (weeks.length === 0) return []
  const weekIds = weeks.map((w) => w.id).join(',')
  const clientIds = [...new Set(weeks.map((w) => w.client_id))].join(',')
  const [tasks, clients] = await Promise.all([
    rest(`tasks?select=id,week_id,project,status,hours,notes,done,created_at&week_id=in.(${weekIds})`),
    rest(`clients?select=id,name,email&id=in.(${clientIds})`),
  ])
  return buildReports(weeks, tasks, clients)
}

async function sentClientIds(weekStart: string): Promise<Set<string>> {
  const rows: { client_id: string }[] = await rest(`report_log?select=client_id&week_start=eq.${weekStart}`)
  return new Set(rows.map((r) => r.client_id))
}

async function sendEmail(args: {
  to: string
  subject: string
  html: string
  text: string
  attachment: { filename: string; content: string }
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env('REPORT_FROM'),
      to: [args.to],
      ...(env('REPORT_REPLY_TO') ? { reply_to: env('REPORT_REPLY_TO') } : {}),
      subject: args.subject,
      html: args.html,
      text: args.text,
      attachments: [args.attachment],
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

async function deliver(report: Report, to: string, test: boolean) {
  const { subject, html, text } = renderEmail(report, {
    appUrl: env('APP_URL'),
    senderName: (env('REPORT_FROM').match(/^(.*?)\s*</)?.[1] || 'Your team').replace(/^"|"$/g, ''),
    test,
  })
  const safeName = report.client.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'client'
  await sendEmail({
    to,
    subject,
    html,
    text,
    attachment: { filename: `weekly-report-${safeName}-${report.weekStart}.xlsx`, content: await buildXlsxBase64(report) },
  })
}

// --------------------------------------------------------------------- server

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const secret = env('REPORT_ADMIN_KEY')
  if (!secret) return json({ error: 'REPORT_ADMIN_KEY is not set on the function.' }, 500)
  if (!safeEqual(req.headers.get('x-report-key') || '', secret)) return json({ error: 'Wrong report key.' }, 401)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body must be JSON.' }, 400)
  }
  const mode = body.mode
  const weekStart: string = body.weekStart || currentMondayUtc()
  if (!WEEK_RE.test(weekStart)) return json({ error: 'weekStart must look like 2026-09-21.' }, 400)

  const reports = await loadReports(weekStart)

  if (mode === 'preview') {
    const sent = await sentClientIds(weekStart)
    return json({
      weekStart,
      clients: reports.map((r) => ({
        clientId: r.client.id,
        name: r.client.name,
        email: r.client.email,
        hours: r.totalHours,
        tasks: r.tasks.length,
        alreadySent: sent.has(r.client.id),
      })),
    })
  }

  if (mode === 'test') {
    const to = String(body.testTo || '').trim()
    if (!EMAIL_RE.test(to)) return json({ error: 'testTo must be a valid email address.' }, 400)
    const report = body.clientId ? reports.find((r) => r.client.id === body.clientId) : reports[0]
    if (!report) return json({ error: 'No client has tasks logged for that week, so there is nothing to preview.' }, 404)
    await deliver(report, to, true)
    return json({ weekStart, testSentTo: to, usingClient: report.client.name })
  }

  if (mode === 'send') {
    const wanted: string[] | null = Array.isArray(body.clientIds) ? body.clientIds : null
    const results: { clientId: string; name: string; status: string; detail?: string }[] = []
    for (const report of reports) {
      const base = { clientId: report.client.id, name: report.client.name }
      if (wanted && !wanted.includes(report.client.id)) continue
      const to = (report.client.email || '').trim()
      if (!EMAIL_RE.test(to)) {
        results.push({ ...base, status: 'skipped', detail: 'no email address on file' })
        continue
      }
      // Claim this client+week first (unique index) so a double trigger can't
      // email twice; release the claim if sending fails so it can be retried.
      const claimed = await rest('report_log?on_conflict=client_id,week_start', {
        method: 'POST',
        headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
        body: JSON.stringify({ client_id: report.client.id, week_start: weekStart, sent_to: to }),
      })
      if (!claimed || claimed.length === 0) {
        results.push({ ...base, status: 'skipped', detail: 'already sent for this week' })
        continue
      }
      try {
        await deliver(report, to, false)
        results.push({ ...base, status: 'sent', detail: to })
      } catch (err) {
        await rest(`report_log?client_id=eq.${report.client.id}&week_start=eq.${weekStart}`, { method: 'DELETE' })
        results.push({ ...base, status: 'failed', detail: (err as Error).message })
      }
    }
    return json({ weekStart, results })
  }

  return json({ error: "mode must be 'preview', 'test' or 'send'." }, 400)
}

;(globalThis as any).Deno?.serve(async (req: Request) => {
  try {
    return await handle(req)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
