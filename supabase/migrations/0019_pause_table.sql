-- Pause table — the reactive control sibling of "block device". Lets
-- staff temporarily stop accepting new orders on a table without
-- rotating its QR token (which would invalidate the printed sticker).
-- Reversible from the same UI surface.
--
-- Design choices:
--   • Soft state via a paused_at timestamp rather than a boolean, so we
--     can show "Paused 4m ago" in the admin without a separate column.
--   • Existing in-flight orders on the table are unaffected — only
--     new order INSERTs are gated.
--   • We hard-reject (P0001), not soft-hold, because pause is an
--     explicit staff decision, not a heuristic. A held queue would
--     just confuse the staff member who paused the table.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Schema
-- ─────────────────────────────────────────────────────────────────────────
alter table public.tables
  add column if not exists paused_at timestamptz;

create index if not exists tables_paused_at_idx
  on public.tables(paused_at) where paused_at is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Extend check_order_abuse() to gate paused tables
-- ─────────────────────────────────────────────────────────────────────────
-- Inserted as a single-clause check at the very top of the function so
-- it short-circuits before the rate-limit math runs. P0001 + a
-- distinguishable message lets the customer-side toast surface the
-- right copy.
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
begin
  -- Stamp submitted_at if the caller didn't.
  if new.submitted_at is null then
    new.submitted_at := now();
  end if;

  -- 0. Hard reject when the table is paused. Comes first so the
  --    rate-limit math doesn't burn a query for a row we're about
  --    to throw out anyway.
  select exists (
    select 1 from public.tables
    where id = new.table_id and paused_at is not null
  ) into table_paused;
  if table_paused then
    raise exception 'This table is paused. Please ask a staff member.'
      using errcode = 'P0001';
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

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Audit: extend log_tables_change to log pause / resume
-- ─────────────────────────────────────────────────────────────────────────
-- Same trigger from 0015_audit_log; we just teach it about the new
-- column. Order matters — paused_at is checked before label / token
-- so a single update that flips both pause and label still logs the
-- pause as the headline event (matches operator intent).
create or replace function public.log_tables_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  actor_email text := public.audit_actor_email(actor);
  table_label text;
  summary text;
begin
  table_label := coalesce(new.label, old.label, coalesce(new.id, old.id));

  if (TG_OP = 'INSERT') then
    summary := format('Table %s added', new.id);

  elsif (TG_OP = 'UPDATE') then
    if old.paused_at is distinct from new.paused_at then
      summary := case
        when new.paused_at is not null then format('Table %s paused', new.id)
        else format('Table %s resumed', new.id)
      end;
    elsif old.archived_at is distinct from new.archived_at then
      summary := case
        when new.archived_at is not null then format('Table %s archived', new.id)
        else format('Table %s restored', new.id)
      end;
    elsif old.label is distinct from new.label then
      summary := format('Table %s renamed: %s → %s',
        new.id,
        coalesce(old.label, '—'),
        coalesce(new.label, '—'));
    elsif old.qr_token is distinct from new.qr_token then
      summary := format('Table %s QR token rotated', new.id);
    else
      return new;
    end if;

  elsif (TG_OP = 'DELETE') then
    summary := format('Table %s deleted', old.id);
  end if;

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    actor, actor_email, TG_OP, 'table',
    coalesce(new.id, old.id),
    summary,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

notify pgrst, 'reload schema';
