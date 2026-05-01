-- Restaurant-wide settings: a single-row singleton table that holds
-- runtime config admins can change without a redeploy. Everything is
-- world-readable (the customer app needs the open-for-orders flag and
-- the require-customer-name flag) but only admins can write.
--
-- The "id = 1" check + default ensures there's always exactly one row;
-- updates target that row by primary key. New columns can be added in
-- later migrations as more settings get promoted out of constants.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.restaurant_settings (
  id smallint primary key default 1 check (id = 1),

  -- Identity (currently hardcoded throughout the app — moving to DB
  -- here so we don't redeploy to rename the place).
  name text not null default 'SERVIO',
  currency_symbol text not null default '₱',

  -- Availability
  open_for_orders boolean not null default true,

  -- Order behavior
  require_customer_name boolean not null default false,
  default_prep_minutes integer not null default 9
    check (default_prep_minutes > 0 and default_prep_minutes < 240),

  -- Updated tracking — useful in audit log + for cache invalidation.
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Seed the singleton row. The conflict guard makes this safe to re-run.
insert into public.restaurant_settings (id) values (1)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. updated_at trigger — bump on every UPDATE so the audit row stamp
--    is always fresh, regardless of what the caller passes.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.touch_restaurant_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists restaurant_settings_touch on public.restaurant_settings;
create trigger restaurant_settings_touch
  before update on public.restaurant_settings
  for each row execute function public.touch_restaurant_settings();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS — public read (anon QR landing needs the open flag), admin
--    write only. INSERT/DELETE are not exposed; the singleton is set
--    by the migration and stays.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.restaurant_settings enable row level security;

drop policy if exists "Anyone reads restaurant settings"
  on public.restaurant_settings;
create policy "Anyone reads restaurant settings"
  on public.restaurant_settings for select
  using (true);

drop policy if exists "Admins update restaurant settings"
  on public.restaurant_settings;
create policy "Admins update restaurant settings"
  on public.restaurant_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Realtime — customer apps subscribe so a "we're closed" toggle
--    propagates instantly without a refresh.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'restaurant_settings'
  ) then
    execute 'alter publication supabase_realtime add table public.restaurant_settings';
  end if;
end $$;

alter table public.restaurant_settings replica identity full;

notify pgrst, 'reload schema';
