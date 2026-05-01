-- Profile self-service: any authenticated staff member can update their
-- own display name and avatar without going through an admin. Adds:
--
--   1. Security-definer RPCs that update only the calling user's own
--      staff row (we don't open up RLS UPDATE because staff also has
--      role / username columns the user must NOT be able to change).
--   2. A Storage RLS policy on the avatars bucket so a non-admin can
--      put / delete files in their own staff/<user_id>/ folder. The
--      existing admin policy stays so admins can still manage anyone.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Self-update RPCs
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.update_my_display_name(p_name text)
returns void
language sql security definer set search_path = public
as $$
  update public.staff
     set display_name = nullif(trim(p_name), '')
   where user_id = auth.uid()
$$;

grant execute on function public.update_my_display_name(text) to authenticated;

create or replace function public.update_my_avatar_url(p_url text)
returns void
language sql security definer set search_path = public
as $$
  update public.staff
     set avatar_url = nullif(trim(p_url), '')
   where user_id = auth.uid()
$$;

grant execute on function public.update_my_avatar_url(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Storage RLS — let users manage their own avatar folder
--
--    Path layout used by the client uploader:
--        avatars/staff/<user_id>/avatar.png
--    foldername(name) splits the path; [1] is "staff", [2] is the
--    user_id. We compare [2] to auth.uid()::text so a user can only
--    read/write under their own subfolder.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Users insert own avatar" on storage.objects;
create policy "Users insert own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'staff'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'staff'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'staff'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'staff'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

notify pgrst, 'reload schema';
