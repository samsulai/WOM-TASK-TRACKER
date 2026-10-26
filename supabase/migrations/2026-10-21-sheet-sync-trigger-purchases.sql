-- Extends the live Google Sheet sync (supabase/migrations/2026-10-19-sheet-sync-trigger.sql,
-- see README "Google Sheet sync") to also fire on hours_purchases changes,
-- now that the sheet-sync function writes each purchase into column C
-- ("Hours Bought") alongside tasks in column D. Reuses sheet_sync_notify()
-- unchanged -- it already just forwards TG_TABLE_NAME, and the Edge
-- Function already branches on 'hours_purchases' in affectedClientIds().
-- Same "opt-in, not folded into schema.sql" treatment as its predecessor:
-- run this manually in the SQL Editor only after the 2026-10-19 migration
-- has already been run (it depends on sheet_sync_notify() existing).
--
-- Rollback (stops purchase-triggered sync only; tasks/weeks sync is
-- untouched):
--   drop trigger if exists hours_purchases_sheet_sync on hours_purchases;

drop trigger if exists hours_purchases_sheet_sync on hours_purchases;
create trigger hours_purchases_sheet_sync
  after insert or update or delete on hours_purchases
  for each row
  execute function sheet_sync_notify();
