-- Push subscriptions for "Your order is ready" notifications.
-- Each row stores one device's Web Push endpoint linked to a single order.
-- When the order's status changes to 'ready', the send-order-push Edge
-- Function fans out to every subscription tied to that order id.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (order_id, endpoint)
);

create index if not exists push_subscriptions_order_id_idx
  on public.push_subscriptions (order_id);

alter table public.push_subscriptions enable row level security;

-- Customer can insert their own subscription (no auth — anonymous).
-- The order id acts as the bearer (long, hard-to-guess).
drop policy if exists push_subs_insert on public.push_subscriptions;
create policy push_subs_insert on public.push_subscriptions
  for insert with check (true);

-- Only staff can read or delete (used by the Edge Function via the service-
-- role key, which bypasses RLS — but we still gate select for direct queries).
drop policy if exists push_subs_staff_read on public.push_subscriptions;
create policy push_subs_staff_read on public.push_subscriptions
  for select using (public.is_staff());

drop policy if exists push_subs_staff_delete on public.push_subscriptions;
create policy push_subs_staff_delete on public.push_subscriptions
  for delete using (public.is_staff());
