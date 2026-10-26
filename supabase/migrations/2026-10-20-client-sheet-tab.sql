-- Per-client Sheet tab name, alongside sheet_id (2026-10-20-client-sheet-id.sql).
-- Different clients' sheets can reasonably use different tab names (a fresh
-- app-owned tab vs. a client's own pre-existing ledger tab, e.g. "Sheet1"),
-- so this can no longer be one global GOOGLE_SHEET_TAB secret for everyone.
-- Null = use the GOOGLE_SHEET_TAB secret's value (or "Tracker Sync" if that
-- isn't set either) as before -- fully backwards compatible.

alter table clients add column if not exists sheet_tab text;
