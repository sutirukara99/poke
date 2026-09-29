# Clean-source rewrite

This directory is the destination for the maintainable post-launch rewrite. The current Alpha still uses the preserved v0.9.4 production bundle as its behavioral reference and applies reproducible transformations from `scripts/build-alpha.py`.

Do not copy generated/minified runtime code here. New modules should be introduced only when their behavior can be compared against the preserved baseline and their save-data impact is understood.

Planned boundaries:

- `components/` — reusable UI
- `screens/` — top-level game screens
- `game/` — battle/run engine
- `data/` — species, moves, regions, trainers, items
- `systems/` — persistence, progression, achievements, relics
- `types/` — shared domain types
- `utils/` — deterministic helpers

## Launch rule

Until clean-source parity exists, changes to gameplay behavior belong in the guarded reconstruction pipeline and must pass `npm run check`. The immutable files under `public/recovered/` are reference assets, not editable source.
