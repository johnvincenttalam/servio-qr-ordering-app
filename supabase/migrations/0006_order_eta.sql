-- Order ETA: a single integer (minutes) shown to customers on Order Status
-- so they roughly know how long their food will take. Computed as the
-- average prep time across the last 20 served orders.
--
-- We expose the value via a security-definer function so anonymous customers
-- can read just the aggregate without us widening RLS on the orders table.

create or replace function public.order_eta_minutes()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select extract(epoch from (ready_at - created_at)) / 60 as mins
    from public.orders
    where ready_at is not null
      and ready_at > created_at
    order by ready_at desc
    limit 20
  )
  select case
    when count(*) < 5 then 12  -- not enough data; sensible default
    else greatest(1, round(avg(mins))::integer)
  end
  from recent;
$$;

grant execute on function public.order_eta_minutes() to anon, authenticated;

notify pgrst, 'reload schema';
