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
  | "result"
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

const BIOMES: Record<
  string,
  { label: string; effect: string; flavor: string[] }
> = {
  grassland: {
    label: "ROUTE",
    effect: "NORMAL · FLUG · PFLANZE",
    flavor: [
      "Der Wind bewegt das hohe Gras.",
      "In der Ferne ruft ein wildes Pokémon.",
      "Der offene Weg teilt sich vor dir.",
    ],
  },
  forest: {
    label: "WALD",
    effect: "PFLANZE · KÄFER · GIFT",
    flavor: [
      "Blätter rascheln über dem Pfad.",
      "Zwischen den Bäumen bewegt sich etwas.",
      "Feuchte Erde dämpft deine Schritte.",
    ],
  },
  cave: {
    label: "HÖHLE",
    effect: "GESTEIN · BODEN · STAHL",
    flavor: [
      "Wasser tropft von der Decke.",
      "Deine Schritte hallen durch den Tunnel.",
      "Ein Schatten verschwindet hinter einem Felsen.",
    ],
  },
  coast: {
    label: "KÜSTE",
    effect: "WASSER · FLUG · REGEN",
    flavor: [
      "Salzige Luft zieht über den Weg.",
      "Wellen schlagen gegen die Felsen.",
      "Über dem Wasser ziehen dunkle Wolken.",
    ],
  },
  sea: {
    label: "MEER",
    effect: "WASSER · EIS · REGEN",
    flavor: [
      "Die Strömung verändert den Weg.",
      "Am Horizont verschwimmt Wasser mit Himmel.",
      "Unter der Oberfläche zieht ein großer Schatten vorbei.",
    ],
  },
  city: {
    label: "STADT",
    effect: "TRAINER · SERVICE · HANDEL",
    flavor: [
      "Zwischen den Häusern wird es geschäftiger.",
      "Trainer sammeln sich entlang der Straße.",
      "Leuchtreklamen spiegeln sich auf dem Pflaster.",
    ],
  },
  ruins: {
    label: "RUINEN",
    effect: "PSYCHO · GEIST · UNLICHT",
    flavor: [
      "Verwitterte Zeichen bedecken den Stein.",
      "Die Luft zwischen den Ruinen wirkt ungewöhnlich still.",
      "Etwas Altes scheint diesen Ort zu beobachten.",
    ],
  },
  mountain: {
    label: "GEBIRGE",
    effect: "GESTEIN · KAMPF · DRACHE",
    flavor: [
      "Der Pfad wird steiler und schmaler.",
      "Kalter Wind zieht über den Grat.",
      "Lose Steine rollen in die Tiefe.",
    ],
  },
  volcano: {
    label: "VULKAN",
    effect: "FEUER · BODEN · SONNE",
    flavor: [
      "Hitze flimmert über dem Gestein.",
      "Schwefel liegt schwer in der Luft.",
      "Unter deinen Füßen vibriert der Boden.",
    ],
  },
  marsh: {
    label: "SUMPF",
    effect: "GIFT · WASSER · BODEN",
    flavor: [
      "Der Boden gibt bei jedem Schritt nach.",
      "Dichter Nebel hängt über dem Wasser.",
      "Zwischen den Schilfen blubbert es.",
    ],
  },
  snow: {
    label: "SCHNEE",
    effect: "EIS · STAHL · HAGEL",
    flavor: [
      "Schnee verschluckt fast jedes Geräusch.",
      "Eisiger Wind fegt über die Route.",
      "Frische Spuren kreuzen deinen Weg.",
    ],
  },
  night: {
    label: "NACHTPFAD",
    effect: "GEIST · UNLICHT · PSYCHO",
    flavor: [
      "Der Weg liegt fast vollständig im Schatten.",
      "Ein Ruf hallt durch die Dunkelheit.",
      "Zwischen den Bäumen glimmt ein Augenpaar.",
    ],
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
  ["result", ".summary-icon, .champion-parade, .result-progression"],
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
  result: "RUN BEENDET",
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

const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

type HyperTrainingMode = "search" | "all" | "improvable" | "perfect";

let hyperTrainingQuery = "";
let hyperTrainingMode: HyperTrainingMode = "search";

const NODE_TYPES: Record<
  string,
  { label: string; symbol: string; tone: string }
> = {
  wild: { label: "WILD", symbol: "◉", tone: "encounter" },
  trainer: { label: "TRAINER", symbol: "⚔", tone: "combat" },
  mystery: { label: "EVENT", symbol: "?", tone: "event" },
  shop: { label: "SHOP", symbol: "₽", tone: "utility" },
  heal: { label: "RAST", symbol: "+", tone: "safe" },
  item: { label: "FUND", symbol: "◆", tone: "reward" },
  city: { label: "STADT", symbol: "▦", tone: "utility" },
  tutor: { label: "TUTOR", symbol: "TM", tone: "utility" },
  boss: { label: "RIVALE", symbol: "!", tone: "boss" },
  gym: { label: "ARENA", symbol: "⬢", tone: "boss" },
  league: { label: "LIGA", symbol: "★", tone: "boss" },
  legendary: { label: "SELTEN", symbol: "✦", tone: "legendary" },
};

const routeNodeKind = (node: HTMLElement) => {
  for (const className of node.classList) {
    if (!className.startsWith("node-")) continue;
    const kind = className.slice(5);
    if (NODE_TYPES[kind]) return kind;
  }
  return "wild";
};

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

  const arena = asRecord(run.arena);
  const route = Array.isArray(arena?.route)
    ? arena.route
    : Array.isArray(run.route)
      ? run.route
      : null;
  const step =
    typeof arena?.step === "number"
      ? arena.step
      : typeof run.step === "number"
        ? run.step
        : 0;
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

  const kind = routeNodeKind(node);
  const identity = NODE_TYPES[kind] ?? NODE_TYPES.wild;
  node.dataset.prRisk = risk;
  node.dataset.prNodeKind = kind;
  node.dataset.prNodeTone = identity.tone;
  node.dataset.prNodeLabel = identity.label;
  node.dataset.prNodeSymbol = identity.symbol;

  if (node.classList.contains("path-chosen")) node.dataset.prNodeState = "chosen";
  else if (node.classList.contains("node-accessible")) node.dataset.prNodeState = "available";
  else if (node.classList.contains("node-unknown")) node.dataset.prNodeState = "unknown";
  else node.dataset.prNodeState = "future";

  const icon = node.querySelector<HTMLElement>(".node-icon-shell");
  if (icon && !icon.querySelector(".pr-node-kind-symbol")) {
    const symbol = document.createElement("span");
    symbol.className = "pr-node-kind-symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = identity.symbol;
    icon.append(symbol);
  }
};

const enhanceRoute = (shell: HTMLElement, run: RecordLike | null) => {
  const map = shell.querySelector<HTMLElement>(".route-map, .adventure-board");
  if (!map) return;

  map.querySelectorAll<HTMLElement>(".route-node").forEach(classifyRouteRisk);
  map.dataset.prRouteBoard = "true";

  map.querySelectorAll<HTMLElement>(".route-row").forEach((row, index, rows) => {
    row.dataset.prRouteStep = String(index + 1).padStart(2, "0");
    row.dataset.prRouteStepState = row.classList.contains("current")
      ? "current"
      : row.classList.contains("past")
        ? "past"
        : "future";
    row.style.setProperty("--pr-route-progress", String(index / Math.max(1, rows.length - 1)));
  });

  if (!map.querySelector(":scope > .pr-route-scenery")) {
    const scenery = document.createElement("span");
    scenery.className = "pr-route-scenery";
    scenery.setAttribute("aria-hidden", "true");
    scenery.innerHTML = `
      <i class="pr-route-scenery-back"></i>
      <i class="pr-route-scenery-mid"></i>
      <i class="pr-route-scenery-front"></i>
      <i class="pr-route-scenery-fog"></i>
    `;
    map.prepend(scenery);
  }

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
  const biomeInfo = biome ? BIOMES[biome] : null;
  const step =
    typeof run?.mapIndex === "number"
      ? Number(run.mapIndex) + 1
      : typeof run?.step === "number"
        ? Number(run.step) + 1
        : null;
  const flavorIndex = Math.max(0, (step ?? 1) - 1);
  const flavor = biomeInfo
    ? biomeInfo.flavor[flavorIndex % biomeInfo.flavor.length]
    : info.flavor;

  if (biome) {
    shell.dataset.prBiome = biome;
    document.body.dataset.prBiome = biome;
  } else {
    delete shell.dataset.prBiome;
    delete document.body.dataset.prBiome;
  }

  const routeRows = map.querySelectorAll(".route-row").length;
  const currentRouteStep =
    typeof asRecord(run?.arena)?.step === "number"
      ? Number(asRecord(run?.arena)?.step) + 1
      : typeof run?.step === "number"
        ? Number(run.step) + 1
        : 1;

  map.dataset.prRegion = region;
  if (biome) map.dataset.prBiome = biome;
  else delete map.dataset.prBiome;

  context.innerHTML = `
    <span class="pr-route-region">${info.label}</span>
    <span class="pr-route-copy">
      <b>${step ? `ETAPPE ${step}` : "EXPEDITION"}${biomeInfo ? ` · ${biomeInfo.label}` : ""}</b>
      <small>${flavor}</small>
    </span>
    <span class="pr-route-progress-chip"><b>${String(currentRouteStep).padStart(2, "0")}</b><small>/${String(Math.max(routeRows, currentRouteStep)).padStart(2, "0")}</small></span>
    <span class="pr-route-identity">${biomeInfo?.effect ?? info.identity}</span>
  `;

  let legend = map.parentElement?.querySelector<HTMLElement>(".pr-route-risk-legend");
  if (!legend) {
    legend = document.createElement("div");
    legend.className = "pr-route-risk-legend";
    legend.setAttribute("aria-label", "Routenrisiko");
    legend.innerHTML = `
      <span data-pr-risk="safe">SAFE</span>
      <span data-pr-risk="balanced">BALANCED</span>
      <span data-pr-risk="variable">VARIABLE</span>
      <span data-pr-risk="dangerous">DANGER</span>
      <button type="button" title="Die Farbe zeigt nur das ungefähre Risiko. Der genaue Inhalt bleibt verborgen." aria-label="Routenrisiko erklären">?</button>
    `;
    context.insertAdjacentElement("afterend", legend);
  }
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

const applyHyperTrainingFilter = (section: HTMLElement) => {
  const grid = section.querySelector<HTMLElement>(".iv-starter-grid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll<HTMLElement>(":scope > article"));
  const query = normalizeSearch(hyperTrainingQuery);
  let visible = 0;

  cards.forEach((card) => {
    const nameNode = card.querySelector(".iv-starter-head strong");
    const name = normalizeSearch(nameNode?.textContent ?? "");
    const copy = textOf(card);
    const perfectMatch = copy.match(/(\d+)\s*\/\s*6\s*perfekte IVs/i);
    const perfectCount = perfectMatch ? Number(perfectMatch[1]) : 0;

    const matches =
      hyperTrainingMode === "all"
        ? true
        : hyperTrainingMode === "improvable"
          ? perfectCount < 6
          : hyperTrainingMode === "perfect"
            ? perfectCount >= 6
            : Boolean(query && name.includes(query));

    card.hidden = !matches;
    card.dataset.prStarterName = name;
    card.dataset.prPerfectIvs = String(perfectCount);
    if (matches) visible += 1;
  });

  const status = section.querySelector<HTMLElement>(".pr-hyper-status");
  if (status) {
    if (hyperTrainingMode === "search" && !query) {
      status.innerHTML = `<b>STARTER SUCHEN</b><small>Gib einen Namen ein – z. B. „feur“ für Feurigel.</small>`;
    } else {
      status.innerHTML = `<b>${visible} TREFFER</b><small>${hyperTrainingMode === "search" ? `Suche „${hyperTrainingQuery}“` : hyperTrainingMode === "all" ? "Alle verfügbaren Starter" : hyperTrainingMode === "improvable" ? "Noch verbesserbare Starter" : "Starter mit 6/6 perfekten IVs"}</small>`;
    }
  }

  section.querySelectorAll<HTMLButtonElement>(".pr-hyper-filter").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === hyperTrainingMode));
  });
};

const enhanceHyperTraining = (shell: HTMLElement) => {
  const section = shell.querySelector<HTMLElement>(".iv-lab-section");
  if (!section) return;

  const grid = section.querySelector<HTMLElement>(".iv-starter-grid");
  if (!grid) return;

  let toolbar = section.querySelector<HTMLElement>(".pr-hyper-toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.className = "pr-hyper-toolbar";
    toolbar.innerHTML = `
      <label class="pr-hyper-search">
        <span>POKÉMON SUCHEN</span>
        <span class="pr-hyper-input-wrap">
          <input type="search" autocomplete="off" spellcheck="false" placeholder="z. B. feur, glum, bisa …" aria-label="Starter für Kronkorken suchen" />
          <button type="button" class="pr-hyper-clear" aria-label="Suche löschen">×</button>
        </span>
      </label>
      <div class="pr-hyper-filters" aria-label="Kronkorken Starter filtern">
        <button type="button" class="pr-hyper-filter" data-mode="all">ALLE</button>
        <button type="button" class="pr-hyper-filter" data-mode="improvable">VERBESSERBAR</button>
        <button type="button" class="pr-hyper-filter" data-mode="perfect">PERFEKT</button>
      </div>
      <div class="pr-hyper-status" aria-live="polite"></div>
    `;
    grid.insertAdjacentElement("beforebegin", toolbar);

    const input = toolbar.querySelector<HTMLInputElement>("input");
    const clear = toolbar.querySelector<HTMLButtonElement>(".pr-hyper-clear");

    input?.addEventListener("input", () => {
      hyperTrainingQuery = input.value;
      hyperTrainingMode = "search";
      applyHyperTrainingFilter(section);
    });

    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      hyperTrainingQuery = "";
      hyperTrainingMode = "search";
      input.value = "";
      applyHyperTrainingFilter(section);
    });

    clear?.addEventListener("click", () => {
      hyperTrainingQuery = "";
      hyperTrainingMode = "search";
      if (input) {
        input.value = "";
        input.focus();
      }
      applyHyperTrainingFilter(section);
    });

    toolbar.querySelectorAll<HTMLButtonElement>(".pr-hyper-filter").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.mode as HyperTrainingMode | undefined;
        if (!mode) return;
        hyperTrainingMode = mode;
        hyperTrainingQuery = "";
        if (input) input.value = "";
        applyHyperTrainingFilter(section);
      });
    });
  }

  const input = toolbar.querySelector<HTMLInputElement>("input");
  if (input && input.value !== hyperTrainingQuery && document.activeElement !== input) {
    input.value = hyperTrainingQuery;
  }

  applyHyperTrainingFilter(section);
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

const enhanceTrainerCard = (shell: HTMLElement) => {
  const card = shell.querySelector<HTMLElement>(".trainer-card");
  if (!card || card.querySelector(".pr-trainer-prestige")) return;

  const save = getSave();
  if (!save) return;

  const history = Array.isArray(save.history) ? save.history : [];
  const championRuns = history
    .map(asRecord)
    .filter(
      (run): run is RecordLike =>
        Boolean(run && run.mode === "story" && run.result === "win"),
    );
  const championRegions = new Set(
    championRuns
      .map((run) => getRegionFromValue(run.region))
      .filter((region): region is RegionKey => Boolean(region)),
  );
  const caught = Array.isArray(save.caught) ? save.caught.length : 0;
  const shiny = Array.isArray(save.shinyCaught) ? save.shinyCaught.length : 0;
  const achievements = Array.isArray(save.achievements)
    ? save.achievements.map(String)
    : [];
  const endlessBest =
    typeof save.endlessHighScore === "number" ? save.endlessHighScore : 0;
  const profile = asRecord(save.profile);
  const level = typeof profile?.level === "number" ? profile.level : 1;
  const totalRuns =
    typeof profile?.totalRuns === "number" ? profile.totalRuns : history.length;
  const dexPercent = Math.min(100, Math.round((caught / 493) * 100));
  const firstWave = achievements.includes("first-wave");

  const prestige = document.createElement("section");
  prestige.className = "pr-trainer-prestige";
  prestige.innerHTML = `
    <div class="pr-prestige-head">
      <span>ACCOUNT PRESTIGE</span>
      <small>TRAINER LV. ${level} · ${totalRuns} RUNS</small>
    </div>
    <div class="pr-prestige-grid">
      <span><b>${championRegions.size}/4</b><small>REGIONEN</small></span>
      <span><b>${championRuns.length}</b><small>HALL OF FAME</small></span>
      <span><b>${endlessBest}</b><small>ENDLESS</small></span>
      <span><b>${dexPercent}%</b><small>POKÉDEX</small></span>
      <span><b>${shiny}</b><small>SHINIES</small></span>
      <span><b>${achievements.length}</b><small>ERFOLGE</small></span>
    </div>
    <div class="pr-prestige-stamp ${firstWave ? "is-exclusive" : ""}">
      ${firstWave ? "✦ FIRST WAVE · EXCLUSIVE" : "POKÉREGIONS TRAINER RECORD"}
    </div>
  `;

  const stats = card.querySelector(".trainer-card-stats");
  (stats ?? card.querySelector(".trainer-card-top"))?.insertAdjacentElement(
    "afterend",
    prestige,
  );
};

const numericValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getRunScore = (run: RecordLike) => {
  const direct = numericValue(run.score);
  if (direct !== null) return direct;

  const score = asRecord(run.score);
  return (
    numericValue(score?.total) ??
    numericValue(score?.score) ??
    numericValue(score?.value)
  );
};

const formatRunDuration = (run: RecordLike) => {
  if (typeof run.startedAt !== "string" || typeof run.endedAt !== "string") {
    return "—";
  }

  const start = Date.parse(run.startedAt);
  const end = Date.parse(run.endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";

  const totalSeconds = Math.floor((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}H ${String(minutes).padStart(2, "0")}M`
    : `${minutes}M ${String(seconds).padStart(2, "0")}S`;
};

const displayToken = (value: unknown, fallback = "—") =>
  typeof value === "string" && value.trim()
    ? value.replaceAll("-", " ").toUpperCase()
    : fallback;

const enhanceRunResult = (shell: HTMLElement, run: RecordLike | null) => {
  if (!run || run.result === "active") return;

  const resultRoot =
    shell.querySelector<HTMLElement>(".summary-icon")?.parentElement ??
    shell.querySelector<HTMLElement>(".champion-parade")?.parentElement;
  if (!resultRoot || resultRoot.querySelector(".pr-run-record")) return;

  resultRoot.dataset.prRunResult = run.result === "win" ? "win" : "loss";

  const region = getRegionFromValue(run.region);
  const score = getRunScore(run);
  const record = document.createElement("section");
  record.className = "pr-run-record";
  record.setAttribute("aria-label", "Run-Zusammenfassung");
  record.innerHTML = `
    <div class="pr-run-record-head">
      <span>${run.result === "win" ? "CHAMPION RECORD" : "RUN RECORD"}</span>
      <small>${region ? REGIONS[region].label : "POKÉREGIONS"}</small>
    </div>
    <div class="pr-run-record-grid">
      <span><b>${displayToken(run.difficulty)}</b><small>SCHWIERIGKEIT</small></span>
      <span><b>${displayToken(run.trainerClass)}</b><small>KLASSE</small></span>
      <span><b>${formatRunDuration(run)}</b><small>ZEIT</small></span>
      <span><b>${Array.isArray(run.badges) ? run.badges.length : 0}</b><small>ORDEN</small></span>
      <span><b>${numericValue(run.defeated) ?? 0}</b><small>SIEGE</small></span>
      <span><b>${score === null ? "—" : Math.round(score).toLocaleString("de-DE")}</b><small>SCORE</small></span>
    </div>
    <div class="pr-run-seed">
      <span>SEED</span>
      <code>${typeof run.seed === "string" ? run.seed : "—"}</code>
    </div>
  `;

  const stats = resultRoot.querySelector(".stats");
  if (stats) stats.insertAdjacentElement("afterend", record);
  else resultRoot.querySelector("h2")?.insertAdjacentElement("afterend", record);

  const champion = resultRoot.querySelector<HTMLElement>(".champion-parade");
  if (champion) champion.dataset.prShareCard = "hall-of-fame";
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
  ].join("|");

  return { title, subtitle, signature, kind };
};

const enhanceBattle = (shell: HTMLElement, run: RecordLike | null) => {
  const field = shell.querySelector<HTMLElement>(".gba-battlefield");
  if (!field) return;

  const intro = getBattleIntro(run);
  field.dataset.prBattleKind = intro.kind || "wild";
  const nativeTrainerIntro = ["gym", "league", "boss"].includes(intro.kind);

  if (
    !nativeTrainerIntro &&
    !field.classList.contains("trainer-intro-field") &&
    field.dataset.prIntroSignature !== intro.signature &&
    Number(asRecord(run?.battle)?.turn ?? 0) <= 1
  ) {
    field.dataset.prIntroSignature = intro.signature;
    field.querySelector(".pr-battle-intro")?.remove();

    const overlay = document.createElement("div");
    overlay.className = `pr-battle-intro pr-battle-intro-${intro.kind || "wild"}`;
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

  const biome = currentRouteBiome(run);
  if (biome) {
    shell.dataset.prBiome = biome;
    document.body.dataset.prBiome = biome;
  } else {
    delete shell.dataset.prBiome;
    delete document.body.dataset.prBiome;
  }

  classifyButtons(shell);
  enhanceMenu(shell);
  enhanceSetup(shell);
  enhanceRoute(shell, run);
  enhanceEvent(shell);
  enhanceHyperTraining(shell);
  enhanceCollections(shell);
  enhanceShop(shell);
  enhanceTrainerCard(shell);
  enhanceRunResult(shell, run);
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
