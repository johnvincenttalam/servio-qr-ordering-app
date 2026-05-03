-- Order modifications, Phase A — customer-side qty-decrease + line
-- removal inside a 60-second window after submit. Real restaurants
-- need this; the existing immutable-after-submit model only worked
-- as a proof-of-concept. See docs/ANTI_ABUSE.md threat-model — adds
-- past 30s would create an attractive abuse vector (stage small, then
-- balloon mid-prep), so this phase intentionally locks adds to admin
-- only and customers can only reduce.
--
-- Phase B (customer adds in first 30s) and Phase C (admin comp / swap /
-- remove with audit) reuse the same audit table + columns added here.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Order + item bookkeeping columns
-- ─────────────────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists modification_count smallint not null default 0
    check (modification_count >= 0 and modification_count <= 50),
  add column if not exists last_modified_at timestamptz;

alter table public.order_items
  add column if not exists modified_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. order_modifications — append-only changelog
-- ─────────────────────────────────────────────────────────────────────────
-- Every successful modify_my_order_item call writes one row here AND
-- one audit_log row. Splitting them lets the admin Activity feed pull
-- a chronological stream while the per-order timeline lives close to
-- the data — useful for refund / dispute investigations.
create table if not exists public.order_modifications (
  id bigint primary key generated always as identity,
  order_id text not null references public.orders(id) on delete cascade,
  -- actor_id null = customer-initiated edit. device_id captures who
  -- on the customer side; admin actor_id will populate in Phase C.
  actor_id uuid references auth.users(id) on delete set null,
  device_id text,
  action text not null check (
    action in ('qty_change', 'removed', 'added', 'comped', 'swapped')
  ),
  line_id text,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists order_modifications_order_id_idx
  on public.order_modifications(order_id, created_at);

alter table public.order_modifications enable row level security;

drop policy if exists "Admins read order modifications" on public.order_modifications;
create policy "Admins read order modifications"
  on public.order_modifications for select
  using (public.is_admin());

-- No anon SELECT; customers don't need to query the changelog. All
-- writes happen through security-definer RPCs.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. modify_my_order_item — customer-side single-line edit
-- ─────────────────────────────────────────────────────────────────────────
-- Single RPC, single op per call. If the new quantity is 0 the line
-- is removed entirely; otherwise the unit-priced quantity field is
-- updated and the order total is recomputed. New quantity must be
-- strictly less than current — adds are NOT allowed by this RPC and
-- belong to a future phase with re-evaluation through check_order_abuse.
--
-- Returns jsonb with { ok: bool, error?: code, modifications_left?: int }.
-- Codes:
--   ORDER_NOT_FOUND       — id doesn't match
--   WRONG_DEVICE          — device_id doesn't match the order
--   WINDOW_EXPIRED        — past 60s since submitted_at
--   STATUS_LOCKED         — order moved past pending
--   CAP_REACHED           — modification_count >= 3
--   LINE_NOT_FOUND        — line_id doesn't match
--   QTY_INVALID           — new qty must be 0..(current-1)
create or replace function public.modify_my_order_item(
  p_order_id text,
  p_device_id text,
  p_line_id text,
  p_new_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  edit_window_seconds constant integer := 60;
  edit_cap constant smallint := 3;
  ord record;
  ln record;
  before_payload jsonb;
  after_payload jsonb;
  action_label text;
  next_total numeric(10, 2);
begin
  if p_device_id is null or p_device_id = '' then
    return jsonb_build_object('ok', false, 'error', 'WRONG_DEVICE');
  end if;

  select id, device_id, status, submitted_at, modification_count
    into ord
  from public.orders
  where id = p_order_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;

  if ord.device_id is null or ord.device_id <> p_device_id then
    return jsonb_build_object('ok', false, 'error', 'WRONG_DEVICE');
  end if;

  if ord.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'STATUS_LOCKED');
  end if;

  if ord.submitted_at is null
     or ord.submitted_at < now() - (edit_window_seconds || ' seconds')::interval then
    return jsonb_build_object('ok', false, 'error', 'WINDOW_EXPIRED');
  end if;

  if ord.modification_count >= edit_cap then
    return jsonb_build_object('ok', false, 'error', 'CAP_REACHED');
  end if;

  select line_id, item_id, name, base_price, unit_price, quantity, image, selections
    into ln
  from public.order_items
  where order_id = p_order_id and line_id = p_line_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'LINE_NOT_FOUND');
  end if;

  -- Strictly decrease only. Equal-or-greater is rejected so the customer
  -- can't bypass the trigger by passing the same number (no-op edits
  -- still bump the cap counter — keep them server-side guarded).
  if p_new_quantity < 0 or p_new_quantity >= ln.quantity then
    return jsonb_build_object('ok', false, 'error', 'QTY_INVALID');
  end if;

  before_payload := to_jsonb(ln);

  if p_new_quantity = 0 then
    delete from public.order_items
    where order_id = p_order_id and line_id = p_line_id;
    action_label := 'removed';
    after_payload := null;
  else
    update public.order_items
    set quantity = p_new_quantity,
        modified_at = now()
    where order_id = p_order_id and line_id = p_line_id;
    action_label := 'qty_change';
    after_payload := jsonb_set(before_payload, '{quantity}', to_jsonb(p_new_quantity));
  end if;

  -- Recompute order total from the live item rows. Doing it here
  -- rather than via a generated column keeps the math local to the
  -- RPC, where we already hold the row lock.
  select coalesce(sum(unit_price * quantity), 0) into next_total
  from public.order_items
  where order_id = p_order_id;

  update public.orders
  set total = next_total,
      modification_count = modification_count + 1,
      last_modified_at = now()
  where id = p_order_id;

  -- Append to the per-order changelog AND the global audit feed.
  insert into public.order_modifications (
    order_id, actor_id, device_id, action, line_id, before, after, reason
  )
  values (
    p_order_id, null, p_device_id, action_label, p_line_id,
    before_payload, after_payload, null
  );

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    null, null, 'UPDATE', 'order_modification', p_order_id,
    case action_label
      when 'removed' then format('Order %s · removed (%s)', p_order_id, ln.name)
      else format(
        'Order %s · qty %s→%s (%s)',
        p_order_id, ln.quantity::text, p_new_quantity::text, ln.name
      )
    end,
    before_payload, after_payload
  );

  -- If the order has no items left, auto-cancel it. The customer's
  -- 60s undo path was specifically for "reverse the whole order" —
  -- editing all items off the order is the same outcome via a
  -- different door, so we land in the same terminal state.
  if (select count(*) from public.order_items where order_id = p_order_id) = 0 then
    update public.orders set status = 'cancelled' where id = p_order_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'modifications_left', edit_cap - (ord.modification_count + 1)
  );
end;
$$;

grant execute on function public.modify_my_order_item(text, text, text, integer)
  to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Realtime — order_modifications on the publication so admin
--    Activity / OrderDetail repaint live as customer edits land.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_modifications'
  ) then
    execute 'alter publication supabase_realtime add table public.order_modifications';
  end if;
end $$;

notify pgrst, 'reload schema';
