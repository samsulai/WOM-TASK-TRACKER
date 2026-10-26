-- Replaces the single-number clients.monthly_hours ("time bought") with a
-- proper dated ledger: each purchase is its own row (date + hours + an
-- optional note), matching how the real Google Sheet ledger this app syncs
-- to already works (a running history of purchase events, not one static
-- figure) -- see README "Client budgets". Folded into schema.sql's main
-- table/RLS/realtime blocks (not treated as opt-in) since this is core
-- functionality, same as weeks/tasks.
--
-- Drops the legacy clients.monthly_hours column in the same migration:
-- confirmed as of 2026-10-21 that neither of this app's two real clients
-- (Overtime Marketing, Ridgewood Local) has it set, so there is no
-- production value to migrate or preserve.

create table if not exists hours_purchases (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  purchased_on  date not null default current_date,
  hours         numeric(6,2) not null check (hours > 0 and hours <= 1000),
  note          text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists hours_purchases_client_id_idx on hours_purchases (client_id);

alter table hours_purchases enable row level security;

drop policy if exists "hours_purchases_select_all" on hours_purchases;
drop policy if exists "hours_purchases_insert_all" on hours_purchases;
drop policy if exists "hours_purchases_update_all" on hours_purchases;
drop policy if exists "hours_purchases_delete_all" on hours_purchases;
create policy "hours_purchases_select_all" on hours_purchases for select using (true);
create policy "hours_purchases_insert_all" on hours_purchases for insert with check (true);
create policy "hours_purchases_update_all" on hours_purchases for update using (true) with check (true);
create policy "hours_purchases_delete_all" on hours_purchases for delete using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hours_purchases'
  ) then
    alter publication supabase_realtime add table hours_purchases;
  end if;
end $$;

alter table clients drop constraint if exists clients_monthly_hours_check;
alter table clients drop column if exists monthly_hours;
