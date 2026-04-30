-- Ensure realtime is fully wired for the kitchen display.
-- Supabase realtime delivers postgres_changes only for tables in the
-- supabase_realtime publication. The kitchen subscribes to both orders and
-- order_items so an INSERT into either table refreshes the view.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_items'
  ) then
    execute 'alter publication supabase_realtime add table public.order_items';
  end if;
end $$;

-- REPLICA IDENTITY FULL ensures DELETE events carry the previous row data
-- (we don't rely on it today but it's a small safety belt for later).
alter table public.orders      replica identity full;
alter table public.order_items replica identity full;
