-- Waiter calls: customers tap "Call waiter" or "Request bill" from the
-- ordering app. Calls show up on the kitchen display + admin Orders surface
-- in real time. Staff resolve them by setting resolved_at + resolved_by.

create table if not exists public.waiter_calls (
  id uuid primary key default gen_random_uuid(),
  table_id text not null,
  order_id text references public.orders(id) on delete set null,
  kind text not null check (kind in ('service', 'bill')),
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

-- Active-calls index: small, covers the realtime list query the staff sees.
create index if not exists waiter_calls_active_idx
  on public.waiter_calls (created_at desc)
  where resolved_at is null;

-- Cooldown index: lets the trigger find recent unresolved calls fast.
create index if not exists waiter_calls_cooldown_idx
  on public.waiter_calls (table_id, kind, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 60s cooldown per (table_id, kind) — prevents accidental double-taps
-- and casual spam without needing client-side coordination across tabs.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.waiter_calls_enforce_cooldown()
returns trigger
language plpgsql
as $$
declare
  recent timestamptz;
begin
  select created_at into recent
    from public.waiter_calls
    where table_id = new.table_id
      and kind = new.kind
      and resolved_at is null
      and created_at > now() - interval '60 seconds'
    order by created_at desc
    limit 1;

  if recent is not null then
    raise exception
      'Please wait a moment before calling again'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists waiter_calls_cooldown on public.waiter_calls;
create trigger waiter_calls_cooldown
  before insert on public.waiter_calls
  for each row execute function public.waiter_calls_enforce_cooldown();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: anonymous customers can insert (no auth at the QR table); only
-- staff can read or update/resolve.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.waiter_calls enable row level security;

drop policy if exists waiter_calls_insert on public.waiter_calls;
create policy waiter_calls_insert on public.waiter_calls
  for insert with check (true);

drop policy if exists waiter_calls_staff_read on public.waiter_calls;
create policy waiter_calls_staff_read on public.waiter_calls
  for select using (public.is_staff());

drop policy if exists waiter_calls_staff_update on public.waiter_calls;
create policy waiter_calls_staff_update on public.waiter_calls
  for update using (public.is_staff()) with check (public.is_staff());

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: the kitchen + admin surfaces subscribe via postgres_changes.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'waiter_calls'
  ) then
    execute 'alter publication supabase_realtime add table public.waiter_calls';
  end if;
end $$;

alter table public.waiter_calls replica identity full;

-- Make sure the anon role + authenticated role can hit the table.
-- RLS still gates which rows they see/touch; the GRANT just unlocks the
-- table-level privilege check that runs before RLS.
grant insert on public.waiter_calls to anon, authenticated;
grant select, update on public.waiter_calls to authenticated, service_role;

notify pgrst, 'reload schema';
