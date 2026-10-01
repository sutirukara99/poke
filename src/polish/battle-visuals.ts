import { readLocalSaveObject } from "../cloud/supabase";

type RegionKey = "kanto" | "johto" | "hoenn" | "sinnoh";
type SceneKey =
  | "grass"
  | "forest"
  | "coast"
  | "cave"
  | "city"
  | "ruins"
  | "mountain"
  | "volcano"
  | "marsh"
  | "snow"
  | "night"
  | "arena";

type FxFamily = "projectile" | "beam" | "slash" | "impact" | "aura";

const getRun = () => {
  const save = readLocalSaveObject();
  if (!save || !save.run || typeof save.run !== "object") return null;
  return save.run as Record<string, unknown>;
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getRegion = (): RegionKey | null => {
  const run = getRun();
  const value = typeof run?.region === "string" ? run.region.toLowerCase() : "";
  return ["kanto", "johto", "hoenn", "sinnoh"].includes(value)
    ? (value as RegionKey)
    : null;
};

const getBattleKind = () => {
  const battle = asRecord(getRun()?.battle);
  return typeof battle?.kind === "string" ? battle.kind.toLowerCase() : "";
};

const getScene = (field: HTMLElement): SceneKey => {
  const run = getRun();
  const node = asRecord(run?.node);
  const biome = typeof node?.biome === "string" ? node.biome.toLowerCase() : "";
  const kind = getBattleKind();

  if (kind === "gym" || kind === "league") return "arena";
  if (field.classList.contains("battle-theme-arena")) return "arena";
  if (field.classList.contains("battle-theme-cave")) return "cave";
  if (field.classList.contains("battle-theme-water")) return "coast";

  if (biome === "forest") return "forest";
  if (biome === "coast" || biome === "sea") return "coast";
  if (biome === "cave") return "cave";
  if (biome === "city") return "city";
  if (biome === "ruins") return "ruins";
  if (biome === "mountain") return "mountain";
  if (biome === "volcano") return "volcano";
  if (biome === "marsh") return "marsh";
  if (biome === "snow") return "snow";
  if (biome === "night") return "night";

  return "grass";
};

const animateBattleSprite = (img: HTMLImageElement) => {
  if (img.dataset.prAnimated === "2") return;

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

  const animated = `https://play.pokemonshowdown.com/sprites/${folder}/${slug}.gif`;

  img.dataset.prAnimated = "2";
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

const familyForType = (type: string): FxFamily => {
  if (["fire", "water", "ice", "electric", "dragon"].includes(type)) {
    return type === "electric" || type === "water" ? "beam" : "projectile";
  }
  if (["grass", "bug", "flying", "steel"].includes(type)) return "slash";
  if (["normal", "fighting", "ground", "rock"].includes(type)) return "impact";
  return "aura";
};

const isHeavyType = (type: string) =>
  ["fighting", "ground", "rock", "dragon", "steel"].includes(type);

const buildScene = (field: HTMLElement) => {
  let scene = field.querySelector<HTMLElement>(":scope > .pr-battle-scene");
  if (!scene) {
    scene = document.createElement("div");
    scene.className = "pr-battle-scene";
    scene.setAttribute("aria-hidden", "true");
    scene.innerHTML = `
      <span class="pr-scene-sky"></span>
      <span class="pr-scene-far"></span>
      <span class="pr-scene-mid"></span>
      <span class="pr-scene-ground"></span>
      <span class="pr-scene-atmosphere">
        <i></i><i></i><i></i><i></i><i></i><i></i>
      </span>
      <span class="pr-scene-vignette"></span>
    `;
    field.prepend(scene);
  }

  const region = getRegion();
  const sceneKey = getScene(field);
  field.dataset.prScene = sceneKey;
  if (region) field.dataset.prRegion = region;
  else delete field.dataset.prRegion;

  const kind = getBattleKind();
  if (kind) field.dataset.prBattleKind = kind;
  else delete field.dataset.prBattleKind;
};

const resetClass = (
  node: HTMLElement,
  className: string,
  duration: number,
) => {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  window.setTimeout(() => node.classList.remove(className), duration);
};

const addImpactReaction = (fx: HTMLElement, type: string) => {
  const field = fx.closest<HTMLElement>(".gba-battlefield");
  if (!field) return;

  const fromPlayer = fx.classList.contains("fx-player");
  const target = field.querySelector<HTMLElement>(
    fromPlayer ? ".enemy-sprite" : ".player-sprite",
  );
  if (target) resetClass(target, "pr-hit-react", 520);

  if (isHeavyType(type)) resetClass(field, "pr-heavy-impact", 360);
  else resetClass(field, "pr-light-impact", 280);
};

const enhanceAttackFx = (fx: HTMLElement) => {
  if (fx.dataset.prEnhanced === "3") return;
  fx.dataset.prEnhanced = "3";

  const type = typeFromFx(fx);
  const family = familyForType(type);
  fx.dataset.prFxType = type;
  fx.dataset.prFxFamily = family;

  fx.querySelectorAll(".pr-fx-system,.pr-attack-asset,.pr-attack-impact").forEach((node) => {
    node.remove();
  });

  const system = document.createElement("span");
  system.className = "pr-fx-system";
  system.setAttribute("aria-hidden", "true");

  const trail = document.createElement("i");
  trail.className = "pr-fx-trail";
  const projectile = document.createElement("i");
  projectile.className = "pr-fx-projectile";
  const impact = document.createElement("i");
  impact.className = "pr-fx-impact";
  const ring = document.createElement("i");
  ring.className = "pr-fx-ring";

  const sparks = document.createElement("span");
  sparks.className = "pr-fx-sparks";
  for (let index = 0; index < 10; index += 1) {
    const spark = document.createElement("i");
    spark.style.setProperty("--spark-index", String(index));
    sparks.append(spark);
  }

  system.append(trail, projectile, impact, ring, sparks);
  fx.append(system);

  addImpactReaction(fx, type);
};

const enhanceField = (field: HTMLElement) => {
  buildScene(field);

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

const BATTLE_SELECTOR =
  ".gba-battlefield, .type-attack-fx, .enemy-sprite, .player-sprite";

const mutationTouchesBattle = (mutation: MutationRecord) => {
  const target = mutation.target;
  if (
    target instanceof Element &&
    (target.matches(BATTLE_SELECTOR) || target.closest(".gba-battlefield"))
  ) {
    return true;
  }

  return Array.from(mutation.addedNodes).some(
    (node) =>
      node instanceof Element &&
      (node.matches(BATTLE_SELECTOR) || Boolean(node.querySelector(BATTLE_SELECTOR))),
  );
};

export const mountBattleVisualPolish = () => {
  enhanceBattleUi();

  const root = document.getElementById("root");
  if (!root) return;

  const observer = new MutationObserver((mutations) => {
    if (mutations.some(mutationTouchesBattle)) queueEnhance();
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "src"],
  });

  window.addEventListener("storage", queueEnhance);
};
