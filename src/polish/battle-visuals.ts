import { readLocalSaveObject } from "../cloud/supabase";

const SHOWDOWN = "https://play.pokemonshowdown.com";

type RegionKey = "kanto" | "johto" | "hoenn" | "sinnoh";
type TerrainKey = "grass" | "water" | "cave" | "indoor" | "snow";

const OFFICIAL_FX: Record<string, string> = {
  normal: "hit.png",
  fire: "fire.png",
  water: "water.png",
  electric: "lightning.png",
  grass: "plant.png",
  ice: "ice.png",
  fighting: "hit.png",
  poison: "poison.png",
  psychic: "psychic.png",
  ground: "rocks.png",
  rock: "rocks.png",
  flying: "wind.png",
  bug: "plant.png",
  ghost: "psychic.png",
  dark: "psychic.png",
  dragon: "shine.png",
  steel: "rocks.png",
  fairy: "shine.png",
};

const getRun = () => {
  const save = readLocalSaveObject();
  if (!save || !save.run || typeof save.run !== "object") return null;
  return save.run as Record<string, unknown>;
};

const getRegion = (): RegionKey | null => {
  const run = getRun();
  const value = typeof run?.region === "string" ? run.region.toLowerCase() : "";
  return ["kanto", "johto", "hoenn", "sinnoh"].includes(value)
    ? (value as RegionKey)
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

const getTerrain = (
  field: HTMLElement,
  region: RegionKey | null,
): TerrainKey => {
  const kind = getBattleKind();

  if (["gym", "league"].includes(kind)) return "indoor";
  if (region === "sinnoh" && getMapIndex() === 6) return "snow";
  if (field.classList.contains("battle-theme-water")) return "water";
  if (field.classList.contains("battle-theme-cave")) return "cave";
  if (field.classList.contains("battle-theme-arena")) return "indoor";
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
  img.decoding = "async";

  img.addEventListener(
    "error",
    () => {
      if (img.dataset.prStaticSrc) img.src = img.dataset.prStaticSrc;
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

const assetUrl = (filename: string) =>
  new URL(`ui/battlefx/${filename}`, document.baseURI).toString();

const enhanceAttackFx = (fx: HTMLElement) => {
  if (fx.dataset.prEnhanced === "2") return;
  fx.dataset.prEnhanced = "2";

  fx.querySelectorAll(".pr-attack-asset,.pr-attack-impact").forEach((node) => {
    node.remove();
  });

  const type = typeFromFx(fx);
  const asset = document.createElement("img");
  asset.className = "pr-attack-asset";
  asset.alt = "";
  asset.setAttribute("aria-hidden", "true");
  asset.src = assetUrl(OFFICIAL_FX[type] ?? OFFICIAL_FX.normal);
  asset.addEventListener("error", () => asset.remove(), { once: true });
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

  if (region) field.dataset.prRegion = region;
  else delete field.dataset.prRegion;

  delete field.dataset.prRegionLabel;
  field.dataset.prTerrain = terrain;

  if (kind) field.dataset.prBattleKind = kind;
  else delete field.dataset.prBattleKind;

  field
    .querySelectorAll<HTMLImageElement>(".enemy-sprite, .player-sprite")
    .forEach(animateBattleSprite);

  field
    .querySelectorAll<HTMLElement>(".type-attack-fx")
    .forEach(enhanceAttackFx);
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
