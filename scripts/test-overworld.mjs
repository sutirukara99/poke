import { readFile } from "node:fs/promises";
import vm from "node:vm";

const tilesets = await readFile(new URL("./overworld-tilesets.js", import.meta.url), "utf8");
const nativeAssets = await readFile(new URL("./overworld-frlg-native.js", import.meta.url), "utf8");
const mapgen = await readFile(new URL("./overworld-mapgen.js", import.meta.url), "utf8");
const terrain = await readFile(new URL("./overworld-terrain-engine.js", import.meta.url), "utf8");
const source = await readFile(new URL("./overworld-runtime.js", import.meta.url), "utf8");

const context = {
  console,
  Math,
  Set,
  Map,
  JSON,
  String,
  Array,
  Object,
  Number,
  Date,
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  window: { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} },
  Event: class {},
  Image: class {},
  QjourneyState: () => ({ overworld: null }),
  qu: () => true,
  Iy: (node) => node?.id,
  Rc: (node, row) => Math.max(0, row.indexOf(node)),
  X: { useRef: () => ({ current: null }), useEffect() {} },
  l: { jsx() { return null; } },
};

vm.createContext(context);
vm.runInContext(
  tilesets + "\n" + nativeAssets + "\n" + mapgen + "\n" + terrain + "\n" + source + "\n;globalThis.__ow={QowBuild,QowBuildAttempt,QowBuildPokemonAttempt,QowBuildArenaAttempt,QowBuildTownMap,QowNativeReference,QowNativePools,QowTerrainModel,QowTerrainSynthesize,QowTerrainSafeIds,QowValidate,QowFallback,QowTile,QowBlocking,QowVisible,QowReachable,QowTrainerSees,QowSolidEntityAt,QowHasApproach,QowCurrentFlavor,QowEncounterWeight,QowBattleWeather,QowEnsure,QowRouteBiome,QowKey,QowW,QowH,QowActiveTileset,QowNativeFrlgCatalog};",
  context,
  { filename: "overworld-runtime.js" },
);

const ow = context.__ow;
if (!ow) throw new Error("Overworld runtime did not expose validation hooks.");

const tileset = ow.QowActiveTileset;
if (tileset?.id !== "pokeregions-gba") throw new Error("Semantic overworld tileset is missing.");
if (tileset.tileSize !== 16) throw new Error("Overworld tileset must stay on 16px logical tiles.");
if (tileset.semanticMetatiles.path !== 189 || tileset.tiles.path?.metatileId !== 189) {
  throw new Error("Route road must use the corrected FRLG Route 1 path metatile.");
}
if (Buffer.from(tileset.metatilesB64, "base64").length !== 10_240) {
  throw new Error("FRLG primary metatile data is incomplete.");
}
if (!Array.isArray(tileset.palettes) || tileset.palettes.length !== 16 || tileset.palettes.some((p) => p.length !== 16)) {
  throw new Error("FRLG palette reconstruction data is incomplete.");
}
for (const [semantic, id] of Object.entries(tileset.semanticMetatiles)) {
  if (!Number.isInteger(id) || id < 0 || id >= 640) throw new Error("Invalid FRLG metatile mapping for " + semantic);
  if (tileset.tiles[semantic] && tileset.tiles[semantic].metatileId !== id) {
    throw new Error("Semantic tile definition does not match FRLG mapping for " + semantic);
  }
}

const nativeSets = ow.QowNativeFrlgCatalog;
for (const [name, expectedRef] of [["palletTown","route1"],["viridianCity","viridianCity"],["pewterCity","pewterCity"],["ceruleanCity","ceruleanCity"],["viridianForest","viridianForest"],["cave","mtMoon1F"]]) {
  const set = nativeSets?.[name];
  if (!set) throw new Error("Missing native FRLG secondary tileset " + name);
  if (!String(set.tilesDataUri).startsWith("data:image/png;base64,")) throw new Error("Native FRLG tiles are not embedded for " + name);
  if (!Array.isArray(set.palettes) || set.palettes.length !== 16 || set.palettes.some((p) => p.length !== 16)) {
    throw new Error("Native FRLG palette set is incomplete for " + name);
  }
  const refMap = ow.QowNativeReference(name, expectedRef);
  if (!refMap || refMap.blocks.length !== refMap.w * refMap.h) throw new Error("Native map reference failed to decode for " + name);
  const pools = ow.QowNativePools(name, expectedRef);
  if (!pools.passable.length || !pools.blocked.length) throw new Error("Native collision/material pools are empty for " + name);
}


// Texture synthesis must learn reusable outdoor adjacency from Route 1.
{
  const model = ow.QowTerrainModel("palletTown", "route1");
  if (!model || model.byClass.open.length < 5 || model.byClass.blocked.length < 10 || model.byClass.grass.length < 20) {
    throw new Error("Safe reference-driven terrain model did not learn enough Route 1 samples.");
  }
  for (const cls of ["open","blocked","grass"]) {
    for (const candidate of model.byClass[cls]) {
      if (!ow.QowTerrainSafeIds[cls].has(candidate.id)) throw new Error("Unsafe FRLG terrain candidate leaked into " + cls + ": " + candidate.id);
    }
  }
}

const node = (id, kind, biome) => ({
  id,
  kind,
  biome,
  title: kind + "-" + id,
  detail: "test",
});

const makeRun = (seed, region = "kanto", biome = "grassland", difficulty = "normal") => ({
  seed,
  region,
  mode: "story",
  mapIndex: 0,
  step: 0,
  difficulty,
  path: [],
  activeRelics: [],
  route: [[
    node(seed + "-wild", "wild", biome),
    node(seed + "-trainer", "trainer", biome),
    node(seed + "-exit", "city", biome),
  ]],
});

// Regression: a fresh run has journey.overworld === null. QowEnsure must
// return the newly-created state, not the stale null that existed before init.
{
  const fresh = makeRun("ENSURE-FRESH", "johto", "grassland");
  fresh.journey = { overworld: null };
  const state = ow.QowEnsure(fresh);
  if (!state || state !== fresh.journey.overworld || state.pendingNode !== null) {
    throw new Error("QowEnsure returned stale/null overworld state on first initialization.");
  }
}

// Early Johto travel should read as an open Pokémon route rather than being
// globally coerced into a dense forest biome.
{
  const early = makeRun("JOHTO-EARLY-COMPOSITION", "johto", "grassland");
  early.mapIndex = 0;
  const map = ow.QowBuild(early);
  if (map.biome !== "grassland" || map.layoutStyle !== "route" || map.composition !== "early-natural") {
    throw new Error("Early Johto route composition is not calm/open grassland.");
  }
  if (map.visualEngine !== "reference-safe-v5" || map.nativeReference !== "route1") {
    throw new Error("Early Johto route is not textured from the safe Route 1 model.");
  }
  if (map.nativeTiles.filter(Boolean).length < map.nativeTiles.length * 0.2) {
    throw new Error("Early Johto route does not use enough safe native FRLG terrain.");
  }
  if (map.compositionStats.branches !== 1 || map.compositionStats.fields !== 2) {
    throw new Error("Early Johto route should have one side pocket and two encounter fields.");
  }
  if (map.compositionStats.pathCells > map.w * map.h * 0.18) {
    throw new Error("Early Johto route road is too visually dominant.");
  }
  const walkRatio = map.compositionStats.walkableCells / (map.w * map.h);
  if (walkRatio < 0.2 || walkRatio > 0.58) {
    throw new Error("Early Johto route walkable-space ratio is unnatural: " + walkRatio);
  }
}

// Route biome belongs to the location/floor, not whichever destination node
// happens to be first. A city objective on an early Kanto/Johto route must not
// turn the entire field into city/cave terrain.
{
  const kanto = makeRun("BIOME-KANTO", "kanto", "city");
  const johto = makeRun("BIOME-JOHTO", "johto", "mountain");
  if (ow.QowRouteBiome(kanto) !== "grassland" || ow.QowBuild(kanto).biome !== "grassland") {
    throw new Error("Kanto early-route biome is still coupled to destination metadata.");
  }
  if (ow.QowRouteBiome(johto) !== "grassland" || ow.QowBuild(johto).biome !== "grassland") {
    throw new Error("Johto early-route biome is still coupled to destination metadata.");
  }
  if (!String(ow.QowKey(kanto)).startsWith("v5-playable|")) {
    throw new Error("Overworld key version did not invalidate stale saved coordinates.");
  }
}

const makeArenaRun = (seed, step = 0, split = false) => ({
  ...makeRun(seed, "kanto", "city", "normal"),
  arena: {
    step,
    path: [],
    route: split
      ? [[node(seed + "-left", "trainer", "city"), node(seed + "-right", "trainer", "city")], [node(seed + "-leader", "gym", "city")]]
      : [[node(seed + "-trainer", "trainer", "city")], [node(seed + "-leader", "gym", "city")]],
  },
});

const signature = (map) =>
  JSON.stringify({
    key: map.key,
    biome: map.biome,
    weather: map.weather,
    timeOfDay: map.timeOfDay,
    condition: map.condition,
    tiles: map.tiles,
    rooms: map.rooms,
    edges: map.edges,
    destinations: map.destinations.map(({ id, kind, x, y, room }) => ({ id, kind, x, y, room })),
    pickups: map.pickups,
    secrets: map.secrets,
    npcs: map.npcs,
  });

const regions = [
  ["kanto", "grassland"],
  ["johto", "forest"],
  ["hoenn", "coast"],
  ["sinnoh", "snow"],
];

let checked = 0;
let sawMigration = false;
let sawRain = false;
let sawSnow = false;
const signatures = new Set();

for (const [region, biome] of regions) {
  for (let n = 0; n < 30; n += 1) {
    const seed = "CI-" + region + "-" + n;
    const runA = makeRun(seed, region, biome, n % 4 === 0 ? "hard" : "normal");
    const runB = structuredClone(runA);
    const mapA = ow.QowBuild(runA);
    const mapB = ow.QowBuild(runB);
    const mapCached = ow.QowBuild(runA);
    if (mapCached !== mapA) {
      throw new Error("Floor cache did not reuse deterministic map for " + seed);
    }

    if (!ow.QowValidate(mapA)) {
      throw new Error("Invalid floor generated for " + seed);
    }
    if (!["route","forest","cave","coast","mountain"].includes(mapA.layoutStyle)) {
      throw new Error("Floor did not use Pokémon-style archetype generator for " + seed + ": " + mapA.layoutStyle);
    }
    if (mapA.generationVersion !== 5) {
      throw new Error("Floor is not using playable overworld generation v5 for " + seed);
    }
    if (!["early-natural","natural-route"].includes(mapA.composition)) {
      throw new Error("Floor has no natural composition profile for " + seed);
    }
    if (!["reference-safe-v5","semantic-safe-v5"].includes(mapA.visualEngine)) {
      throw new Error("Floor did not use the collision-safe visual engine for " + seed + ": " + mapA.visualEngine);
    }
    if (!mapA.compositionStats || mapA.compositionStats.branches < 1 || mapA.compositionStats.branches > 2 || mapA.compositionStats.fields < 2) {
      throw new Error("Floor composition stats are invalid for " + seed);
    }
    if (["route","forest"].includes(mapA.layoutStyle) && mapA.compositionStats.pathCells > mapA.w * mapA.h * 0.22) {
      throw new Error("Route road expanded into a giant floor carpet for " + seed + ": " + mapA.compositionStats.pathCells);
    }
    if (!Array.isArray(mapA.features) || mapA.features.length < 1 || mapA.features.some((f) => !f.id || !Number.isInteger(f.cells) || f.cells < 1)) {
      throw new Error("Floor has no authored scenery features for " + seed);
    }
    if (!mapA.nativeTheme || !ow.QowNativeFrlgCatalog[mapA.nativeTheme]) {
      throw new Error("Floor did not select a native FRLG visual theme for " + seed);
    }
    if (!Array.isArray(mapA.nativeTiles) || mapA.nativeTiles.length !== mapA.w * mapA.h) {
      throw new Error("Floor native visual buffer is malformed for " + seed);
    }
    const nativeCount = mapA.nativeTiles.filter(Boolean).length;
    if (mapA.nativeReference === "route1" && nativeCount < mapA.nativeTiles.length * 0.2) {
      throw new Error("Safe Route 1 synthesis covers too little of the field for " + seed + ": " + nativeCount);
    }
    if (mapA.nativeReference !== "route1" && nativeCount !== 0) {
      throw new Error("Non-Route1 floor should use semantic-safe rendering until a curated native model exists for " + seed);
    }
    if (mapA.nativeTiles.some((v) => v && v.set !== mapA.nativeTheme)) {
      throw new Error("Field mixes incompatible native tilesets for " + seed);
    }
    if (signature(mapA) !== signature(mapB)) {
      throw new Error("Seed determinism failed for " + seed);
    }
    if (ow.QowBlocking(ow.QowTile(mapA, mapA.spawn.x, mapA.spawn.y))) {
      throw new Error("Player spawn is blocked for " + seed);
    }

    const reachable = ow.QowReachable(mapA, mapA.spawn.x, mapA.spawn.y);
    for (const target of mapA.destinations) {
      if (!reachable.has(target.x + "," + target.y)) {
        throw new Error("Destination " + target.id + " is unreachable for " + seed);
      }
      if (target.kind !== "wild" && !ow.QowHasApproach(mapA, target, reachable)) {
        throw new Error("Destination " + target.id + " has no usable interaction approach for " + seed);
      }
      const solid = ow.QowSolidEntityAt(mapA, target.x, target.y, { defeatedTrainers: [] });
      if (target.kind === "wild" ? solid : !solid) {
        throw new Error("Unexpected physical collision semantics for " + target.id + " in " + seed);
      }
    }
    for (const pickup of mapA.pickups) {
      if (!reachable.has(pickup.x + "," + pickup.y)) {
        throw new Error("Pickup " + pickup.id + " is unreachable for " + seed);
      }
    }
    for (const secret of mapA.secrets ?? []) {
      if (!reachable.has(secret.x + "," + secret.y)) {
        throw new Error("Secret room " + secret.id + " is unreachable for " + seed);
      }
      if (!(mapA.pickups ?? []).some((pickup) => pickup.room === secret.room && pickup.secret)) {
        throw new Error("Secret room has no secret pickup for " + seed);
      }
    }
    for (const npc of mapA.npcs ?? []) {
      if (!reachable.has(npc.x + "," + npc.y)) {
        throw new Error("Ambient NPC " + npc.id + " is unreachable for " + seed);
      }
      if (!ow.QowHasApproach(mapA, npc, reachable)) {
        throw new Error("Ambient NPC " + npc.id + " cannot be approached for " + seed);
      }
      if (!ow.QowSolidEntityAt(mapA, npc.x, npc.y, { defeatedTrainers: [] })) {
        throw new Error("Ambient NPC " + npc.id + " is not physically solid for " + seed);
      }
      if (!npc.dialogue) throw new Error("Ambient NPC has no dialogue for " + seed);
    }
    if (!["clear", "rain", "snow", "mist"].includes(mapA.weather)) {
      throw new Error("Unknown weather for " + seed + ": " + mapA.weather);
    }
    if (!["day", "dusk", "night"].includes(mapA.timeOfDay)) {
      throw new Error("Unknown time-of-day for " + seed + ": " + mapA.timeOfDay);
    }

    const flavor = ow.QowCurrentFlavor(runA);
    if (flavor.weather !== mapA.weather || flavor.timeOfDay !== mapA.timeOfDay || flavor.condition !== mapA.condition || flavor.biome !== mapA.biome) {
      throw new Error("Encounter flavor diverges from rendered floor for " + seed);
    }
    const expectedBattleWeather = mapA.weather === "rain" ? "rain" : mapA.weather === "snow" ? "hail" : null;
    if (ow.QowBattleWeather(runA) !== expectedBattleWeather) {
      throw new Error("Battle weather diverges from overworld weather for " + seed);
    }
    if (mapA.condition === "migration") {
      sawMigration = true;
      const rare = ow.QowEncounterWeight(runA, { rarity: "rare", types: ["normal"] });
      const common = ow.QowEncounterWeight(runA, { rarity: "common", types: ["normal"] });
      if (!(rare > common)) throw new Error("Migration does not favor rare encounters for " + seed);
    }
    if (mapA.weather === "rain") {
      sawRain = true;
      if (!(ow.QowEncounterWeight(runA, { rarity: "common", types: ["water"] }) > ow.QowEncounterWeight(runA, { rarity: "common", types: ["normal"] }))) {
        throw new Error("Rain does not favor Water encounters for " + seed);
      }
    }
    if (mapA.weather === "snow") {
      sawSnow = true;
      if (!(ow.QowEncounterWeight(runA, { rarity: "common", types: ["ice"] }) > ow.QowEncounterWeight(runA, { rarity: "common", types: ["normal"] }))) {
        throw new Error("Snow does not favor Ice encounters for " + seed);
      }
    }

    const visible = ow.QowVisible(mapA.spawn.x, mapA.spawn.y, 5, mapA.w, mapA.h);
    if (!visible.includes(mapA.spawn.x + "," + mapA.spawn.y)) {
      throw new Error("Fog visibility excludes spawn for " + seed);
    }

    signatures.add(signature(mapA));
    checked += 1;
  }
}

if (signatures.size < checked * 0.8) {
  throw new Error("Generator variety too low: " + signatures.size + "/" + checked + " unique floors");
}

if (!sawMigration) throw new Error("Seed suite never exercised migration encounter weighting.");
if (!sawRain) throw new Error("Seed suite never exercised rain encounter weighting.");
if (!sawSnow) throw new Error("Seed suite never exercised snow encounter weighting.");

const townA = ow.QowBuildTownMap(makeRun("TOWN-A","kanto","grassland"));
const townB = ow.QowBuildTownMap(makeRun("TOWN-A","kanto","grassland"));
if (townA.layoutStyle !== "town" || townA.w < 30 || townA.h < 20 || townA.generationVersion !== 2) throw new Error("Procedural town archetype is missing.");
if (!Array.isArray(townA.features) || townA.features.length < 3) throw new Error("Town authored scenery pass is missing.");
if (JSON.stringify(townA.tiles) !== JSON.stringify(townB.tiles) || JSON.stringify(townA.nativeTiles) !== JSON.stringify(townB.nativeTiles)) {
  throw new Error("Procedural town is not deterministic.");
}
if (!townA.nativeTiles.some((v) => ["viridianCity","pewterCity","ceruleanCity"].includes(v?.set)) || !townA.nativeTiles.some((v) => v?.set === "palletTown")) {
  throw new Error("Town does not combine original FRLG city/residential building stamps.");
}
if (!["viridianCity","pewterCity","ceruleanCity"].includes(townA.nativeTheme)) throw new Error("Town native city theme is invalid.");
for (const p of [townA.landmarks.center,townA.landmarks.mart,townA.spawn]) {
  if (!p || ow.QowBlocking(ow.QowTile(townA,p.x,p.y))) throw new Error("Town landmark approach is blocked.");
}
if (!Array.isArray(townA.services) || !townA.services.some((s) => s.id === "center") || !townA.services.some((s) => s.id === "mart")) {
  throw new Error("Randomized town services are not anchored to generated landmarks.");
}

for (let n = 0; n < 24; n += 1) {
  const split = n % 2 === 0;
  const step = n % 3 === 0 ? 1 : 0;
  const run = makeArenaRun("ARENA-" + n, step, split);
  const map = ow.QowBuild(run);
  if (!map.arena) throw new Error("Arena run did not use arena generator.");
  if (!ow.QowValidate(map)) throw new Error("Arena floor validation failed for " + run.seed);
  if (map.weather !== "clear" || map.timeOfDay !== "day" || map.condition !== "patrol") {
    throw new Error("Arena floor flavor is not deterministic indoor state for " + run.seed);
  }
  const expectedChoices = run.arena.route[step].length;
  if (map.destinations.length !== expectedChoices) {
    throw new Error("Arena destination count mismatch for " + run.seed);
  }
  const reachable = ow.QowReachable(map, map.spawn.x, map.spawn.y);
  for (const target of map.destinations) {
    if (!ow.QowHasApproach(map, target, reachable)) {
      throw new Error("Arena target cannot be approached for " + run.seed);
    }
  }
}

// Trainer line of sight must respect both facing and collision.
{
  const map = ow.QowFallback(makeRun("LOS", "kanto", "grassland"));
  const trainer = { kind: "trainer", x: 22, y: 12, facing: "down" };
  for (let y = 13; y <= 16; y += 1) map.tiles[y * map.w + 22] = "path";
  if (!ow.QowTrainerSees(map, trainer, 22, 15)) {
    throw new Error("Trainer line-of-sight failed on a clear path.");
  }
  map.tiles[14 * map.w + 22] = "wall";
  if (ow.QowTrainerSees(map, trainer, 22, 15)) {
    throw new Error("Trainer line-of-sight ignores blocking terrain.");
  }
}

console.log("Overworld generator validation passed (" + checked + " seeded floors, " + signatures.size + " unique).");
