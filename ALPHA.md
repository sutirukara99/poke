# 1.0 Alpha reconstruction architecture

The current 1.0 Alpha has two layers:

1. **Immutable behavioral baseline** — `public/recovered/v0.9.4.js` and `.css` are the latest complete production assets recovered from browser cache.
2. **Reproducible Alpha reconstruction** — `scripts/build-alpha.py` transforms that baseline into `public/recovered/v1.0.0-alpha.1-r7.js`; `src/styles/alpha.css` adds the new visual layer. The r7 launch candidate also includes gift-code rewards, First Wave cosmetics/achievement handling, stacked achievement notifications, responsive hardening and cache-busting.

This is an intentional bridge architecture. It lets the game move forward now without losing the recovered behavior, while future work can move systems out of the minified bundle into readable modules under `src/app`, `src/game`, `src/data`, and `src/systems`.

## Design principles

- roguelike progression over team-set/build-synergy bonuses
- deterministic seeded systems where competition/fairness matters
- persistent meta rewards kept separate from moment-to-moment run choices
- strong visual hierarchy inspired by handheld monster-RPG interfaces, without depending on copied proprietary UI artwork
- v0.9.4 baseline remains immutable until clean-source parity is reached

## Alpha validation

`npm run verify:alpha` rebuilds r7, checks JavaScript syntax and verifies markers for the major systems plus launch-critical branding, gift-code, First Wave, route-safety and achievement-stack behavior. `npm run check` also runs TypeScript and recovery checks.
## Competitive fairness

Daily Expeditions deliberately ignore persistent equipped relics, Meta-Starters, Bottle-Cap starter IV upgrades, Mastery moves, trainer-class upgrades and persistent shiny-rate bonuses. Daily score should reflect the shared daily seed and run decisions rather than permanent account power.
