-- Weekly report support. Run once in the Supabase SQL Editor on the existing
-- project (schema.sql already contains this for fresh projects).
-- Additive only: adds one nullable column and one new table; nothing existing
-- is changed or dropped.

alter table clients add column if not exists email text;

create table if not exists report_log (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  week_start  date not null,
  sent_to     text not null,
  sent_at     timestamptz not null default now(),
  unique (client_id, week_start)
);

-- RLS on, no policies: the anon key can't touch this table; only the
-- weekly-report Edge Function (service role) can.
alter table report_log enable row level security;
