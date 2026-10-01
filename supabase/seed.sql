-- PokéRegions starter data
-- Re-runnable and safe for development/production.
-- ALPHA2026 is intentionally disabled until you explicitly enable it.

insert into public.catalog_items (
  item_key, kind, name, description, rarity, stackable, is_active, metadata, sort_order
)
values
  (
    'currency.rogue_points',
    'currency',
    'Rogue Points',
    'Permanente Meta-Währung für PokéRegions.',
    'common',
    true,
    true,
    '{"currency":"rogue_points","game_grant_type":"meta_points"}'::jsonb,
    10
  ),
  (
    'item.gold_bottle_cap',
    'item',
    'Goldkronkorken',
    'Seltener permanenter Gegenstand für IV-Verbesserungen.',
    'legendary',
    true,
    true,
    '{"permanent":true,"game_grant_type":"gold_bottle_caps"}'::jsonb,
    20
  ),
  (
    'pokemon.alpha_shiny_riolu',
    'pokemon',
    'Shiny Riolu · Alpha',
    'Exklusives Shiny Riolu für PokéRegions Alpha-Tester.',
    'exclusive',
    false,
    true,
    '{"species":"riolu","shiny":true,"exclusive":"alpha","permanent":true,"game_grant_type":"starter_unlock","game_grant_key":"riolu"}'::jsonb,
    30
  ),
  (
    'title.alpha_tester',
    'title',
    'Alpha Trainer',
    'Exklusiver Titel für Teilnehmer der PokéRegions Alpha.',
    'exclusive',
    false,
    true,
    '{"slot":"title","exclusive":"alpha"}'::jsonb,
    40
  ),
  (
    'frame.alpha_tester',
    'frame',
    'Alpha-Rahmen',
    'Exklusiver Trainerkarten-Rahmen für Alpha-Tester.',
    'exclusive',
    false,
    true,
    '{"slot":"frame","exclusive":"alpha"}'::jsonb,
    50
  )
on conflict (item_key) do update set
  kind = excluded.kind,
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  stackable = excluded.stackable,
  is_active = excluded.is_active,
  metadata = excluded.metadata,
  sort_order = excluded.sort_order;

insert into public.achievements (
  achievement_key,
  name,
  description,
  category,
  rarity,
  is_hidden,
  is_active,
  points,
  metadata,
  sort_order
)
values (
  'achievement.alpha_tester',
  'Alpha Tester',
  'Du warst während der offenen Alpha von PokéRegions dabei.',
  'legacy',
  'exclusive',
  false,
  true,
  0,
  '{"exclusive":"alpha","legacy":true}'::jsonb,
  10
)
on conflict (achievement_key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  is_hidden = excluded.is_hidden,
  is_active = excluded.is_active,
  metadata = excluded.metadata,
  sort_order = excluded.sort_order;

insert into public.reward_bundles (
  bundle_key,
  name,
  description,
  is_active,
  metadata
)
values (
  'bundle.alpha_tester',
  'Alpha Tester Pack',
  'Permanente Belohnungen für PokéRegions Alpha-Tester.',
  true,
  '{"exclusive":"alpha"}'::jsonb
)
on conflict (bundle_key) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  metadata = excluded.metadata;

insert into public.reward_bundle_entries (
  bundle_id,
  reward_type,
  reward_key,
  quantity,
  metadata,
  sort_order
)
select
  b.id,
  v.reward_type,
  v.reward_key,
  v.quantity,
  v.metadata,
  v.sort_order
from public.reward_bundles b
cross join (
  values
    ('item'::text, 'pokemon.alpha_shiny_riolu'::text, 1::bigint, '{}'::jsonb, 10),
    ('item'::text, 'title.alpha_tester'::text, 1::bigint, '{}'::jsonb, 20),
    ('item'::text, 'frame.alpha_tester'::text, 1::bigint, '{}'::jsonb, 30),
    ('item'::text, 'item.gold_bottle_cap'::text, 2::bigint, '{}'::jsonb, 40),
    ('achievement'::text, 'achievement.alpha_tester'::text, 1::bigint, '{}'::jsonb, 50)
) as v(reward_type, reward_key, quantity, metadata, sort_order)
where b.bundle_key = 'bundle.alpha_tester'
on conflict (bundle_id, reward_type, reward_key) do update set
  quantity = excluded.quantity,
  metadata = excluded.metadata,
  sort_order = excluded.sort_order;

insert into public.promo_codes (
  code,
  name,
  description,
  reward_bundle_id,
  is_active,
  max_redemptions_per_user,
  notes,
  metadata
)
select
  'ALPHA2026',
  'Alpha Tester Gift',
  'Beispielcode für das exklusive Alpha-Tester-Paket.',
  b.id,
  false,
  1,
  'ABSICHTLICH DEAKTIVIERT. Erst aktivieren, wenn der Code wirklich verteilt werden soll.',
  '{"seeded":true}'::jsonb
from public.reward_bundles b
where b.bundle_key = 'bundle.alpha_tester'
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  reward_bundle_id = excluded.reward_bundle_id,
  notes = excluded.notes,
  metadata = excluded.metadata;

insert into public.feature_flags (flag_key, enabled, public_visible, description, config)
values
  (
    'cloud_accounts',
    true,
    true,
    'E-Mail/Discord Accounts und Cloud-Save sind aktiv.',
    '{}'::jsonb
  ),
  (
    'account_inventory',
    false,
    true,
    'Accountgebundenes permanentes Inventar.',
    '{}'::jsonb
  ),
  (
    'promo_codes',
    false,
    true,
    'Gutscheincode-Einlösung im Spiel.',
    '{}'::jsonb
  ),
  (
    'achievements_backend',
    false,
    true,
    'Datenbankgestützte Achievements.',
    '{}'::jsonb
  ),
  (
    'admin_panel',
    false,
    false,
    'Ingame Admin Panel.',
    '{}'::jsonb
  )
on conflict (flag_key) do update set
  description = excluded.description,
  config = excluded.config;

insert into public.announcements (
  announcement_key,
  title,
  body,
  severity,
  is_active,
  metadata
)
values (
  'backend.foundation.ready',
  'Backend vorbereitet',
  'Account-Inventar, Gutscheine, Achievements, Events und Admin-Werkzeuge sind vorbereitet.',
  'info',
  false,
  '{"internal":true}'::jsonb
)
on conflict (announcement_key) do update set
  title = excluded.title,
  body = excluded.body,
  severity = excluded.severity,
  metadata = excluded.metadata;
