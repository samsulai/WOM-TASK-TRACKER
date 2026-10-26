-- Narrows the weeks_sheet_sync trigger (supabase/migrations/2026-10-19-sheet-sync-trigger.sql)
-- now that a task's "Date" in the synced Sheet comes from the task's own
-- creation date, not its week's week_start (see sheet-sync's taskToRecord
-- and src/components/TaskRow.jsx, which now shows the same date in-app).
-- Editing a week's date no longer changes anything in that client's Sheet,
-- so the trigger no longer needs to fire for it -- only a week actually
-- MOVING between clients still needs a resync (the task's hours move to a
-- different client's Sheet entirely).
--
-- Run this manually in the SQL Editor, any time after the 2026-10-19
-- migration (it depends on sheet_sync_notify() already existing). Purely
-- an efficiency cleanup, not a correctness fix -- skipping this just means
-- a few extra no-op syncs keep firing when a week's date is edited.
--
-- Rollback (restores the old, harmless week_start-also-triggers behavior):
--   drop trigger if exists weeks_sheet_sync on weeks;
--   create trigger weeks_sheet_sync after update on weeks for each row
--     when (old.client_id is distinct from new.client_id or old.week_start is distinct from new.week_start)
--     execute function sheet_sync_notify();

drop trigger if exists weeks_sheet_sync on weeks;
create trigger weeks_sheet_sync
  after update on weeks
  for each row
  when (old.client_id is distinct from new.client_id)
  execute function sheet_sync_notify();
