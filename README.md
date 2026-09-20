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

- `weeks`: one row per week (`week_start` date, optional `label`).
- `tasks`: belongs to a week (`week_id`), has `project`, `status`
  (`Not Started` / `In Progress` / `Blocked` / `Done`), `hours`, `notes`,
  `done`.

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
- **CSV export**: the month picker next to "Export CSV" filters the download
  to that month (matched against each task's week start date); leave it
  blank to export everything.

## Future work / ideas not yet implemented

- Real login (Supabase Auth) so only specific people can access the tracker,
  instead of "anyone with the link."
- Mobile-friendly layout.
- CSV export of hours.
- Drag-and-drop task reordering within a week.
