-- The original staff_read policy used `public.is_staff()` which queries
-- the staff table from inside a policy on the staff table. Even with
-- SECURITY DEFINER it can hang in some Supabase configurations.
-- The simpler rule: a signed-in user can read THEIR OWN staff row, and that's
-- all the AuthProvider needs to look up its role. Cross-staff queries will
-- get their own policy when an admin staff-management UI is built.

drop policy if exists staff_read on public.staff;
drop policy if exists staff_read_own on public.staff;

create policy staff_read_own on public.staff
  for select using (auth.uid() = user_id);
