import { readFile } from "node:fs/promises";
import vm from "node:vm";

const tilesets = await readFile(new URL("./overworld-tilesets.js", import.meta.url), "utf8");
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
  tilesets + "\n" + source + "\n;globalThis.__ow={QowBuild,QowBuildAttempt,QowBuildArenaAttempt,QowValidate,QowFallback,QowTile,QowBlocking,QowVisible,QowReachable,QowTrainerSees,QowSolidEntityAt,QowHasApproach,QowCurrentFlavor,QowEncounterWeight,QowBattleWeather,QowW,QowH,QowActiveTileset};",
  context,
  { filename: "overworld-runtime.js" },
);

const ow = context.__ow;
if (!ow) throw new Error("Overworld runtime did not expose validation hooks.");

const tileset = ow.QowActiveTileset;
if (tileset?.id !== "pokeregions-gba") throw new Error("Semantic overworld tileset is missing.");
if (tileset.tileSize !== 16) throw new Error("Overworld tileset must stay on 16px logical tiles.");
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

    if (!ow.QowValidate(mapA)) {
      throw new Error("Invalid floor generated for " + seed);
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
