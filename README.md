# PokéRogue Regions

Recovered source workspace for **PokéRogue Regions**.

## Current recovery baseline

This repository was rebuilt after the previous GitHub account became unavailable. The latest browser-cached production build we could recover is **v0.9.4**, from 2026-09-28 02:30.

The original production JavaScript and CSS are preserved under `src/recovered/` and `src/styles/`. The app currently boots that recovered build through a small Vite/TypeScript shell so we have a stable, deployable baseline before rebuilding the 1.0 systems.

## Stack

- React production bundle (recovered)
- TypeScript
- Vite
- LocalStorage save data
- Static hosting compatible with Cloudflare Pages

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`

## Recovery policy

Do not delete `src/recovered/v0.9.4.bundle.js` or `src/styles/v0.9.4.css` until the clean-source rewrite has feature parity. They are the preserved reference for the last recovered playable build.

See [RECOVERY.md](./RECOVERY.md) for details.

## Next milestone

Rebuild the editable 1.0 Alpha systems on top of this recovered v0.9.4 baseline without reintroducing a team/build-synergy layer.
