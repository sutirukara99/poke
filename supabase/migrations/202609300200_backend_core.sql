-- PokéRegions backend foundation
-- Safe to apply after 20260930_cloud_accounts.sql.
-- This migration is intentionally additive: it keeps existing cloud_saves and entitlements data.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trainer_name text not null default 'Trainer'
    check (char_length(trainer_name) between 1 and 32),
  account_state text not null default 'active'
    check (account_state in ('active', 'restricted', 'banned')),
  locale text not null default 'de',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null
    check (role in ('player', 'tester', 'moderator', 'admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.catalog_items (
  item_key text primary key,
  kind text not null
    check (kind in (
      'currency',
      'item',
      'relic',
      'pokemon',
      'avatar',
      'frame',
      'background',
      'title',
      'token'
    )),
  name text not null,
  description text not null default '',
  icon_url text,
  rarity text not null default 'common'
    check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'exclusive')),
  stackable boolean not null default true,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null references public.catalog_items(item_key) on delete restrict,
  quantity bigint not null default 1 check (quantity >= 0),
  metadata jsonb not null default '{}'::jsonb,
  first_granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

create table if not exists public.profile_loadouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_item_key text references public.catalog_items(item_key) on delete set null,
  frame_item_key text references public.catalog_items(item_key) on delete set null,
  background_item_key text references public.catalog_items(item_key) on delete set null,
  title_item_key text references public.catalog_items(item_key) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_bundles (
  id uuid primary key default gen_random_uuid(),
  bundle_key text not null unique,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_bundle_entries (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.reward_bundles(id) on delete cascade,
  reward_type text not null
    check (reward_type in ('item', 'entitlement', 'achievement')),
  reward_key text not null,
  quantity bigint not null default 1 check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0
);

create unique index if not exists reward_bundle_entries_unique_reward
  on public.reward_bundle_entries (bundle_id, reward_type, reward_key);

create table if not exists public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bundle_id uuid references public.reward_bundles(id) on delete set null,
  source_type text not null,
  source_ref text,
  granted_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reward_grants_user_created_idx
  on public.reward_grants (user_id, created_at desc);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  reward_bundle_id uuid not null references public.reward_bundles(id) on delete restrict,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  max_redemptions_per_user integer not null default 1
    check (max_redemptions_per_user > 0),
  created_by uuid references auth.users(id) on delete set null,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code = upper(trim(code))),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists promo_codes_active_window_idx
  on public.promo_codes (is_active, starts_at, ends_at);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists promo_redemptions_code_idx
  on public.promo_redemptions (promo_code_id, redeemed_at desc);

create index if not exists promo_redemptions_user_idx
  on public.promo_redemptions (user_id, redeemed_at desc);

create table if not exists public.achievements (
  achievement_key text primary key,
  name text not null,
  description text not null default '',
  category text not null default 'general',
  icon_url text,
  rarity text not null default 'common'
    check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'exclusive')),
  is_hidden boolean not null default false,
  is_active boolean not null default true,
  points integer not null default 0 check (points >= 0),
  trigger_key text,
  target_value numeric,
  reward_bundle_id uuid references public.reward_bundles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null references public.achievements(achievement_key) on delete restrict,
  progress_value numeric not null default 0,
  progress_data jsonb not null default '{}'::jsonb,
  unlocked_at timestamptz not null default now(),
  source text not null default 'system',
  primary key (user_id, achievement_key)
);

create table if not exists public.achievement_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null references public.achievements(achievement_key) on delete cascade,
  progress_value numeric not null default 0 check (progress_value >= 0),
  progress_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

create table if not exists public.events (
  event_key text primary key,
  name text not null,
  description text not null default '',
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  reward_bundle_id uuid references public.reward_bundles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.event_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null references public.events(event_key) on delete restrict,
  claimed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, event_key)
);

create table if not exists public.player_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists player_notifications_user_unread_idx
  on public.player_notifications (user_id, read_at, created_at desc);

create table if not exists public.feature_flags (
  flag_key text primary key,
  enabled boolean not null default false,
  public_visible boolean not null default true,
  description text not null default '',
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  announcement_key text primary key,
  title text not null,
  body text not null,
  severity text not null default 'info'
    check (severity in ('info', 'success', 'warning', 'critical')),
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  link_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  entity_type text,
  entity_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null
    check (action_type in ('warning', 'restrict', 'unrestrict', 'ban', 'unban', 'note')),
  reason text not null default '',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_target_idx
  on public.moderation_actions (target_user_id, created_at desc);

create table if not exists public.cloud_save_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  save_data jsonb not null,
  save_version integer not null,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists cloud_save_revisions_user_created_idx
  on public.cloud_save_revisions (user_id, created_at desc);

-- Extend the original entitlement table without breaking existing rewards.
alter table public.entitlements
  add column if not exists source_type text not null default 'system',
  add column if not exists source_ref text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.archive_cloud_save_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.save_data is distinct from new.save_data then
    insert into public.cloud_save_revisions (
      user_id,
      save_data,
      save_version,
      source_updated_at
    )
    values (
      old.user_id,
      old.save_data,
      old.save_version,
      old.updated_at
    );

    delete from public.cloud_save_revisions
    where id in (
      select id
      from public.cloud_save_revisions
      where user_id = old.user_id
      order by created_at desc
      offset 10
    );
  end if;

  return new;
end;
$$;

drop trigger if exists cloud_saves_archive_revision on public.cloud_saves;
create trigger cloud_saves_archive_revision
before update on public.cloud_saves
for each row
execute function public.archive_cloud_save_revision();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists catalog_items_set_updated_at on public.catalog_items;
create trigger catalog_items_set_updated_at
before update on public.catalog_items
for each row execute function public.set_updated_at();

drop trigger if exists account_inventory_set_updated_at on public.account_inventory;
create trigger account_inventory_set_updated_at
before update on public.account_inventory
for each row execute function public.set_updated_at();

drop trigger if exists profile_loadouts_set_updated_at on public.profile_loadouts;
create trigger profile_loadouts_set_updated_at
before update on public.profile_loadouts
for each row execute function public.set_updated_at();

drop trigger if exists reward_bundles_set_updated_at on public.reward_bundles;
create trigger reward_bundles_set_updated_at
before update on public.reward_bundles
for each row execute function public.set_updated_at();

drop trigger if exists promo_codes_set_updated_at on public.promo_codes;
create trigger promo_codes_set_updated_at
before update on public.promo_codes
for each row execute function public.set_updated_at();

drop trigger if exists achievements_set_updated_at on public.achievements;
create trigger achievements_set_updated_at
before update on public.achievements
for each row execute function public.set_updated_at();

drop trigger if exists achievement_progress_set_updated_at on public.achievement_progress;
create trigger achievement_progress_set_updated_at
before update on public.achievement_progress
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at
before update on public.feature_flags
for each row execute function public.set_updated_at();

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();
