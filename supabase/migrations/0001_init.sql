-- SERVIO initial schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- Idempotent guards (`if not exists`) make it safe to re-run during early development.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.tables (
  id text primary key,                 -- "T1", "T2", ...
  label text not null,
  qr_token text unique,                -- optional rotating token for QR codes
  archived_at timestamptz
);

create table if not exists public.menu_items (
  id text primary key,                 -- "meal-1", "drink-2", ...
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  image text not null,
  category text not null check (category in ('meals','drinks','desserts','sides')),
  description text not null,
  top_pick boolean not null default false,
  in_stock boolean not null default true,
  options jsonb,                       -- MenuOption[] (see src/types)
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_category_position_idx
  on public.menu_items (category, position) where archived_at is null;
create index if not exists menu_items_top_pick_idx
  on public.menu_items (top_pick) where top_pick = true and archived_at is null;

create table if not exists public.banners (
  id text primary key,                 -- "welcome", "halo-halo-week", ...
  image text not null,
  title text,
  subtitle text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists banners_active_position_idx
  on public.banners (position) where active = true;

create table if not exists public.orders (
  id text primary key,                 -- "ORD-..."
  table_id text not null references public.tables(id),
  status text not null check (status in ('pending','preparing','ready','served','cancelled')) default 'pending',
  total numeric(10,2) not null check (total >= 0),
  customer_name text,
  notes text,
  created_at timestamptz not null default now(),
  ready_at timestamptz
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  line_id text not null,               -- composite from useAppStore.lineIdOf
  item_id text references public.menu_items(id),
  name text not null,                  -- snapshot
  base_price numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  image text not null,
  selections jsonb                     -- CartItemSelection[]
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','kitchen','waiter')),
  display_name text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists menu_items_touch_updated_at on public.menu_items;
create trigger menu_items_touch_updated_at
  before update on public.menu_items
  for each row execute function public.touch_updated_at();

create or replace function public.set_ready_at() returns trigger as $$
begin
  if new.status = 'ready' and old.status <> 'ready' then
    new.ready_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_ready_at on public.orders;
create trigger orders_set_ready_at
  before update on public.orders
  for each row execute function public.set_ready_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tables      enable row level security;
alter table public.menu_items  enable row level security;
alter table public.banners     enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.staff       enable row level security;

-- Helper: is the current user a staff member?
create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.staff where user_id = auth.uid()); $$;

-- TABLES: anyone reads non-archived; staff manage
drop policy if exists tables_read on public.tables;
create policy tables_read on public.tables
  for select using (archived_at is null or public.is_staff());

drop policy if exists tables_staff_write on public.tables;
create policy tables_staff_write on public.tables
  for all using (public.is_staff()) with check (public.is_staff());

-- MENU ITEMS: anyone reads non-archived; staff manage
drop policy if exists menu_items_read on public.menu_items;
create policy menu_items_read on public.menu_items
  for select using (archived_at is null or public.is_staff());

drop policy if exists menu_items_staff_write on public.menu_items;
create policy menu_items_staff_write on public.menu_items
  for all using (public.is_staff()) with check (public.is_staff());

-- BANNERS: anyone reads active; staff manage
drop policy if exists banners_read on public.banners;
create policy banners_read on public.banners
  for select using (active or public.is_staff());

drop policy if exists banners_staff_write on public.banners;
create policy banners_staff_write on public.banners
  for all using (public.is_staff()) with check (public.is_staff());

-- ORDERS: anyone can place; anyone can read by id (id is the bearer token);
-- only staff can update/delete
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (true);

drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
  for select using (true);

drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update on public.orders
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists orders_staff_delete on public.orders;
create policy orders_staff_delete on public.orders
  for delete using (public.is_staff());

-- ORDER ITEMS: same as orders
drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert with check (true);

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
  for select using (true);

drop policy if exists order_items_staff_write on public.order_items;
create policy order_items_staff_write on public.order_items
  for all using (public.is_staff()) with check (public.is_staff());

-- STAFF: a logged-in user can read their own row; staff can read all
drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff
  for select using (auth.uid() = user_id or public.is_staff());

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────────────────────
-- The customer's Order Status page subscribes to changes on its own order row.
-- Add the orders table to the realtime publication if not already there.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end $$;
