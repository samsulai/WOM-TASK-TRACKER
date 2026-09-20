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
-- ---------------------------------------------------------------------------
create table if not exists weeks (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null unique,
  label       text not null default '',
  created_at  timestamptz not null default now()
);

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
-- write. That's an acceptable default for a small internal tool shared with
-- one trusted contractor, but it means the URL itself is the access control.
-- If that's not good enough, add Supabase Auth + tighten these policies to
-- `using (auth.uid() is not null)` before sharing the link.
-- ---------------------------------------------------------------------------
alter table weeks enable row level security;
alter table tasks enable row level security;

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

-- ---------------------------------------------------------------------------
-- Realtime: add both tables to the publication Supabase's realtime service
-- listens to. Without this, postgres_changes subscriptions never fire.
-- Wrapped so re-running this script doesn't error if already added.
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
end $$;
