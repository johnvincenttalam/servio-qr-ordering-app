-- Storage bucket for menu items + promo banners. Mirrors the avatars
-- pattern from 0009: a single public bucket with admin-only writes,
-- 5 MB cap, and an image-mime allowlist as defence in depth.
--
-- Path scheme is descriptive but unstructured — uploads are random
-- UUIDs, so we don't tie an object to a specific menu item / banner
-- row. That keeps the editor flow simple (image is independent of the
-- record being created) at the cost of producing the occasional
-- orphaned object when an admin uploads then cancels. Worth it.
--
-- The bucket name uses an underscore-friendly id but a human-readable
-- name; both are referenced as 'menu-images' in client code.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Bucket
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,  -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Storage RLS: public read, admin-only write/update/delete
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Menu images publicly readable" on storage.objects;
create policy "Menu images publicly readable"
  on storage.objects for select
  using (bucket_id = 'menu-images');

drop policy if exists "Admins insert menu images" on storage.objects;
create policy "Admins insert menu images"
  on storage.objects for insert
  with check (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "Admins update menu images" on storage.objects;
create policy "Admins update menu images"
  on storage.objects for update
  using (bucket_id = 'menu-images' and public.is_admin())
  with check (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "Admins delete menu images" on storage.objects;
create policy "Admins delete menu images"
  on storage.objects for delete
  using (bucket_id = 'menu-images' and public.is_admin());

notify pgrst, 'reload schema';
