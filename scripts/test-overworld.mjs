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
  tilesets + "\n" + source + "\n;globalThis.__ow={QowBuild,QowBuildAttempt,QowValidate,QowFallback,QowTile,QowBlocking,QowVisible,QowReachable,QowTrainerSees,QowW,QowH,QowActiveTileset};",
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
      if (!npc.dialogue) throw new Error("Ambient NPC has no dialogue for " + seed);
    }
    if (!["clear", "rain", "snow", "mist"].includes(mapA.weather)) {
      throw new Error("Unknown weather for " + seed + ": " + mapA.weather);
    }
    if (!["day", "dusk", "night"].includes(mapA.timeOfDay)) {
      throw new Error("Unknown time-of-day for " + seed + ": " + mapA.timeOfDay);
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
