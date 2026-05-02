-- Business hours — scheduled open / close per weekday so staff don't
-- have to manually flip open_for_orders at midnight every shift. Pairs
-- with the existing manual override (open_for_orders), which is now
-- strictly a force-close lever; the schedule is the source of "open"
-- truth. Truth table:
--
--   override=true,  schedule=open    → OPEN
--   override=true,  schedule=closed  → CLOSED ("we're closed")
--   override=false, schedule=open    → CLOSED ("admin force-close")
--   override=false, schedule=closed  → CLOSED
--
-- Override never opens the venue during scheduled-closed hours. To open
-- outside normal hours (private event), edit the schedule for that day.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Settings — timezone + last-call cutoff
-- ─────────────────────────────────────────────────────────────────────────
alter table public.restaurant_settings
  add column if not exists timezone text not null default 'Asia/Manila';

-- Number of minutes before close_time when new orders stop. Single
-- value applies across all days — most venues run a uniform last-call
-- rule. 0 = no last call, customers can order until the second the
-- venue closes.
alter table public.restaurant_settings
  add column if not exists last_call_minutes_before_close smallint not null default 0
    check (
      last_call_minutes_before_close >= 0
      and last_call_minutes_before_close < 240
    );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. business_hours — one row per weekday
-- ─────────────────────────────────────────────────────────────────────────
-- weekday follows Postgres extract(dow): 0 = Sunday, 6 = Saturday.
create table if not exists public.business_hours (
  weekday smallint primary key check (weekday >= 0 and weekday <= 6),
  open_time time,
  close_time time,
  -- Explicit closed flag rather than nullable times alone — clearer
  -- intent in the admin UI (toggle "Closed today" rather than "set
  -- both times to NULL"). Saved when admin flips the day off, so
  -- their previous open/close stay around for re-enable.
  closed boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Seed every weekday so the lookup never misses. Default closed=true
-- so the first migration apply doesn't accidentally lock customers
-- out — admins must opt in by configuring at least one day. Until
-- they do, the venue stays in "manual override only" mode (the
-- check below short-circuits to closed unless override AND schedule
-- both agree).
--
-- Wait — that would lock the venue out by default after this migration.
-- That's not OK for an existing deployment. Default to "open
-- 09:00–22:00 every day" so flipping the migration on doesn't
-- silently break things. Admins will see the schedule live in admin
-- UI on first load and can adjust.
insert into public.business_hours (weekday, open_time, close_time, closed)
values
  (0, '09:00', '22:00', false),
  (1, '09:00', '22:00', false),
  (2, '09:00', '22:00', false),
  (3, '09:00', '22:00', false),
  (4, '09:00', '22:00', false),
  (5, '09:00', '22:00', false),
  (6, '09:00', '22:00', false)
on conflict (weekday) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS — anon SELECT (customer needs hours for the closed banner),
--    admin UPDATE only.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.business_hours enable row level security;

drop policy if exists "Anyone reads business hours" on public.business_hours;
create policy "Anyone reads business hours"
  on public.business_hours for select
  using (true);

drop policy if exists "Admins update business hours" on public.business_hours;
create policy "Admins update business hours"
  on public.business_hours for update
  using (public.is_admin())
  with check (public.is_admin());

-- updated_at trigger so the row stamp always matches the most recent
-- save — useful for debugging and for invalidating any cache layers.
create or replace function public.touch_business_hours()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_hours_touch on public.business_hours;
create trigger business_hours_touch
  before update on public.business_hours
  for each row execute function public.touch_business_hours();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. is_restaurant_open() — single source of truth
-- ─────────────────────────────────────────────────────────────────────────
-- stable so it can be called repeatedly within a transaction without
-- refetching settings on every row. Returns false if any of:
--   • manual override is off
--   • today is flagged closed
--   • now is before open_time
--   • now is at or past (close_time - last_call_minutes)
create or replace function public.is_restaurant_open()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  override boolean;
  tz text;
  last_call_min smallint;
  today record;
  now_local time;
  effective_close time;
begin
  select open_for_orders, timezone, last_call_minutes_before_close
    into override, tz, last_call_min
  from public.restaurant_settings where id = 1;

  if not coalesce(override, false) then return false; end if;

  select * into today
  from public.business_hours
  where weekday = extract(dow from (now() at time zone coalesce(tz, 'UTC')))::smallint;

  if not found or today.closed then return false; end if;
  if today.open_time is null or today.close_time is null then return false; end if;

  now_local := (now() at time zone coalesce(tz, 'UTC'))::time;
  effective_close := today.close_time
    - (coalesce(last_call_min, 0)::text || ' minutes')::interval;

  return now_local >= today.open_time and now_local < effective_close;
end;
$$;

grant execute on function public.is_restaurant_open() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. check_order_abuse — gate inserts on is_restaurant_open()
-- ─────────────────────────────────────────────────────────────────────────
-- Inserts new clause as 0a — runs before the table-pause check so the
-- "we're closed" message wins over "this table is paused" (more
-- actionable: customer should leave / come back later, not flag
-- staff). Keeps everything else in the trigger identical.
create or replace function public.check_order_abuse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_blocked boolean := false;
  table_paused boolean := false;
  table_rate integer := 0;
  device_rate integer := 0;
  burst_count integer := 0;
  score smallint := coalesce(new.risk_score, 0);
  hold boolean := coalesce(new.requires_review, false);
  sess_table_id text;
  sess_closed_at timestamptz;
  sess_expires_at timestamptz;
  sess_qr_token_seen text;
  sess_seated boolean;
  current_table_token text;
  require_seat boolean;
begin
  if new.submitted_at is null then
    new.submitted_at := now();
  end if;

  -- 0a. Hard reject when outside business hours. Highest priority —
  --     customers should hear "we're closed" before any other reason.
  if not public.is_restaurant_open() then
    raise exception 'We''re closed right now. Please come back during open hours.'
      using errcode = 'P0001';
  end if;

  -- 0b. Hard reject when the table is paused.
  select exists (
    select 1 from public.tables
    where id = new.table_id and paused_at is not null
  ) into table_paused;
  if table_paused then
    raise exception 'This table is paused. Please ask a staff member.'
      using errcode = 'P0001';
  end if;

  -- 1. Validate the customer session if one was provided.
  if new.session_id is not null then
    select table_id, closed_at, expires_at, qr_token_seen, seated
      into sess_table_id, sess_closed_at, sess_expires_at,
           sess_qr_token_seen, sess_seated
    from public.customer_sessions
    where id = new.session_id;

    if not found then
      raise exception 'Session not found. Please rescan the QR code.'
        using errcode = 'P0001';
    end if;
    if sess_table_id is distinct from new.table_id then
      raise exception 'Session does not match this table.'
        using errcode = 'P0001';
    end if;
    if sess_closed_at is not null then
      raise exception 'Your session has ended. Please rescan the QR code.'
        using errcode = 'P0001';
    end if;
    if sess_expires_at < now() then
      raise exception 'Your session has expired. Please rescan the QR code.'
        using errcode = 'P0001';
    end if;

    select require_seated_session into require_seat
    from public.restaurant_settings
    where id = 1;
    if coalesce(require_seat, false) and not sess_seated then
      raise exception 'Please ask a staff member to start your session.'
        using errcode = 'P0001';
    end if;

    select qr_token into current_table_token
    from public.tables where id = new.table_id;
    if current_table_token is distinct from sess_qr_token_seen then
      hold := true;
      score := score + 40;
    end if;

    update public.customer_sessions
    set last_seen_at = now()
    where id = new.session_id;
  end if;

  -- 2. Hard reject when the device is on the blocklist.
  if new.device_id is not null then
    select exists (
      select 1 from public.device_blocklist where device_id = new.device_id
    ) into is_blocked;
    if is_blocked then
      raise exception 'This device is blocked from placing orders.'
        using errcode = 'P0001';
    end if;
  end if;

  -- 3. Per-table rate ceiling — 25 orders/hour.
  select count(*) into table_rate
  from public.orders
  where table_id = new.table_id
    and created_at > now() - interval '1 hour';
  if table_rate >= 25 then
    hold := true;
    score := score + 30;
  end if;

  -- 4. Per-device rate ceiling — 10 orders/hour.
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

  -- 5. Burst — 5+ orders on the same table within 60 seconds.
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

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Realtime — customer apps subscribe so a live hours edit repaints
--    the closed banner without a refresh.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'business_hours'
  ) then
    execute 'alter publication supabase_realtime add table public.business_hours';
  end if;
end $$;

alter table public.business_hours replica identity full;

notify pgrst, 'reload schema';
