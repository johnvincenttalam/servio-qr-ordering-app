-- Track when an order was marked 'served' (handed off to the customer),
-- mirroring the existing ready_at column. Useful later for analytics on
-- table turnover (served_at − created_at) and for distinguishing "kitchen
-- finished" (ready_at) from "guest received" (served_at).

alter table public.orders
  add column if not exists served_at timestamptz;

-- Extend the existing trigger function to stamp served_at the same way it
-- stamps ready_at. The trigger orders_set_ready_at is already attached to
-- public.orders BEFORE UPDATE — replacing the function picks up the new
-- branch without touching the trigger.
create or replace function public.set_ready_at() returns trigger as $$
begin
  if new.status = 'ready' and (old.status is distinct from 'ready') then
    new.ready_at = now();
  end if;
  if new.status = 'served' and (old.status is distinct from 'served') then
    new.served_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

notify pgrst, 'reload schema';
