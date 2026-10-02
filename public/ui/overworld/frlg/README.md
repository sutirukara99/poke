# FireRed/LeafGreen Overworld Assets

These pixel assets and reconstruction data are sourced from the public `pret/pokefirered` decompilation repository and are used by PokéRegions for its fan-made free-roam overworld.

## Local object / primary sources

- `data/tilesets/primary/general/tiles.png`
- `data/tilesets/primary/general/metatiles.bin`
- General palette data
- `graphics/object_events/pics/people/red_normal.png`
- `graphics/object_events/pics/people/youngster.png`
- `graphics/object_events/pics/people/hiker.png`
- `graphics/object_events/pics/people/nurse.png`
- `graphics/object_events/pics/misc/item_ball.png`
- `graphics/object_events/pics/misc/sign.png`
- `graphics/object_events/pics/misc/gym_sign.png`
- `graphics/object_events/pics/misc/rock_smash_rock.png`

## Native secondary map reconstruction

`scripts/overworld-frlg-native.js` embeds the original secondary tiles, metatiles, palettes and selected reference-map block data required to reconstruct authentic FRLG scenery in the Canvas renderer. Current sources include:

- `data/tilesets/secondary/pallet_town` + Pallet Town / Route 1 layout data
- `data/tilesets/secondary/viridian_city` + Viridian City layout data
- `data/tilesets/secondary/pewter_city` + Pewter City layout data
- `data/tilesets/secondary/cerulean_city` + Cerulean City layout data
- `data/tilesets/secondary/viridian_forest` + Viridian Forest layout data
- `data/tilesets/secondary/cave` + Mt. Moon 1F layout data

The game does not treat the raw tile PNGs as CSS sprite sheets. It reconstructs 16×16 metatiles from the original 8×8 tile descriptors, flip flags, palette index and primary/secondary tile source, then composes deterministic generated maps from those authentic materials.

Pokémon, Pokémon character names, game graphics and related assets are trademarks/copyright of Nintendo, Creatures Inc. and GAME FREAK inc. PokéRegions is a fan project and does not claim ownership of these assets.
