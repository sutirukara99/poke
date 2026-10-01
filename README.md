# PokéRegions

**Current build: `1.0.0-alpha.1` · launch candidate `r7` — Roguelike Depth & Progression**

PokéRegions is back on a new repository after the previous GitHub source became unavailable. The last complete deployed build we could recover was **v0.9.4** from Opera's browser cache. That immutable production bundle is preserved as the baseline, and the current 1.0 Alpha is a reproducible reconstruction layered on top of it.

> Important: this repository does **not** pretend to be the lost original TypeScript tree. `public/recovered/v0.9.4.js` is the recovered deployed behavior; `scripts/build-alpha.py` documents and reproduces the 1.0 reconstruction while readable source is progressively restored.

## 1.0 Alpha systems

- Ascension 0–10 per region with enemy/shop/score scaling
- deterministic Daily Expeditions and personal best records
- Run Score with D → S+ ranks
- Relics 2.0: 18 type plates + 8 rogue relics
- Loot Control: lock, reroll and skip rewards
- Boss Telegraphs
- five-stat stage system: Attack, Defense, Sp. Atk, Sp. Def, Speed
- Species Mastery and Pokédex Challenges
- Elite archetypes
- chained Mystery Events
- Secret Routes and Cracked Compass discovery
- Rogue Codex
- first-run Alpha tutorial
- Completion dashboard
- keyboard controls for menus, routes and battles
- broad handheld/Pokémon-inspired visual polish
- gift-code redemption with persistent event rewards
- First Wave Alpha reward: permanent Shiny Riolu, special tag and achievement
- stacked achievement notifications for simultaneous unlocks
- launch-focused responsive, accessibility and cache-hardening pass

A team/build-synergy layer is deliberately **not** part of the design. The project is being pushed further toward a run-based roguelike identity instead.

## Recovery baseline

Preserved assets:

- `public/recovered/v0.9.4.js`
- `public/recovered/v0.9.4.css`

Reconstructed active build:

- `public/recovered/v1.0.0-alpha.1-r7.js`
- `src/styles/alpha.css`

The generated Alpha JS is rebuilt during verification/deployment from the preserved baseline. To reproduce the current launch candidate locally:

```bash
npm run rebuild:alpha
npm run verify:alpha
```

## Development

```bash
npm install
npm run check
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Validation & deployment

Every pull request and push to `main` runs TypeScript checks, recovery validation, Alpha reconstruction smoke tests and a production build. The GitHub Pages deployment repeats the launch-critical checks before publishing, so a broken Alpha reconstruction is not deployed independently of CI.

Automatic deployment:

- production branch: `main`
- runtime: Node.js 22
- build command: `npm run build`
- output directory: `dist`
- workflow: `.github/workflows/pages-vite.yml`

`npm run deploy` remains available for an intentional Wrangler/Cloudflare Assets deployment. The Vite build uses relative asset paths so the same output works from the GitHub Pages project path or behind a custom domain.

## Recovery documentation

See [`RECOVERY.md`](./RECOVERY.md) for what was recovered and what was reconstructed.


## PokéRegions Cloud

Optional account/cloud-save scaffolding lives in `src/cloud/`. Guest/local play remains the default and the cloud UI stays hidden until the public Supabase environment variables are configured.

Setup, Discord OAuth and database migration instructions are documented in [`CLOUD.md`](./CLOUD.md).


## Runtime visual assets

Battle presentation uses remote Pokémon Showdown sprite/FX resources at runtime for animated battle sprites, generation-style battle backgrounds and move-effect imagery. These resources are referenced by URL rather than vendored into this repository. Pokémon and related assets remain the property of their respective rights holders; PokéRegions is an unofficial fan project.
