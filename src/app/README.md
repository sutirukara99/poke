# Clean-source rewrite

This directory is reserved for the editable 1.0 rewrite.

The recovered v0.9.4 production bundle remains the behavioral reference while systems are moved back into readable TypeScript/React modules.

Planned boundaries:

- `components/` — reusable UI
- `screens/` — top-level game screens
- `game/` — battle/run engine
- `data/` — species, moves, regions, trainers, items
- `systems/` — persistence, progression, achievements, relics
- `types/` — shared domain types
- `utils/` — deterministic helpers
