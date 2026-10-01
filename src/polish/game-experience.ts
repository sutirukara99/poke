import { readLocalSaveObject } from "../cloud/supabase";

type RegionKey = "kanto" | "johto" | "hoenn" | "sinnoh";
type ScreenKey =
  | "menu"
  | "setup"
  | "route"
  | "battle"
  | "event"
  | "shop"
  | "loot"
  | "party"
  | "summary"
  | "pc"
  | "pokedex"
  | "inventory"
  | "quests"
  | "achievements"
  | "trainer"
  | "history"
  | "settings"
  | "other";

type RecordLike = Record<string, unknown>;

const REGIONS: Record<
  RegionKey,
  { label: string; flavor: string; identity: string }
> = {
  kanto: {
    label: "KANTO",
    flavor: "Klassische Routen, Trainerduelle und Stadt-Abenteuer.",
    identity: "KLASSISCH · TRAINER · DIREKT",
  },
  johto: {
    label: "JOHTO",
    flavor: "Schreine, Wälder und verborgene Wege prägen die Reise.",
    identity: "MYSTIK · NACHT · SECRETS",
  },
  hoenn: {
    label: "HOENN",
    flavor: "Wetter, Küsten und wilde Natur verändern jede Etappe.",
    identity: "WETTER · WASSER · NATUR",
  },
  sinnoh: {
    label: "SINNOH",
    flavor: "Berge, Schnee und riskante Pfade belohnen Vorbereitung.",
    identity: "BERGE · RUINEN · RISIKO",
  },
};

const SCREEN_SELECTORS: Array<[ScreenKey, string]> = [
  ["battle", ".retro-battle-shell, .gba-battlefield"],
  ["loot", ".alpha-loot, .loot-choice-screen"],
  ["event", ".mystery-event-card"],
  ["shop", ".shop-screen"],
  ["setup", ".alpha-run-setup, .new-run-screen"],
  ["route", ".adventure-board, .route-map"],
  ["pokedex", ".pokedex-head, .national-dex-grid, .dex-grid"],
  ["pc", ".pc-grid, .pc-storage, .pc-box"],
  ["inventory", ".inventory-screen, .inventory-grid"],
  ["quests", ".alpha-quest-board, .quest-board"],
  ["achievements", ".achievement-grid, .achievements-screen"],
  ["history", ".history-list, .history-screen, .hall-of-fame"],
  ["settings", ".settings-screen, .settings-block"],
  ["summary", ".summary, .pokemon-summary"],
  ["party", ".party-panel, .party-screen"],
  ["menu", ".menu-grid, .menu-hero, .hero"],
  ["trainer", ".trainer-card"],
];

const SCREEN_LABELS: Partial<Record<ScreenKey, string>> = {
  menu: "POKÉREGIONS",
  setup: "NEUE EXPEDITION",
  route: "ROUTE",
  battle: "KAMPF",
  event: "EREIGNIS",
  shop: "POKÉMARKT",
  loot: "BELOHNUNG",
  party: "TEAM",
  summary: "POKÉMON",
  pc: "PC-LAGER",
  pokedex: "POKÉDEX",
  inventory: "INVENTAR",
  quests: "QUESTS",
  achievements: "ERFOLGE",
  trainer: "TRAINERKARTE",
  history: "RUN-ARCHIV",
  settings: "EINSTELLUNGEN",
};

const asRecord = (value: unknown): RecordLike | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordLike)
    : null;

const getSave = () => asRecord(readLocalSaveObject());

const getRun = () => asRecord(getSave()?.run);

const getRegionFromValue = (value: unknown): RegionKey | null => {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return normalized === "kanto" ||
    normalized === "johto" ||
    normalized === "hoenn" ||
    normalized === "sinnoh"
    ? normalized
    : null;
};

const getContextRegion = (): RegionKey | null => {
  const save = getSave();
  const runRegion = getRegionFromValue(asRecord(save?.run)?.region);
  if (runRegion) return runRegion;

  const history = Array.isArray(save?.history) ? save.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const region = getRegionFromValue(asRecord(history[index])?.region);
    if (region) return region;
  }

  return null;
};

const detectScreen = (shell: HTMLElement): ScreenKey => {
  for (const [screen, selector] of SCREEN_SELECTORS) {
    if (shell.querySelector(selector)) return screen;
  }
  return "other";
};

const textOf = (node: Element) =>
  (node.textContent ?? "").replace(/\s+/g, " ").trim();

const classifyButtons = (shell: HTMLElement) => {
  shell.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const label = textOf(button).toUpperCase();
    let action = "secondary";

    if (
      button.classList.contains("primary") ||
      /FORTSETZEN|RUN ERZEUGEN|STARTEN|START →|AUSWÄHLEN →|KAUFEN|FANGEN|EINLÖSEN|ANNEHMEN|ENTWICKELN|WEITER →|LOS GEHT/.test(
        label,
      )
    ) {
      action = "primary";
    } else if (/AUFGEBEN|LÖSCHEN|RESET|VERWERFEN/.test(label)) {
      action = "danger";
    } else if (
      /ZURÜCK|SCHLIESSEN|DETAIL|FILTER|SORT|OPTION|INFO|LOCK|REROLL|ÜBERSPRINGEN/.test(
        label,
      )
    ) {
      action = "utility";
    }

    button.dataset.prAction = action;

    if (/FORTSETZEN/.test(label)) button.dataset.prPriority = "continue";
    else if (/NEUER RUN|NEUEN RUN|EXPEDITION STARTEN/.test(label))
      button.dataset.prPriority = "new-run";
    else delete button.dataset.prPriority;

    if (!button.getAttribute("aria-label") && button.title && !label) {
      button.setAttribute("aria-label", button.title);
    }
  });
};

const enhanceMenu = (shell: HTMLElement) => {
  const grid = shell.querySelector<HTMLElement>(".menu-grid");
  if (!grid) return;

  grid.setAttribute("aria-label", "Spielmenü");
  grid.querySelectorAll<HTMLElement>("button").forEach((button) => {
    const label = textOf(button).toUpperCase();
    if (/POKÉDEX|INVENTAR|ERFOLG|HALL OF FAME|RANKING|TRAINER|QUEST/.test(label)) {
      button.dataset.prMenuGroup = "progress";
    } else if (/EINSTELL|CREDITS|CODEX|COMPLETION/.test(label)) {
      button.dataset.prMenuGroup = "system";
    } else {
      button.dataset.prMenuGroup = "play";
    }
  });

  const hero = shell.querySelector<HTMLElement>(".menu-hero, .hero");
  if (hero) hero.dataset.prHero = "game";
};

const enhanceSetup = (shell: HTMLElement) => {
  const setup = shell.querySelector<HTMLElement>(".alpha-run-setup");
  if (!setup || setup.querySelector(".pr-setup-flow")) return;

  const flow = document.createElement("div");
  flow.className = "pr-setup-flow";
  flow.setAttribute("aria-label", "Run-Erstellung");
  ["MODUS", "REGION", "REGELN", "START"].forEach((label, index) => {
    const step = document.createElement("span");
    step.innerHTML = `<b>${index + 1}</b><small>${label}</small>`;
    flow.append(step);
  });

  const firstHeading = setup.querySelector("h1");
  firstHeading?.insertAdjacentElement("afterend", flow);
};

const currentRouteBiome = (run: RecordLike | null) => {
  if (!run) return null;
  const node = asRecord(run.node);
  if (typeof node?.biome === "string") return node.biome;

  const route = Array.isArray(run.arena)
    ? null
    : Array.isArray(run.route)
      ? run.route
      : null;
  const step = typeof run.step === "number" ? run.step : 0;
  const row = route && Array.isArray(route[step]) ? route[step] : null;
  const firstNode = row?.map(asRecord).find(Boolean);
  return typeof firstNode?.biome === "string" ? firstNode.biome : null;
};

const classifyRouteRisk = (node: HTMLElement) => {
  const copy = textOf(node).toUpperCase();
  let risk = "balanced";

  if (/ELITE|RIVALE|ARENA|LIGA|LEGEND|BOSS|SECRET|GEHEIM/.test(copy)) {
    risk = "dangerous";
  } else if (/HEIL|CENTER|SHOP|MARKT|STADT|RAST/.test(copy)) {
    risk = "safe";
  } else if (/EVENT|MYSTERY|EREIGNIS|FUND/.test(copy)) {
    risk = "variable";
  }

  node.dataset.prRisk = risk;
};

const enhanceRoute = (shell: HTMLElement, run: RecordLike | null) => {
  const map = shell.querySelector<HTMLElement>(".route-map, .adventure-board");
  if (!map) return;

  map.querySelectorAll<HTMLElement>(".route-node").forEach(classifyRouteRisk);

  const region = getRegionFromValue(run?.region) ?? getContextRegion();
  if (!region) return;

  let context = map.parentElement?.querySelector<HTMLElement>(".pr-route-context");
  if (!context) {
    context = document.createElement("div");
    context.className = "pr-route-context";
    context.setAttribute("aria-live", "polite");
    map.insertAdjacentElement("beforebegin", context);
  }

  const info = REGIONS[region];
  const biome = currentRouteBiome(run);
  const step =
    typeof run?.mapIndex === "number"
      ? Number(run.mapIndex) + 1
      : typeof run?.step === "number"
        ? Number(run.step) + 1
        : null;

  context.innerHTML = `
    <span class="pr-route-region">${info.label}</span>
    <span class="pr-route-copy">
      <b>${step ? `ETAPPE ${step}` : "EXPEDITION"}</b>
      <small>${biome ? `${String(biome).toUpperCase()} · ` : ""}${info.flavor}</small>
    </span>
    <span class="pr-route-identity">${info.identity}</span>
  `;
};

const enhanceEvent = (shell: HTMLElement) => {
  shell.querySelectorAll<HTMLElement>(".mystery-event-card").forEach((card) => {
    card.dataset.prNarrative = "true";
    card.querySelectorAll<HTMLButtonElement>("button").forEach((button, index) => {
      button.style.setProperty("--pr-choice-index", String(index + 1));
      button.dataset.prChoice = String(index + 1);
    });
  });
};

const enhanceCollections = (shell: HTMLElement) => {
  shell
    .querySelectorAll<HTMLElement>(
      ".national-dex-grid, .dex-grid, .pc-grid, .inventory-grid, .achievement-grid, .loot-grid",
    )
    .forEach((grid) => {
      grid.dataset.prCollection = "true";
    });
};

const enhanceShop = (shell: HTMLElement) => {
  shell.querySelectorAll<HTMLElement>(".shop-screen").forEach((shop) => {
    shop.dataset.prShop = "mart";
  });
};

const enhanceEmptyStates = (shell: HTMLElement) => {
  shell
    .querySelectorAll<HTMLElement>("p, small, .empty-state")
    .forEach((element) => {
      const value = textOf(element).toLowerCase();
      if (
        value === "no data" ||
        value === "keine daten" ||
        value === "leer" ||
        value === "nothing here"
      ) {
        element.dataset.prEmpty = "true";
        element.textContent = "Hier gibt es noch nichts zu entdecken.";
      }
    });
};

const getBattleIntro = (run: RecordLike | null) => {
  const battle = asRecord(run?.battle);
  const node = asRecord(run?.node);
  const kind = typeof battle?.kind === "string" ? battle.kind.toLowerCase() : "";

  const title =
    kind === "gym"
      ? "ARENALEITER"
      : kind === "league"
        ? "POKÉMON-LIGA"
        : kind === "boss"
          ? "RIVALENKAMPF"
          : kind === "legendary"
            ? "LEGENDÄR"
            : kind === "trainer"
              ? "TRAINERKAMPF"
              : "WILDE BEGEGNUNG";

  const subtitle =
    (typeof node?.bossName === "string" && node.bossName) ||
    (typeof node?.title === "string" && node.title) ||
    (kind === "wild" ? "Etwas bewegt sich im hohen Gras." : "");

  const signature = [
    String(run?.step ?? ""),
    String(run?.mapIndex ?? ""),
    String(node?.id ?? ""),
    kind,
    String(battle?.turn ?? 0),
  ].join("|");

  return { title, subtitle, signature };
};

const enhanceBattle = (shell: HTMLElement, run: RecordLike | null) => {
  const field = shell.querySelector<HTMLElement>(".gba-battlefield");
  if (!field) return;

  const intro = getBattleIntro(run);
  if (
    field.dataset.prIntroSignature !== intro.signature &&
    Number(asRecord(run?.battle)?.turn ?? 0) <= 1
  ) {
    field.dataset.prIntroSignature = intro.signature;
    field.querySelector(".pr-battle-intro")?.remove();

    const overlay = document.createElement("div");
    overlay.className = "pr-battle-intro";
    overlay.innerHTML = `<b>${intro.title}</b><small>${intro.subtitle}</small>`;
    field.append(overlay);

    window.setTimeout(() => overlay.classList.add("is-leaving"), 720);
    window.setTimeout(() => overlay.remove(), 1_020);
  }

  field
    .querySelectorAll<HTMLImageElement>(".enemy-sprite, .player-sprite")
    .forEach((sprite) => {
      const src = sprite.currentSrc || sprite.src;
      if (!src.toLowerCase().includes("shiny")) return;
      if (sprite.dataset.prShinyBurst === src) return;
      sprite.dataset.prShinyBurst = src;

      const burst = document.createElement("span");
      burst.className = "pr-shiny-burst";
      burst.setAttribute("aria-hidden", "true");
      sprite.insertAdjacentElement("afterend", burst);
      window.setTimeout(() => burst.remove(), 1_100);
    });
};

let lastScreen: ScreenKey | null = null;
let transitionTimer: number | undefined;

const showScreenTransition = (
  screen: ScreenKey,
  region: RegionKey | null,
  run: RecordLike | null,
) => {
  if (!lastScreen || lastScreen === screen || screen === "other") {
    lastScreen = screen;
    return;
  }

  lastScreen = screen;
  let overlay = document.querySelector<HTMLElement>(".pr-screen-transition");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "pr-screen-transition";
    overlay.setAttribute("aria-hidden", "true");
    document.body.append(overlay);
  }

  const battle = asRecord(run?.battle);
  const kind = typeof battle?.kind === "string" ? battle.kind.toLowerCase() : "";
  const label =
    screen === "battle" && kind === "gym"
      ? "ARENA"
      : screen === "battle" && kind === "league"
        ? "POKÉMON-LIGA"
        : SCREEN_LABELS[screen] ?? "POKÉREGIONS";

  overlay.innerHTML = `<b>${label}</b><small>${region ? REGIONS[region].label : ""}</small>`;
  overlay.classList.remove("is-active");
  void overlay.offsetWidth;
  overlay.classList.add("is-active");

  if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(
    () => overlay?.classList.remove("is-active"),
    430,
  );
};

const applyExperience = () => {
  const shell = document.querySelector<HTMLElement>(".alpha-shell");
  if (!shell) return;

  const run = getRun();
  const region = getRegionFromValue(run?.region) ?? getContextRegion();
  const screen = detectScreen(shell);

  shell.dataset.prScreen = screen;
  document.body.dataset.prScreen = screen;

  if (region) {
    shell.dataset.prRegion = region;
    document.body.dataset.prRegion = region;
  } else {
    delete shell.dataset.prRegion;
    delete document.body.dataset.prRegion;
  }

  classifyButtons(shell);
  enhanceMenu(shell);
  enhanceSetup(shell);
  enhanceRoute(shell, run);
  enhanceEvent(shell);
  enhanceCollections(shell);
  enhanceShop(shell);
  enhanceEmptyStates(shell);
  enhanceBattle(shell, run);
  showScreenTransition(screen, region, run);
};

let queued = false;
const queueExperience = () => {
  if (queued) return;
  queued = true;
  window.requestAnimationFrame(() => {
    queued = false;
    applyExperience();
  });
};

export const mountGameExperience = () => {
  applyExperience();

  const root = document.getElementById("root") ?? document.body;
  const observer = new MutationObserver(queueExperience);
  observer.observe(root, { childList: true, subtree: true });

  window.addEventListener("storage", queueExperience);
  window.addEventListener("resize", queueExperience, { passive: true });
};
