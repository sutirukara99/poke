# PokéRogue Regions

**Current build: `1.0.0-alpha.1` — Roguelike Depth & Progression**

PokéRogue Regions is back on a new repository after the previous GitHub source became unavailable. The last complete deployed build we could recover was **v0.9.4** from Opera's browser cache. That immutable production bundle is preserved as the baseline, and the current 1.0 Alpha is a reproducible reconstruction layered on top of it.

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

A team/build-synergy layer is deliberately **not** part of the design. The project is being pushed further toward a run-based roguelike identity instead.

## Recovery baseline

Preserved assets:

- `public/recovered/v0.9.4.js`
- `public/recovered/v0.9.4.css`

Reconstructed active build:

- `public/recovered/v1.0.0-alpha.1-r4.js`
- `src/styles/alpha.css`

The generated Alpha JS is committed so static hosts can serve it without Python. To reproduce it from the preserved baseline:

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

## Cloudflare Pages

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback: `public/_redirects`

## Recovery documentation

See [`RECOVERY.md`](./RECOVERY.md) for what was recovered and what was reconstructed.
<!-- pages-redeploy: 2026-09-28 -->


### Cloudflare Pages (production)

Recommended production host:

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root
- Node.js: 22

The Vite build uses relative asset paths so the same build also remains usable from the GitHub Pages project path.
