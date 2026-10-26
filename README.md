# Weekly Task Tracker

A small shared task tracker built with React + Vite + Supabase. Organizes work
into weeks, each containing tasks (project, status, hours, notes, done), with
a totals-by-project summary and live sync via Supabase Realtime — so you and
a contractor can have it open at the same time and see each other's edits.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**.
2. Pick an org, name it (e.g. `weekly-task-tracker`), set a database password
   (save it somewhere — you won't need it for this app, but Supabase requires
   it), and choose a region close to you and your contractor.
3. Wait for provisioning to finish (a minute or two).

## 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. Click **New query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. This creates the `weeks` and `tasks` tables, enables Row Level Security
   with open read/write policies (see the note in that file about why —
   short version: there's no login yet, so the shared link is the access
   control), and adds both tables to the `supabase_realtime` publication so
   live sync works.
4. Verify: **Table Editor** in the sidebar should now show `weeks` and
   `tasks`.

## 3. Get your API keys

1. In the dashboard, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key (not the
   `service_role` key — that one must never go in frontend code).

## 4. Configure the app

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

`.env.local` is already gitignored (via the `*.local` pattern) — never commit
real keys.

## 5. Run locally

```bash
npm install
npm run dev
```

Open the printed `localhost` URL. Open it in a second tab (or browser) to
confirm edits sync live between the two.

## 6. Deploy

Any static host that supports Vite works (Vercel, Netlify, Cloudflare
Pages…). The two most common:

**Vercel**
```bash
npm i -g vercel
vercel
```
When prompted, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as
environment variables (or set them in the Vercel dashboard under
Project Settings → Environment Variables), then redeploy.

**Netlify**
```bash
npm i -g netlify-cli
netlify deploy
```
Build command: `npm run build`, publish directory: `dist`. Set the same two
env vars in Site settings → Environment variables.

Either way, share the deployed URL with your contractor — since there's no
login yet, the URL is what grants access.

## Data model

- `clients`: optional. A week can belong to a client, or stay "internal"
  (`client_id` null).
- `weeks`: one row per week per client (`week_start` date, optional `label`,
  optional `client_id`).
- `tasks`: belongs to a week (`week_id`), has `project`, `status`
  (`Not Started` / `In Progress` / `Blocked` / `Done`), `hours`, `notes`,
  `done`.

## Client links

- Your own link (no `?client=` in the URL) is the admin view: it shows
  everything — internal weeks plus every client's weeks — combined totals,
  and a **Clients** button (top bar) to add clients and copy their link.
- Each client's link (`?client=<their-id>`) scopes the *entire* app to just
  their weeks/tasks — totals, stats, the week list, CSV export. They don't
  see the Clients button or anyone else's data in the UI.
- **Client links are view-only.** A client can browse their weeks, see
  totals, and export their own CSV, but every add/edit/delete control is
  hidden and every field is disabled — they can't log hours, change
  status, or remove anything themselves. Only the admin link can make
  changes. (If you ever want clients to self-report their own hours
  instead, that's a one-line flip of the `readOnly` flag in `App.jsx` —
  ask before assuming which direction fits a given client relationship.)
- **Viewing vs. moving (admin).** The **Viewing** selector in the top bar
  chooses whose data you're looking at — Everything, Internal only, or one
  client — and filters the weeks list, stats, totals and CSV export. It never
  changes data. New weeks you add belong to whoever you're viewing. To hand an
  existing week to a different client (or make it internal), use **Move…**
  next to "Belongs to" on the week card — that's the only control that
  changes ownership. A move is blocked if the destination already has a week
  starting the same day.
- **This is a capability link, not real access control.** Like the rest of
  this app (see the RLS trade-off note in `supabase/schema.sql`), every table
  is readable/writable by anyone with the anon key — the client-scoped URL
  filters what the *app* shows, but doesn't stop someone from querying the
  database directly. That's an acceptable trade-off for organizing views for
  trusted clients, but it is **not** confidentiality between clients who
  shouldn't be able to see each other's data even if they tried. That needs
  real per-client accounts (Supabase Auth + RLS keyed to the logged-in
  user) — a meaningfully bigger feature than this app currently has.

## How live sync + concurrent edits are handled

- Each browser tab subscribes to Postgres changes on both tables via
  Supabase Realtime.
- Edits are optimistic (applied to local state immediately) and saved to
  Supabase debounced (600ms after you stop typing, or immediately on
  blur/for select/checkbox fields).
- While a row has an unsaved local edit, incoming realtime updates for that
  *specific row* are held back so they can't overwrite what you're typing.
  Once your save succeeds, the row accepts remote updates again.
- If a save fails (e.g. offline), the row shows an inline error with a
  Retry button, and your local edit is preserved rather than silently lost.
- If you and your contractor edit the *same field on the same row* at
  nearly the same moment, last write wins — there's no field-level merge.
  For a two-person tool this is an acceptable trade-off; row-level granularity
  (you rarely both touch the exact same task at the exact same second) keeps
  the implementation simple.

## Rollover and CSV export

- **Rollover**: once per app load, any task that isn't marked Done in a week
  before the current one is automatically moved into the current week (a new
  "current week" row is created if one doesn't exist yet). This jumps
  straight to the current week rather than one week at a time, so it stays
  correct even after a long gap between visits — since there's no backend
  cron, the check only runs when someone actually opens the app.
- **Export**: the **Export** menu downloads either an Excel file (`.xlsx`:
  a formatted *Tasks* sheet with a totals row, a *By project* summary, and —
  when the export spans more than one owner — a *By client* summary) or a
  CSV. The month picker next to it filters the download to that month
  (matched against each task's week start date); leave it blank to export
  everything. Both formats respect the current **Viewing** selection.

## Client budgets ("hours bought" vs. "hours used")

Optional, per client. Log each **hours bought** purchase (date + hours, plus
an optional note) and the app tracks all-time hours logged against the
running total — nothing changes for a client with no purchases on file.
Modeled as a dated ledger, not a single overwritable number, because that's
how the real Google Sheet this app syncs to already tracks it: a running
history of purchase events (e.g. "20 hours bought" on one date, "40 hours
bought" on a later one), not one static figure to keep overwriting by hand.

Needs one small, additive database change first: run
[`supabase/migrations/2026-10-21-hours-purchases.sql`](supabase/migrations/2026-10-21-hours-purchases.sql)
in the SQL Editor (adds the `hours_purchases` table and drops the old,
unused `clients.monthly_hours` column). Until that's run, adding a purchase
shows a clear error instead of silently failing.

- **Budget card**: appears automatically whenever a single client is in
  view — the admin **Viewing** switcher set to that client, or the client's
  own read-only link — right under the stats bar. Admins get an inline
  add-purchase form (date, hours, optional note) plus the full purchase
  history below, each entry deletable on hover. Shows hours used vs. bought
  (all-time, not scoped to a calendar month), a progress bar, and an
  "On track" / "Over budget" status.
- A client's own link shows nothing when there's no purchase history yet
  (they can't add one, so there's nothing useful to prompt them to do).
- **In the weekly report email**: if the client has any purchases on file,
  the email adds an "Hours bought" line — all-time hours used compared to
  all-time hours bought.
- This is purely informational — nothing here invoices, bills, or blocks
  logging more hours once hours bought is exceeded.

## Weekly reports (email to clients)

Emails each client who had tasks logged in a week a summary (hours, done vs.
open, every task) with the week attached as an Excel file and a link to their
read-only page. Clients with no tasks that week, or no email on file, are
skipped. Each client is emailed **at most once per week** (tracked in
`report_log`), so a double click or a double trigger can't spam anyone.

Sending needs a small server-side piece (a browser can't hold an email API
key), so this is a Supabase Edge Function plus Resend for delivery.

### One-time setup

1. **Database.** Run
   [`supabase/migrations/2026-09-25-weekly-report.sql`](supabase/migrations/2026-09-25-weekly-report.sql)
   in the SQL Editor. It only *adds* a nullable `clients.email` column and a
   `report_log` table (no policies, so the public key can't read it).
2. **Resend.** Create an account at [resend.com](https://resend.com), add your
   sending domain (Resend gives you DNS records to add at your registrar) and
   wait for it to verify — without a verified domain, emails may land in spam
   or be refused. Create an API key.
3. **Edge Function.** In Supabase → *Edge Functions* → *Deploy a new function*
   → name it exactly `weekly-report` and paste in
   [`supabase/functions/weekly-report/index.ts`](supabase/functions/weekly-report/index.ts).
   Turn **off "Verify JWT"** for this function: the newer `sb_publishable_…`
   keys aren't JWTs, and the function protects itself with its own report key
   (next step). (CLI alternative: `supabase functions deploy weekly-report --no-verify-jwt`.)
4. **Secrets** (Edge Functions → *Secrets*):

   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | your Resend API key |
   | `REPORT_ADMIN_KEY` | a long random string you invent — this is the "report key" you type into the app |
   | `REPORT_FROM` | `WordOut Media <reports@your-verified-domain.com>` |
   | `APP_URL` | `https://tracker-olive-rho.vercel.app` (used for each client's link) |
   | `REPORT_REPLY_TO` | optional — where client replies should go |

### Using it

1. Open **Clients** and type each client's email under their name (it saves
   when you click away).
2. Select the week you want in the Weeks list, then click **Reports** in the
   top bar. The window lists every client who had tasks that week, with their
   hours and whether they have an email / were already sent one.
3. The first time on a device, enter the report key (the `REPORT_ADMIN_KEY`
   secret). It's remembered on that device and hidden afterwards; **Change**
   or **Forget** it from the bottom of the window.
4. Optional: type your own address next to **Send a test to** and click
   **Send test** to get one sample report to yourself only (marked `[TEST]`,
   nothing is logged, nothing goes to any client).
5. Click **Send to N clients**. You confirm the list first, then it sends.

### Automating it (do this after you're happy with the manual sends)

Once the test emails look right, schedule the same function to run every
Friday with Supabase's `pg_cron` + `pg_net` (Database → Extensions → enable
both). In the SQL Editor — replacing the two placeholders — run:

```sql
select cron.schedule(
  'weekly-client-reports',
  '0 16 * * 5', -- Fridays 16:00 UTC; adjust for your timezone
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/weekly-report',
    headers := '{"Content-Type": "application/json", "x-report-key": "<your REPORT_ADMIN_KEY>"}'::jsonb,
    body := '{"mode": "send"}'::jsonb
  );
  $$
);
```

With no `weekStart` the function reports on the *current* week (Monday–Sunday,
UTC). To stop it: `select cron.unschedule('weekly-client-reports');`.

### Things to know

- **Client email addresses are stored in the open `clients` table**, like
  everything else here (see the capability-link caveat above): anyone holding
  the public key could read them. Moving to real login (Future work) fixes
  this; until then, only add addresses you're comfortable with that exposure.
- The report key stops strangers from triggering emails, but it is typed into
  the app and kept in that browser's local storage — treat it like a password
  and use the app only on your own devices.
- Resend's free tier has daily/monthly sending limits; check them if you have
  many clients.

## Google Sheet sync (live, any client)

Keeps any client's logged hours **and** hours-bought purchases mirrored,
live, into a Google Sheet tab — either one the app fully owns (`Tracker
Sync` by default) or a client's own pre-existing ledger tab, safely.
**One-way only**: the app writes; the Sheet is never read back into the
app. One row per task or purchase.

**Column convention, the same for every client's sheet:**
`A` = Date, `B` = Description, `C` = Hours Bought, `D` = Hours Spent,
`E` = Total Hours Left, `Z` = a hidden tracking column (each row's task or
purchase ID — leave it alone, the sync uses it to find its own rows again
later). **The app writes every column.** A task's hours go to column D; an
hours-bought purchase's go to column C, with its description formatted the
same way a human already enters these by hand (e.g. "20 hours bought").

**C and D display as a duration clock (`04:23:00`), not a decimal.** This
matches how staff already log time in Slack and how a real pre-existing
hand-tracked ledger's own rows typically already work. Google Sheets has no
way to *display* a cell as `HH:MM:SS` without the number stored underneath
being a day-fraction (`hours ÷ 24` — Duration format's unit is "1.0 = one
day"), so that's what the app stores there, and it forces each cell it
writes to Duration format (`[hh]:mm:ss`) so the day-fraction always renders
as hours, never as a confusing raw decimal like `0.1826`. The trade-off:
the *raw* cell value is no longer self-explanatory at a glance (checking the
formula bar shows `0.1826`, not `4.38`), and nothing outside this app should
ever read C or D directly expecting a plain hour count. This app itself
never does — "Hours Left," the budget cards, and the weekly email are all
computed from the database directly, never from these cells.

Column E gets the live running balance (hours bought so far minus hours
used so far) — computed straight from the app's own clean numbers, never a
spreadsheet formula, so it's never thrown off by a historical row's number
format. **It gets the same day-fraction/Duration treatment as C/D, but only
while the balance is non-negative** — a client still within budget sees
`HH:MM:SS` same as C/D; the moment they go over budget, that one row falls
back to a plain negative number instead, since Duration format can't
represent a negative duration cleanly (see
`hoursLeftValue`/`ensureHoursLeftFormat` in the Edge Function). Only one row
ever shows a value in E at a time — whichever row is currently last —
matching how a lead's own hand-maintained ledger places a single running
total at the bottom; every sync clears E everywhere else first. **If a
client's Sheet already had its own formula in column E, turning sync on for
them replaces it with this app's own number the first time sync runs** —
that's intentional, not a bug: the app's figure is always correct,
regardless of what historical data looks like. This is why a
brand-new app-owned tab uses this same 5-visible-column shape instead of a
3-column one — one convention works safely whether the target is an empty
tab or a client's real, already in-use ledger.

Edits update a task's or purchase's existing row in place. Deleting one (or
moving a task's week off this client) **blanks** that row's
`A`/`B`/`C`/`D`/`Z` rather than removing it — the row stays, just empty;
nothing below it ever shifts. New rows are always appended after the
sheet's current last row, never inserted mid-table, so nothing already
there — hand-entered or previously synced — ever moves.

Which clients get synced is entirely driven by a per-client **Google Sheet
sync** field in the Clients window (paste a Sheet ID or its full URL — either
works). A client with that field left blank is simply never synced; nothing
else about the app changes for them.

### One-time setup

1. **Database.** Run
   [`supabase/migrations/2026-10-20-client-sheet-id.sql`](supabase/migrations/2026-10-20-client-sheet-id.sql)
   and
   [`supabase/migrations/2026-10-20-client-sheet-tab.sql`](supabase/migrations/2026-10-20-client-sheet-tab.sql)
   in the SQL Editor. Each only *adds* one nullable column (`sheet_id`,
   `sheet_tab`).
2. **Google Cloud (once, shared by every client).** Create (or reuse) a GCP
   project, enable the **Google Sheets API**, then create a **service
   account** and generate a JSON key for it. This one service account is
   reused for every client's Sheet — nothing here is per-client.
3. **Edge Function.** In Supabase → *Edge Functions* → *Deploy a new function*
   → name it exactly `sheet-sync` and paste in
   [`supabase/functions/sheet-sync/index.ts`](supabase/functions/sheet-sync/index.ts).
   Turn **off "Verify JWT"** for this function, same reasoning as
   `weekly-report` above. (CLI alternative:
   `supabase functions deploy sheet-sync --no-verify-jwt`.)
4. **Secrets** (Edge Functions → *Secrets*):

   | Name | Value |
   |---|---|
   | `SHEET_SYNC_KEY` | a long random string you invent — the shared secret the trigger sends back |
   | `GOOGLE_SHEET_TAB` | optional fallback tab name, used only for a client with no **Tab name** set in the Clients window — `Tracker Sync` if neither is set |
   | `GOOGLE_SA_CLIENT_EMAIL` | the service account's email |
   | `GOOGLE_SA_PRIVATE_KEY` | the service account's private key (from the JSON key file's `private_key` field) — paste it **as-is**, literal `\n` sequences and all |

5. **Enable the triggers.** Run
   [`supabase/migrations/2026-10-19-sheet-sync-trigger.sql`](supabase/migrations/2026-10-19-sheet-sync-trigger.sql)
   in the SQL Editor, replacing its three placeholders
   (`__PROJECT_REF__`, `__SHEET_SYNC_KEY__`, `__SUPABASE_ANON_KEY__`) first,
   then run
   [`supabase/migrations/2026-10-21-sheet-sync-trigger-purchases.sql`](supabase/migrations/2026-10-21-sheet-sync-trigger-purchases.sql)
   (no placeholders — it reuses the function the first migration just
   created) so hours-bought purchases sync too. Both create their trigger
   project-wide, once — neither needs re-running per client.

### Turning it on for a client

1. In the target Google Sheet (a fresh tab, or the client's own existing
   ledger tab), **share the Sheet with the service account's email as
   Editor**.
2. In the app's **Clients** window, paste the Sheet's ID (or its full URL —
   the app extracts the ID either way) into that client's **Google Sheet
   sync** field, and that tab's exact name into **Tab name** right next to
   it (leave blank to use `Tracker Sync`).
3. From then on, every add/edit/delete of that client's tasks (and any edit
   to one of their week's dates, or a week moved on/off them) re-syncs their
   Sheet within a few seconds. The header row and the hidden `Z` tracking
   column are set up automatically on first sync — nothing to prepare by
   hand beyond sharing the Sheet.

Test with a throwaway client and a scratch Sheet (or a **copy** of a real
ledger, never the live original) first, with `curl` (or any HTTP client),
before trusting it against a real client's Sheet:

```sh
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/sheet-sync' \
  -H 'Content-Type: application/json' \
  -H 'x-sync-key: <your SHEET_SYNC_KEY>' \
  -d '{"type":"UPDATE","table":"weeks","record":{"client_id":"<that client's UUID>"},"old_record":{"client_id":"<same UUID>"}}'
```

A response like `{"results":[{"clientId":"...","written":N,"blanked":M}]}`
means it reconciled that client's current tasks against the Sheet.
`{"skipped":true}` means the client in the test body has no `sheet_id` set.

### Migrating an existing hand-tracked ledger

If a client's Sheet was tracked **by hand** before this app existed, its
Hours Bought / Hours Spent columns very likely already use Google Sheets'
own "Duration" number format (displays like `20:00:00`), with the
underlying value stored as a day-fraction (`20` hours stored as `0.8333`).
That's exactly the convention this app's own sync now uses for C and D (see
the column-convention note above), so a hand-tracked ledger's historical
rows and the app's newly-synced rows end up using the **same** unit and
display — nothing to convert, nothing to clean up before turning sync on
for a client. If a historical row happens to be a plain NUMBER instead
(an older row that predates the lead's own switch to Duration formatting,
for example), leave it as-is too: the sync never touches a historical row's
formatting, only the exact rows it writes itself, so mixed formats in old
rows are harmless — they just predate the convention.

The one thing to know: the app's own number in column E **replaces**
whatever was there before (including any formula the lead had set up),
the first time sync runs for that client — see the column-convention note
above.

### Things to know

- **Reconcile, not full rewrite.** Each sync only touches the rows that
  actually need it: a new task's or purchase's row is appended after the
  sheet's current last row, an edited one's existing row is updated in place
  (found via its id in the hidden `Z` column), and a deleted one's row is
  blanked, not removed. Nothing pre-existing — hand-entered rows included —
  is ever cleared, reordered, or shifted.
- **A blank row can accumulate** where a deleted task or purchase used to be
  — a deliberate trade-off (see the Edge Function's header comment) in
  exchange for never needing to re-index every other tracked row after a
  deletion. Harmless; tidy it up by hand if it bothers you.
- **Columns C and D get Duration formatting (`[hh]:mm:ss`) applied, but only
  on the exact rows a sync is writing — never the whole column.** This app
  always writes an hours value as a day-fraction there (e.g. `20` hours
  stored as `0.8333`), so those specific rows need Duration formatting to
  display correctly as `20:00:00` (left as plain NUMBER, that same `0.8333`
  would show as a confusing raw decimal). Scoping the fix to only the rows
  this sync actually writes keeps every hand-entered row exactly as its own
  author left it — including a historical row that happens to use a
  different format, which is left alone rather than forced to match.
- **Column E (Total Hours Left) is cleared and rewritten on every sync.**
  Every row's E cell is blanked, then the live balance (hours bought minus
  hours used, computed from the app's own numbers) is written onto just the
  current last row — so it always reads as one single, correct running
  total, no matter how the row above it happened to be formatted. That row's
  number FORMAT is also reset on every sync, to Duration or plain NUMBER
  depending on whether the balance is currently negative — so a client
  crossing over budget (or coming back under it) always gets the right
  format for their new balance, not whatever was left over from before.
- **A task only syncs (and only counts toward E) once it's "verified".**
  Every task created in the app is verified by default; only a task logged
  via Slack (`/log-task`) starts out unverified and is invisible to sync
  entirely until an admin approves it — see "Slack task logging" below.
- **Every client's task and purchase edits fire a trigger** — the function
  looks up that record's client and skips immediately (no Sheets API call,
  no Google auth) if that client has no `sheet_id` set. Check the Edge
  Function logs if a sync you expected doesn't seem to have happened.
- **Rollback is instant and touches no data:**
  `drop trigger tasks_sheet_sync on tasks; drop trigger weeks_sheet_sync on weeks; drop trigger hours_purchases_sheet_sync on hours_purchases;`
  (this disables sync for every client at once). To turn it off for just one
  client, clear their **Google Sheet sync** field in the Clients window
  instead.
- Google Sheets API has a default quota around 300 writes/minute/project —
  fine for a handful of clients' normal traffic, but worth watching if many
  clients are active at once (a week deletion fires one sync per cascaded
  task, per affected client).

## Slack task logging (`/log-task`)

Lets staff log a task straight from Slack instead of opening the app. Running
`/log-task` opens a modal (Client — a real client or **Internal**, Project,
Date, Status, Time spent); submitting it inserts a normal task row. It shows
up in the app immediately, via the app's own realtime subscription, and
counts toward that client's totals right away — same as any other task.
**Internal** maps to a week with no `client_id`, exactly like the "Internal
(no client)" option when moving a week in the app — the natural home for
non-billable work.

**It does NOT sync to that client's Google Sheet right away.** Since Slack
is the one task-entry path with no admin review before the data lands in
the database, a Slack-submitted task is inserted as unverified (`verified =
false`) and held out of Sheet sync entirely (see "Google Sheet sync" above)
until an admin clicks **Approve** on it in the app — a pending task shows a
"Pending review" badge and an Approve button on its row. Approving it is
just an ordinary field update, so it fires the same trigger as any other
change and syncs to the Sheet for the first time right then. A task created
in the app itself skips all of this — it's verified from the moment it's
created, exactly like today.

Unlike Sheet sync's shared secret, Slack signs every request itself
(HMAC-SHA256 over the raw body, using the app's own Signing Secret) — no
secret to invent. Who can actually *run* the command is controlled
separately, by an explicit allowlist of Slack user ids
(`SLACK_ALLOWED_USER_IDS`), since a slash command is otherwise runnable by
anyone in the workspace.

### One-time setup

1. **Database.** Run
   [`supabase/migrations/2026-10-23-task-verified.sql`](supabase/migrations/2026-10-23-task-verified.sql)
   in the SQL Editor — adds the one `verified` column this whole feature
   depends on. Safe to run any time; it only adds a column (defaulting
   every existing task to verified).
2. **Create the Slack app.** Go to
   [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** →
   **From a manifest** → pick your workspace → paste:

   ```yaml
   display_information:
     name: Task Logger
   features:
     bot_user:
       display_name: Task Logger
       always_online: true
     slash_commands:
       - command: /log-task
         url: https://example.com/placeholder
         description: Log a task to the Weekly Task Tracker
         should_escape: false
     shortcuts:
       - name: Log a task
         type: global
         callback_id: log_task_shortcut
         description: Log a task to the Weekly Task Tracker
   oauth_config:
     scopes:
       bot:
         - commands
         - chat:write
         - im:write
   settings:
     interactivity:
       is_enabled: true
       request_url: https://example.com/placeholder
     org_deploy_enabled: false
     socket_mode_enabled: false
     token_rotation_enabled: false
   ```

   The **Global Shortcut** gives staff a "click here to start" entry point
   (the lightning-bolt/shortcuts menu, or Slack's `⌘K` search) in addition
   to typing `/log-task` — same modal either way. `im:write` is needed for
   the confirmation DM sent after a task is successfully logged.

   If you're adding this to an app that already exists (rather than
   creating fresh from this manifest), add the shortcut via **Interactivity
   & Shortcuts** → scroll to **Shortcuts** → **Create New Shortcut** →
   **Global** → Name "Log a task", Callback ID `log_task_shortcut` — and add
   the `im:write` scope via **OAuth & Permissions** → **Bot Token Scopes**
   → **Add an OAuth Scope**, then **Reinstall to Workspace** (required
   whenever scopes change).

   The placeholder URLs are just there so Slack accepts the manifest — swap
   them for the real Edge Function URL in step 5, once it's deployed.
3. **Grab the credentials.** On the created app: **OAuth & Permissions** →
   **Bot User OAuth Token** (`xoxb-...`); **Basic Information** → **App
   Credentials** → **Signing Secret**.
4. **Edge Function.** In Supabase → *Edge Functions* → *Deploy a new
   function* → name it exactly `slack-log-task` and paste in
   [`supabase/functions/slack-log-task/index.ts`](supabase/functions/slack-log-task/index.ts).
   Turn **off "Verify JWT"**, same reasoning as `weekly-report` and
   `sheet-sync` above (CLI alternative:
   `supabase functions deploy slack-log-task --no-verify-jwt`).
5. **Secrets** (Edge Functions → *Secrets*):

   | Name | Value |
   |---|---|
   | `SLACK_SIGNING_SECRET` | from step 3 |
   | `SLACK_BOT_TOKEN` | from step 3 (the `xoxb-...` token) |
   | `SLACK_ALLOWED_USER_IDS` | comma-separated Slack user ids allowed to run `/log-task` (each staff member's Slack profile → **More** → **Copy member ID**) |

   (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` don't need setting — every
   Edge Function already has those automatically.)
6. **Point Slack at the real URL.** Back on the Slack app: **Slash
   Commands** → edit `/log-task` → set the Request URL to
   `https://<project-ref>.supabase.co/functions/v1/slack-log-task`.
   **Interactivity & Shortcuts** → set the Request URL to the same address.
   Save both.
7. **Reinstall the app** to the workspace if Slack prompts you to (it
   sometimes does after changing scopes or URLs) — **OAuth & Permissions**
   → **Reinstall to Workspace**.

Test with a throwaway task before trusting it for real: run `/log-task` in
Slack, fill in the modal against a test client, submit, and confirm the task
shows up in the app within a couple seconds.

### Things to know

- **The week a task lands in is resolved automatically.** The function
  finds (or creates) the existing week for that client covering the chosen
  date's calendar week (Monday–Sunday, matching how the app itself picks
  "the current week") — nobody has to pre-create a week in the app first.
- **Project is required** in the Slack modal (Slack's own field validation,
  not a special rule this app enforces) — slightly stricter than the app's
  own Add Task form, which allows a blank project.
- **Errors come back as a Slack DM**, not an inline modal error — if the
  database insert fails (e.g. a transient network issue), the modal still
  closes, and the bot DMs the reason instead of leaving the form stuck open.
- **Every submitted task needs an admin's approval before it reaches the
  Sheet.** It shows up in the app right away (with a "Pending review" badge
  and an Approve button on its row) and already counts toward that client's
  totals in the app — only the Google Sheet sync is held back until
  approved. The confirmation DM says as much, so staff aren't left assuming
  it's already on the Sheet.
- **Two ways to open the modal, one code path.** The slash command and the
  Global Shortcut both end up calling the same `openLogTaskModal` — same
  allowlist check, same client list, same form. Someone not on the
  allowlist gets an explicit ephemeral message from the slash command, but
  silently sees nothing happen from the shortcut (it has no equivalent
  built-in response channel) — a minor inconsistency, not a security gap,
  since both paths are gated by the same check either way.
- **Rollback:** delete the `/log-task` command and the app from
  [api.slack.com/apps](https://api.slack.com/apps), or just clear the
  `SLACK_ALLOWED_USER_IDS` secret to lock everyone out without deleting
  anything.

## Future work / ideas not yet implemented

- Real per-client accounts (Supabase Auth) if client links need genuine
  confidentiality rather than the current capability-link trade-off.
- Drag-and-drop task reordering within a week.
