# PokéRegions Overworld Engine

## Product contract

PokéRegions is a Pokémon-style free-roam roguelike. The player spends the active run inside a tile-based world, not on a visible node graph or web dashboard. Existing battle, catch, inventory, PC, relic, class, achievement, account and cloud systems remain game services behind the overworld.

The visible run loop is:

```text
Starter
  -> seeded field floor
  -> explore / tall grass / trainers / loot / NPCs / secrets
  -> physically reach a route destination
  -> battle / service / event interaction
  -> return to the same world when appropriate
  -> next generated floor
  -> walkable town / arena stages / boss milestones
```

Maintenance mode stays enabled while the new engine is being manually playtested.

## Runtime architecture

```text
Recovered Alpha Client
├── existing run / battle / inventory / progression backend
└── Overworld
    ├── scripts/overworld-tilesets.js
    │   ├── semantic tile catalog
    │   ├── FRLG metatile mappings
    │   └── local object-sprite catalog
    ├── scripts/overworld-frlg-native.js
    │   ├── embedded original FRLG secondary tilesets
    │   ├── original map block references
    │   └── palette / metatile source data
    ├── scripts/overworld-mapgen.js
    │   ├── natural route / forest / coast / mountain / cave topology
    │   ├── macro waypoints + clearings + side pockets
    │   ├── grass fields / landmarks / objective placement
    │   ├── procedural town layout + building stamps
    │   └── native FRLG primary + secondary metatile renderer
    ├── scripts/overworld-terrain-engine.js
    │   ├── learns adjacency from original FRLG reference maps
    │   ├── filters one-off map objects out of terrain synthesis
    │   ├── preserves real horizontal / vertical metatile pairings
    │   └── paints coherent native visual terrain over logical collision
    ├── scripts/overworld-runtime.js
    │   ├── deterministic RNG
    │   ├── arena generator + generator integration
    │   ├── regional geometry / floor flavor
    │   ├── biome painter
    │   ├── collision / entity collision
    │   ├── visibility / fog
    │   ├── trainer line of sight
    │   ├── floor flavor / encounter weighting
    │   ├── validation + safe fallback
    │   ├── LRU-style floor cache
    │   └── Canvas 2D renderer
    ├── scripts/overworld-reducer.js
    │   ├── movement
    │   ├── danger / wild encounters
    │   ├── pickups / secret rewards
    │   ├── NPC interaction
    │   └── destination interaction
    ├── scripts/overworld-component.js
    │   ├── Canvas host
    │   ├── compact HUD / quest ticker
    │   ├── held-key input
    │   ├── touch D-pad
    │   └── F2 developer overlay
    └── scripts/overworld-city.js
        ├── walkable town
        ├── Pokémon Center interior
        ├── PokéMart interior
        ├── physical PC / Nurse / Tutor / Quest Board
        └── city service overlays
```

React is intentionally not the tile renderer. The world is one Canvas surface; React is reserved for UI, menus and integration with the recovered client.

## Floor identity and caching

A field key is derived from:

```text
run seed
+ region
+ mode
+ map index
+ route step
+ arena step
+ difficulty
+ debug generation salt
+ selected route path
```

The same run state always produces the same floor. The generator may retry invalid candidates with deterministic attempt salts; after the retry budget it returns a guaranteed-safe fallback floor.

Generated floors are cached by the deterministic key. Re-rendering or moving does not regenerate the room graph. The cache keeps a bounded set of recent floors; the F2 `REGEN` command changes the debug salt and therefore intentionally creates a new floor.

## Field generator

Normal outdoor floors use the **Natural Overworld Engine v4**. The map is generated as a logical landscape first and textured from original FRLG reference-map adjacency afterwards.

The pipeline is:

1. derive the deterministic floor seed
2. choose biome, weather, time and floor condition
3. choose the archetype: **route / forest / coast / mountain / cave**
4. fill the floor with its natural blocking mass (trees, rock, water or cave wall)
5. carve one readable main route through that mass using macro waypoints
6. widen selected bends into authored clearings instead of opening the whole map
7. attach one side pocket on early routes and up to two on later routes
8. place coherent tall-grass fields beside the travel line
9. place optional landmarks such as ponds or rock outcrops
10. place objectives, NPCs and pickups only after topology is complete
11. build a visual model from a real FRLG reference map
12. synthesize native metatiles using reference neighborhood and original horizontal/vertical adjacency
13. render explicit road/water/sand/snow tiles through the semantic fallback where needed
14. BFS-validate spawn, destinations, NPC approaches and pickups
15. accept, retry, or use the guaranteed-safe fallback

The important rule is that randomness changes **composition**, not individual visual noise. A route should read as a designed Pokémon map: blocked natural mass, one primary line of travel, optional side content, then decoration.

For ordinary outdoor routes the texture reference is **FireRed/LeafGreen Route 1** instead of city maps. This prevents roofs, walls or unrelated city metatiles from leaking into fields. Forest and cave archetypes use their dedicated native references.

The native atlas also distinguishes primary and secondary palette ownership: General/primary metatiles use the primary palette set, while secondary palette slots use the selected secondary tileset.


### Regional geometry

Region identity changes geometry, biome pressure and the selected native FRLG visual theme:

- **Kanto:** classic balanced routes with Pallet/Viridian-style visuals.
- **Johto:** denser forest language, more enclosed green pockets and Viridian-style town palettes.
- **Hoenn:** wider coastal flow, lagoons/water pressure and brighter Cerulean-derived city palettes.
- **Sinnoh:** tighter mountain/snow corridors, rocky chicanes and Pewter/Viridian-derived palettes.

All four remain generated from the run seed; the regional theme changes the composition rules rather than simply recoloring one shared map.

## Arena generator

Arena stages do not reuse normal route geometry. They use dedicated indoor templates:

- entrance/spawn at the bottom
- central progression corridor
- physical split wings when the arena route offers two choices
- trainer rooms at the end of each wing
- a larger centered final room for the Gym Leader
- indoor fixed flavor: day / clear / trainer patrol

The existing arena progression backend remains intact; only the visible travel layer is replaced.

## World state

The active run persists exploration state under `journey.overworld`.

```ts
{
  mapKey: string,
  x: number,
  y: number,
  prevX: number,
  prevY: number,
  facing: "up" | "down" | "left" | "right",
  steps: number,
  danger: number,
  seen: string[],
  picked: string[],
  defeatedTrainers: string[],
  pendingNode: string | null,
  encounterOnly: boolean,
  debugSalt: number,
  lastMessage: string
}
```

Old runs are migrated lazily by `QowEnsure`; existing Pokémon, items, money, badges, relics, PC, class and account state are not replaced.

## Movement and physical world rules

- WASD and arrow keys are held-key controls.
- E / Enter / Space interacts.
- M / Escape opens the existing game menu.
- F2 toggles developer tools.
- Coarse-pointer devices get an on-screen D-pad + A/Menu controls.
- Movement is logical tile-by-tile with a short Canvas tween.
- Trainer sprites use directional walk frames and return to idle.
- The lead Pokémon trails the previous player tile.
- Terrain collision and entity collision are separate: players cannot walk through trainers, NPCs or service objects.
- Solid entities must have at least one reachable adjacent interaction tile or the floor is rejected.
- Trainers use directional line of sight; walls and blocking terrain stop detection.

## Encounters and floor flavor

Each non-arena floor deterministically receives:

- time: day / dusk / night
- weather: clear / rain / snow / mist
- condition: quiet / dense / migration / patrol / rich

These are gameplay data, not only visual effects.

- Dense floors increase grass density and favor Bug/Grass/Poison encounters.
- Migration strongly raises Rare and Uncommon encounter weighting.
- Night favors Dark/Ghost/Poison types.
- Rain favors Water/Electric types and becomes Rain in battle.
- Snow favors Ice/Steel types and becomes Hail in battle.
- Mist favors Psychic/Ghost/Fairy types.
- Rich floors can produce more physical pickups.

Tall grass uses a rising danger meter instead of a fixed independent roll every step. Incidental grass battles set `encounterOnly`; winning returns to the exact same floor and position rather than consuming the route decision.

## Towns and services

A city destination no longer opens the old four-button dashboard.

The city is a walkable, deterministic generated tile scene built from original FRLG town map blocks and building stamps. Center, Mart, Gym-decoration and a residential building are placed around a generated plaza, with paths, gardens, park/grass pockets, a pond and tree clusters.

The city contains:

- Pokémon Center entrance
- PokéMart entrance
- PC terminal
- Move Tutor
- Quest Board
- physical route exit

The Pokémon Center and PokéMart have separate walkable interiors. The Nurse heals through the existing backend; the Center PC opens the existing PC system. The Mart requires walking to the clerk before its purchase overlay opens. The Quest Board shows current mission progress and can request another mission.

Large legacy world/quest dashboards are hidden during exploration and service interactions. One compact active quest is shown in the overworld command bar.

## Rendering

Logical tile size is 16 px. The main world renders internally at 480×320 and scales with `image-rendering: pixelated`.

Core outdoor terrain uses the locally embedded FireRed/LeafGreen decomp source correctly. The browser reconstructs 16×16 metatiles from the original 4-bpp grayscale tile sheets, primary and secondary `metatiles.bin` data and the matching 16-color palettes.

The generator also embeds original FRLG map block references (Route 1, Pallet Town, Viridian City, Pewter City, Cerulean City, Viridian Forest and Mt. Moon) and samples/stamps those blocks into generated layouts. Critical movement lanes remain governed by logical collision tiles, so original visual assets can be used without sacrificing deterministic path validation.

Unsupported semantic cases still have the procedural GBA-style fallback renderer; the raw decomp sheets are never treated as a CSS sprite atlas.

Existing local FRLG object sprites are used for trainer, NPC, Nurse, Item Ball and sign actors. Abstract route punctuation has been replaced by physical-world cues: rustling grass, signs, sprites, arena signage and legendary ground shimmer.

## UI and transitions

- The legacy journey banner/progress strip is hidden whenever the Canvas world is active.
- The old world-info and quest dashboards are hidden during active exploration.
- Battle entry gets a short visible transition before the battle phase changes.
- Returning to the world uses a short reverse-style reveal.
- Non-battle route interactions hide the party/dashboard chrome and use a focused game window.
- Reduced-motion preferences disable transition animation.
- F2 shows coordinates, FPS, current tile, RNG, seed, floor key, biome/flavor, generator attempt, room/target counts, danger and visibility.
- F2 tools: reveal map, force wild encounter, teleport to main target, regenerate floor.

## Validation contract

Every generated field must satisfy:

- spawn is walkable
- useful reachable area exists
- every destination is reachable
- every solid destination has a reachable interaction approach
- every pickup is reachable
- every ambient NPC is reachable, solid and interactable
- every generated secret room has a secret pickup
- terrain blocks pathfinding and trainer sight correctly
- floor flavor and encounter flavor remain identical
- battle weather matches overworld rain/snow
- identical seeds are deterministic
- repeated builds reuse the deterministic floor cache

`npm run test:overworld` validates 120 seeded field floors across Kanto, Johto, Hoenn and Sinnoh plus dedicated arena templates. It checks the original FRLG primary/secondary data, native reference maps, authored feature grammar, region theme selection, deterministic town generation/building stamps, collision semantics, secret rooms, NPC dialogue, regional flavor, migration/rain/snow encounter weighting, trainer sight and cache reuse.

## Integration rule

The old route graph may continue to exist internally as a content/progression backend, but it must never be the primary player-facing travel surface. Route choices are translated into physical world destinations. Node-map UI and node terminology must not reappear in the run experience.

## Engine definition of done

The engine layer is considered mechanically stable when:

- TypeScript passes
- recovery verification passes
- generated alpha JavaScript syntax passes
- alpha smoke checks pass
- seeded field + arena validation passes
- Vite production build passes
- maintenance mode remains enabled until manual playtest signs off

Remaining follow-up work should build on this engine rather than create another travel layer. Examples: more building interiors, richer region-specific tilesets, additional arena puzzle templates, overworld audio/footsteps and deeper NPC schedules.
