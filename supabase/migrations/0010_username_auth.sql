-- Centralised account management: admin creates staff accounts directly
-- with an auto-generated temp password (instead of email-magic-link
-- invites). Staff can sign in with either email or username, and a
-- temp password forces a one-shot change on next login.
--
-- This migration adds the schema. The matching client + edge function
-- changes ship in commits 2–4.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Columns
-- ─────────────────────────────────────────────────────────────────────────
alter table public.staff
  add column if not exists username text;

alter table public.staff
  add column if not exists password_temporary boolean not null default false;

-- Username format: lowercased, 3-30 chars, [a-z0-9._]. Enforced at the
-- DB so a buggy client can't slip in mixed-case or invalid characters.
alter table public.staff
  drop constraint if exists staff_username_format;
alter table public.staff
  add constraint staff_username_format
    check (username is null or username ~ '^[a-z0-9._]{3,30}$');

-- Reserve a few obvious system identifiers so they can't be claimed.
alter table public.staff
  drop constraint if exists staff_username_not_reserved;
alter table public.staff
  add constraint staff_username_not_reserved
    check (
      username is null or
      username not in ('admin', 'root', 'system', 'support', 'help')
    );

-- Partial unique index allows multiple NULL usernames (legacy rows
-- without one) while enforcing uniqueness on every assigned name.
create unique index if not exists staff_username_unique_idx
  on public.staff (username)
  where username is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. list_staff() — include username + password_temporary so the admin
--    Staff page can show both columns. Drop+recreate because the OUT
--    column list is changing again.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.list_staff();

create or replace function public.list_staff()
returns table (
  user_id uuid,
  email text,
  username text,
  role text,
  display_name text,
  avatar_url text,
  password_temporary boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql stable security definer set search_path = public, auth
as $$
  select
    s.user_id,
    u.email::text,
    s.username,
    s.role,
    s.display_name,
    s.avatar_url,
    s.password_temporary,
    s.created_at,
    u.last_sign_in_at
  from public.staff s
  join auth.users u on u.id = s.user_id
  where public.is_admin()
  order by s.created_at desc;
$$;

grant execute on function public.list_staff() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. lookup_email_by_username() — public endpoint for the login form to
--    resolve a typed username to the underlying auth.users.email so it
--    can call signInWithPassword. Security-definer so anonymous callers
--    can hit it without granting them direct read on auth.users.
--
--    Trade-off: this leaks "does this username exist" to anonymous
--    callers. For a closed staff list (single restaurant, ~10 people)
--    that's an acceptable cost for not having to ship a custom auth
--    edge function on the login path.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.lookup_email_by_username(p_username text)
returns text
language sql stable security definer set search_path = public, auth
as $$
  select u.email::text
  from public.staff s
  join auth.users u on u.id = s.user_id
  where s.username = lower(p_username)
  limit 1
$$;

grant execute on function public.lookup_email_by_username(text)
  to anon, authenticated;

notify pgrst, 'reload schema';
