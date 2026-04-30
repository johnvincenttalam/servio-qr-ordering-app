-- Staff management surface: lets an admin invite, promote/demote, and
-- remove other staff from the admin app instead of poking at SQL directly.
--
-- This migration adds:
--   1. An is_admin() helper (mirrors is_staff()) for RLS-safe role checks
--   2. RLS policies so admins can read/update/delete every staff row
--   3. A list_staff() RPC that joins staff → auth.users to expose emails
--      (auth.users is not directly readable by the client)
--   4. A guard trigger that prevents deleting or demoting the last admin
--      (so the system can't accidentally lock itself out)
--   5. Realtime so the staff list refreshes live across admin tabs

-- ─────────────────────────────────────────────────────────────────────────
-- is_admin() helper
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$
    select exists (
      select 1 from public.staff
      where user_id = auth.uid() and role = 'admin'
    );
  $$;

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: admins manage every row; the existing staff_read_own from
-- migration 0003 still lets a non-admin staff read their own row.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists staff_admin_read on public.staff;
create policy staff_admin_read on public.staff
  for select using (public.is_admin());

drop policy if exists staff_admin_update on public.staff;
create policy staff_admin_update on public.staff
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists staff_admin_delete on public.staff;
create policy staff_admin_delete on public.staff
  for delete using (public.is_admin());

-- INSERT is not exposed via RLS — new staff rows are created exclusively
-- by the admin-invite Edge Function using the service-role key.

-- ─────────────────────────────────────────────────────────────────────────
-- list_staff() — security-definer RPC so admins can see emails without
-- granting client access to the auth.users table.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.list_staff()
returns table (
  user_id uuid,
  email text,
  role text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql stable security definer set search_path = public, auth
as $$
  select
    s.user_id,
    u.email::text,
    s.role,
    s.display_name,
    s.created_at,
    u.last_sign_in_at
  from public.staff s
  join auth.users u on u.id = s.user_id
  where public.is_admin()
  order by s.created_at desc;
$$;

grant execute on function public.list_staff() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Guard: the system must always have at least one admin. Block deletes
-- and demotions of the final admin row.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.staff_guard_last_admin()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.role = 'admin' then
    if not exists (
      select 1 from public.staff
      where role = 'admin' and user_id <> old.user_id
    ) then
      raise exception 'Cannot remove the last admin'
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.role = 'admin'
    and new.role is distinct from 'admin'
  then
    if not exists (
      select 1 from public.staff
      where role = 'admin' and user_id <> old.user_id
    ) then
      raise exception 'Cannot demote the last admin'
        using errcode = 'P0001';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists staff_guard_last_admin on public.staff;
create trigger staff_guard_last_admin
  before delete or update on public.staff
  for each row execute function public.staff_guard_last_admin();

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: admin Staff page subscribes so role changes propagate live.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'staff'
  ) then
    execute 'alter publication supabase_realtime add table public.staff';
  end if;
end $$;

alter table public.staff replica identity full;

notify pgrst, 'reload schema';
