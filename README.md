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

## Future work / ideas not yet implemented

- Real per-client accounts (Supabase Auth) if client links need genuine
  confidentiality rather than the current capability-link trade-off.
- Drag-and-drop task reordering within a week.
