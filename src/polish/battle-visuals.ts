import { readLocalSaveObject } from "../cloud/supabase";

const SHOWDOWN = "https://play.pokemonshowdown.com";

type RegionKey = "kanto" | "johto" | "hoenn" | "sinnoh";

const REGION_LABELS: Record<RegionKey, string> = {
  kanto: "KANTO · GEN I",
  johto: "JOHTO · GEN II",
  hoenn: "HOENN · GEN III",
  sinnoh: "SINNOH · GEN IV",
};

const TYPE_ASSETS: Record<string, string> = {
  normal: "impact.png",
  fire: "fireball.png",
  water: "waterwisp.png",
  electric: "lightning.png",
  grass: "leaf1.png",
  ice: "iceball.png",
  fighting: "fist.png",
  poison: "poisonwisp.png",
  psychic: "mistball.png",
  ground: "rocks.png",
  rock: "rock1.png",
  flying: "feather.png",
  bug: "web.png",
  ghost: "shadowball.png",
  dark: "blackwisp.png",
  dragon: "flareball.png",
  steel: "gear.png",
  fairy: "shine.png",
};

const MOVE_ASSETS: Array<[RegExp, string]> = [
  [/(thunderbolt|thunder|thunder-wave|volt|spark)/, "lightning.png"],
  [/(flamethrower|fire-blast|ember|flame|fire-punch)/, "fireball.png"],
  [/(overheat|flare-blitz)/, "flareball.png"],
  [/(shadow-ball|shadow)/, "shadowball.png"],
  [/(energy-ball|solar-beam)/, "energyball.png"],
  [/(razor-leaf|leaf-blade|vine-whip)/, "leaf1.png"],
  [/(ice-beam|aurora-beam)/, "iceball.png"],
  [/(ice-shard|icicle)/, "icicle.png"],
  [/(water-pulse|hydro-pump|aqua|surf)/, "waterwisp.png"],
  [/(psychic|psybeam|confusion)/, "mistball.png"],
  [/(rock-slide|stone-edge|rock-throw)/, "rocks.png"],
  [/(slash|cut|night-slash|air-slash)/, "leftslash.png"],
  [/(bite|crunch)/, "topbite.png"],
  [/(close-combat|brick-break|punch|force-palm)/, "fist.png"],
  [/(metal-claw|iron-head|gyro-ball)/, "gear.png"],
];

const getRun = () => {
  const save = readLocalSaveObject();
  if (!save || !save.run || typeof save.run !== "object") return null;
  return save.run as Record<string, unknown>;
};

const getRegion = (): RegionKey | null => {
  const run = getRun();
  const region = typeof run?.region === "string" ? run.region.toLowerCase() : "";
  return ["kanto", "johto", "hoenn", "sinnoh"].includes(region)
    ? (region as RegionKey)
    : null;
};

const getMapIndex = () => {
  const run = getRun();
  return typeof run?.mapIndex === "number" ? run.mapIndex : 0;
};

const getBattleKind = () => {
  const run = getRun();
  const battle =
    run?.battle && typeof run.battle === "object"
      ? (run.battle as Record<string, unknown>)
      : null;
  return typeof battle?.kind === "string" ? battle.kind : "";
};

const getTerrain = (field: HTMLElement, region: RegionKey | null) => {
  if (region === "sinnoh" && getMapIndex() === 6) return "snow";
  if (field.classList.contains("battle-theme-water")) return "water";
  if (field.classList.contains("battle-theme-cave")) return "cave";
  if (field.classList.contains("battle-theme-arena")) return "arena";
  return "grass";
};

const animateBattleSprite = (img: HTMLImageElement) => {
  if (img.dataset.prAnimated === "1") return;

  const source = img.currentSrc || img.src;
  const match = source.match(/\/([^/]+)\.png(?:\?.*)?$/i);
  if (!match) return;

  const slug = match[1];
  const player = img.classList.contains("player-sprite");
  const shiny = source.includes("shiny");
  const folder = player
    ? shiny
      ? "ani-back-shiny"
      : "ani-back"
    : shiny
      ? "ani-shiny"
      : "ani";

  const animated = `${SHOWDOWN}/sprites/${folder}/${slug}.gif`;
  img.dataset.prAnimated = "1";
  img.dataset.prStaticSrc = source;

  img.addEventListener(
    "error",
    () => {
      if (img.src === animated && img.dataset.prStaticSrc) {
        img.src = img.dataset.prStaticSrc;
      }
    },
    { once: true },
  );

  img.src = animated;
};

const typeFromFx = (fx: HTMLElement) => {
  for (const className of fx.classList) {
    if (
      className.startsWith("fx-") &&
      className !== "fx-player" &&
      className !== "fx-enemy"
    ) {
      return className.slice(3);
    }
  }
  return "normal";
};

const moveFromFx = (fx: HTMLElement) => {
  for (const className of fx.classList) {
    if (className.startsWith("move-fx-")) return className.slice(8);
  }
  return "";
};

const assetForFx = (fx: HTMLElement) => {
  const move = moveFromFx(fx);
  if (move) {
    const matched = MOVE_ASSETS.find(([pattern]) => pattern.test(move));
    if (matched) return matched[1];
  }
  return TYPE_ASSETS[typeFromFx(fx)] ?? "impact.png";
};

const enhanceAttackFx = (fx: HTMLElement) => {
  if (fx.dataset.prEnhanced === "1") return;
  fx.dataset.prEnhanced = "1";

  const asset = document.createElement("img");
  asset.className = "pr-attack-asset";
  asset.alt = "";
  asset.setAttribute("aria-hidden", "true");
  asset.src = `${SHOWDOWN}/fx/${assetForFx(fx)}`;
  asset.addEventListener(
    "error",
    () => {
      asset.remove();
    },
    { once: true },
  );
  fx.append(asset);

  const impact = document.createElement("span");
  impact.className = "pr-attack-impact";
  impact.setAttribute("aria-hidden", "true");
  fx.append(impact);
};

const enhanceField = (field: HTMLElement) => {
  const region = getRegion();
  const terrain = getTerrain(field, region);
  const kind = getBattleKind();

  if (region) {
    field.dataset.prRegion = region;
    field.dataset.prRegionLabel = REGION_LABELS[region];
  } else {
    delete field.dataset.prRegion;
    delete field.dataset.prRegionLabel;
  }

  field.dataset.prTerrain = terrain;
  if (kind) field.dataset.prBattleKind = kind;

  field.querySelectorAll<HTMLImageElement>(".enemy-sprite, .player-sprite").forEach(
    animateBattleSprite,
  );

  field.querySelectorAll<HTMLElement>(".type-attack-fx").forEach(enhanceAttackFx);
};

const enhanceBattleUi = () => {
  document
    .querySelectorAll<HTMLElement>(".gba-battlefield")
    .forEach(enhanceField);

  document
    .querySelectorAll<HTMLElement>(".type-attack-fx")
    .forEach(enhanceAttackFx);
};

let queued = false;
const queueEnhance = () => {
  if (queued) return;
  queued = true;
  window.requestAnimationFrame(() => {
    queued = false;
    enhanceBattleUi();
  });
};

export const mountBattleVisualPolish = () => {
  enhanceBattleUi();

  const observer = new MutationObserver(queueEnhance);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "src"],
  });

  window.addEventListener("storage", queueEnhance);
};
