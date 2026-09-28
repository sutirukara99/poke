# Recovery notes

## What was recovered

The previous repository became unavailable with the old GitHub account. A browser-cache recovery produced the latest complete production assets found in Opera's HTTP cache:

- JavaScript: `index-CkLLm7id.js` — cached 2026-09-28 02:30
- CSS: `index-CoKcXii9.css` — cached 2026-09-28 02:30
- Product version inside the JavaScript bundle: `v0.9.4`

The production payloads were gzip-compressed inside Chromium simple-cache entries. They were extracted and checksummed before being committed here in immutable chunks.

## Integrity

- JavaScript SHA-256: `0f2a4c155d47de05eadd996f820b9fe8538e1e959dd4811ae1c6f7d5d68a425e`
- CSS SHA-256: `b43de0091f6fe45df06262136b9d53add6c6cdbf30233b63ef05061e2248813f`

Run:

```bash
npm run verify:recovery
```

## Why chunks exist

GitHub connector writes have practical payload limits, so the immutable production assets are stored as numbered byte-for-byte text chunks and assembled before dev/build.

Generated files:

- `public/recovered/v0.9.4.js`
- `public/recovered/v0.9.4.css`

Do not edit those generated files. Edit clean source modules as 1.0 is rebuilt.

## What this is not

This is not the original TypeScript/TSX source tree. Minification removed original module boundaries, names, comments, and types. The recovered bundle preserves deployed behavior and data, which makes it a strong reference baseline.

## 1.0 direction

The clean-source rewrite will restore modular React/TypeScript source and then reintroduce the planned roguelike-depth systems. Team/build synergy is intentionally excluded.
