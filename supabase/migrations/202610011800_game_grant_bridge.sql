-- Bridge account/admin rewards into the legacy PokéRegions save format.
-- This fixes the gap where account_inventory changed but the actual game still read
-- metaPoints, bottleCaps, goldBottleCaps, unlockedStarters, etc. from cloud_saves/localStorage.

create table if not exists public.game_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_type text not null
    check (grant_type in (
      'meta_points',
      'bottle_caps',
      'gold_bottle_caps',
      'ability_capsules',
      'ability_patches',
      'ancient_charms',
      'starter_unlock',
      'achievement',
      'relic'
    )),
  grant_key text,
  quantity bigint not null default 1 check (quantity > 0),
  payload jsonb not null default '{}'::jsonb,
  source_type text not null default 'admin',
  source_ref text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists game_grants_user_pending_idx
  on public.game_grants (user_id, applied_at, created_at);

alter table public.game_grants enable row level security;

drop policy if exists "Users can read own game grants" on public.game_grants;
create policy "Users can read own game grants"
on public.game_grants for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all game grants" on public.game_grants;
create policy "Admins can read all game grants"
on public.game_grants for select to authenticated
using (public.current_user_is_admin());

grant select on public.game_grants to authenticated;

create or replace function public.queue_game_grant_internal(
  p_user_id uuid,
  p_grant_type text,
  p_grant_key text default null,
  p_quantity bigint default 1,
  p_payload jsonb default '{}'::jsonb,
  p_source_type text default 'system',
  p_source_ref text default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  if p_grant_type not in (
    'meta_points',
    'bottle_caps',
    'gold_bottle_caps',
    'ability_capsules',
    'ability_patches',
    'ancient_charms',
    'starter_unlock',
    'achievement',
    'relic'
  ) then
    raise exception 'Unsupported game grant type: %', p_grant_type;
  end if;

  if p_grant_type in ('starter_unlock', 'achievement', 'relic')
     and nullif(trim(coalesce(p_grant_key, '')), '') is null then
    raise exception 'grant_key is required for %', p_grant_type;
  end if;

  insert into public.game_grants (
    user_id,
    grant_type,
    grant_key,
    quantity,
    payload,
    source_type,
    source_ref,
    created_by
  )
  values (
    p_user_id,
    p_grant_type,
    nullif(trim(coalesce(p_grant_key, '')), ''),
    p_quantity,
    coalesce(p_payload, '{}'::jsonb),
    p_source_type,
    p_source_ref,
    p_created_by
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.queue_game_grant_internal(
  uuid, text, text, bigint, jsonb, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.queue_game_grant_internal(
  uuid, text, text, bigint, jsonb, text, text, uuid
) to service_role;

create or replace function public.admin_queue_game_grant(
  p_target_user_id uuid,
  p_grant_type text,
  p_grant_key text default null,
  p_quantity bigint default 1,
  p_payload jsonb default '{}'::jsonb,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin role required';
  end if;

  if not exists (
    select 1 from public.profiles where user_id = p_target_user_id
  ) then
    raise exception 'Target profile not found';
  end if;

  v_grant_id := public.queue_game_grant_internal(
    p_target_user_id,
    p_grant_type,
    p_grant_key,
    p_quantity,
    coalesce(p_payload, '{}'::jsonb),
    'admin',
    nullif(trim(coalesce(p_reason, '')), ''),
    auth.uid()
  );

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    target_user_id,
    entity_type,
    entity_key,
    payload
  )
  values (
    auth.uid(),
    'queue_game_grant',
    p_target_user_id,
    'game_grant',
    v_grant_id::text,
    jsonb_build_object(
      'grant_type', p_grant_type,
      'grant_key', p_grant_key,
      'quantity', p_quantity,
      'reason', p_reason
    )
  );

  return v_grant_id;
end;
$$;

revoke all on function public.admin_queue_game_grant(
  uuid, text, text, bigint, jsonb, text
) from public, anon;

grant execute on function public.admin_queue_game_grant(
  uuid, text, text, bigint, jsonb, text
) to authenticated;

create or replace function public.fetch_my_pending_game_grants()
returns table (
  id uuid,
  grant_type text,
  grant_key text,
  quantity bigint,
  payload jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    g.id,
    g.grant_type,
    g.grant_key,
    g.quantity,
    g.payload,
    g.created_at
  from public.game_grants g
  where g.user_id = auth.uid()
    and g.applied_at is null
  order by g.created_at, g.id
  limit 100;
$$;

revoke all on function public.fetch_my_pending_game_grants() from public, anon;
grant execute on function public.fetch_my_pending_game_grants() to authenticated;

create or replace function public.ack_my_game_grants(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.game_grants
  set applied_at = coalesce(applied_at, now())
  where user_id = auth.uid()
    and id = any(p_ids)
    and applied_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.ack_my_game_grants(uuid[]) from public, anon;
grant execute on function public.ack_my_game_grants(uuid[]) to authenticated;

-- Add explicit bridge metadata to seeded catalog items.
update public.catalog_items
set metadata = metadata || '{"game_grant_type":"meta_points"}'::jsonb
where item_key = 'currency.rogue_points';

update public.catalog_items
set metadata = metadata || '{"game_grant_type":"gold_bottle_caps"}'::jsonb
where item_key = 'item.gold_bottle_cap';

update public.catalog_items
set metadata = metadata || '{"game_grant_type":"starter_unlock","game_grant_key":"riolu"}'::jsonb
where item_key = 'pokemon.alpha_shiny_riolu';

-- Replace the existing admin catalog grant RPC so mapped catalog rewards also
-- reach the real game save instead of living only in account_inventory.
create or replace function public.admin_grant_catalog_item(
  p_target_user_id uuid,
  p_item_key text,
  p_quantity bigint default 1,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metadata jsonb;
  v_game_grant_type text;
  v_game_grant_key text;
  v_game_grant_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin role required';
  end if;

  select metadata
  into v_metadata
  from public.catalog_items
  where item_key = p_item_key;

  if not found then
    raise exception 'Unknown catalog item: %', p_item_key;
  end if;

  perform public.grant_catalog_item_internal(
    p_target_user_id,
    p_item_key,
    p_quantity,
    jsonb_build_object('admin_reason', p_reason)
  );

  v_game_grant_type := nullif(v_metadata ->> 'game_grant_type', '');
  v_game_grant_key := coalesce(
    nullif(v_metadata ->> 'game_grant_key', ''),
    nullif(v_metadata ->> 'species', ''),
    nullif(v_metadata ->> 'relic_id', '')
  );

  if v_game_grant_type is not null then
    v_game_grant_id := public.queue_game_grant_internal(
      p_target_user_id,
      v_game_grant_type,
      v_game_grant_key,
      p_quantity,
      v_metadata,
      'catalog_admin',
      p_item_key,
      auth.uid()
    );
  end if;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    target_user_id,
    entity_type,
    entity_key,
    payload
  )
  values (
    auth.uid(),
    'grant_catalog_item',
    p_target_user_id,
    'catalog_item',
    p_item_key,
    jsonb_build_object(
      'quantity', p_quantity,
      'reason', p_reason,
      'game_grant_id', v_game_grant_id
    )
  );
end;
$$;

-- Backfill already-existing mapped inventory once when this migration is applied.
-- This makes earlier admin tests/rewards visible in-game too.
insert into public.game_grants (
  user_id,
  grant_type,
  grant_key,
  quantity,
  payload,
  source_type,
  source_ref
)
select
  ai.user_id,
  ci.metadata ->> 'game_grant_type',
  coalesce(
    nullif(ci.metadata ->> 'game_grant_key', ''),
    nullif(ci.metadata ->> 'species', ''),
    nullif(ci.metadata ->> 'relic_id', '')
  ),
  ai.quantity,
  ci.metadata,
  'inventory_bridge_migration',
  ai.item_key
from public.account_inventory ai
join public.catalog_items ci on ci.item_key = ai.item_key
where ai.quantity > 0
  and nullif(ci.metadata ->> 'game_grant_type', '') is not null
  and not exists (
    select 1
    from public.game_grants g
    where g.user_id = ai.user_id
      and g.source_type = 'inventory_bridge_migration'
      and g.source_ref = ai.item_key
  );
