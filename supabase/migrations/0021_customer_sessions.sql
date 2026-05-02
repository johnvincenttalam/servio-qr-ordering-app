-- Customer sessions — second leg of presence-proofing (Phase 2 /
-- Control 2 in docs/ANTI_ABUSE.md). Each scan of a table QR creates
-- (or reuses) a row here, tying a device to a table for a 4-hour
-- window. Order inserts validate against an active session, so a
-- stale URL with no live session can't reach the kitchen.
--
-- Naming note: "customer_sessions" rather than "table_sessions" to
-- avoid colliding with the admin-side useTableSessions hook (which
-- is just live-stats per table — counts, totals, oldest order).
-- Different concept: this row models THE CUSTOMER's active visit.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Schema
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id text not null references public.tables(id) on delete cascade,
  device_id text not null,
  -- Snapshot of qr_token at scan time. If it differs from the table's
  -- current token at order time the session pre-dates a rotation —
  -- the customer might be waving a stale URL. Soft-held for review.
  qr_token_seen text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Set by an admin "Bump" action (Control 3) or by future cleanup
  -- jobs. Once set, the session is dead even if expires_at is still
  -- in the future.
  closed_at timestamptz
);

create index if not exists customer_sessions_active_idx
  on public.customer_sessions(table_id, device_id)
  where closed_at is null;
create index if not exists customer_sessions_expiry_idx
  on public.customer_sessions(expires_at)
  where closed_at is null;

alter table public.customer_sessions enable row level security;

drop policy if exists "Admins read customer sessions" on public.customer_sessions;
create policy "Admins read customer sessions"
  on public.customer_sessions for select
  using (public.is_admin());

drop policy if exists "Admins update customer sessions" on public.customer_sessions;
create policy "Admins update customer sessions"
  on public.customer_sessions for update
  using (public.is_admin())
  with check (public.is_admin());

-- No anon SELECT/INSERT — all customer-side access goes via the
-- security-definer RPC below. This keeps the surface tight and
-- means we don't have to expose internal columns to anon.

-- ─────────────────────────────────────────────────────────────────────────
-- 2. start_customer_session — customer-side scan entry point
-- ─────────────────────────────────────────────────────────────────────────
-- Returns jsonb so we can extend the response shape later (e.g.,
-- adding `seated` for Control 3) without breaking existing clients
-- that only read session_id + expires_at.
--
-- Errors are returned as { error: <code> } rather than raised, so the
-- client gets a clean object to switch on instead of a Postgres
-- error code. The codes are stable strings; the client maps them
-- to user-facing copy.
create or replace function public.start_customer_session(
  p_table_id text,
  p_qr_token text,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_token text;
  is_archived boolean;
  existing_id uuid;
  existing_expires timestamptz;
  new_id uuid;
  new_expires timestamptz;
begin
  if p_table_id is null or p_table_id = '' then
    return jsonb_build_object('error', 'INVALID_TABLE');
  end if;
  if p_device_id is null or p_device_id = '' then
    return jsonb_build_object('error', 'INVALID_DEVICE');
  end if;

  select qr_token, archived_at is not null
    into current_token, is_archived
  from public.tables
  where id = p_table_id;

  if not found then
    return jsonb_build_object('error', 'TABLE_NOT_FOUND');
  end if;
  if is_archived then
    return jsonb_build_object('error', 'TABLE_ARCHIVED');
  end if;
  -- A null current_token means the table predates token rotation
  -- (first migration set tokens but legacy rows might be untokened
  -- in old environments). Treat as "no token check" so the system
  -- doesn't lock those tables out — same backward-compat behaviour
  -- as useTableValidation.
  if current_token is not null and current_token <> p_qr_token then
    return jsonb_build_object('error', 'QR_ROTATED');
  end if;

  -- Reuse: if this device already has an active session on this
  -- table, return it instead of churning a fresh row on every page
  -- refresh. Bump last_seen_at so admin can see liveness.
  select id, expires_at
    into existing_id, existing_expires
  from public.customer_sessions
  where table_id = p_table_id
    and device_id = p_device_id
    and closed_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if existing_id is not null then
    update public.customer_sessions
    set last_seen_at = now()
    where id = existing_id;
    return jsonb_build_object(
      'session_id', existing_id,
      'expires_at', existing_expires
    );
  end if;

  -- Fresh session, 4 hours. Long enough for a leisurely meal +
  -- coffee, short enough that a stale URL discovered the next
  -- morning is dead before the morning rotation.
  new_expires := now() + interval '4 hours';
  insert into public.customer_sessions (
    table_id, device_id, qr_token_seen, expires_at
  )
  values (p_table_id, p_device_id, p_qr_token, new_expires)
  returning id into new_id;

  return jsonb_build_object(
    'session_id', new_id,
    'expires_at', new_expires
  );
end;
$$;

grant execute on function public.start_customer_session(text, text, text)
  to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. orders.session_id + check_order_abuse extension
-- ─────────────────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists session_id uuid
  references public.customer_sessions(id) on delete set null;

create index if not exists orders_session_id_idx
  on public.orders(session_id) where session_id is not null;

-- Re-create check_order_abuse with the session validation slice
-- inserted between the paused-table check (0019) and the device
-- blocklist (0017). Order matters — pause + session both produce
-- P0001 with friendly messages, so the customer hears the most
-- specific "what to do" first.
--
-- Backward-compat: legacy rows without session_id are allowed (so
-- existing test data + admin-created seeds don't break). New
-- clients always pass one.
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
  current_table_token text;
begin
  if new.submitted_at is null then
    new.submitted_at := now();
  end if;

  -- 0. Hard reject when the table is paused.
  select exists (
    select 1 from public.tables
    where id = new.table_id and paused_at is not null
  ) into table_paused;
  if table_paused then
    raise exception 'This table is paused. Please ask a staff member.'
      using errcode = 'P0001';
  end if;

  -- 1. Validate the customer session if one was provided. Legacy
  --    orders without a session are still allowed.
  if new.session_id is not null then
    select table_id, closed_at, expires_at, qr_token_seen
      into sess_table_id, sess_closed_at, sess_expires_at, sess_qr_token_seen
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

    -- Soft signal: if the QR token rotated since the session began,
    -- the customer is on a stale URL. Hold for review (the original
    -- visit might still be legit — e.g., a long meal that crossed
    -- a rotation that wasn't supposed to happen during service).
    select qr_token into current_table_token
    from public.tables where id = new.table_id;
    if current_table_token is distinct from sess_qr_token_seen then
      hold := true;
      score := score + 40;
    end if;

    -- Bump session liveness so admin live-tables view reflects
    -- recent activity even when there's no waiter call.
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

notify pgrst, 'reload schema';
