-- Live Google Sheet sync (see README "Google Sheet sync"). Fires on every
-- tasks/weeks change project-wide; the sheet-sync Edge Function itself
-- decides per-event which client(s) are affected and skips instantly for
-- any client with no sheet_id set on their `clients` row -- so this
-- migration only needs running once, not once per client. Unlike every
-- other file in this folder, it's still NOT folded into schema.sql and NOT
-- part of a fresh project's baseline, since it's an opt-in feature (the
-- Edge Function + its secrets have to exist first) rather than core
-- behavior every instance of this app wants by default.
--
-- Calls pg_net's net.http_post() directly from a small trigger function,
-- rather than Supabase's supabase_functions.http_request() wrapper -- that
-- wrapper only exists once the Database Webhooks dashboard feature has been
-- used at least once, which this project hadn't done. net.http_post() is
-- the same underlying mechanism (and the same one this project's existing
-- weekly-report pg_cron job already calls successfully, see README
-- "Automating it"), so this works with no dashboard step required first.
--
-- Run this manually, in the SQL Editor, AFTER sheet-sync is deployed and its
-- secrets are set (README), with the three placeholders below replaced first:
--   __PROJECT_REF__        your Supabase project ref (Project Settings -> General)
--   __SHEET_SYNC_KEY__      same value as the SHEET_SYNC_KEY secret
--   __SUPABASE_ANON_KEY__  your project's publishable/anon key (Project Settings -> API)
--     -- this isn't a secret (it already ships in the frontend bundle); it's
--     -- required because Supabase's gateway rejects function calls that
--     -- have no apikey/Authorization header at all, even with Verify JWT off
-- Embedding the secret directly in this SQL mirrors the existing pg_cron
-- snippet in README ("Automating it"), which embeds REPORT_ADMIN_KEY the
-- same way -- acceptable here because anyone with DB access already has
-- equivalent access to everything else in this app's open-RLS tables.
--
-- Rollback (stops all sync activity instantly, touches no data):
--   drop trigger if exists tasks_sheet_sync on tasks;
--   drop trigger if exists weeks_sheet_sync on weeks;
--   drop function if exists sheet_sync_notify();

create extension if not exists pg_net;

create or replace function sheet_sync_notify() returns trigger
language plpgsql as $$
begin
  perform net.http_post(
    url := 'https://__PROJECT_REF__.supabase.co/functions/v1/sheet-sync',
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', case when TG_OP = 'DELETE' then null else row_to_json(NEW) end,
      'old_record', case when TG_OP = 'INSERT' then null else row_to_json(OLD) end
    ),
    headers := '{"Content-Type":"application/json","apikey":"__SUPABASE_ANON_KEY__","x-sync-key":"__SHEET_SYNC_KEY__"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists tasks_sheet_sync on tasks;
create trigger tasks_sheet_sync
  after insert or update or delete on tasks
  for each row
  execute function sheet_sync_notify();

-- A week being moved between clients via "Move..." also needs to resync
-- even though no `tasks` row changed (the function resyncs both the old
-- and new client's Sheet when a week moves between two synced clients).
-- This trigger also still fires on a week's date being edited, which is
-- now a no-op sync (see supabase/migrations/2026-10-22-sheet-sync-trigger-task-date.sql,
-- which narrows this down once you've run it).
drop trigger if exists weeks_sheet_sync on weeks;
create trigger weeks_sheet_sync
  after update on weeks
  for each row
  when (old.client_id is distinct from new.client_id or old.week_start is distinct from new.week_start)
  execute function sheet_sync_notify();
