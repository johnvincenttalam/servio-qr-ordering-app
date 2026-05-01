-- Categories: lift the four hardcoded values ('meals','drinks','desserts',
-- 'sides') out of the menu_items.category check constraint into their own
-- table so admins can add, rename, reorder, and archive them at runtime.
--
-- The schema stays compatible: menu_items.category remains a text column,
-- it just becomes a foreign key into the new table instead of a fixed
-- check constraint. Existing rows back-fill cleanly because their values
-- already match the seeded category ids.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. categories table
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id text primary key,
  label text not null,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists categories_position_idx
  on public.categories (position) where archived_at is null;

-- Seed the four originals so existing menu_items rows resolve their FK.
-- on conflict do nothing so the migration is safe to re-run.
insert into public.categories (id, label, position) values
  ('meals',    'Meals',    10),
  ('drinks',   'Drinks',   20),
  ('desserts', 'Desserts', 30),
  ('sides',    'Sides',    40)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. menu_items: swap the check constraint for an FK
-- ─────────────────────────────────────────────────────────────────────────
alter table public.menu_items
  drop constraint if exists menu_items_category_check;

-- Use a separately-named constraint so `drop constraint if exists` is
-- predictable on re-runs.
alter table public.menu_items
  drop constraint if exists menu_items_category_fkey;

alter table public.menu_items
  add constraint menu_items_category_fkey
  foreign key (category) references public.categories(id)
  on update cascade
  on delete restrict;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS — anon reads non-archived rows, staff write everything
-- ─────────────────────────────────────────────────────────────────────────
alter table public.categories enable row level security;

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories
  for select using (archived_at is null or public.is_staff());

drop policy if exists categories_staff_write on public.categories;
create policy categories_staff_write on public.categories
  for all using (public.is_staff()) with check (public.is_staff());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Realtime — admin Categories page subscribes so renames/archives
--    propagate live across tabs.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'categories'
  ) then
    execute 'alter publication supabase_realtime add table public.categories';
  end if;
end $$;

alter table public.categories replica identity full;

notify pgrst, 'reload schema';
