-- Order modifications, Phase C.1 follow-up — admin uncomp.

-- Extend the action check on order_modifications so 'uncomped' is a
-- first-class value instead of being shoehorned into qty_change.
alter table public.order_modifications
  drop constraint if exists order_modifications_action_check;
alter table public.order_modifications
  add constraint order_modifications_action_check
  check (action in (
    'qty_change', 'removed', 'added', 'comped', 'uncomped', 'swapped'
  ));

-- Pairs with admin_comp_order_item from 0026: lets staff revert a
-- comp when it was applied to the wrong line, the customer asked for
-- the original deal back, etc. Restores unit_price from the
-- order_item's stored base_price, clears comped_at + comp_reason,
-- recomputes the order total, and writes the same audit + per-order
-- changelog entries the comp/remove paths use.
--
-- Status gate matches comp/remove: pending / preparing / ready ok;
-- served / cancelled rejected. Reason is required so the audit
-- trail shows why the comp was reversed.

create or replace function public.admin_uncomp_order_item(
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
    raise exception 'Only admins can uncomp items.' using errcode = '42501';
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

  -- Soft no-op: if the line isn't comped, just return success without
  -- writing a phantom audit entry. Saves the operator from a confusing
  -- "uncomped (was already restored)" log line.
  if ln.comped_at is null then
    return jsonb_build_object(
      'ok', true,
      'new_total', (
        select coalesce(sum(unit_price * quantity), 0)
        from public.order_items where order_id = p_order_id
      )
    );
  end if;

  before_payload := to_jsonb(ln);

  -- Restore unit_price from base_price + the per-selection delta. The
  -- selections jsonb stored on the line carries priceDelta values from
  -- when the customer ordered, so summing them gives the correct
  -- restored unit price. Falls back to base_price alone if there are
  -- no selections.
  update public.order_items
  set unit_price = base_price + coalesce((
    select sum((sel->>'priceDelta')::numeric)
    from jsonb_array_elements(coalesce(selections, '[]'::jsonb)) sel
  ), 0),
      comped_at = null,
      comp_reason = null,
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

  -- "after" payload reflects the post-restore unit price for the
  -- audit row. Re-fetch to capture the actual value the UPDATE wrote.
  select to_jsonb(oi.*) into after_payload
  from public.order_items oi
  where order_id = p_order_id and line_id = p_line_id;

  insert into public.order_modifications (
    order_id, actor_id, device_id, action, line_id, before, after, reason
  )
  values (
    p_order_id, actor, null, 'uncomped', p_line_id,
    before_payload, after_payload, btrim(p_reason)
  );

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    actor, actor_email, 'UPDATE', 'order_modification', p_order_id,
    format('Order %s · uncomped (%s) — %s', p_order_id, ln.name, btrim(p_reason)),
    before_payload, after_payload
  );

  return jsonb_build_object('ok', true, 'new_total', next_total);
end;
$$;

grant execute on function public.admin_uncomp_order_item(text, text, text)
  to authenticated;

notify pgrst, 'reload schema';
