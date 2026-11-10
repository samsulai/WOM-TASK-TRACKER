-- Locks down writes to require a real Supabase Auth session, now that the
-- app has an admin login (see README "Admin login"). Reads are left exactly
-- as open as before -- that's what the read-only client-link feature
-- depends on (a client opens their link with no account at all) -- only
-- insert/update/delete now require auth.role() = 'authenticated'.
--
-- Safe for the existing Slack (/log-task) and Google Sheet sync Edge
-- Functions: both already use the service-role key, which bypasses RLS
-- entirely regardless of these policies.
--
-- Run this manually in the SQL Editor, same as any other opt-in migration
-- here -- not folded into schema.sql, since schema.sql has to stay runnable
-- on a brand-new project before an admin account even exists yet.
--
-- Rollback (back to fully open writes, matching schema.sql's original
-- policies):
--   create policy "weeks_insert_all" on weeks for insert with check (true);
--   create policy "weeks_update_all" on weeks for update using (true) with check (true);
--   create policy "weeks_delete_all" on weeks for delete using (true);
--   (same pattern for tasks, clients, hours_purchases)

drop policy if exists "weeks_insert_all" on weeks;
drop policy if exists "weeks_update_all" on weeks;
drop policy if exists "weeks_delete_all" on weeks;
create policy "weeks_insert_auth" on weeks for insert with check (auth.role() = 'authenticated');
create policy "weeks_update_auth" on weeks for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "weeks_delete_auth" on weeks for delete using (auth.role() = 'authenticated');

drop policy if exists "tasks_insert_all" on tasks;
drop policy if exists "tasks_update_all" on tasks;
drop policy if exists "tasks_delete_all" on tasks;
create policy "tasks_insert_auth" on tasks for insert with check (auth.role() = 'authenticated');
create policy "tasks_update_auth" on tasks for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "tasks_delete_auth" on tasks for delete using (auth.role() = 'authenticated');

drop policy if exists "clients_insert_all" on clients;
drop policy if exists "clients_update_all" on clients;
drop policy if exists "clients_delete_all" on clients;
create policy "clients_insert_auth" on clients for insert with check (auth.role() = 'authenticated');
create policy "clients_update_auth" on clients for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "clients_delete_auth" on clients for delete using (auth.role() = 'authenticated');

drop policy if exists "hours_purchases_insert_all" on hours_purchases;
drop policy if exists "hours_purchases_update_all" on hours_purchases;
drop policy if exists "hours_purchases_delete_all" on hours_purchases;
create policy "hours_purchases_insert_auth" on hours_purchases for insert with check (auth.role() = 'authenticated');
create policy "hours_purchases_update_auth" on hours_purchases for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "hours_purchases_delete_auth" on hours_purchases for delete using (auth.role() = 'authenticated');
