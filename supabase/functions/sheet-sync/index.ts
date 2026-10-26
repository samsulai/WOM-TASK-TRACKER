// Google Sheet sync Edge Function.
//
// Keeps any client's logged hours mirrored, live, into a Google Sheet tab
// (`Tracker Sync` by default, but this works equally on a client's own
// pre-existing ledger tab -- see below). Which client gets synced, and to
// which Sheet/tab, is driven entirely by that client's `sheet_id` and
// `sheet_tab` columns (set in the Clients window) -- a client with no
// sheet_id is simply skipped; a client with no sheet_tab falls back to the
// GOOGLE_SHEET_TAB secret, then to "Tracker Sync". One-way only: the app
// writes; the Sheet is never read back into the app.
//
// Column convention, the same for every client's sheet:
//   A = Date, B = Description, C = Hours Bought, D = Hours Spent,
//   E = Total Hours Left, Z = hidden row-id tracking column.
// The app writes every column -- a task's hours go to D, an hours-ledger
// purchase's go to C (its description reads "N hours bought", matching how a
// human has always entered these by hand), and E gets the CURRENT running
// balance (hours bought so far minus hours used so far), computed straight
// from the app's own clean numbers -- never a SUM() formula over the sheet's
// own cells, which would be wrong the moment old hand-entered rows and new
// synced rows use different number formats (see "Migrating an existing
// hand-tracked ledger" in the README). Only one row ever holds a value in E
// at a time -- whichever row is currently last -- matching how a lead's own
// hand-maintained ledger places a single running total at the bottom; every
// sync clears E everywhere else first. This is why a dedicated app-only tab
// now uses the same 5-visible-column shape as a client's own hand-maintained
// ledger -- one convention, works safely on both, and a client whose Sheet
// already had its own formula in E has it replaced by this app's own number
// the first time sync runs for them.
//
// Columns C and D store hours as a DAY-FRACTION (see hoursToDayFraction),
// not a plain hour count, and get Duration formatting ([hh]:mm:ss) forced
// on every sync -- but ONLY on the exact rows being written that sync,
// never the whole column. This is a deliberate choice, not an accident:
// Google Sheets' Duration/Time formats are built entirely on "1.0 = one
// day," so there is no way to make a cell DISPLAY as "04:23:00" without
// the number stored underneath being 4.3833/24. The payoff is that the
// sheet shows hours the same way staff already log them in Slack
// ("Time: 04:23:00") and the same way a real pre-existing hand-tracked
// ledger's own historical rows already work -- one consistent convention,
// not two. The cost (see README "Google Sheet sync" for the full
// reasoning) is that the RAW cell value is no longer self-explanatory --
// checking the formula bar shows 0.1826, not 4.38 -- so nothing outside
// this app should ever read C or D directly expecting a plain hour count.
// This app itself never does: "Hours Left," the budget cards, and the
// weekly email are all computed from the database directly, never from
// these cells. Scoping the format-fix to only the rows actually being
// written (rather than the whole column) still matters for the same
// reason it always did -- it keeps any row this sync doesn't own exactly
// as its own author left it, whatever convention they used.
//
// Column E gets the SAME day-fraction/Duration treatment as C/D, but only
// while the balance is non-negative -- it's the one column that can go
// negative (over budget), and Duration format can't represent that
// cleanly, so an over-budget balance falls back to a plain negative number
// instead (see hoursLeftValue/ensureHoursLeftFormat).
//
// A task is only ever considered here (synced, and counted toward E's
// balance) once it's "verified" -- see loadClientTasks. Every task created
// in the app is verified by default; only supabase/functions/slack-log-task
// inserts one as unverified, holding it out of the Sheet entirely until an
// admin approves it in the app (an ordinary `tasks` update, which fires the
// same trigger as any other change and syncs it for the first time then).
//
// One row per task or purchase. Each synced record is tracked by its id
// (from whichever table it came from -- ids never collide across tables)
// in column Z, so an edit updates that exact row in place and a delete (or
// a task's week moving off this client) blanks that row's A/B/C/D/Z rather
// than removing it -- deliberately simple over "tidy": actually deleting a
// row would require re-finding every other tracked row's new position
// afterward, which is a lot of extra complexity and bug-risk on a document
// someone relies on daily, in exchange for avoiding an occasional blank
// row. New rows are always appended after the sheet's current last row,
// never inserted mid-table or reordered, so nothing pre-existing
// (hand-entered or previously synced) ever shifts position.
//
// Triggered by Postgres triggers (supabase/migrations/2026-10-19-sheet-sync-trigger.sql,
// 2026-10-21-sheet-sync-trigger-purchases.sql, and
// 2026-10-22-sheet-sync-trigger-task-date.sql) using pg_net -- on every
// `tasks` insert/update/delete, on a `weeks` update that changes client_id
// (moving a week between clients needs to resync even though no `tasks`
// row changed -- BOTH the old and new client's sheets), and on every
// `hours_purchases` insert/update/delete.
//
// Auth: the caller must send the shared secret in an `x-sync-key` header.
// See README "Google Sheet sync" for setup (service account, secrets,
// enabling the trigger, and setting a client's sheet_id).
//
// Everything above `Deno.serve` is plain functions with no Deno/network
// dependency at import time, so it can be unit-tested outside Supabase.

export type SyncTask = {
  id: string
  project: string
  notes: string
  hours: number | string
  createdAt: string
}

export type SyncPurchase = {
  id: string
  purchasedOn: string
  hours: number | string
  note: string
  createdAt?: string
}

// A common shape both a task and a purchase reduce to before planning --
// `kind` is only consulted at write time, to pick which column (C or D) the
// hours go to; everything else (partitioning, row assignment, sorting) is
// identical for both and never needs to know which kind it's looking at.
export type SyncRecord = {
  id: string
  kind: 'task' | 'purchase'
  date: string
  description: string
  hours: number | string
  createdAt?: string
}

export type SyncPlan = {
  toBlank: number[]
  toWrite: { row: number; record: SyncRecord }[]
}

// ---------------------------------------------------------------- pure logic

// Neither `project` nor `notes` is explicitly "the description" -- project is
// the bold/primary field in the UI, notes is secondary -- so combine them
// when both are present rather than picking just one.
export function taskDescription(t: { project: string; notes: string }): string {
  const project = (t.project || '').trim()
  const notes = (t.notes || '').trim()
  if (!project && !notes) return '(no description)'
  return notes ? (project ? `${project} — ${notes}` : notes) : project
}

// Matches how a human has always entered these by hand on the real Sheet
// (e.g. "20 hours bought"), so a client's existing ledger reads the same
// whether a row came from a person or from this sync.
export function purchaseDescription(p: { hours: number | string; note: string }): string {
  const n = Number(p.hours || 0)
  const amount = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  const note = (p.note || '').trim()
  return note ? `${amount} hours bought — ${note}` : `${amount} hours bought`
}

// Plain string math on the YYYY-MM-DD date, not a Date object -- avoids the
// local/UTC day-shift bug this app has already hit once (see TrendChart's
// date arithmetic) by never round-tripping through a timezone-aware Date.
export function sheetDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${m}/${d}/${y}`
}

// A task's date is when it was actually logged (its createdAt), not its
// week's start date -- a week groups tasks, but each one was created on
// its own real calendar day, and the lead specifically wants that reflected
// here (matching the app's own task table -- see src/components/TaskRow.jsx).
export function taskToRecord(t: SyncTask): SyncRecord {
  return { id: t.id, kind: 'task', date: t.createdAt.slice(0, 10), description: taskDescription(t), hours: t.hours, createdAt: t.createdAt }
}

export function purchaseToRecord(p: SyncPurchase): SyncRecord {
  return {
    id: p.id,
    kind: 'purchase',
    date: p.purchasedOn,
    description: purchaseDescription(p),
    hours: p.hours,
    createdAt: p.createdAt,
  }
}

// Decides exactly what needs to change, without touching the network --
// `rowById` and `lastRow` describe the sheet's current state (from a
// batchGet), `records` is this client's current tasks + purchases combined.
// A record already in `rowById` keeps its row; a new one goes after
// `lastRow`; a tracked row whose record is no longer in the list is blanked.
export function partitionSync(records: SyncRecord[], rowById: Map<string, number>, lastRow: number): SyncPlan {
  const currentIds = new Set(records.map((r) => r.id))
  const toBlank: number[] = []
  for (const [id, row] of rowById) {
    if (!currentIds.has(id)) toBlank.push(row)
  }

  // New rows get a stable, predictable order (chronological) among
  // themselves, even though existing rows never move from wherever they
  // already are.
  const sorted = [...records].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '')
  )
  const toWrite: { row: number; record: SyncRecord }[] = []
  let nextRow = lastRow + 1
  for (const record of sorted) {
    const existingRow = rowById.get(record.id)
    if (existingRow) {
      toWrite.push({ row: existingRow, record })
    } else {
      toWrite.push({ row: nextRow, record })
      nextRow++
    }
  }
  return { toBlank, toWrite }
}

// Google Sheets' Duration/Time number formats are built entirely on "1.0 =
// one day" -- there is no way to make a cell DISPLAY as "50:00:00" without
// the number stored underneath being the day-fraction 50/24. This is a
// deliberate choice (see README "Google Sheet sync" for the reasoning and
// the risk being accepted), not an oversight: every hours value this app
// writes to C or D goes through this conversion, and every cell it writes
// to also gets its format forced to Duration (see ensureDurationFormat) so
// the stored day-fraction always displays correctly as hours, never as a
// confusing raw decimal. E is excluded -- see buildHoursLeftData.
export function hoursToDayFraction(hours: number | string): number {
  return Number(hours || 0) / 24
}

// Builds the exact `values.batchUpdate` request body (the `data` array) for
// a plan -- pure and testable, so the tricky row/range arithmetic can be
// pinned down with plain test cases rather than only verified by hand
// against a live Sheet.
export function buildBatchUpdateData(tab: string, plan: SyncPlan): { range: string; values: (string | number)[][] }[] {
  const q = (s: string) => `'${tab}'!${s}`
  const data: { range: string; values: (string | number)[][] }[] = [
    {
      range: q('A1:E1'),
      values: [['Date', 'Description', 'Hours Bought', 'Hours Spent', 'Total Hours Left']],
    },
  ]
  for (const row of plan.toBlank) {
    data.push({ range: q(`A${row}:B${row}`), values: [['', '']] })
    data.push({ range: q(`C${row}:D${row}`), values: [['', '']] })
    data.push({ range: q(`Z${row}`), values: [['']] })
  }
  for (const { row, record } of plan.toWrite) {
    data.push({ range: q(`A${row}:B${row}`), values: [[sheetDate(record.date), record.description]] })
    const column = record.kind === 'purchase' ? 'C' : 'D'
    data.push({ range: q(`${column}${row}`), values: [[hoursToDayFraction(record.hours)]] })
    data.push({ range: q(`Z${row}`), values: [[record.id]] })
  }
  return data
}

// Total hours bought so far minus total hours used so far -- the same
// all-time, cumulative figure the app itself shows (see src/App.jsx's
// hoursBoughtToDate/grandTotal). Computed straight from the records this
// sync already has in memory, never from a Sheet formula.
export function hoursLeftFor(records: SyncRecord[]): number {
  let left = 0
  for (const r of records) {
    const hours = Number(r.hours || 0)
    left += r.kind === 'purchase' ? hours : -hours
  }
  return left
}

// "Hours left" gets the day-fraction/Duration treatment ONLY when it's
// non-negative. Unlike C/D (always a positive duration someone typed in),
// this column can go negative once a client is over budget, and Google
// Sheets' Duration format can't represent a negative duration cleanly --
// so the common case (still within budget) reads as HH:MM:SS like C/D,
// while an over-budget balance falls back to a plain negative number
// rather than displaying something broken. See ensureHoursLeftFormat for
// the matching cell-format half of this (both have to travel together,
// same as hoursToDayFraction/ensureDurationFormat do for C/D).
export function hoursLeftValue(hoursLeft: number): number {
  return hoursLeft >= 0 ? hoursToDayFraction(hoursLeft) : hoursLeft
}

// Clears column E (Total Hours Left) from row 2 through `clearUpToRow`,
// then writes the live balance onto `writeRow` -- so exactly one row ever
// shows a value there, matching how a lead's own hand-maintained ledger
// places a single running total at the bottom.
//
// `clearUpToRow` must be at least as large as column E's own CURRENT
// extent (not just wherever this sync's last task/purchase row happens to
// be) -- if the row that previously held the total was the sheet's last
// row and its task/purchase later got deleted, column A's extent shrinks
// back down (Google Sheets drops trailing empty cells from a query), but
// the stale total sitting in E at that now-orphaned row does NOT go away
// on its own; the clear has to reach far enough to still catch it. The
// caller is expected to pass `Math.max(newLastRow, eLastRow)` -- see
// `fetchSheetState`'s `eLastRow`.
export function buildHoursLeftData(
  tab: string,
  clearUpToRow: number,
  writeRow: number | null,
  hoursLeft: number
): { range: string; values: (string | number)[][] }[] {
  const q = (s: string) => `'${tab}'!${s}`
  if (clearUpToRow < 2) return []
  const blankRows: (string | number)[][] = Array.from({ length: clearUpToRow - 1 }, () => [''])
  const data: { range: string; values: (string | number)[][] }[] = [{ range: q(`E2:E${clearUpToRow}`), values: blankRows }]
  if (writeRow !== null) data.push({ range: q(`E${writeRow}`), values: [[hoursLeftValue(hoursLeft)]] })
  return data
}

// ------------------------------------------------------------------- plumbing

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const env = (name: string) => (globalThis as any).Deno?.env.get(name) ?? ''

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Every outbound fetch (Supabase REST, Google OAuth, every Sheets API call)
// gets this same timeout. Without it, a single hung network call just waits
// forever -- the caller (pg_net, from the Postgres trigger) gives up after
// its own 5s timeout and moves on, but the function itself keeps running
// server-side regardless, until Supabase's platform force-kills it for
// exceeding its own resource limit (seen in practice: a 150-SECOND
// execution ending in a WORKER_RESOURCE_LIMIT/546 response, with no useful
// error to debug from). Failing fast here instead turns that into an
// ordinary, readable error within a few seconds.
const FETCH_TIMEOUT_MS = 15_000

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
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Database ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: 'tasks' | 'weeks' | 'hours_purchases'
  record?: Record<string, unknown>
  old_record?: Record<string, unknown>
}

// Which client(s) this event could affect. A task event only ever touches
// one client (wherever its week currently belongs); a week event can touch
// TWO if the week moved between two different clients, since each one's
// sheet needs to be brought up to date independently; a purchase event
// always touches exactly one client, read straight off its own row (no join
// needed, since hours_purchases already has client_id directly).
async function affectedClientIds(payload: WebhookPayload): Promise<string[]> {
  if (payload.table === 'tasks') {
    const weekId = (payload.record?.week_id ?? payload.old_record?.week_id) as string | undefined
    if (!weekId) return []
    const weeks: { client_id: string | null }[] = await rest(`weeks?select=client_id&id=eq.${weekId}&limit=1`)
    const clientId = weeks[0]?.client_id
    return clientId ? [clientId] : []
  }
  if (payload.table === 'weeks') {
    const newClientId = (payload.record?.client_id ?? null) as string | null
    const oldClientId = (payload.old_record?.client_id ?? null) as string | null
    return [...new Set([newClientId, oldClientId].filter((id): id is string => Boolean(id)))]
  }
  if (payload.table === 'hours_purchases') {
    const clientId = (payload.record?.client_id ?? payload.old_record?.client_id) as string | undefined
    return clientId ? [clientId] : []
  }
  return []
}

async function getClientSheetConfig(clientId: string): Promise<{ sheetId: string; tab: string } | null> {
  const clients: { sheet_id: string | null; sheet_tab: string | null }[] = await rest(
    `clients?select=sheet_id,sheet_tab&id=eq.${clientId}&limit=1`
  )
  const sheetId = clients[0]?.sheet_id
  if (!sheetId) return null
  const tab = clients[0]?.sheet_tab || env('GOOGLE_SHEET_TAB') || 'Tracker Sync'
  return { sheetId, tab }
}

// Only verified tasks are ever considered -- a task logged via Slack
// (supabase/functions/slack-log-task) is inserted with verified=false and
// held back here until an admin approves it in the app. Because it's held
// back at the SOURCE (this query), it's invisible to partitionSync too: it
// never gets a Z-column row assigned, never gets written OR blanked, and
// the moment it's approved (an ordinary `tasks` update, which fires the
// same sheet_sync_notify trigger as any other change) it shows up here for
// the first time and syncs normally, same as any other new task.
async function loadClientTasks(clientId: string): Promise<SyncTask[]> {
  const weeks: { id: string }[] = await rest(`weeks?select=id&client_id=eq.${clientId}`)
  if (weeks.length === 0) return []
  const weekIds = weeks.map((w) => w.id).join(',')
  const tasks: {
    id: string
    project: string
    notes: string
    hours: number | string
    created_at: string
  }[] = await rest(`tasks?select=id,project,notes,hours,created_at&week_id=in.(${weekIds})&verified=eq.true`)
  return tasks.map((t) => ({
    id: t.id,
    project: t.project,
    notes: t.notes,
    hours: t.hours,
    createdAt: t.created_at,
  }))
}

async function loadClientPurchases(clientId: string): Promise<SyncPurchase[]> {
  const purchases: {
    id: string
    purchased_on: string
    hours: number | string
    note: string
    created_at: string
  }[] = await rest(`hours_purchases?select=id,purchased_on,hours,note,created_at&client_id=eq.${clientId}`)
  return purchases.map((p) => ({
    id: p.id,
    purchasedOn: p.purchased_on,
    hours: p.hours,
    note: p.note,
    createdAt: p.created_at,
  }))
}

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

// Hand-rolled service-account JWT via Deno's native Web Crypto (RS256) --
// zero new dependencies, consistent with this function family's plain-fetch
// style. Google service-account keys are PKCS8 already, so no key-format
// conversion is needed. One service account's credentials are shared across
// every client's Sheet -- each Sheet just needs that same account shared on
// it as an Editor.
async function getAccessToken(): Promise<string> {
  const pem = env('GOOGLE_SA_PRIVATE_KEY').replace(/\\n/g, '\n')
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const now = Math.floor(Date.now() / 1000)
  const enc = (o: unknown) => base64url(new TextEncoder().encode(JSON.stringify(o)))
  const signingInput = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: env('GOOGLE_SA_CLIENT_EMAIL'),
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  const jwt = `${signingInput}.${base64url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`)
  return (await res.json()).access_token as string
}

// Reads just enough of the sheet to plan a sync: column Z (which rows are
// already tracked, and for which task), column A (to find the current last
// used row, for placing new rows after it), and column E (its own current
// extent -- needed separately from column A's, since a row holding nothing
// but a leftover "Total Hours Left" value is invisible to a query on
// column A alone; see buildHoursLeftData). Three single-column ranges in
// one batchGet call.
async function fetchSheetState(
  token: string,
  sheetId: string,
  tab: string
): Promise<{ rowById: Map<string, number>; lastRow: number; eLastRow: number }> {
  const q = (s: string) => `'${tab}'!${s}`
  const params = new URLSearchParams()
  params.append('ranges', q('A2:A'))
  params.append('ranges', q('Z2:Z'))
  params.append('ranges', q('E2:E'))
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Sheets batchGet ${res.status}: ${await res.text()}`)
  const body = await res.json()
  const aValues: string[][] = body.valueRanges?.[0]?.values || []
  const zValues: string[][] = body.valueRanges?.[1]?.values || []
  const eValues: string[][] = body.valueRanges?.[2]?.values || []
  const rowById = new Map<string, number>()
  zValues.forEach((cells, i) => {
    const id = cells[0]
    if (id) rowById.set(id, i + 2) // row 2 is index 0
  })
  return { rowById, lastRow: aValues.length + 1, eLastRow: eValues.length + 1 }
}

async function applySyncPlan(
  token: string,
  sheetId: string,
  tab: string,
  plan: SyncPlan,
  extraData: { range: string; values: (string | number)[][] }[] = []
) {
  const data = [...buildBatchUpdateData(tab, plan), ...extraData]
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Sheets batchUpdate ${res.status}: ${await res.text()}`)
}

// The tab's internal numeric grid id (NOT the spreadsheet's string id) --
// needed for the general (non-values) batchUpdate endpoint below.
async function getSheetGridId(token: string, sheetId: string, tab: string): Promise<number> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=${encodeURIComponent('sheets.properties(sheetId,title)')}`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  )
  if (!res.ok) throw new Error(`Sheets metadata ${res.status}: ${await res.text()}`)
  const body = await res.json()
  const match = (body.sheets || []).find((s: any) => s.properties?.title === tab)
  if (!match) throw new Error(`No tab named "${tab}" found in this spreadsheet.`)
  return match.properties.sheetId
}

// Collapses a set of row numbers into contiguous inclusive [start, end]
// runs, so a sync writing many consecutive new rows still costs one request
// per run rather than one per row.
export function rowRanges(rows: number[]): { start: number; end: number }[] {
  const sorted = [...new Set(rows)].sort((a, b) => a - b)
  const ranges: { start: number; end: number }[] = []
  for (const row of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && row === last.end + 1) {
      last.end = row
    } else {
      ranges.push({ start: row, end: row })
    }
  }
  return ranges
}

// Forces columns C (Hours Bought) and D (Hours Spent) to Duration
// formatting ([hh]:mm:ss), but ONLY on the exact rows this sync is writing
// this time -- never the whole column. This pairs with hoursToDayFraction:
// a day-fraction value only displays correctly as hours when the cell's
// format says so, so the two always have to be applied together. Scoped to
// C/D only -- E (Total Hours Left) is handled separately, by
// ensureHoursLeftFormat below, since its format depends on whether the
// balance is negative, not just on which row it's in.
async function ensureDurationFormat(token: string, sheetId: string, gridId: number, rows: number[]) {
  if (rows.length === 0) return
  const requests = rowRanges(rows).map(({ start, end }) => ({
    repeatCell: {
      range: { sheetId: gridId, startRowIndex: start - 1, endRowIndex: end, startColumnIndex: 2, endColumnIndex: 4 },
      cell: { userEnteredFormat: { numberFormat: { type: 'TIME', pattern: '[hh]:mm:ss' } } },
      fields: 'userEnteredFormat.numberFormat',
    },
  }))
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Sheets format fix ${res.status}: ${await res.text()}`)
}

// Mirrors ensureDurationFormat but for the single row currently holding
// "Hours left" (E) -- Duration format ([hh]:mm:ss) when the balance is
// non-negative, matching C/D's convention; plain NUMBER when negative
// (over budget), since Duration format can't represent that cleanly. Pairs
// with hoursLeftValue the same way ensureDurationFormat pairs with
// hoursToDayFraction: the stored value and the cell's format always have
// to agree, or the day-fraction trick just shows a confusing raw decimal.
async function ensureHoursLeftFormat(
  token: string,
  sheetId: string,
  gridId: number,
  writeRow: number | null,
  hoursLeft: number
) {
  if (writeRow === null) return
  const numberFormat =
    hoursLeft >= 0 ? { type: 'TIME', pattern: '[hh]:mm:ss' } : { type: 'NUMBER', pattern: '0.##' }
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId: gridId, startRowIndex: writeRow - 1, endRowIndex: writeRow, startColumnIndex: 4, endColumnIndex: 5 },
            cell: { userEnteredFormat: { numberFormat } },
            fields: 'userEnteredFormat.numberFormat',
          },
        },
      ],
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Sheets format fix ${res.status}: ${await res.text()}`)
}

async function syncClient(
  clientId: string
): Promise<{ clientId: string; skipped?: true; written?: number; blanked?: number }> {
  const config = await getClientSheetConfig(clientId)
  if (!config) return { clientId, skipped: true }
  const { sheetId, tab } = config

  const [tasks, purchases, token] = await Promise.all([
    loadClientTasks(clientId),
    loadClientPurchases(clientId),
    getAccessToken(),
  ])
  const records = [...tasks.map(taskToRecord), ...purchases.map(purchaseToRecord)]
  const { rowById, lastRow, eLastRow } = await fetchSheetState(token, sheetId, tab)
  const plan = partitionSync(records, rowById, lastRow)

  // The sheet's row count AFTER this sync's own writes -- where any brand
  // new row lands, and so where the live "Total Hours Left" balance goes.
  // `null` when there are no records left at all (nothing to put a balance
  // on). The clear itself must reach at least as far as column E's own
  // current extent too, not just this sync's last row -- see
  // buildHoursLeftData's header comment for why.
  const newLastRow = plan.toWrite.length ? Math.max(lastRow, ...plan.toWrite.map((w) => w.row)) : null
  const clearUpToRow = Math.max(newLastRow ?? 0, eLastRow)
  const hoursLeft = hoursLeftFor(records)
  const hoursLeftData = buildHoursLeftData(tab, clearUpToRow, newLastRow, hoursLeft)

  // Every row in plan.toWrite is a task or purchase we're actively writing
  // this sync, so it's exactly the set that needs C/D's Duration format
  // (re-)applied. E's format is handled separately (it depends on the
  // balance's sign, not just which row) but needs the same gridId, so both
  // fixes share one lookup rather than fetching it twice.
  const rowsToFormat = plan.toWrite.map((w) => w.row)
  const formatFixes =
    rowsToFormat.length > 0 || newLastRow !== null
      ? getSheetGridId(token, sheetId, tab).then((gridId) =>
          Promise.all([
            ensureDurationFormat(token, sheetId, gridId, rowsToFormat),
            ensureHoursLeftFormat(token, sheetId, gridId, newLastRow, hoursLeft),
          ])
        )
      : Promise.resolve()
  await Promise.all([applySyncPlan(token, sheetId, tab, plan, hoursLeftData), formatFixes])

  return { clientId, written: plan.toWrite.length, blanked: plan.toBlank.length }
}

// --------------------------------------------------------------------- server

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const secret = env('SHEET_SYNC_KEY')
  if (!secret) return json({ error: 'SHEET_SYNC_KEY is not set on the function.' }, 500)
  if (!safeEqual(req.headers.get('x-sync-key') || '', secret)) return json({ error: 'Wrong sync key.' }, 401)

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Body must be JSON.' }, 400)
  }

  const clientIds = await affectedClientIds(payload)
  if (clientIds.length === 0) return json({ skipped: true })

  const results = await Promise.all(clientIds.map(syncClient))
  return json({ results })
}

;(globalThis as any).Deno?.serve(async (req: Request) => {
  try {
    return await handle(req)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
