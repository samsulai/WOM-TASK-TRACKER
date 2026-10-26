-- Weekly Task Tracker schema
-- Run this once in the Supabase SQL Editor (or via `supabase db push`) on a fresh project.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible, but DROP POLICY
-- statements will error harmlessly if the policy doesn't exist yet on first run.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gives us gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Tables
--
-- A week is "internal" (client_id null) until assigned to a client. Each
-- client gets a shareable link (?client=<id>) that scopes the whole app to
-- just their weeks/tasks -- see README "Client links" for how this works
-- and what it does and doesn't protect against.
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Where the end-of-week report goes. Nullable: clients without an address are
-- simply skipped when reports are sent.
alter table clients add column if not exists email text;

-- Google Sheet ID to live-sync this client's logged hours into (see README
-- "Google Sheet sync"). Null = sync is off for this client; nothing is sent.
alter table clients add column if not exists sheet_id text;

-- Which tab in that Sheet to write to. Null = GOOGLE_SHEET_TAB secret's
-- value, or "Tracker Sync" if that isn't set either -- different clients
-- reasonably use different tab names (a fresh app-owned tab vs. a client's
-- own pre-existing ledger tab).
alter table clients add column if not exists sheet_tab text;

-- Drops the old single-number "monthly hours" budget: replaced below by
-- hours_purchases, a dated ledger of purchase events (matching how a real
-- client's Google Sheet ledger already tracks "hours bought" -- a running
-- history of irregular, dated amounts, not one static figure). No real
-- client had this column set as of 2026-10-21, so nothing to migrate.
alter table clients drop constraint if exists clients_monthly_hours_check;
alter table clients drop column if exists monthly_hours;

create table if not exists weeks (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null,
  label       text not null default '',
  client_id   uuid references clients(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Each client (including the "internal" null bucket) can only have one row
-- per calendar week -- but different clients can each have their own row
-- for the same week_start.
create unique index if not exists weeks_client_week_unique on weeks (client_id, week_start);

create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  week_id     uuid not null references weeks(id) on delete cascade,
  project     text not null default '',
  status      text not null default 'Not Started'
                check (status in ('Not Started', 'In Progress', 'Blocked', 'Done')),
  hours       numeric(6,2) not null default 0
                check (hours >= 0 and hours <= 168),
  notes       text not null default '',
  done        boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tasks_week_id_idx on tasks (week_id);

-- Lets a task be held back from Google Sheet sync until an admin reviews
-- it -- see README "Slack task logging". Defaults to true: every task
-- created in the app itself (src/App.jsx's addTask) is implicitly already
-- "verified", since an admin typed it in directly. Only the Slack
-- integration (supabase/functions/slack-log-task) sets this false on
-- insert, since that's the one input path with no review step before the
-- data lands in the database.
alter table tasks add column if not exists verified boolean not null default true;

-- A dated ledger of "hours bought" purchase events for a client -- see
-- README "Client budgets". Each row is one purchase (date + amount, plus an
-- optional note); the running total is just the sum of these, compared
-- against all hours ever logged for the client (see App.jsx's grandTotal).
create table if not exists hours_purchases (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  purchased_on  date not null default current_date,
  hours         numeric(6,2) not null check (hours > 0 and hours <= 1000),
  note          text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists hours_purchases_client_id_idx on hours_purchases (client_id);

-- Which weekly reports have already gone out, so a report is never emailed
-- twice for the same client + week (even if it's triggered twice). Row Level
-- Security is enabled with NO policies on purpose: the anon key can't read or
-- write it, only the weekly-report Edge Function (service role) can.
create table if not exists report_log (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  week_start  date not null,
  sent_to     text not null,
  sent_at     timestamptz not null default now(),
  unique (client_id, week_start)
);
alter table report_log enable row level security;

-- ---------------------------------------------------------------------------
-- Keep updated_at current on every UPDATE (used for optimistic-concurrency /
-- "don't clobber a row someone else is actively editing" logic in the client)
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- v1 trade-off: this app has no login system yet (see README "Future work").
-- Anyone with the anon key (i.e. anyone with the deployed URL) can read and
-- write EVERY row in every table below -- including client links, which are
-- capability URLs (unguessable, not access-controlled): they organize the
-- view per client but don't prevent someone from querying the tables
-- directly with the anon key. If that's not good enough, add Supabase Auth
-- and tighten these policies to `using (auth.uid() is not null)` (or a
-- proper per-client mapping) before sharing more broadly.
-- ---------------------------------------------------------------------------
alter table weeks enable row level security;
alter table tasks enable row level security;
alter table clients enable row level security;
alter table hours_purchases enable row level security;

drop policy if exists "weeks_select_all" on weeks;
drop policy if exists "weeks_insert_all" on weeks;
drop policy if exists "weeks_update_all" on weeks;
drop policy if exists "weeks_delete_all" on weeks;
create policy "weeks_select_all" on weeks for select using (true);
create policy "weeks_insert_all" on weeks for insert with check (true);
create policy "weeks_update_all" on weeks for update using (true) with check (true);
create policy "weeks_delete_all" on weeks for delete using (true);

drop policy if exists "tasks_select_all" on tasks;
drop policy if exists "tasks_insert_all" on tasks;
drop policy if exists "tasks_update_all" on tasks;
drop policy if exists "tasks_delete_all" on tasks;
create policy "tasks_select_all" on tasks for select using (true);
create policy "tasks_insert_all" on tasks for insert with check (true);
create policy "tasks_update_all" on tasks for update using (true) with check (true);
create policy "tasks_delete_all" on tasks for delete using (true);

drop policy if exists "clients_select_all" on clients;
drop policy if exists "clients_insert_all" on clients;
drop policy if exists "clients_update_all" on clients;
drop policy if exists "clients_delete_all" on clients;
create policy "clients_select_all" on clients for select using (true);
create policy "clients_insert_all" on clients for insert with check (true);
create policy "clients_update_all" on clients for update using (true) with check (true);
create policy "clients_delete_all" on clients for delete using (true);

drop policy if exists "hours_purchases_select_all" on hours_purchases;
drop policy if exists "hours_purchases_insert_all" on hours_purchases;
drop policy if exists "hours_purchases_update_all" on hours_purchases;
drop policy if exists "hours_purchases_delete_all" on hours_purchases;
create policy "hours_purchases_select_all" on hours_purchases for select using (true);
create policy "hours_purchases_insert_all" on hours_purchases for insert with check (true);
create policy "hours_purchases_update_all" on hours_purchases for update using (true) with check (true);
create policy "hours_purchases_delete_all" on hours_purchases for delete using (true);

-- ---------------------------------------------------------------------------
-- Realtime: add all three tables to the publication Supabase's realtime
-- service listens to. Without this, postgres_changes subscriptions never
-- fire. Wrapped so re-running this script doesn't error if already added.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'weeks'
  ) then
    alter publication supabase_realtime add table weeks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table tasks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clients'
  ) then
    alter publication supabase_realtime add table clients;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hours_purchases'
  ) then
    alter publication supabase_realtime add table hours_purchases;
  end if;
end $$;
