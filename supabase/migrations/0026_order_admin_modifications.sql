-- Order modifications, Phase C.1 — admin-side comp + remove. Pairs
-- with the customer-side modify_my_order_item from 0025 to make the
-- order finally mutable from both directions:
--
--   Customer (Phase A): qty-decrease + line removal in 60s window
--   Admin (Phase C.1):  comp + remove on pending / preparing / ready
--   Admin (Phase C.2):  swap — deferred (needs menu picker UI)
--
-- All admin mutations require an authenticated admin (is_admin()) —
-- the RPCs raise on unauthenticated calls so customers can't reach
-- them by trying. Every successful op writes one row to
-- order_modifications + one row to audit_log so the diff is visible
-- in the per-order timeline AND the global Activity feed.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Comp bookkeeping on order_items
-- ─────────────────────────────────────────────────────────────────────────
-- comped_at + comp_reason are persistent so the item line can render
-- a "comped · reason" tag even after a refresh. unit_price is set to
-- 0 in the same write so the order total stays accurate without a
-- separate computed-column path.
alter table public.order_items
  add column if not exists comped_at timestamptz,
  add column if not exists comp_reason text;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. admin_comp_order_item — set unit_price to 0, stamp the reason
-- ─────────────────────────────────────────────────────────────────────────
-- Returns jsonb { ok, error?, new_total? } so the client can update its
-- order header summary without a refetch round-trip. Idempotent in the
-- sense that comping an already-comped line is a no-op success — the
-- comp_reason gets overwritten with the new one (operator might want
-- to refine "Other" into "Kitchen burn" after a moment of thought).
create or replace function public.admin_comp_order_item(
  p_order_id text,
  p_line_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  actor_email text := public.audit_actor_email(actor);
  ord record;
  ln record;
  before_payload jsonb;
  after_payload jsonb;
  next_total numeric(10, 2);
begin
  if not public.is_admin() then
    raise exception 'Only admins can comp items.' using errcode = '42501';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  end if;

  select id, status into ord
  from public.orders
  where id = p_order_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;
  if ord.status in ('served', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'STATUS_LOCKED');
  end if;

  select line_id, item_id, name, base_price, unit_price, quantity, image,
         selections, comped_at, comp_reason
    into ln
  from public.order_items
  where order_id = p_order_id and line_id = p_line_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'LINE_NOT_FOUND');
  end if;

  before_payload := to_jsonb(ln);

  update public.order_items
  set unit_price = 0,
      comped_at = now(),
      comp_reason = btrim(p_reason),
      modified_at = now()
  where order_id = p_order_id and line_id = p_line_id;

  select coalesce(sum(unit_price * quantity), 0) into next_total
  from public.order_items
  where order_id = p_order_id;

  update public.orders
  set total = next_total,
      modification_count = modification_count + 1,
      last_modified_at = now()
  where id = p_order_id;

  after_payload := jsonb_build_object(
    'unit_price', 0,
    'comped_at', now(),
    'comp_reason', btrim(p_reason)
  );

  insert into public.order_modifications (
    order_id, actor_id, device_id, action, line_id, before, after, reason
  )
  values (
    p_order_id, actor, null, 'comped', p_line_id,
    before_payload, after_payload, btrim(p_reason)
  );

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    actor, actor_email, 'UPDATE', 'order_modification', p_order_id,
    format(
      'Order %s · comped (%s, %s) — %s',
      p_order_id, ln.name,
      to_char(ln.unit_price * ln.quantity, 'FM999G999D00'),
      btrim(p_reason)
    ),
    before_payload, after_payload
  );

  return jsonb_build_object('ok', true, 'new_total', next_total);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. admin_remove_order_item — drop the line entirely
-- ─────────────────────────────────────────────────────────────────────────
-- Mirrors comp's contract. If removing the last line empties the
-- order, the order auto-cancels (matches the customer-side behaviour
-- in modify_my_order_item).
create or replace function public.admin_remove_order_item(
  p_order_id text,
  p_line_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  actor_email text := public.audit_actor_email(actor);
  ord record;
  ln record;
  before_payload jsonb;
  next_total numeric(10, 2);
  remaining integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove items.' using errcode = '42501';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  end if;

  select id, status into ord
  from public.orders
  where id = p_order_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;
  if ord.status in ('served', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'STATUS_LOCKED');
  end if;

  select line_id, item_id, name, base_price, unit_price, quantity,
         image, selections, comped_at, comp_reason
    into ln
  from public.order_items
  where order_id = p_order_id and line_id = p_line_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'LINE_NOT_FOUND');
  end if;

  before_payload := to_jsonb(ln);

  delete from public.order_items
  where order_id = p_order_id and line_id = p_line_id;

  select coalesce(sum(unit_price * quantity), 0) into next_total
  from public.order_items
  where order_id = p_order_id;

  update public.orders
  set total = next_total,
      modification_count = modification_count + 1,
      last_modified_at = now()
  where id = p_order_id;

  select count(*) into remaining
  from public.order_items where order_id = p_order_id;

  -- Auto-cancel when the order has no items left — same terminal
  -- state the customer-side path would land on.
  if remaining = 0 then
    update public.orders set status = 'cancelled' where id = p_order_id;
  end if;

  insert into public.order_modifications (
    order_id, actor_id, device_id, action, line_id, before, after, reason
  )
  values (
    p_order_id, actor, null, 'removed', p_line_id,
    before_payload, null, btrim(p_reason)
  );

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    actor, actor_email, 'UPDATE', 'order_modification', p_order_id,
    format('Order %s · removed (%s) — %s', p_order_id, ln.name, btrim(p_reason)),
    before_payload, null
  );

  return jsonb_build_object(
    'ok', true,
    'new_total', next_total,
    'order_cancelled', remaining = 0
  );
end;
$$;

grant execute on function public.admin_comp_order_item(text, text, text)
  to authenticated;
grant execute on function public.admin_remove_order_item(text, text, text)
  to authenticated;

notify pgrst, 'reload schema';
