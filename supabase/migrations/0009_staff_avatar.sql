-- Avatar support for staff: a column on the staff table to store the URL,
-- a public Storage bucket with size + mime constraints as defence in
-- depth, and an updated list_staff() RPC that returns avatar_url alongside
-- the existing fields.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Column
-- ─────────────────────────────────────────────────────────────────────────
alter table public.staff
  add column if not exists avatar_url text;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. list_staff() — replace the function so admins see the avatar_url too.
-- We drop first because Postgres rejects "create or replace function" when
-- the output column list changes (we're adding avatar_url to the table).
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.list_staff();

create or replace function public.list_staff()
returns table (
  user_id uuid,
  email text,
  role text,
  display_name text,
  avatar_url text,
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
    s.avatar_url,
    s.created_at,
    u.last_sign_in_at
  from public.staff s
  join auth.users u on u.id = s.user_id
  where public.is_admin()
  order by s.created_at desc;
$$;

grant execute on function public.list_staff() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Storage bucket: public read, 2 MB cap, image mime types only
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Storage RLS: anyone can read, only admins can write/delete
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Avatars publicly readable" on storage.objects;
create policy "Avatars publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Admins insert avatars" on storage.objects;
create policy "Admins insert avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and public.is_admin());

drop policy if exists "Admins update avatars" on storage.objects;
create policy "Admins update avatars"
  on storage.objects for update
  using (bucket_id = 'avatars' and public.is_admin())
  with check (bucket_id = 'avatars' and public.is_admin());

drop policy if exists "Admins delete avatars" on storage.objects;
create policy "Admins delete avatars"
  on storage.objects for delete
  using (bucket_id = 'avatars' and public.is_admin());

notify pgrst, 'reload schema';
