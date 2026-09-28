# PokéRogue Regions

Recovered source workspace for **PokéRogue Regions**.

## Status

The repository has been rebuilt around the latest complete browser-cached production build we recovered: **v0.9.4**, cached on 2026-09-28 at 02:30.

The exact deployed source tree was not recoverable, but the production JavaScript and CSS were. They are preserved in:

- `public/recovered/v0.9.4.js`
- `public/recovered/v0.9.4.css`

The current Vite shell boots that preserved production build directly. This gives us a stable playable baseline while the readable React/TypeScript 1.0 source is rebuilt under `src/app/`.

## Stack

- React production bundle (recovered)
- TypeScript
- Vite
- LocalStorage save data
- Static hosting compatible with Cloudflare Pages

## Local development

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

- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback: included via `public/_redirects`

## Recovery rule

Do not edit or remove the files in `public/recovered/` until the clean-source rewrite reaches feature parity. They are the behavioral reference for v0.9.4.

See [RECOVERY.md](./RECOVERY.md).

## Next milestone

**1.0 Alpha — Roguelike Depth & Progression**

The 1.0 rebuild will restore the planned progression, daily, ascension, relic, mastery, elite, event-chain, secret-route and completion systems as editable TypeScript. Team/build synergy remains intentionally excluded.
