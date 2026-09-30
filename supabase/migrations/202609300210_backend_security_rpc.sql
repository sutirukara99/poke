-- PokéRegions backend RLS, account bootstrap and trusted RPCs.
-- Apply after 202609300200_backend_core.sql.

create or replace function public.current_user_has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = p_role
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_role('admin');
$$;

revoke all on function public.current_user_has_role(text) from public, anon;
revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_has_role(text) to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function public.handle_new_backend_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'trainer_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'global_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'user_name'), ''),
      'Trainer'
    ),
    32
  );

  insert into public.profiles (user_id, trainer_name)
  values (new.id, v_name)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'player')
  on conflict (user_id, role) do nothing;

  insert into public.profile_loadouts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_backend on auth.users;
create trigger on_auth_user_created_backend
after insert on auth.users
for each row execute function public.handle_new_backend_user();

-- Backfill accounts that existed before this migration.
insert into public.profiles (user_id, trainer_name)
select
  u.id,
  left(
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'trainer_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'global_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'user_name'), ''),
      'Trainer'
    ),
    32
  )
from auth.users u
on conflict (user_id) do nothing;

insert into public.user_roles (user_id, role)
select id, 'player'
from auth.users
on conflict (user_id, role) do nothing;

insert into public.profile_loadouts (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

-- RLS -----------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.catalog_items enable row level security;
alter table public.account_inventory enable row level security;
alter table public.profile_loadouts enable row level security;
alter table public.reward_bundles enable row level security;
alter table public.reward_bundle_entries enable row level security;
alter table public.reward_grants enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.events enable row level security;
alter table public.event_claims enable row level security;
alter table public.player_notifications enable row level security;
alter table public.feature_flags enable row level security;
alter table public.announcements enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.cloud_save_revisions enable row level security;

-- Profiles
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
on public.profiles for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Roles
drop policy if exists "Users can read own roles" on public.user_roles;
create policy "Users can read own roles"
on public.user_roles for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all roles" on public.user_roles;
create policy "Admins can read all roles"
on public.user_roles for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can insert roles" on public.user_roles;
create policy "Admins can insert roles"
on public.user_roles for insert to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete roles" on public.user_roles;
create policy "Admins can delete roles"
on public.user_roles for delete to authenticated
using (public.current_user_is_admin());

-- Catalog
drop policy if exists "Public can read active catalog" on public.catalog_items;
create policy "Public can read active catalog"
on public.catalog_items for select to anon, authenticated
using (is_active);

drop policy if exists "Admins can read all catalog" on public.catalog_items;
create policy "Admins can read all catalog"
on public.catalog_items for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can insert catalog" on public.catalog_items;
create policy "Admins can insert catalog"
on public.catalog_items for insert to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update catalog" on public.catalog_items;
create policy "Admins can update catalog"
on public.catalog_items for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete catalog" on public.catalog_items;
create policy "Admins can delete catalog"
on public.catalog_items for delete to authenticated
using (public.current_user_is_admin());

-- Inventory
drop policy if exists "Users can read own inventory" on public.account_inventory;
create policy "Users can read own inventory"
on public.account_inventory for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all inventory" on public.account_inventory;
create policy "Admins can read all inventory"
on public.account_inventory for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can insert inventory" on public.account_inventory;
create policy "Admins can insert inventory"
on public.account_inventory for insert to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update inventory" on public.account_inventory;
create policy "Admins can update inventory"
on public.account_inventory for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete inventory" on public.account_inventory;
create policy "Admins can delete inventory"
on public.account_inventory for delete to authenticated
using (public.current_user_is_admin());

-- Profile loadout
drop policy if exists "Users can read own loadout" on public.profile_loadouts;
create policy "Users can read own loadout"
on public.profile_loadouts for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all loadouts" on public.profile_loadouts;
create policy "Admins can read all loadouts"
on public.profile_loadouts for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can manage loadouts" on public.profile_loadouts;
create policy "Admins can manage loadouts"
on public.profile_loadouts for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Reward definitions stay hidden from players to avoid exposing future promo content.
drop policy if exists "Admins can manage reward bundles" on public.reward_bundles;
create policy "Admins can manage reward bundles"
on public.reward_bundles for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can manage reward bundle entries" on public.reward_bundle_entries;
create policy "Admins can manage reward bundle entries"
on public.reward_bundle_entries for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Users can read own reward grants" on public.reward_grants;
create policy "Users can read own reward grants"
on public.reward_grants for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all reward grants" on public.reward_grants;
create policy "Admins can read all reward grants"
on public.reward_grants for select to authenticated
using (public.current_user_is_admin());

-- Promo codes are intentionally non-enumerable to normal players.
drop policy if exists "Admins can manage promo codes" on public.promo_codes;
create policy "Admins can manage promo codes"
on public.promo_codes for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Users can read own promo redemptions" on public.promo_redemptions;
create policy "Users can read own promo redemptions"
on public.promo_redemptions for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read promo redemptions" on public.promo_redemptions;
create policy "Admins can read promo redemptions"
on public.promo_redemptions for select to authenticated
using (public.current_user_is_admin());

-- Achievements
drop policy if exists "Public can read visible achievements" on public.achievements;
create policy "Public can read visible achievements"
on public.achievements for select to anon, authenticated
using (is_active and not is_hidden);

drop policy if exists "Users can read their unlocked hidden achievements" on public.achievements;
create policy "Users can read their unlocked hidden achievements"
on public.achievements for select to authenticated
using (
  is_active
  and is_hidden
  and exists (
    select 1
    from public.user_achievements ua
    where ua.user_id = auth.uid()
      and ua.achievement_key = achievements.achievement_key
  )
);

drop policy if exists "Admins can read all achievements" on public.achievements;
create policy "Admins can read all achievements"
on public.achievements for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can insert achievements" on public.achievements;
create policy "Admins can insert achievements"
on public.achievements for insert to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update achievements" on public.achievements;
create policy "Admins can update achievements"
on public.achievements for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete achievements" on public.achievements;
create policy "Admins can delete achievements"
on public.achievements for delete to authenticated
using (public.current_user_is_admin());

drop policy if exists "Users can read own achievements" on public.user_achievements;
create policy "Users can read own achievements"
on public.user_achievements for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read user achievements" on public.user_achievements;
create policy "Admins can read user achievements"
on public.user_achievements for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can manage user achievements" on public.user_achievements;
create policy "Admins can manage user achievements"
on public.user_achievements for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Events
drop policy if exists "Public can read live events" on public.events;
create policy "Public can read live events"
on public.events for select to anon, authenticated
using (
  is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

drop policy if exists "Admins can read all events" on public.events;
create policy "Admins can read all events"
on public.events for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can insert events" on public.events;
create policy "Admins can insert events"
on public.events for insert to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
on public.events for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
on public.events for delete to authenticated
using (public.current_user_is_admin());

drop policy if exists "Users can read own event claims" on public.event_claims;
create policy "Users can read own event claims"
on public.event_claims for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read event claims" on public.event_claims;
create policy "Admins can read event claims"
on public.event_claims for select to authenticated
using (public.current_user_is_admin());

-- Notifications
drop policy if exists "Users can read own notifications" on public.player_notifications;
create policy "Users can read own notifications"
on public.player_notifications for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can manage notifications" on public.player_notifications;
create policy "Admins can manage notifications"
on public.player_notifications for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Feature flags
drop policy if exists "Public can read visible flags" on public.feature_flags;
create policy "Public can read visible flags"
on public.feature_flags for select to anon, authenticated
using (public_visible);

drop policy if exists "Admins can read all flags" on public.feature_flags;
create policy "Admins can read all flags"
on public.feature_flags for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can manage flags" on public.feature_flags;
create policy "Admins can manage flags"
on public.feature_flags for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Announcements
drop policy if exists "Public can read live announcements" on public.announcements;
create policy "Public can read live announcements"
on public.announcements for select to anon, authenticated
using (
  is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

drop policy if exists "Admins can read all announcements" on public.announcements;
create policy "Admins can read all announcements"
on public.announcements for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can manage announcements" on public.announcements;
create policy "Admins can manage announcements"
on public.announcements for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Admin-only tables
drop policy if exists "Admins can read audit log" on public.admin_audit_log;
create policy "Admins can read audit log"
on public.admin_audit_log for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can insert audit log" on public.admin_audit_log;
create policy "Admins can insert audit log"
on public.admin_audit_log for insert to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can manage moderation actions" on public.moderation_actions;
create policy "Admins can manage moderation actions"
on public.moderation_actions for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Save history
drop policy if exists "Users can read own save revisions" on public.cloud_save_revisions;
create policy "Users can read own save revisions"
on public.cloud_save_revisions for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all save revisions" on public.cloud_save_revisions;
create policy "Admins can read all save revisions"
on public.cloud_save_revisions for select to authenticated
using (public.current_user_is_admin());

-- Existing cloud tables gain admin visibility without changing player behavior.
drop policy if exists "Admins can read all cloud saves" on public.cloud_saves;
create policy "Admins can read all cloud saves"
on public.cloud_saves for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can update cloud saves" on public.cloud_saves;
create policy "Admins can update cloud saves"
on public.cloud_saves for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete cloud saves" on public.cloud_saves;
create policy "Admins can delete cloud saves"
on public.cloud_saves for delete to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can read all entitlements" on public.entitlements;
create policy "Admins can read all entitlements"
on public.entitlements for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can insert entitlements" on public.entitlements;
create policy "Admins can insert entitlements"
on public.entitlements for insert to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update entitlements" on public.entitlements;
create policy "Admins can update entitlements"
on public.entitlements for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete entitlements" on public.entitlements;
create policy "Admins can delete entitlements"
on public.entitlements for delete to authenticated
using (public.current_user_is_admin());

-- Trusted mutation helpers ---------------------------------------------------

create or replace function public.grant_catalog_item_internal(
  p_user_id uuid,
  p_item_key text,
  p_quantity bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stackable boolean;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  select stackable
  into v_stackable
  from public.catalog_items
  where item_key = p_item_key;

  if not found then
    raise exception 'Unknown catalog item: %', p_item_key;
  end if;

  if v_stackable then
    insert into public.account_inventory (user_id, item_key, quantity, metadata)
    values (p_user_id, p_item_key, p_quantity, coalesce(p_metadata, '{}'::jsonb))
    on conflict (user_id, item_key)
    do update set
      quantity = public.account_inventory.quantity + excluded.quantity,
      metadata = public.account_inventory.metadata || excluded.metadata;
  else
    insert into public.account_inventory (user_id, item_key, quantity, metadata)
    values (p_user_id, p_item_key, 1, coalesce(p_metadata, '{}'::jsonb))
    on conflict (user_id, item_key)
    do update set
      quantity = greatest(public.account_inventory.quantity, 1),
      metadata = public.account_inventory.metadata || excluded.metadata;
  end if;
end;
$$;

create or replace function public.grant_reward_bundle_internal(
  p_user_id uuid,
  p_bundle_id uuid,
  p_source_type text,
  p_source_ref text default null,
  p_granted_by uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
  v_grant_id uuid;
begin
  if not exists (
    select 1 from public.reward_bundles where id = p_bundle_id
  ) then
    raise exception 'Unknown reward bundle';
  end if;

  for v_entry in
    select reward_type, reward_key, quantity, metadata
    from public.reward_bundle_entries
    where bundle_id = p_bundle_id
    order by sort_order, id
  loop
    if v_entry.reward_type = 'item' then
      perform public.grant_catalog_item_internal(
        p_user_id,
        v_entry.reward_key,
        v_entry.quantity,
        v_entry.metadata
      );
    elsif v_entry.reward_type = 'entitlement' then
      insert into public.entitlements (
        user_id,
        code,
        reward,
        source_type,
        source_ref,
        metadata
      )
      values (
        p_user_id,
        v_entry.reward_key,
        v_entry.metadata,
        p_source_type,
        p_source_ref,
        v_entry.metadata
      )
      on conflict (user_id, code)
      do update set
        reward = public.entitlements.reward || excluded.reward,
        source_type = excluded.source_type,
        source_ref = excluded.source_ref,
        metadata = public.entitlements.metadata || excluded.metadata;
    elsif v_entry.reward_type = 'achievement' then
      insert into public.user_achievements (
        user_id,
        achievement_key,
        progress_value,
        progress_data,
        source
      )
      values (
        p_user_id,
        v_entry.reward_key,
        0,
        v_entry.metadata,
        p_source_type
      )
      on conflict (user_id, achievement_key) do nothing;
    end if;
  end loop;

  insert into public.reward_grants (
    user_id,
    bundle_id,
    source_type,
    source_ref,
    granted_by,
    metadata
  )
  values (
    p_user_id,
    p_bundle_id,
    p_source_type,
    p_source_ref,
    p_granted_by,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_grant_id;

  return v_grant_id;
end;
$$;

create or replace function public.unlock_achievement_internal(
  p_user_id uuid,
  p_achievement_key text,
  p_source text default 'system',
  p_progress_data jsonb default '{}'::jsonb,
  p_granted_by uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle_id uuid;
  v_row_count bigint := 0;
  v_inserted boolean := false;
begin
  select reward_bundle_id
  into v_bundle_id
  from public.achievements
  where achievement_key = p_achievement_key;

  if not found then
    raise exception 'Unknown achievement: %', p_achievement_key;
  end if;

  insert into public.user_achievements (
    user_id,
    achievement_key,
    progress_value,
    progress_data,
    source
  )
  values (
    p_user_id,
    p_achievement_key,
    0,
    coalesce(p_progress_data, '{}'::jsonb),
    p_source
  )
  on conflict (user_id, achievement_key) do nothing;

  get diagnostics v_row_count = row_count;
  v_inserted := v_row_count > 0;

  if v_inserted and v_bundle_id is not null then
    perform public.grant_reward_bundle_internal(
      p_user_id,
      v_bundle_id,
      'achievement',
      p_achievement_key,
      p_granted_by,
      jsonb_build_object('achievement_key', p_achievement_key)
    );
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.grant_catalog_item_internal(uuid, text, bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.grant_reward_bundle_internal(uuid, uuid, text, text, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.unlock_achievement_internal(uuid, text, text, jsonb, uuid)
  from public, anon, authenticated;

-- Player RPCs ---------------------------------------------------------------

create or replace function public.set_my_trainer_name(p_trainer_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_trainer_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 32 then
    raise exception 'Trainer name must contain 1 to 32 characters';
  end if;

  update public.profiles
  set trainer_name = v_name
  where user_id = auth.uid();

  return v_name;
end;
$$;

create or replace function public.touch_my_last_seen()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set last_seen_at = v_now
  where user_id = auth.uid();

  return v_now;
end;
$$;

create or replace function public.equip_profile_item(
  p_slot text,
  p_item_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_slot not in ('avatar', 'frame', 'background', 'title') then
    raise exception 'Unknown profile slot';
  end if;

  if p_item_key is not null then
    select c.kind
    into v_kind
    from public.catalog_items c
    join public.account_inventory i
      on i.item_key = c.item_key
     and i.user_id = auth.uid()
     and i.quantity > 0
    where c.item_key = p_item_key;

    if not found then
      raise exception 'Item is not owned';
    end if;

    if v_kind <> p_slot then
      raise exception 'Item cannot be equipped in this slot';
    end if;
  end if;

  insert into public.profile_loadouts (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.profile_loadouts
  set
    avatar_item_key = case when p_slot = 'avatar' then p_item_key else avatar_item_key end,
    frame_item_key = case when p_slot = 'frame' then p_item_key else frame_item_key end,
    background_item_key = case when p_slot = 'background' then p_item_key else background_item_key end,
    title_item_key = case when p_slot = 'title' then p_item_key else title_item_key end
  where user_id = auth.uid();
end;
$$;

create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.promo_codes%rowtype;
  v_global_count integer;
  v_user_count integer;
  v_rewards jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and account_state <> 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'account_restricted');
  end if;

  select *
  into v_code
  from public.promo_codes
  where code = upper(trim(coalesce(p_code, '')))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if not v_code.is_active then
    return jsonb_build_object('ok', false, 'error', 'inactive_code');
  end if;

  if v_code.starts_at is not null and v_code.starts_at > now() then
    return jsonb_build_object('ok', false, 'error', 'not_started');
  end if;

  if v_code.ends_at is not null and v_code.ends_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select count(*)::integer
  into v_global_count
  from public.promo_redemptions
  where promo_code_id = v_code.id;

  if v_code.max_redemptions is not null
     and v_global_count >= v_code.max_redemptions then
    return jsonb_build_object('ok', false, 'error', 'limit_reached');
  end if;

  select count(*)::integer
  into v_user_count
  from public.promo_redemptions
  where promo_code_id = v_code.id
    and user_id = auth.uid();

  if v_user_count >= v_code.max_redemptions_per_user then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  insert into public.promo_redemptions (promo_code_id, user_id)
  values (v_code.id, auth.uid());

  perform public.grant_reward_bundle_internal(
    auth.uid(),
    v_code.reward_bundle_id,
    'promo_code',
    v_code.code,
    null,
    jsonb_build_object('promo_code_id', v_code.id)
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type', e.reward_type,
        'key', e.reward_key,
        'quantity', e.quantity,
        'metadata', e.metadata
      )
      order by e.sort_order, e.id
    ),
    '[]'::jsonb
  )
  into v_rewards
  from public.reward_bundle_entries e
  where e.bundle_id = v_code.reward_bundle_id;

  return jsonb_build_object(
    'ok', true,
    'code', v_code.code,
    'name', v_code.name,
    'rewards', v_rewards
  );
end;
$$;

create or replace function public.claim_event_reward(p_event_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_row_count bigint := 0;
  v_claimed boolean := false;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select *
  into v_event
  from public.events
  where event_key = p_event_key
  for update;

  if not found
     or not v_event.is_active
     or (v_event.starts_at is not null and v_event.starts_at > now())
     or (v_event.ends_at is not null and v_event.ends_at <= now()) then
    return jsonb_build_object('ok', false, 'error', 'event_unavailable');
  end if;

  insert into public.event_claims (user_id, event_key)
  values (auth.uid(), v_event.event_key)
  on conflict (user_id, event_key) do nothing;

  get diagnostics v_row_count = row_count;
  v_claimed := v_row_count > 0;

  if not v_claimed then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  if v_event.reward_bundle_id is not null then
    perform public.grant_reward_bundle_internal(
      auth.uid(),
      v_event.reward_bundle_id,
      'event',
      v_event.event_key,
      null,
      '{}'::jsonb
    );
  end if;

  return jsonb_build_object('ok', true, 'event_key', v_event.event_key);
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count bigint := 0;
  v_updated boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.player_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid();

  get diagnostics v_row_count = row_count;
  v_updated := v_row_count > 0;
  return v_updated;
end;
$$;

revoke all on function public.set_my_trainer_name(text) from public, anon;
revoke all on function public.touch_my_last_seen() from public, anon;
revoke all on function public.equip_profile_item(text, text) from public, anon;
revoke all on function public.redeem_promo_code(text) from public, anon;
revoke all on function public.claim_event_reward(text) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;

grant execute on function public.set_my_trainer_name(text) to authenticated;
grant execute on function public.touch_my_last_seen() to authenticated;
grant execute on function public.equip_profile_item(text, text) to authenticated;
grant execute on function public.redeem_promo_code(text) to authenticated;
grant execute on function public.claim_event_reward(text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- Admin RPCs ----------------------------------------------------------------

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
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin role required';
  end if;

  perform public.grant_catalog_item_internal(
    p_target_user_id,
    p_item_key,
    p_quantity,
    jsonb_build_object('admin_reason', p_reason)
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
    'grant_catalog_item',
    p_target_user_id,
    'catalog_item',
    p_item_key,
    jsonb_build_object('quantity', p_quantity, 'reason', p_reason)
  );
end;
$$;

create or replace function public.admin_grant_reward_bundle(
  p_target_user_id uuid,
  p_bundle_key text,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle_id uuid;
  v_grant_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin role required';
  end if;

  select id into v_bundle_id
  from public.reward_bundles
  where bundle_key = p_bundle_key;

  if not found then
    raise exception 'Unknown reward bundle';
  end if;

  v_grant_id := public.grant_reward_bundle_internal(
    p_target_user_id,
    v_bundle_id,
    'admin',
    p_reason,
    auth.uid(),
    '{}'::jsonb
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
    'grant_reward_bundle',
    p_target_user_id,
    'reward_bundle',
    p_bundle_key,
    jsonb_build_object('reason', p_reason, 'reward_grant_id', v_grant_id)
  );

  return v_grant_id;
end;
$$;

create or replace function public.admin_unlock_achievement(
  p_target_user_id uuid,
  p_achievement_key text,
  p_reason text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unlocked boolean;
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin role required';
  end if;

  v_unlocked := public.unlock_achievement_internal(
    p_target_user_id,
    p_achievement_key,
    'admin',
    jsonb_build_object('reason', p_reason),
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
    'unlock_achievement',
    p_target_user_id,
    'achievement',
    p_achievement_key,
    jsonb_build_object('reason', p_reason, 'new_unlock', v_unlocked)
  );

  return v_unlocked;
end;
$$;

create or replace function public.admin_notify_user(
  p_target_user_id uuid,
  p_title text,
  p_body text,
  p_kind text default 'info',
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin role required';
  end if;

  insert into public.player_notifications (user_id, kind, title, body, payload)
  values (
    p_target_user_id,
    p_kind,
    p_title,
    p_body,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_id;

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
    'notify_user',
    p_target_user_id,
    'notification',
    v_id::text,
    jsonb_build_object('title', p_title, 'kind', p_kind)
  );

  return v_id;
end;
$$;

create or replace function public.admin_set_account_state(
  p_target_user_id uuid,
  p_state text,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin role required';
  end if;

  if p_state not in ('active', 'restricted', 'banned') then
    raise exception 'Invalid account state';
  end if;

  update public.profiles
  set account_state = p_state
  where user_id = p_target_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  insert into public.moderation_actions (
    target_user_id,
    actor_user_id,
    action_type,
    reason
  )
  values (
    p_target_user_id,
    auth.uid(),
    case
      when p_state = 'active' then 'unrestrict'
      when p_state = 'restricted' then 'restrict'
      else 'ban'
    end,
    p_reason
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
    'set_account_state',
    p_target_user_id,
    'profile',
    p_target_user_id::text,
    jsonb_build_object('state', p_state, 'reason', p_reason)
  );
end;
$$;

revoke all on function public.admin_grant_catalog_item(uuid, text, bigint, text)
  from public, anon;
revoke all on function public.admin_grant_reward_bundle(uuid, text, text)
  from public, anon;
revoke all on function public.admin_unlock_achievement(uuid, text, text)
  from public, anon;
revoke all on function public.admin_notify_user(uuid, text, text, text, jsonb)
  from public, anon;
revoke all on function public.admin_set_account_state(uuid, text, text)
  from public, anon;

grant execute on function public.admin_grant_catalog_item(uuid, text, bigint, text)
  to authenticated;
grant execute on function public.admin_grant_reward_bundle(uuid, text, text)
  to authenticated;
grant execute on function public.admin_unlock_achievement(uuid, text, text)
  to authenticated;
grant execute on function public.admin_notify_user(uuid, text, text, text, jsonb)
  to authenticated;
grant execute on function public.admin_set_account_state(uuid, text, text)
  to authenticated;

-- Table privileges. RLS remains the actual authorization boundary.
grant select on public.profiles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.catalog_items to authenticated;
grant select, insert, update, delete on public.account_inventory to authenticated;
grant select, insert, update, delete on public.profile_loadouts to authenticated;
grant select, insert, update, delete on public.reward_bundles to authenticated;
grant select, insert, update, delete on public.reward_bundle_entries to authenticated;
grant select on public.reward_grants to authenticated;
grant select, insert, update, delete on public.promo_codes to authenticated;
grant select on public.promo_redemptions to authenticated;
grant select, insert, update, delete on public.achievements to authenticated;
grant select, insert, update, delete on public.user_achievements to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select on public.event_claims to authenticated;
grant select, insert, update, delete on public.player_notifications to authenticated;
grant select, insert, update, delete on public.feature_flags to authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert on public.admin_audit_log to authenticated;
grant select, insert, update, delete on public.moderation_actions to authenticated;
grant select on public.cloud_save_revisions to authenticated;
grant select, insert, update, delete on public.entitlements to authenticated;

grant select on public.catalog_items to anon;
grant select on public.achievements to anon;
grant select on public.events to anon;
grant select on public.feature_flags to anon;
grant select on public.announcements to anon;
