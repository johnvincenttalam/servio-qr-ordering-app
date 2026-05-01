-- Activity log: a read-only audit trail of who changed what across the
-- admin's high-signal entities. Populated by per-table trigger
-- functions that compose a human-readable summary at write time so
-- the UI doesn't have to diff JSON to render a feed entry. Position
-- changes (drag-reorder noise) and zero-diff updates are skipped on
-- purpose; we only log the events an admin would actually want to
-- see in a forensics or accountability scenario.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Table + indexes
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id bigint primary key generated always as identity,
  -- actor_id may be null if the change came from a service role or
  -- the staff record was later deleted. actor_email is denormalised
  -- so the feed still reads sensibly when that happens.
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx
  on public.audit_log(created_at desc);
create index if not exists audit_log_entity_idx
  on public.audit_log(entity_type, entity_id);
create index if not exists audit_log_actor_idx
  on public.audit_log(actor_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. RLS — admins read; writes happen only via security-definer triggers.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.audit_log enable row level security;

drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log"
  on public.audit_log for select
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Helper to resolve actor_email from auth.uid() at trigger time.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.audit_actor_email(actor uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select email::text from auth.users where id = actor;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Trigger function: menu_items
--   Tracks: price changes, in_stock toggles, archive/restore,
--   top_pick toggles, category moves, creates, renames. Pure
--   reorder (position-only updates) is skipped to keep the feed
--   readable.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.log_menu_items_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  actor_email text := public.audit_actor_email(actor);
  summary text;
begin
  if (TG_OP = 'INSERT') then
    summary := format('%s added to menu', new.name);

  elsif (TG_OP = 'UPDATE') then
    if old.price is distinct from new.price then
      summary := format('%s price ₱%s → ₱%s', new.name, old.price::text, new.price::text);
    elsif old.in_stock is distinct from new.in_stock then
      summary := case
        when new.in_stock then format('%s back in stock', new.name)
        else format('%s marked sold out', new.name)
      end;
    elsif old.archived_at is distinct from new.archived_at then
      summary := case
        when new.archived_at is not null then format('%s archived', new.name)
        else format('%s restored', new.name)
      end;
    elsif old.top_pick is distinct from new.top_pick then
      summary := case
        when new.top_pick then format('%s featured as top pick', new.name)
        else format('%s unfeatured from top picks', new.name)
      end;
    elsif old.category is distinct from new.category then
      summary := format('%s moved to %s', new.name, new.category);
    elsif old.name is distinct from new.name then
      summary := format('Renamed %s → %s', old.name, new.name);
    elsif (
      old.description is distinct from new.description
      or old.image is distinct from new.image
      or old.options is distinct from new.options
    ) then
      summary := format('%s edited', new.name);
    else
      -- Position-only or no-op update — skip.
      return new;
    end if;

  elsif (TG_OP = 'DELETE') then
    summary := format('%s permanently deleted', old.name);
  end if;

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    actor, actor_email, TG_OP, 'menu_item',
    coalesce(new.id, old.id),
    summary,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists menu_items_audit on public.menu_items;
create trigger menu_items_audit
  after insert or update or delete on public.menu_items
  for each row execute function public.log_menu_items_change();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Trigger function: categories
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.log_categories_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  actor_email text := public.audit_actor_email(actor);
  summary text;
begin
  if (TG_OP = 'INSERT') then
    summary := format('Category "%s" created', new.label);

  elsif (TG_OP = 'UPDATE') then
    if old.label is distinct from new.label then
      summary := format('Category renamed: %s → %s', old.label, new.label);
    elsif old.archived_at is distinct from new.archived_at then
      summary := case
        when new.archived_at is not null then format('Category "%s" archived', new.label)
        else format('Category "%s" restored', new.label)
      end;
    elsif old.icon is distinct from new.icon then
      summary := format('Category "%s" icon changed', new.label);
    else
      return new;  -- position-only or noise
    end if;

  elsif (TG_OP = 'DELETE') then
    summary := format('Category "%s" deleted', old.label);
  end if;

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    actor, actor_email, TG_OP, 'category',
    coalesce(new.id, old.id),
    summary,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists categories_audit on public.categories;
create trigger categories_audit
  after insert or update or delete on public.categories
  for each row execute function public.log_categories_change();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Trigger function: banners (hard-deleted, no archived_at)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.log_banners_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  actor_email text := public.audit_actor_email(actor);
  banner_label text;
  summary text;
begin
  banner_label := coalesce(new.title, old.title, 'Untitled banner');

  if (TG_OP = 'INSERT') then
    summary := format('Banner "%s" added', banner_label);

  elsif (TG_OP = 'UPDATE') then
    if old.active is distinct from new.active then
      summary := case
        when new.active then format('Banner "%s" enabled', banner_label)
        else format('Banner "%s" disabled', banner_label)
      end;
    elsif (
      old.title is distinct from new.title
      or old.subtitle is distinct from new.subtitle
      or old.image is distinct from new.image
    ) then
      summary := format('Banner "%s" edited', banner_label);
    else
      return new;  -- position-only
    end if;

  elsif (TG_OP = 'DELETE') then
    summary := format('Banner "%s" deleted', banner_label);
  end if;

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    actor, actor_email, TG_OP, 'banner',
    coalesce(new.id, old.id),
    summary,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists banners_audit on public.banners;
create trigger banners_audit
  after insert or update or delete on public.banners
  for each row execute function public.log_banners_change();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Trigger function: tables
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
    if old.archived_at is distinct from new.archived_at then
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

drop trigger if exists tables_audit on public.tables;
create trigger tables_audit
  after insert or update or delete on public.tables
  for each row execute function public.log_tables_change();

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Trigger function: waiter_calls — only resolutions are interesting.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.log_waiter_calls_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  actor_email text := public.audit_actor_email(actor);
  summary text;
  response_seconds integer;
begin
  -- Only log when a call moves from unresolved to resolved.
  if (TG_OP <> 'UPDATE') then
    return new;
  end if;
  if (old.resolved_at is not null or new.resolved_at is null) then
    return new;
  end if;

  response_seconds := extract(epoch from (new.resolved_at - new.created_at))::integer;

  summary := format(
    'Resolved Table %s %s%s',
    new.table_id,
    case
      when new.kind = 'service' then 'service call'
      else 'bill request'
    end,
    case
      when response_seconds < 60 then ' (under 1 min)'
      when response_seconds < 3600 then format(' (%s min)', (response_seconds / 60)::text)
      else ''
    end
  );

  insert into public.audit_log (
    actor_id, actor_email, action, entity_type, entity_id,
    summary, before, after
  )
  values (
    actor, actor_email, 'UPDATE', 'waiter_call',
    new.id,
    summary,
    to_jsonb(old),
    to_jsonb(new)
  );

  return new;
end;
$$;

drop trigger if exists waiter_calls_audit on public.waiter_calls;
create trigger waiter_calls_audit
  after update on public.waiter_calls
  for each row execute function public.log_waiter_calls_change();

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Realtime: include audit_log so admins see new entries live.
-- Guarded so re-running the migration doesn't error on the duplicate add.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'audit_log'
  ) then
    execute 'alter publication supabase_realtime add table public.audit_log';
  end if;
end $$;

notify pgrst, 'reload schema';
