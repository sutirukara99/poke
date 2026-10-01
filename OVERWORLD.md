# PokéRegions Overworld Engine

## Product contract

PokéRegions is a Pokémon-style free-roam roguelike. The player should spend the run inside a tile-based world, not on a visible node graph or web dashboard. Existing battle, catch, inventory, PC, relic, class, achievement, account and cloud systems remain game services behind the overworld.

The visible run loop is:

```text
Starter
  -> seeded field floor
  -> explore / grass / trainers / loot / events
  -> physical exit or destination
  -> existing battle / service / event resolution
  -> return to the same world when appropriate
  -> next generated floor
  -> town / gym / boss milestones
```

Maintenance mode stays enabled while this engine is being validated.

## Runtime architecture

```text
Recovered Alpha Client
├── existing run / battle / inventory / progression backend
└── Overworld
    ├── scripts/overworld-runtime.js
    │   ├── deterministic RNG
    │   ├── logical room graph
    │   ├── biome painter
    │   ├── collision
    │   ├── visibility / fog
    │   ├── trainer line of sight
    │   ├── validation + fallback
    │   └── Canvas 2D renderer
    ├── scripts/overworld-reducer.js
    │   ├── movement
    │   ├── danger / wild encounters
    │   ├── pickups
    │   └── destination interaction
    └── scripts/overworld-component.js
        ├── Canvas host
        ├── compact HUD
        ├── held-key input
        └── F2 debug overlay
```

React is intentionally not the tile renderer. The game world is one Canvas surface; React is reserved for UI and integration with the recovered client.

## Floor identity

A floor key is derived from:

```text
run seed
+ region
+ mode
+ map index
+ route step
+ arena step
+ difficulty
```

The same state must always produce the same floor. The generator may retry invalid candidates with deterministic attempt salts. After the retry budget is exhausted it produces a guaranteed-safe fallback floor.

## Generator pipeline

1. derive floor seed
2. select the current region/biome identity
3. construct a connected logical room graph
4. place rooms on the logical grid with seeded variation
5. carve corridors and occasional loops
6. paint each room from the biome profile
7. translate current roguelike route choices into physical destinations
8. place optional pickup rooms
9. clear the spawn area
10. BFS-validate spawn, destinations and pickups
11. accept, retry, or use the safe fallback

The graph is never shown to the player.

## World state

The active run persists overworld state under `journey.overworld`.

```ts
{
  mapKey: string,
  x: number,
  y: number,
  facing: "up" | "down" | "left" | "right",
  steps: number,
  danger: number,
  grassSteps: number,
  seen: string[],
  picked: string[],
  defeatedTrainers: string[],
  pendingNode: string | null,
  encounterOnly: boolean,
  lastMessage: string
}
```

Old runs are migrated lazily by `QowEnsure`; existing Pokémon, items, money, badges, relics, PC, class and account state are not replaced.

## Movement and encounters

- WASD and arrow keys are held-key controls.
- E / Enter / Space interacts.
- M / Escape opens the existing game menu.
- F2 toggles the developer overlay.
- Collision is tile-defined.
- The logical position advances tile-by-tile; the Canvas renderer tweens between positions.
- Tall grass uses a danger meter rather than an independent fixed roll every step.
- A grass encounter marks itself `encounterOnly`, so winning returns to the same floor and position instead of consuming the route step.
- Trainers use directional line of sight and blocking terrain.

## Rendering

Logical tile size is 16 px. The internal Canvas is 480×320 and scales with `image-rendering: pixelated`.

Core outdoor terrain now uses the locally hosted FireRed/LeafGreen decomp source correctly: the browser reconstructs 16×16 metatiles from the original 4-bpp grayscale tile sheet, the primary `metatiles.bin` data and all 16 General palettes. Semantic terrain IDs such as ground, path, tall grass, water and sand map to explicit metatile IDs. Biomes without a suitable General metatile use the procedural GBA-style fallback renderer instead of abusing the raw sheet as a CSS atlas.

Existing locally hosted FRLG object sprites are used for the trainer, NPC and item actors. There is no runtime dependency on an external sprite host for the overworld.

## Region identity

The generator supports region-biased biome behavior rather than only palette filters:

- Kanto: classic grassland/route baseline.
- Johto: forest bias and denser natural rooms.
- Hoenn: coast/water bias.
- Sinnoh: mountain/snow bias.

The runtime also supports cave, city, ruins, volcano, marsh, night and generic grassland profiles.

## Validation contract

Every generated floor must satisfy:

- spawn is walkable
- useful reachable area exists
- every physical destination is reachable
- every pickup is reachable
- blocking terrain blocks pathfinding and trainer sight
- identical seeds are deterministic

`npm run test:overworld` currently validates 120 seeded floors across the four regions, checks deterministic output, connectivity, pickups, fog visibility and trainer line of sight.

## Integration rule

The old route graph may continue to exist internally as a content/progression backend, but it must never be the primary player-facing travel surface. Route choices are translated into physical objects/areas in the floor. Node terminology and node-map UI must not reappear in the run experience.

## Definition of done for the engine layer

The engine layer is considered stable when:

- TypeScript passes
- recovery verification passes
- alpha build/syntax/smoke checks pass
- overworld generator validation passes
- Vite production build passes
- maintenance mode remains enabled for manual playtest

Further content milestones (town interiors, gym dungeon templates, richer NPC schedules, weather/audio, dedicated tileset metadata and mobile controls) should be implemented on top of this engine rather than by adding another travel UI.
