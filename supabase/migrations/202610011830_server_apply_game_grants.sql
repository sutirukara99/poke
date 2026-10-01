-- Apply pending game grants directly to cloud_saves server-side.
-- This removes the dependency on the browser being the component that mutates
-- metaPoints / bottleCaps / starter unlocks before acknowledging a grant.

create or replace function public.append_unique_text_jsonb(
  p_array jsonb,
  p_value text
)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_agg(value order by value)
      from (
        select distinct value
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(coalesce(p_array, '[]'::jsonb)) = 'array'
              then coalesce(p_array, '[]'::jsonb)
            else '[]'::jsonb
          end
        )
        union
        select p_value
      ) values_set
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.apply_game_grant_to_cloud_save_internal(
  p_user_id uuid,
  p_grant_type text,
  p_grant_key text,
  p_quantity bigint,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  if p_grant_type = 'meta_points' then
    update public.cloud_saves
    set
      save_data = jsonb_set(
        save_data,
        '{metaPoints}',
        to_jsonb(coalesce((save_data ->> 'metaPoints')::bigint, 0) + p_quantity),
        true
      ),
      updated_at = now()
    where user_id = p_user_id;

  elsif p_grant_type = 'bottle_caps' then
    update public.cloud_saves
    set
      save_data = jsonb_set(
        save_data,
        '{bottleCaps}',
        to_jsonb(coalesce((save_data ->> 'bottleCaps')::bigint, 0) + p_quantity),
        true
      ),
      updated_at = now()
    where user_id = p_user_id;

  elsif p_grant_type = 'gold_bottle_caps' then
    update public.cloud_saves
    set
      save_data = jsonb_set(
        save_data,
        '{goldBottleCaps}',
        to_jsonb(coalesce((save_data ->> 'goldBottleCaps')::bigint, 0) + p_quantity),
        true
      ),
      updated_at = now()
    where user_id = p_user_id;

  elsif p_grant_type = 'ability_capsules' then
    update public.cloud_saves
    set
      save_data = jsonb_set(
        save_data,
        '{abilityCapsules}',
        to_jsonb(coalesce((save_data ->> 'abilityCapsules')::bigint, 0) + p_quantity),
        true
      ),
      updated_at = now()
    where user_id = p_user_id;

  elsif p_grant_type = 'ability_patches' then
    update public.cloud_saves
    set
      save_data = jsonb_set(
        save_data,
        '{abilityPatches}',
        to_jsonb(coalesce((save_data ->> 'abilityPatches')::bigint, 0) + p_quantity),
        true
      ),
      updated_at = now()
    where user_id = p_user_id;

  elsif p_grant_type = 'ancient_charms' then
    update public.cloud_saves
    set
      save_data = jsonb_set(
        save_data,
        '{ancientCharms}',
        to_jsonb(coalesce((save_data ->> 'ancientCharms')::bigint, 0) + p_quantity),
        true
      ),
      updated_at = now()
    where user_id = p_user_id;

  elsif p_grant_type = 'starter_unlock' then
    if nullif(trim(coalesce(p_grant_key, '')), '') is null then
      raise exception 'grant_key is required for starter_unlock';
    end if;

    update public.cloud_saves
    set
      save_data = jsonb_set(
        jsonb_set(
          save_data,
          '{unlockedStarters}',
          public.append_unique_text_jsonb(save_data -> 'unlockedStarters', p_grant_key),
          true
        ),
        '{accountPokemonRewards}',
        coalesce(
          case
            when jsonb_typeof(save_data -> 'accountPokemonRewards') = 'object'
              then save_data -> 'accountPokemonRewards'
            else '{}'::jsonb
          end,
          '{}'::jsonb
        ) || jsonb_build_object(
          p_grant_key,
          coalesce(
            case
              when jsonb_typeof((save_data -> 'accountPokemonRewards') -> p_grant_key) = 'object'
                then (save_data -> 'accountPokemonRewards') -> p_grant_key
              else '{}'::jsonb
            end,
            '{}'::jsonb
          ) || coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
            'quantity', p_quantity,
            'grantedAt', now()
          )
        ),
        true
      ),
      updated_at = now()
    where user_id = p_user_id;

  elsif p_grant_type = 'achievement' then
    if nullif(trim(coalesce(p_grant_key, '')), '') is null then
      raise exception 'grant_key is required for achievement';
    end if;

    update public.cloud_saves
    set
      save_data = jsonb_set(
        save_data,
        '{achievements}',
        public.append_unique_text_jsonb(save_data -> 'achievements', p_grant_key),
        true
      ),
      updated_at = now()
    where user_id = p_user_id;

  elsif p_grant_type = 'relic' then
    if nullif(trim(coalesce(p_grant_key, '')), '') is null then
      raise exception 'grant_key is required for relic';
    end if;

    update public.cloud_saves
    set
      save_data = jsonb_set(
        save_data,
        '{relicsOwned}',
        public.append_unique_text_jsonb(save_data -> 'relicsOwned', p_grant_key),
        true
      ),
      updated_at = now()
    where user_id = p_user_id;

  else
    raise exception 'Unsupported game grant type: %', p_grant_type;
  end if;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.apply_game_grant_to_cloud_save_internal(
  uuid, text, text, bigint, jsonb
) from public, anon, authenticated;

grant execute on function public.apply_game_grant_to_cloud_save_internal(
  uuid, text, text, bigint, jsonb
) to service_role;

-- Queue the grant for users without a cloud save; otherwise apply immediately.
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
  v_applied boolean := false;
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

  v_applied := public.apply_game_grant_to_cloud_save_internal(
    p_user_id,
    p_grant_type,
    p_grant_key,
    p_quantity,
    coalesce(p_payload, '{}'::jsonb)
  );

  if v_applied then
    update public.game_grants
    set applied_at = now()
    where id = v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.queue_game_grant_internal(
  uuid, text, text, bigint, jsonb, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.queue_game_grant_internal(
  uuid, text, text, bigint, jsonb, text, text, uuid
) to service_role;

-- Apply existing pending grants that were created before this server-side bridge.
do $$
declare
  v_grant record;
  v_applied boolean;
begin
  for v_grant in
    select id, user_id, grant_type, grant_key, quantity, payload
    from public.game_grants
    where applied_at is null
    order by created_at, id
  loop
    v_applied := public.apply_game_grant_to_cloud_save_internal(
      v_grant.user_id,
      v_grant.grant_type,
      v_grant.grant_key,
      v_grant.quantity,
      v_grant.payload
    );

    if v_applied then
      update public.game_grants
      set applied_at = now()
      where id = v_grant.id;
    end if;
  end loop;
end;
$$;
