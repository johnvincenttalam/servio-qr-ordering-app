-- Anti-abuse Phase 1, audit hookup. Surfaces the held / approved /
-- rejected / blocked events from 0017 in the existing audit_log feed
-- so staff can review what the trigger held and what the team did
-- about it. No schema changes — only new trigger functions that
-- write into audit_log via security-definer calls.
--
-- Two new entity types appear in the feed:
--   order_review  — held / approved / rejected lifecycle on an order
--   device_block  — added or removed from device_blocklist

-- ─────────────────────────────────────────────────────────────────────────
-- 1. orders — log review lifecycle
-- ─────────────────────────────────────────────────────────────────────────
-- Three events, all routed through one AFTER trigger:
--   • INSERT with requires_review = true → "held for review (risk N)"
--   • UPDATE flipping requires_review true → false  → "approved"
--   • UPDATE on a held row moving to status='cancelled' → "rejected"
--
-- The "held" event is written with actor_id = null because the row
-- comes in on an anonymous customer write (auth.uid() is null inside
-- the trigger). approve / reject originate from a signed-in admin so
-- their uid + email get captured normally.
create or replace function public.log_orders_review_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  actor_email text := public.audit_actor_email(actor);
  summary text;
  log_action text;
begin
  if (TG_OP = 'INSERT') then
    if new.requires_review is not true then
      return new;
    end if;
    log_action := 'INSERT';
    summary := case
      when new.risk_score > 0 then format(
        'Order %s held for review (risk %s)',
        new.id,
        new.risk_score::text
      )
      else format('Order %s held for review', new.id)
    end;

  elsif (TG_OP = 'UPDATE') then
    -- Approve: held flag flipped off without cancelling.
    if old.requires_review is true
       and new.requires_review is not true
       and new.status <> 'cancelled' then
      log_action := 'UPDATE';
      summary := format('Order %s approved (was held)', new.id);

    -- Reject: held order moved straight to cancelled. The
    -- HeldOrdersBanner reject path sets status='cancelled' but
    -- leaves requires_review alone; the OrderDetail block-device
    -- path also lands here. Either way it's a rejection.
    elsif old.requires_review is true
          and new.status = 'cancelled'
          and old.status <> 'cancelled' then
      log_action := 'UPDATE';
      summary := format('Order %s rejected (was held)', new.id);

    else
      return new;  -- non-review-related update; leave to other triggers.
    end if;

  else
    return coalesce(new, old);  -- DELETE not interesting for reviews
  end if;

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    actor, actor_email, log_action, 'order_review',
    coalesce(new.id, old.id),
    summary,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists orders_review_audit on public.orders;
create trigger orders_review_audit
  after insert or update on public.orders
  for each row execute function public.log_orders_review_change();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. device_blocklist — log block / unblock
-- ─────────────────────────────────────────────────────────────────────────
-- INSERT and DELETE both interesting; UPDATE not — the table only has
-- (device_id, blocked_by, reason, created_at) and none of those matter
-- to change after the fact. Reason is included in the summary because
-- it's the most useful field at glance time.
create or replace function public.log_device_blocklist_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  actor_email text := public.audit_actor_email(actor);
  summary text;
  device_label text;
begin
  device_label := substr(coalesce(new.device_id, old.device_id), 1, 8);

  if (TG_OP = 'INSERT') then
    summary := case
      when new.reason is not null and length(new.reason) > 0 then format(
        'Device %s… blocked (%s)', device_label, new.reason
      )
      else format('Device %s… blocked', device_label)
    end;

  elsif (TG_OP = 'DELETE') then
    summary := format('Device %s… unblocked', device_label);

  else
    return new;
  end if;

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    actor, actor_email, TG_OP, 'device_block',
    coalesce(new.device_id, old.device_id),
    summary,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists device_blocklist_audit on public.device_blocklist;
create trigger device_blocklist_audit
  after insert or delete on public.device_blocklist
  for each row execute function public.log_device_blocklist_change();

notify pgrst, 'reload schema';
