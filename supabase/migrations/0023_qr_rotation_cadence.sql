-- QR rotation cadence + reprint tracking. Replaces the unconditional
-- daily rotation from 0020 with an opt-in cadence (off / weekly /
-- monthly) and tracks which tables need reprinting after a rotation
-- so the admin UI can surface a "reprint needed" banner instead of
-- silently breaking printed stickers.
--
-- The original 0020 design assumed daily rotation was operationally
-- viable; it isn't, because the printed sticker URL carries the token
-- so a rotation means every sticker has to be reprinted overnight.
-- This migration:
--   1. unschedules the unconditional daily cron job from 0020
--   2. adds a cadence setting (defaults to off — operators opt in)
--   3. adds a printed_token column on tables so the UI can show
--      "this table's QR has been rotated since the last print"
--   4. schedules a new daily cron that no-ops unless today matches
--      the venue's chosen cadence

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Settings: cadence
-- ─────────────────────────────────────────────────────────────────────────
alter table public.restaurant_settings
  add column if not exists qr_rotation_cadence text not null default 'off'
    check (qr_rotation_cadence in ('off', 'weekly', 'monthly'));

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tables: printed_token
-- ─────────────────────────────────────────────────────────────────────────
-- printed_token = the value of qr_token at the time the operator last
-- printed the sticker. After a rotation, qr_token changes but
-- printed_token stays — the difference is what powers the
-- "reprint needed" badge.
alter table public.tables
  add column if not exists printed_token text;

-- Backfill: assume any existing tables are already printed at their
-- current token. Operators can rotate manually to force a reprint
-- prompt if they want to test the workflow.
update public.tables
set printed_token = qr_token
where printed_token is null and qr_token is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Replace the 0020 cron job with a cadence-aware function
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'rotate-qr-tokens-daily') then
    perform cron.unschedule('rotate-qr-tokens-daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'maybe-rotate-qr-tokens') then
    perform cron.unschedule('maybe-rotate-qr-tokens');
  end if;
end $$;

-- maybe_rotate_qr_tokens — runs every day, no-ops unless today matches
-- the venue's cadence. Logs a single audit_log entry summarising the
-- rotation (rather than 20-30 per-table entries) so the activity feed
-- stays readable.
create or replace function public.maybe_rotate_qr_tokens()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  cadence text;
  today_dow integer;
  today_dom integer;
  rotated_count integer := 0;
begin
  select qr_rotation_cadence into cadence
  from public.restaurant_settings where id = 1;

  if cadence is null or cadence = 'off' then
    return;
  end if;

  today_dow := extract(dow from now());   -- 0 = Sunday … 6 = Saturday
  today_dom := extract(day from now());

  -- Weekly cadence rotates Sunday night UTC (dow 0) so the printed
  -- stickers are stale at Monday-morning open. Monthly rotates the
  -- last day of the month for the same reason.
  if cadence = 'weekly' and today_dow <> 0 then return; end if;
  if cadence = 'monthly' and today_dom <> extract(day from (date_trunc('month', now()) + interval '1 month - 1 day')) then
    return;
  end if;

  with bumped as (
    update public.tables
    set qr_token = encode(gen_random_bytes(16), 'hex')
    where archived_at is null
    returning id
  )
  select count(*) into rotated_count from bumped;

  if rotated_count > 0 then
    -- Single batched audit entry so the feed isn't drowned in noise.
    insert into public.audit_log (
      actor_id, actor_email, action, entity_type, entity_id,
      summary, before, after
    )
    values (
      null, null, 'UPDATE', 'qr_rotation', cadence,
      format('Auto QR rotation: %s tables (%s cadence)', rotated_count::text, cadence),
      null, null
    );
  end if;
end;
$$;

-- The schedule still runs daily, so flipping the cadence in admin
-- doesn't require also rescheduling the cron — the function reads
-- the setting at fire time. 20:00 UTC = 04:00 Asia/Manila.
select cron.schedule(
  'maybe-rotate-qr-tokens',
  '0 20 * * *',
  $$select public.maybe_rotate_qr_tokens();$$
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Suppress per-table token-rotation entries from log_tables_change
--    when the rotation came from the cron (actor null) — we already
--    log a single batched 'qr_rotation' entry above.
-- ─────────────────────────────────────────────────────────────────────────
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
      -- Skip per-table log when the cron did the rotation; the batched
      -- 'qr_rotation' entry from maybe_rotate_qr_tokens covers it. We
      -- detect cron by actor_id being null AND the change being
      -- token-only. Manual rotations from the admin UI carry an
      -- actor_id and still log normally.
      if actor is null then
        return new;
      end if;
      summary := format('Table %s QR token rotated', new.id);
    elsif old.printed_token is distinct from new.printed_token then
      -- printed_token bumps mean "operator confirmed reprint" — not
      -- worth a feed entry on every print.
      return new;
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
