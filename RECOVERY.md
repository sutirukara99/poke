# PokéRogue Regions recovery record

## Recovered baseline

The previous repository became unavailable with the old GitHub account. Opera's HTTP cache contained three PokéRegions production JavaScript builds; the newest complete one was the 02:30 build.

Recovered matching assets:

- JavaScript: `index-CkLLm7id.js`
- CSS: `index-CoKcXii9.css`
- Cache time: 2026-09-28 02:30
- Product marker in JavaScript: `v0.9.4`

The Chromium simple-cache entries stored the HTTP payload gzip-compressed. The payloads were extracted and preserved in this repository.

## Original extracted payload hashes

Before upload, the extracted cache payloads had these SHA-256 values:

- JavaScript: `0f2a4c155d47de05eadd996f820b9fe8538e1e959dd4811ae1c6f7d5d68a425e`
- CSS: `b43de0091f6fe45df06262136b9d53add6c6cdbf30233b63ef05061e2248813f`

The repository stores the recovered text as normal Git blobs. Browser behavior is the preservation target; line-ending serialization is not treated as source equivalence.

## Important limitation

The production bundle is not the original TypeScript/TSX repository. Minification removed original module boundaries, local symbol names, comments and types.

What we *do* have is the complete deployed v0.9.4 behavior/data bundle and stylesheet, which is enough to:

1. keep a working baseline,
2. inspect exact game behavior,
3. rebuild maintainable source modules,
4. compare the rewrite against the preserved build.

## Clean-source strategy

New readable code belongs under `src/app/`, `src/game/`, `src/data/`, `src/systems/` and related modules.

The recovered bundle stays immutable under `public/recovered/` until the clean rewrite reaches parity.

## 1.0 rebuild

The next milestone is the previously planned roguelike-focused 1.0 Alpha. It deliberately does **not** add a team/build-synergy system.
