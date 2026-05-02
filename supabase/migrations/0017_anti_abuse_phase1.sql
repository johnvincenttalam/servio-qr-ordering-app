-- Anti-abuse Phase 1 — see docs/ANTI_ABUSE.md for the full design.
--
-- Adds:
--   1. device_blocklist  — staff-managed list of device ids that can't submit orders
--   2. orders.device_id, requires_review, risk_score, submitted_at columns
--   3. check_order_abuse() trigger that gates inserts on the blocklist + rate limits
--   4. cancel_my_order(...) RPC for the customer's 30-second undo window
--
-- Does NOT add: per-session token table, behavioural-score multi-signal scorer,
-- soft-verification ladder, OTP. Those are Phase 2+.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. device_blocklist — small lookup table of banned device_ids
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.device_blocklist (
  device_id text primary key,
  blocked_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.device_blocklist enable row level security;

drop policy if exists "Admins read blocklist" on public.device_blocklist;
create policy "Admins read blocklist"
  on public.device_blocklist for select
  using (public.is_admin());

drop policy if exists "Admins write blocklist" on public.device_blocklist;
create policy "Admins write blocklist"
  on public.device_blocklist for insert
  with check (public.is_admin());

drop policy if exists "Admins remove blocklist" on public.device_blocklist;
create policy "Admins remove blocklist"
  on public.device_blocklist for delete
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 2. New columns on orders
--    device_id        — client-generated UUID, nullable (legacy orders won't have one)
--    requires_review  — staff must approve before kitchen sees the ticket
--    risk_score       — 0-100, audit value for post-mortem; not enforced here
--    submitted_at     — separate from created_at so the kitchen-visibility
--                       30-second window is independent from the row's
--                       insertion timestamp (in case we later defer commit)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists device_id text,
  add column if not exists requires_review boolean not null default false,
  add column if not exists risk_score smallint not null default 0,
  add column if not exists submitted_at timestamptz;

-- Backfill for existing rows so older queries don't have to coalesce.
update public.orders
set submitted_at = created_at
where submitted_at is null;

create index if not exists orders_device_id_idx
  on public.orders(device_id) where device_id is not null;
create index if not exists orders_requires_review_idx
  on public.orders(requires_review) where requires_review = true;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Pre-insert trigger — runs on every order insert. Hard-rejects rows
--    from blocklisted devices, soft-holds rows that bust the rate limits.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.check_order_abuse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_blocked boolean := false;
  table_rate integer := 0;
  device_rate integer := 0;
  burst_count integer := 0;
  score smallint := coalesce(new.risk_score, 0);
  hold boolean := coalesce(new.requires_review, false);
begin
  -- Stamp submitted_at if the caller didn't.
  if new.submitted_at is null then
    new.submitted_at := now();
  end if;

  -- 1. Hard reject when the device is on the blocklist. P0001 lets the
  --    client surface a friendly "ask a staff member" message rather
  --    than a generic 500.
  if new.device_id is not null then
    select exists (
      select 1 from public.device_blocklist where device_id = new.device_id
    ) into is_blocked;
    if is_blocked then
      raise exception 'This device is blocked from placing orders.'
        using errcode = 'P0001';
    end if;
  end if;

  -- 2. Per-table rate ceiling — 25 orders/hour. Soft-holds the row so
  --    staff can review rather than silently dropping it.
  select count(*) into table_rate
  from public.orders
  where table_id = new.table_id
    and created_at > now() - interval '1 hour';
  if table_rate >= 25 then
    hold := true;
    score := score + 30;
  end if;

  -- 3. Per-device rate ceiling — 10 orders/hour.
  if new.device_id is not null then
    select count(*) into device_rate
    from public.orders
    where device_id = new.device_id
      and created_at > now() - interval '1 hour';
    if device_rate >= 10 then
      hold := true;
      score := score + 25;
    end if;
  end if;

  -- 4. Burst — 5+ orders on the same table within 60 seconds is a bot
  --    or prankster pattern. Hold for review.
  select count(*) into burst_count
  from public.orders
  where table_id = new.table_id
    and created_at > now() - interval '60 seconds';
  if burst_count >= 5 then
    hold := true;
    score := score + 50;
  end if;

  new.requires_review := hold;
  new.risk_score := least(score, 100);
  return new;
end;
$$;

drop trigger if exists orders_check_abuse on public.orders;
create trigger orders_check_abuse
  before insert on public.orders
  for each row execute function public.check_order_abuse();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. cancel_my_order(order_id, device_id) — RPC the customer calls inside
--    the 30-second undo window. We don't grant broad UPDATE rights to anon;
--    instead, this security-definer function checks ownership-by-device
--    and the time window before flipping status to cancelled.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.cancel_my_order(
  p_order_id text,
  p_device_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  row_device text;
  row_status text;
  row_submitted timestamptz;
begin
  if p_device_id is null or p_device_id = '' then
    return false;
  end if;

  select device_id, status, submitted_at
    into row_device, row_status, row_submitted
  from public.orders
  where id = p_order_id;

  if not found then
    return false;
  end if;

  -- Only the device that submitted can cancel; only within 30s; only
  -- while the order hasn't moved past pending. The trigger may have
  -- soft-held it (requires_review = true) — those are still cancellable
  -- because the kitchen hasn't started anyway.
  if row_device is null or row_device <> p_device_id then return false; end if;
  if row_status <> 'pending' then return false; end if;
  if row_submitted is null or row_submitted < now() - interval '30 seconds' then
    return false;
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
  return true;
end;
$$;

grant execute on function public.cancel_my_order(text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Realtime — device_blocklist on the publication so the admin held-orders
--    banner repaints when a fresh block lands from another tab.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'device_blocklist'
  ) then
    execute 'alter publication supabase_realtime add table public.device_blocklist';
  end if;
end $$;

notify pgrst, 'reload schema';
