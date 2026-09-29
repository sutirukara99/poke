# Changelog

## 1.0.0-alpha.1 launch candidate r7 — 2026-09-29

### Final audit
- Re-read every tracked repository file, including the preserved baseline assets, launch styles, scripts, workflows, configuration and project documentation.
- Production Pages deployment now runs the full Alpha validation before publishing; manual Wrangler deploys do the same.
- Hardened the boot watchdog so it cancels as soon as the app mounts and no longer relies on an inline click handler.
- Strengthened recovery and launch smoke checks and added typed recovery/build manifests.
- Updated stale recovery/rewrite documentation and corrected launch cache guidance.
- Confirmed limited event achievements do not block standard 100% completion.

### Launch polish
- Added a final responsive pass for desktop, tablet and phone layouts, including Meta-Shop, PC, inventory, achievements, starter selection, settings and loot screens.
- Improved touch targets, safe-area handling, text overflow, modal scrolling and reduced-motion behavior.
- Added clearer accessibility state for mode/region selection and live gift-code status feedback.
- Added a boot recovery screen instead of leaving players on a silent blank page if startup is interrupted.
- Added social/share metadata and connection warm-up for external sprite/map hosts.
- Bumped the reconstructed runtime to r7 and added cache controls to reduce stale-build issues at launch.

### Alpha tester rewards
- Added gift-code redemption to the region selection screen.
- Added `Alpha2026`: permanent Shiny Riolu Meta-Starter with the `First Wave` tag.
- Added the special `First Wave` achievement/title and migration for testers who redeemed the code before the achievement shipped.
- Multiple achievements unlocked by one action now display as a vertical toast stack.

### Region & combat UI
- Restored region artwork with polished hover/selected states and graceful image fallback.
- Added short move descriptions on hover/focus in battle, tutor and party views.
- Compacted the party sidebar when a run only contains one Pokémon.
- Renamed visible legacy PokéRogue Regions branding to PokéRegions while retaining internal legacy save keys for compatibility.

## 1.0.0-alpha.1 — 2026-09-28

### Route safety pass
- Fixed optional-node exits such as Move-Tutor, Shop, Heal, Item and City being able to lead into a route with no selectable continuation.
- Added a route watchdog that repairs already-stuck active saves on reload.
- Secret routes now only replace nodes in full three-lane rows, so hiding a secret can never remove the sole valid path.
- Schutzschild is limited to 4 PP, 60% first-use success and 10% on consecutive uses.
- Revealed route nodes now explain their function on hover/focus.

### Protect balance & route clarity
- Schutzschild heavily nerfed: 4 PP, 60% base success, only 10% when repeated until another move is used.
- Reduced AI value for repeated Protect stalling and exposed the success rule directly on the move button.
- Added hover/focus tooltips to revealed route nodes explaining Wild Battle, Trainer Battle, Market, Event, Healing, Tutor, Arena, League and Legendary nodes.

### Quality & fairness pass
- Elite archetypes now have distinct mechanics: IV Specialists, Hunter crit focus, Relic Keeper sustain/loot, Veteran lead protection and Weather Ace type boosters.
- Run History now exposes Daily runs, score/rank, Ascension, elite battles and secret routes.
- Daily Expeditions now isolate persistent account power: no equipped relics, Meta-Starters, Bottle-Cap starter IVs, Mastery moves or trainer-class upgrades.
- Converted the obsolete per-run quest achievement into an account Questboard milestone.
- Added live run-condition chips for Daily/Ascension, challenge rules, active relics, loot rerolls and live score.
- Added a dynamic main-menu count for Questboard rewards ready to claim.
- Continued the unified dark-theme and sprite-alignment polish pass.

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