-- Seated gate — third leg of presence-proofing (Phase 2 / Control 3
-- in docs/ANTI_ABUSE.md). Opt-in workflow: with require_seated_session
-- on, the QR scan creates a session but doesn't unlock ordering until
-- a staff member explicitly "seats" the party. Default is off so
-- existing venues keep the trust-by-default model; venues that want
-- the workflow flip the setting in admin → Settings.
--
-- Trade-off chosen (Path A from the plan): an opt-in setting rather
-- than a hard requirement. Counter-service venues would resent
-- toggling Seat on every customer; full-service venues already greet
-- every party and the toggle is natural.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. restaurant_settings.require_seated_session
-- ─────────────────────────────────────────────────────────────────────────
alter table public.restaurant_settings
  add column if not exists require_seated_session boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. customer_sessions.seated
-- ─────────────────────────────────────────────────────────────────────────
-- Default true so existing rows (created before this migration) stay
-- ordering-eligible. start_customer_session below overrides this for
-- new rows when require_seated_session is on.
alter table public.customer_sessions
  add column if not exists seated boolean not null default true;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. start_customer_session — create new sessions unseated when the
--    venue requires it, seated by default otherwise
-- ─────────────────────────────────────────────────────────────────────────
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
  existing_seated boolean;
  new_id uuid;
  new_expires timestamptz;
  require_seat boolean;
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
  if current_token is not null and current_token <> p_qr_token then
    return jsonb_build_object('error', 'QR_ROTATED');
  end if;

  -- Reuse: include seated in the response so the client can branch
  -- the menu UI ("waiting to be seated" banner) without an extra
  -- round-trip.
  select id, expires_at, seated
    into existing_id, existing_expires, existing_seated
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
      'expires_at', existing_expires,
      'seated', existing_seated
    );
  end if;

  -- Fresh session. seated = NOT require_seated_session so off-by-default
  -- venues stay trust-on-scan; opt-in venues need staff to seat.
  select require_seated_session into require_seat
  from public.restaurant_settings
  where id = 1;

  new_expires := now() + interval '4 hours';
  insert into public.customer_sessions (
    table_id, device_id, qr_token_seen, expires_at, seated
  )
  values (
    p_table_id, p_device_id, p_qr_token, new_expires,
    not coalesce(require_seat, false)
  )
  returning id into new_id;

  return jsonb_build_object(
    'session_id', new_id,
    'expires_at', new_expires,
    'seated', not coalesce(require_seat, false)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. check_order_abuse — gate orders on seated status (only when the
--    venue requires it; flipping the setting back off effectively
--    auto-frees any unseated sessions without a separate UPDATE)
-- ─────────────────────────────────────────────────────────────────────────
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

  -- 0. Hard reject when the table is paused.
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

    -- Seated gate (Control 3). Only enforced while the venue has it
    -- on — flipping require_seated_session off in admin auto-frees
    -- any in-flight unseated sessions without a separate UPDATE.
    select require_seated_session into require_seat
    from public.restaurant_settings
    where id = 1;
    if coalesce(require_seat, false) and not sess_seated then
      raise exception 'Please ask a staff member to start your session.'
        using errcode = 'P0001';
    end if;

    -- Soft signal: QR rotated mid-session.
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
-- 5. Realtime publication — admin Tables page subscribes so Seat /
--    Bump actions reflect across staff devices in real time.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_sessions'
  ) then
    execute 'alter publication supabase_realtime add table public.customer_sessions';
  end if;
end $$;

notify pgrst, 'reload schema';
