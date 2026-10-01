-- PokéRegions public maintenance switch.
-- Public clients may read this row; only admins may change it through existing RLS.

insert into public.feature_flags (
  flag_key,
  enabled,
  public_visible,
  description,
  config
)
values (
  'maintenance_mode',
  true,
  true,
  'Sperrt den öffentlichen Spielclient während Wartungsarbeiten. Accounts mit der Rolle admin dürfen den Client nach Rollenprüfung öffnen.',
  jsonb_build_object(
    'eyebrow', 'POKÉREGIONS · SYSTEM UPDATE',
    'title', 'Die nächste Expedition wird gerade vorbereitet.',
    'message', 'PokéRegions befindet sich kurz im Wartungsmodus. Wir überarbeiten Oberfläche, Spielfluss und Präsentation für die nächste Alpha-Version.',
    'detail', 'Dein lokaler Fortschritt und deine Cloud-Saves bleiben erhalten. Sobald die Arbeiten abgeschlossen sind, kannst du hier direkt weiterspielen.',
    'status', 'WARTUNGSARBEITEN'
  )
)
on conflict (flag_key) do update
set
  enabled = excluded.enabled,
  public_visible = true,
  description = excluded.description,
  config = excluded.config,
  updated_at = now();
