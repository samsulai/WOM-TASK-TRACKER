-- Generalizes Google Sheet sync (supabase/functions/sheet-sync) from one
-- hardcoded client to any client: each client can now have their own
-- sheet_id, set in the Clients window, instead of one TARGET_CLIENT_ID
-- secret. Additive only: one nullable column, nothing existing changes.

alter table clients add column if not exists sheet_id text;
