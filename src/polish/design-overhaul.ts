import { readLocalSaveObject } from "../cloud/supabase";

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

type DrawerEntry = {
  key: string;
  label: string;
  meta?: string;
  icon: string;
  disabled?: boolean;
  activate: () => void;
};

type DrawerGroup = {
  key: string;
  label: string;
  entries: DrawerEntry[];
  openByDefault?: boolean;
};

type HomeRecord = Record<string, unknown>;

type HomeRunPreview = {
  region: "kanto" | "johto" | "hoenn" | "sinnoh";
  regionLabel: string;
  modeLabel: string;
  routeLabel: string;
  stateLabel: string;
  progress: number;
  progressLabel: string;
  party: Array<{
    species: string;
    label: string;
    level: number;
    shiny: boolean;
  }>;
};

const asHomeRecord = (value: unknown): HomeRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as HomeRecord)
    : null;

const homeNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const HOME_REGION_LABELS: Record<HomeRunPreview["region"], string> = {
  kanto: "KANTO",
  johto: "JOHTO",
  hoenn: "HOENN",
  sinnoh: "SINNOH",
};

const SHOWDOWN_SPRITE_ALIASES: Record<string, string> = {
  "nidoran-m": "nidoranm",
  "nidoran-f": "nidoranf",
  "mr-mime": "mrmime",
  "mime-jr": "mimejr",
  "ho-oh": "hooh",
  "porygon-z": "porygonz",
  "deoxys-normal": "deoxys",
  "giratina-altered": "giratina",
  "wormadam-plant": "wormadam",
  "shaymin-land": "shaymin",
};

const spriteSlug = (species: string) =>
  SHOWDOWN_SPRITE_ALIASES[species] ??
  species.replace(/[^a-z0-9]/gi, "").toLowerCase();

const homePokemonSprite = (species: string, shiny: boolean) =>
  `https://play.pokemonshowdown.com/sprites/${shiny ? "gen5-shiny" : "gen5"}/${spriteSlug(species)}.png`;

const homeTrainerSprite = (trainer: string) =>
  `https://play.pokemonshowdown.com/sprites/trainers/${trainer}.png`;

const displaySpecies = (species: string) =>
  species
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");

const readHomeRunPreview = (): HomeRunPreview | null => {
  const save = asHomeRecord(readLocalSaveObject());
  const run = asHomeRecord(save?.run);
  if (!run) return null;

  const rawRegion =
    typeof run.region === "string" ? run.region.toLowerCase() : "kanto";
  const region: HomeRunPreview["region"] =
    rawRegion === "johto" ||
    rawRegion === "hoenn" ||
    rawRegion === "sinnoh"
      ? rawRegion
      : "kanto";

  const team = Array.isArray(run.team)
    ? run.team.map(asHomeRecord).filter(Boolean)
    : [];
  const party = team.slice(0, 3).flatMap((member) => {
    const species =
      typeof member?.species === "string" ? member.species : "";
    if (!species) return [];
    return [{
      species,
      label: displaySpecies(species),
      level: Math.max(1, Math.round(homeNumber(member?.level, 1))),
      shiny: member?.shiny === true,
    }];
  });

  const mode = typeof run.mode === "string" ? run.mode : "story";
  const badges = Array.isArray(run.badges) ? run.badges.length : 0;
  const endlessStage = Math.max(0, Math.round(homeNumber(run.endlessStage)));
  const arena = asHomeRecord(run.arena);
  const node = asHomeRecord(run.node);
  const phase = typeof run.phase === "string" ? run.phase : "map";
  const mapIndex = Math.max(0, Math.round(homeNumber(run.mapIndex)));
  const step = Math.max(
    0,
    Math.round(homeNumber(arena?.step, homeNumber(run.step))),
  );

  const routeLabel =
    mode === "endless"
      ? `Etappe ${Math.max(1, endlessStage || step + 1)}`
      : `Etappe ${mapIndex + 1}`;

  let stateLabel = `Route ${step + 1}`;
  const nodeKind = typeof node?.kind === "string" ? node.kind : "";
  if (arena) stateLabel = "Arena vor dir";
  else if (nodeKind === "city") stateLabel = "Zwischenstopp";
  else if (phase === "battle") stateLabel = "Kampf läuft";
  else if (phase === "loot") stateLabel = "Beute wartet";
  else if (phase === "starter") stateLabel = "Starter wählen";
  else if (nodeKind === "gym") stateLabel = "Arenakampf";
  else if (nodeKind === "legendary") stateLabel = "Legendäre Begegnung";

  const progress =
    mode === "endless"
      ? ((endlessStage % 10) / 10) * 100
      : Math.min(100, (badges / 8) * 100);

  const modeLabel =
    run.dailyChallenge ? "DAILY" : mode === "endless" ? "ENDLESS" : "STORY";

  return {
    region,
    regionLabel: HOME_REGION_LABELS[region],
    modeLabel,
    routeLabel,
    stateLabel,
    progress,
    progressLabel:
      mode === "endless"
        ? `Nächster Boss · ${endlessStage % 10}/10`
        : `${badges}/8 Orden`,
    party,
  };
};

const SCREEN_LABELS: Record<ScreenKey, string> = {
  menu: "EXPEDITION HUB",
  setup: "NEUE EXPEDITION",
  route: "REGIONSROUTE",
  battle: "KAMPF",
  event: "EREIGNIS",
  shop: "VERSORGUNG",
  loot: "BELOHNUNG",
  party: "TEAM",
  summary: "POKÉMON",
  pc: "PC-LAGER",
  pokedex: "POKÉDEX",
  inventory: "INVENTAR",
  quests: "QUESTS",
  achievements: "ERFOLGE",
  trainer: "TRAINERKARTE",
  result: "RUN RECORD",
  history: "RUN-ARCHIV",
  settings: "EINSTELLUNGEN",
  other: "POKÉREGIONS",
};

const REGION_LABELS: Record<string, string> = {
  kanto: "KANTO",
  johto: "JOHTO",
  hoenn: "HOENN",
  sinnoh: "SINNOH",
};

const MENU_ICONS: Array<[RegExp, string]> = [
  [/FORTSETZEN|ABENTEUER|RUN STARTEN|RUN ERZEUGEN/, "▶"],
  [/NEUEN RUN|NEUER RUN/, "＋"],
  [/POKÉDEX/, "◉"],
  [/INVENTAR/, "▣"],
  [/META/, "◆"],
  [/PROFIL|TRAINER/, "♙"],
  [/PC-BOX|PC-LAGER|PC/, "□"],
  [/QUEST/, "!"],
  [/ERFOLG/, "☆"],
  [/RUN-VERLAUF|ARCHIV|HISTORY/, "↻"],
  [/COMPLETION/, "◈"],
  [/CODEX/, "⌘"],
  [/EINSTELL/, "⚙"],
  [/CREDITS/, "♡"],
  [/ACCOUNT|CLOUD/, "☁"],
  [/ADMIN/, "◆"],
  [/DISCORD/, "●"],
  [/ZURÜCK|HAUPTMENÜ|HUB/, "←"],
];

const make = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const normalize = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/[→←＋▣◆◉♙☆⚙♡⌘◈☁▶]/g, "")
    .trim();

const textOf = (node: Element | null) =>
  normalize(node?.textContent ?? "");

const readScreen = (shell: HTMLElement): ScreenKey => {
  const value = shell.dataset.prScreen as ScreenKey | undefined;
  return value && value in SCREEN_LABELS ? value : "other";
};

const iconFor = (label: string) => {
  const upper = label.toUpperCase();
  return MENU_ICONS.find(([pattern]) => pattern.test(upper))?.[1] ?? "•";
};

const getButtonLabel = (button: HTMLButtonElement) => {
  const strong = button.querySelector(".menu-copy strong, strong");
  return textOf(strong) || textOf(button) || "AKTION";
};

const getButtonMeta = (button: HTMLButtonElement) => {
  const small = button.querySelector(".menu-copy small, small");
  const meta = textOf(small);
  return meta && meta !== getButtonLabel(button) ? meta : "";
};

const drawerOpenGroups = new Set<string>(["play"]);
let drawerSignature = "";
let currentBackSource: HTMLButtonElement | null = null;

const closeDrawer = () => {
  document.body.classList.remove("pr-game-drawer-open");
  const drawer = document.querySelector<HTMLElement>(".pr-game-drawer");
  drawer?.setAttribute("aria-hidden", "true");
};

const openDrawer = () => {
  document.body.classList.add("pr-game-drawer-open");
  const drawer = document.querySelector<HTMLElement>(".pr-game-drawer");
  drawer?.setAttribute("aria-hidden", "false");
  window.setTimeout(
    () => drawer?.querySelector<HTMLElement>("button, summary")?.focus(),
    30,
  );
};

const toggleDrawer = () => {
  if (document.body.classList.contains("pr-game-drawer-open")) closeDrawer();
  else openDrawer();
};

const ensureDrawerHost = () => {
  let backdrop = document.querySelector<HTMLElement>(".pr-game-drawer-backdrop");
  if (!backdrop) {
    backdrop = make("div", "pr-game-drawer-backdrop");
    backdrop.addEventListener("click", closeDrawer);
    document.body.append(backdrop);
  }

  let drawer = document.querySelector<HTMLElement>(".pr-game-drawer");
  if (!drawer) {
    drawer = make("aside", "pr-game-drawer");
    drawer.setAttribute("aria-label", "PokéRegions Spielmenü");
    drawer.setAttribute("aria-hidden", "true");
    document.body.append(drawer);
  }

  return drawer;
};

const findBackSource = (shell: HTMLElement) => {
  const buttons = Array.from(shell.querySelectorAll<HTMLButtonElement>("button"));
  const exact = buttons.find((button) => {
    if (button.closest(".pr-game-chrome, .pr-setup-compact-controls")) return false;
    const label = textOf(button).toUpperCase();
    return (
      label === "HAUPTMENÜ" ||
      label === "ZURÜCK ZUM HAUPTMENÜ" ||
      label === "ZURÜCK" ||
      label === "MENÜ"
    );
  });

  const fallback = buttons.find((button) => {
    if (button.closest(".pr-game-chrome, .pr-setup-compact-controls")) return false;
    const label = textOf(button).toUpperCase();
    return /HAUPTMENÜ|← ZURÜCK|ZURÜCK ←/.test(label);
  });

  return exact ?? fallback ?? null;
};

const ensureChrome = (shell: HTMLElement) => {
  shell.dataset.prOverhaul = "game";

  let chrome = shell.querySelector<HTMLElement>(":scope > .pr-game-chrome");
  if (!chrome) {
    shell.querySelector(":scope > .pr-app-chrome")?.remove();

    chrome = make("header", "pr-game-chrome");
    chrome.setAttribute("aria-label", "PokéRegions HUD");

    const brand = make("div", "pr-game-brand");
    const mark = make("span", "pr-game-brand-mark");
    mark.setAttribute("aria-hidden", "true");
    const brandCopy = make("span", "pr-game-brand-copy");
    brandCopy.append(
      make("b", "", "POKÉREGIONS"),
      make("small", "", "ROGUELIKE // ALPHA"),
    );
    brand.append(mark, brandCopy);

    const context = make("div", "pr-game-context");
    context.append(
      make("small", "pr-game-context-region", "REGION NETWORK"),
      make("strong", "pr-game-context-screen", "POKÉREGIONS"),
    );

    const actions = make("div", "pr-game-chrome-actions");
    const back = make("button", "pr-game-back", "← HUB");
    back.type = "button";
    back.hidden = true;
    back.addEventListener("click", () => currentBackSource?.click());

    const menu = make("button", "pr-game-menu-toggle");
    menu.type = "button";
    menu.setAttribute("aria-label", "Spielmenü öffnen");
    menu.innerHTML =
      '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
    menu.addEventListener("click", toggleDrawer);

    actions.append(back, menu);
    chrome.append(brand, context, actions);
    shell.prepend(chrome);
  }

  const screen = readScreen(shell);
  const region = shell.dataset.prRegion ?? "";
  const screenNode = chrome.querySelector<HTMLElement>(".pr-game-context-screen");
  const regionNode = chrome.querySelector<HTMLElement>(".pr-game-context-region");
  const back = chrome.querySelector<HTMLButtonElement>(".pr-game-back");

  if (screenNode) screenNode.textContent = SCREEN_LABELS[screen];
  if (regionNode) {
    regionNode.textContent =
      screen === "menu" ? "GAME LIBRARY" : REGION_LABELS[region] ?? "REGION NETWORK";
  }

  if (region) chrome.dataset.region = region;
  else delete chrome.dataset.region;

  currentBackSource = screen === "menu" ? null : findBackSource(shell);
  if (back) {
    back.hidden = !currentBackSource;
    back.textContent = screen === "setup" ? "← HUB" : "← ZURÜCK";
  }
};

const buttonEntry = (
  button: HTMLButtonElement,
  keyPrefix: string,
): DrawerEntry => {
  const label = getButtonLabel(button);
  return {
    key: `${keyPrefix}:${label.toLowerCase()}`,
    label,
    meta: getButtonMeta(button),
    icon: iconFor(label),
    disabled: button.disabled,
    activate: () => {
      closeDrawer();
      button.click();
    },
  };
};

const collectMenuGroups = (shell: HTMLElement): DrawerGroup[] => {
  const groups = new Map<string, DrawerGroup>([
    ["play", { key: "play", label: "EXPEDITION", entries: [], openByDefault: true }],
    ["trainer", { key: "trainer", label: "TRAINER", entries: [] }],
    ["progress", { key: "progress", label: "FORTSCHRITT", entries: [] }],
    ["system", { key: "system", label: "SYSTEM", entries: [] }],
  ]);

  const seen = new Set<HTMLButtonElement>();
  const seenLabels = new Set<string>();
  const sources = [
    ...shell.querySelectorAll<HTMLButtonElement>(".menu-library .menu-grid button"),
    ...shell.querySelectorAll<HTMLButtonElement>(".hero .actions button, .menu-hero .actions button"),
  ];

  for (const button of sources) {
    if (seen.has(button)) continue;
    seen.add(button);
    const label = getButtonLabel(button);
    const labelKey = normalize(label).toLowerCase();
    if (seenLabels.has(labelKey)) continue;
    seenLabels.add(labelKey);
    const upper = label.toUpperCase();
    let group = "trainer";

    if (/FORTSETZEN|ABENTEUER|NEUEN RUN|NEUER RUN|RUN STARTEN/.test(upper)) {
      group = "play";
    } else if (/POKÉDEX|INVENTAR|META|PROFIL|PC-BOX|PC-LAGER/.test(upper)) {
      group = "trainer";
    } else if (/QUEST|ERFOLG|RUN-VERLAUF|ARCHIV|COMPLETION|CODEX/.test(upper)) {
      group = "progress";
    } else if (/EINSTELL|CREDITS/.test(upper)) {
      group = "system";
    }

    groups.get(group)?.entries.push(buttonEntry(button, group));
  }

  const discord = shell.querySelector<HTMLAnchorElement>(".discord-community-link");
  if (discord?.href) {
    groups.get("system")?.entries.push({
      key: "system:discord",
      label: "Discord",
      meta: "Feedback · Updates · Community",
      icon: "●",
      activate: () => {
        closeDrawer();
        window.open(discord.href, "_blank", "noopener,noreferrer");
      },
    });
  }

  const account = document.querySelector<HTMLButtonElement>(".cloud-account-pill");
  if (account) {
    groups.get("system")?.entries.push({
      key: "system:account",
      label: "Account & Cloud",
      meta: textOf(account),
      icon: "☁",
      activate: () => {
        closeDrawer();
        account.click();
      },
    });
  }

  const admin = document.querySelector<HTMLButtonElement>(".pr-admin-trigger");
  if (admin) {
    groups.get("system")?.entries.push({
      key: "system:admin",
      label: "Admin",
      meta: "Control Panel",
      icon: "◆",
      activate: () => {
        closeDrawer();
        admin.click();
      },
    });
  }

  return [...groups.values()].filter((group) => group.entries.length > 0);
};

const collectContextGroups = (
  shell: HTMLElement,
  screen: ScreenKey,
): DrawerGroup[] => {
  const groups: DrawerGroup[] = [];

  if (currentBackSource) {
    groups.push({
      key: "play",
      label: "NAVIGATION",
      openByDefault: true,
      entries: [
        {
          key: "context:back",
          label: screen === "setup" ? "Zum Hub" : "Zurück",
          meta: "Aktuelle Ansicht verlassen",
          icon: "←",
          activate: () => {
            closeDrawer();
            currentBackSource?.click();
          },
        },
      ],
    });
  }

  const utilities: DrawerEntry[] = [];
  const account = document.querySelector<HTMLButtonElement>(".cloud-account-pill");
  if (account) {
    utilities.push({
      key: "context:account",
      label: "Account & Cloud",
      meta: textOf(account),
      icon: "☁",
      activate: () => {
        closeDrawer();
        account.click();
      },
    });
  }

  const admin = document.querySelector<HTMLButtonElement>(".pr-admin-trigger");
  if (admin) {
    utilities.push({
      key: "context:admin",
      label: "Admin",
      meta: "Control Panel",
      icon: "◆",
      activate: () => {
        closeDrawer();
        admin.click();
      },
    });
  }

  if (utilities.length) {
    groups.push({ key: "system", label: "SYSTEM", entries: utilities });
  }

  return groups;
};

const renderDrawer = (shell: HTMLElement) => {
  const drawer = ensureDrawerHost();
  const screen = readScreen(shell);
  const region = shell.dataset.prRegion ?? "";
  const groups =
    screen === "menu"
      ? collectMenuGroups(shell)
      : collectContextGroups(shell, screen);

  const signature = JSON.stringify({
    screen,
    region,
    groups: groups.map((group) => ({
      key: group.key,
      entries: group.entries.map((entry) => [
        entry.key,
        entry.label,
        entry.meta,
        entry.disabled,
      ]),
    })),
  });

  if (signature === drawerSignature) return;
  drawerSignature = signature;

  const header = make("header", "pr-drawer-head");
  const headerCopy = make("div");
  headerCopy.append(
    make("small", "", REGION_LABELS[region] ?? "POKÉREGIONS"),
    make("strong", "", "SPIELMENÜ"),
  );
  const close = make("button", "pr-drawer-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Spielmenü schließen");
  close.addEventListener("click", closeDrawer);
  header.append(headerCopy, close);

  const context = make("div", "pr-drawer-context");
  context.append(
    make("span", "", SCREEN_LABELS[screen]),
    make("span", "", "1.0 ALPHA"),
  );

  const body = make("div", "pr-drawer-body");
  for (const group of groups) {
    const details = document.createElement("details");
    details.className = "pr-drawer-group";
    details.dataset.group = group.key;
    details.open =
      drawerOpenGroups.has(group.key) ||
      Boolean(group.openByDefault && !drawerOpenGroups.has(`closed:${group.key}`));

    details.addEventListener("toggle", () => {
      if (details.open) {
        drawerOpenGroups.add(group.key);
        drawerOpenGroups.delete(`closed:${group.key}`);
      } else {
        drawerOpenGroups.delete(group.key);
        drawerOpenGroups.add(`closed:${group.key}`);
      }
    });

    const summary = document.createElement("summary");
    summary.append(
      make("span", "", group.label),
      make("small", "", String(group.entries.length).padStart(2, "0")),
    );

    const list = make("div", "pr-drawer-list");
    for (const entry of group.entries) {
      const button = make("button", "pr-drawer-entry");
      button.type = "button";
      button.disabled = Boolean(entry.disabled);

      const icon = make("span", "pr-drawer-entry-icon", entry.icon);
      const copy = make("span", "pr-drawer-entry-copy");
      copy.append(
        make("strong", "", entry.label),
        make("small", "", entry.meta ?? ""),
      );
      const arrow = make("span", "pr-drawer-entry-arrow", "›");
      button.append(icon, copy, arrow);
      button.addEventListener("click", entry.activate);
      list.append(button);
    }

    details.append(summary, list);
    body.append(details);
  }

  if (!groups.length) {
    const empty = make("p", "pr-drawer-empty", "Für diese Ansicht gibt es keine zusätzlichen Menüpunkte.");
    body.append(empty);
  }

  const footer = make("footer", "pr-drawer-footer");
  footer.append(
    make("span", "", "POKÉREGIONS"),
    make("span", "", "REGION // RUN // BUILD"),
  );

  drawer.replaceChildren(header, context, body, footer);
};

let launcherSignature = "";

const renderMinimalHome = (shell: HTMLElement) => {
  const groups = collectMenuGroups(shell);
  const hero = shell.querySelector<HTMLElement>(".hero, .menu-hero");
  if (!hero) return;

  const play = groups.find((group) => group.key === "play");
  const continueEntry = play?.entries.find((entry) =>
    /FORTSETZEN|CONTINUE/i.test(entry.label),
  );
  const newEntry = play?.entries.find((entry) =>
    /NEUEN RUN|NEUER RUN|RUN STARTEN|ABENTEUER/i.test(entry.label),
  );
  const account = document.querySelector<HTMLButtonElement>(".cloud-account-pill");
  const version =
    textOf(hero.querySelector(".art-label")) ||
    textOf(shell.querySelector(".version")) ||
    "1.0 ALPHA";
  const preview = continueEntry ? readHomeRunPreview() : null;

  const signature = JSON.stringify({
    continue: continueEntry
      ? [continueEntry.label, continueEntry.meta, continueEntry.disabled]
      : null,
    preview,
    fresh: newEntry ? [newEntry.label, newEntry.meta, newEntry.disabled] : null,
    account: textOf(account),
    version,
  });

  let home = shell.querySelector<HTMLElement>(".pr-minimal-home");
  if (signature === launcherSignature && home) return;
  launcherSignature = signature;

  if (!home) {
    home = make("section", "pr-minimal-home");
    home.setAttribute("aria-label", "PokéRegions Hauptmenü");
    const content = hero.parentElement ?? shell;
    content.insertBefore(home, hero);
  }

  const brand = make("header", "pr-minimal-brand");
  const brandMark = make("span", "pr-minimal-brand-mark");
  brandMark.setAttribute("aria-hidden", "true");
  const brandCopy = make("div", "pr-minimal-brand-copy");
  brandCopy.append(
    make("h1", "", "POKÉREGIONS"),
    make("p", "", "ROGUELIKE · FOUR REGIONS"),
    make("small", "", version.replace(/\s+/g, " ")),
  );
  brand.append(brandMark, brandCopy);

  const modes = make("div", "pr-minimal-modes pr-image-mode-grid");

  const addImage = (
    host: HTMLElement,
    src: string,
    className: string,
    index?: number,
  ) => {
    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    image.loading = index === 0 ? "eager" : "lazy";
    image.draggable = false;
    image.referrerPolicy = "no-referrer";
    image.className = className;
    if (typeof index === "number") image.dataset.artIndex = String(index);
    image.addEventListener("error", () => image.remove(), { once: true });
    host.append(image);
  };

  const addMode = (
    kicker: string,
    title: string,
    detail: string,
    art: "continue" | "new" | "trainer",
    activate: () => void,
    disabled = false,
  ) => {
    const button = make("button", "pr-minimal-mode pr-image-mode");
    button.type = "button";
    button.disabled = disabled;
    button.dataset.modeArt = art;
    button.setAttribute("aria-label", title);

    const scene = make("span", "pr-minimal-mode-scene pr-image-mode-scene");
    scene.setAttribute("aria-hidden", "true");
    scene.append(
      make("span", "pr-image-mode-glow"),
      make("span", "pr-image-mode-horizon"),
    );

    const figures = make("span", "pr-image-mode-figures");
    if (art === "continue") {
      if (preview?.party.length) {
        preview.party.slice(0, 3).forEach((member, index) => {
          addImage(
            figures,
            homePokemonSprite(member.species, member.shiny),
            "pr-mode-pokemon",
            index,
          );
        });
      } else {
        addImage(figures, homePokemonSprite("pikachu", false), "pr-mode-pokemon", 0);
      }
    } else if (art === "new") {
      ["bulbasaur", "charmander", "squirtle"].forEach((species, index) => {
        addImage(
          figures,
          homePokemonSprite(species, false),
          "pr-mode-pokemon",
          index,
        );
      });
    } else {
      addImage(figures, homeTrainerSprite("red"), "pr-mode-trainer", 0);
      addImage(figures, homePokemonSprite("pikachu", false), "pr-mode-sidekick", 1);
    }
    scene.append(figures);

    if (art === "continue" && preview) {
      const badge = make(
        "span",
        "pr-image-mode-badge",
        `${preview.regionLabel} · ${preview.modeLabel}`,
      );
      scene.append(badge);
    }

    const copy = make("span", "pr-minimal-mode-copy");
    copy.append(
      make("small", "", kicker),
      make("strong", "", title),
      make("span", "", detail),
    );

    if (art === "continue" && preview) {
      const state = make(
        "span",
        "pr-image-mode-state",
        `${preview.routeLabel} · ${preview.stateLabel} · ${preview.progressLabel}`,
      );
      copy.append(state);
    }

    const action = make(
      "b",
      "pr-minimal-mode-action",
      disabled ? "GESPERRT" : art === "continue" ? "FORTSETZEN →" : "ÖFFNEN →",
    );
    button.append(scene, copy, action);
    button.addEventListener("click", activate);
    modes.append(button);
  };

  if (continueEntry) {
    addMode(
      "AKTIVE EXPEDITION",
      "Run fortsetzen",
      preview
        ? `${preview.regionLabel} · ${preview.routeLabel} · ${preview.stateLabel}`
        : continueEntry.meta || "Setze deine aktuelle Reise fort.",
      "continue",
      continueEntry.activate,
      Boolean(continueEntry.disabled),
    );
  }

  if (newEntry) {
    addMode(
      "EXPEDITION",
      "Neuer Run",
      "Story · Daily · Endless",
      "new",
      newEntry.activate,
      Boolean(newEntry.disabled),
    );
  }

  addMode(
    "TRAINER",
    "Sammlung & Fortschritt",
    "Pokédex · Inventar · Erfolge",
    "trainer",
    openDrawer,
  );

  const footer = make("footer", "pr-minimal-footer");
  const status = make("span", "pr-minimal-status");
  status.append(
    make("i", ""),
    make("span", "", account ? "CLOUD READY" : "LOCAL SAVE"),
  );

  const menu = make("button", "pr-minimal-menu");
  menu.type = "button";
  menu.textContent = "☰ TRAINER-MENÜ";
  menu.addEventListener("click", openDrawer);

  footer.append(status, menu);
  home.replaceChildren(brand, modes, footer);
};

const clearMinimalHome = (shell: HTMLElement) => {
  launcherSignature = "";
  shell.querySelector(".pr-minimal-home")?.remove();
};

const enhanceHome = (shell: HTMLElement) => {
  renderMinimalHome(shell);

  const library = shell.querySelector<HTMLElement>(".menu-library");
  if (library) library.dataset.prCollapsedLibrary = "true";

  const hero = shell.querySelector<HTMLElement>(".hero, .menu-hero");
  if (!hero) return;
  hero.dataset.prGameHero = "true";

  const actions = hero.querySelector<HTMLElement>(".actions");
  if (actions) {
    const buttons = Array.from(actions.querySelectorAll<HTMLButtonElement>("button"));
    buttons.forEach((button, index) => {
      button.dataset.prHeroAction = index === 0 ? "primary" : "drawer";
    });
  }

  shell
    .querySelectorAll<HTMLElement>(".dashboard")
    .forEach((node) => (node.dataset.prHomeDashboard = "true"));
};

const createSetupToggle = (
  setup: HTMLElement,
  label: string,
  key: "rules" | "ascension" | "code",
) => {
  const button = make("button", "pr-setup-compact-button", label);
  button.type = "button";
  button.dataset.toggle = key;
  const attr =
    key === "rules"
      ? "prRulesOpen"
      : key === "ascension"
        ? "prAscensionOpen"
        : "prCodeOpen";

  const sync = () => {
    const open = setup.dataset[attr] === "true";
    button.setAttribute("aria-pressed", String(open));
  };

  button.addEventListener("click", () => {
    setup.dataset[attr] = String(setup.dataset[attr] !== "true");
    sync();
  });
  sync();
  return button;
};

const enhanceSetup = (shell: HTMLElement) => {
  const setup = shell.querySelector<HTMLElement>(".alpha-run-setup");
  if (!setup) return;
  setup.dataset.prCompactSetup = "true";

  if (setup.querySelector(".pr-setup-compact-controls")) return;

  const rules = setup.querySelector(".challenge-panel, .new-run-options");
  const ascension = setup.querySelector(".alpha-ascension");
  const code = setup.querySelector(".alpha-gift-code");

  if (!rules && !ascension && !code) return;

  const controls = make("div", "pr-setup-compact-controls");
  const label = make("span", "pr-setup-compact-label", "OPTIONEN");
  controls.append(label);

  if (rules) controls.append(createSetupToggle(setup, "REGELN", "rules"));
  if (ascension) controls.append(createSetupToggle(setup, "ASCENSION", "ascension"));
  if (code) controls.append(createSetupToggle(setup, "GESCHENKCODE", "code"));

  const anchor =
    setup.querySelector(".challenge-panel") ??
    setup.querySelector(".alpha-ascension") ??
    setup.querySelector(".alpha-gift-code") ??
    setup.querySelector(".new-run-options");

  anchor?.insertAdjacentElement("beforebegin", controls);
};

const markBackSource = (shell: HTMLElement) => {
  shell
    .querySelectorAll<HTMLElement>("[data-pr-shell-back-source]")
    .forEach((node) => delete node.dataset.prShellBackSource);

  currentBackSource = readScreen(shell) === "menu" ? null : findBackSource(shell);
  if (currentBackSource) currentBackSource.dataset.prShellBackSource = "true";
};

const markGameScreens = (shell: HTMLElement) => {
  const screen = readScreen(shell);
  shell.dataset.prGameScreen = screen;

  shell
    .querySelectorAll<HTMLElement>(
      ".national-dex-grid, .dex-grid, .pc-grid, .inventory-grid, .achievement-grid, .loot-grid, .history-list",
    )
    .forEach((node) => (node.dataset.prGameCollection = "true"));

  shell
    .querySelectorAll<HTMLElement>(".play-layout")
    .forEach((node) => (node.dataset.prGamePlayLayout = "true"));

  if (screen === "battle") {
    shell.querySelector<HTMLElement>(".retro-battle-shell")?.setAttribute(
      "data-pr-game-battle",
      "true",
    );
  }
};

const applyDesign = () => {
  const shell = document.querySelector<HTMLElement>(".alpha-shell");
  if (!shell) return;

  const screen = readScreen(shell);
  document.body.dataset.prGameScreen = screen;
  document.body.classList.add("pr-design-overhaul", "pr-game-ui");

  markBackSource(shell);
  ensureChrome(shell);
  markGameScreens(shell);

  if (screen === "menu") enhanceHome(shell);
  else clearMinimalHome(shell);
  if (screen === "setup") enhanceSetup(shell);

  renderDrawer(shell);
};

let queued = false;
const queueDesign = () => {
  if (queued) return;
  queued = true;
  window.requestAnimationFrame(() => {
    queued = false;
    applyDesign();
  });
};

export const mountDesignOverhaul = () => {
  applyDesign();

  const root = document.getElementById("root") ?? document.body;
  const observer = new MutationObserver(queueDesign);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "data-pr-screen",
      "data-pr-region",
      "disabled",
      "class",
    ],
  });

  window.addEventListener("resize", queueDesign, { passive: true });
  window.addEventListener("storage", queueDesign);

  for (const id of ["pokeregions-cloud-root", "pokeregions-admin-root"]) {
    const host = document.getElementById(id);
    if (!host) continue;
    const hostObserver = new MutationObserver(queueDesign);
    hostObserver.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "disabled"],
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("pr-game-drawer-open")) {
      closeDrawer();
    }
  });
};
