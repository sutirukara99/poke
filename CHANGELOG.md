# Changelog

## 1.0.0-alpha.1 — 2026-09-28

### Roguelike progression
- Added region-specific Ascension 0–10 with difficulty, shop and score scaling.
- Added deterministic Daily Expeditions with date seed, fixed rules and best-score records.
- Added Run Score and D/C/B/A/S/S+ result ranks.
- Added Species Mastery and Pokédex mastery challenges.
- Added a weighted Completion dashboard.

### Runs & encounters
- Added Relics 2.0 with eight new rogue relics alongside the 18 type plates.
- Added Loot Control with reward lock, reroll and skip-for-money actions.
- Added Boss Telegraphs for key encounters.
- Added five-stat battle stages and new setup/debuff moves.
- Added Elite Trainer archetypes, Secret Routes and event-chain follow-ups.
- Added Cracked Compass, Hunter Mark, Black Feather, Glass Charm, Lucky Egg, Old Coin, Rogue Die and Warden Charm effects.

### UX
- Added Rogue Codex and first-run Alpha onboarding.
- Added menu, route and battle keyboard shortcuts.
- Added a broad Pokémon/handheld-inspired visual polish layer while retaining the project's own layout and assets.
- Improved save migration for the new Alpha fields while keeping save schema v5 compatible.

### Recovery
- Reconstructed this Alpha from the preserved v0.9.4 production baseline.
- Added a reproducible `scripts/build-alpha.py` patch pipeline and Alpha smoke validation.

## 0.9.4-recovered.1 — 2026-09-28

- Established new repository after loss of access to previous GitHub account.
- Recovered production JavaScript and CSS from Opera HTTP cache.
- Added deterministic recovery verification.
- Added Vite shell for the preserved v0.9.4 production build.