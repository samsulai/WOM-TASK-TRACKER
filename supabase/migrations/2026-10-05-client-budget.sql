-- Client monthly hours budget ("time bought" vs "time used"). Run once in
-- the Supabase SQL Editor on the existing project (schema.sql already
-- contains this for fresh projects).
-- Additive only: adds one nullable column with a check constraint; nothing
-- existing is changed, dropped or made required.

alter table clients add column if not exists monthly_hours numeric(6,2);
alter table clients drop constraint if exists clients_monthly_hours_check;
alter table clients add constraint clients_monthly_hours_check
  check (monthly_hours is null or (monthly_hours >= 0 and monthly_hours <= 1000));
