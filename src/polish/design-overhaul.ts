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
  if (regionNode) regionNode.textContent = REGION_LABELS[region] ?? "REGION NETWORK";

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
  const sources = [
    ...shell.querySelectorAll<HTMLButtonElement>(".hero .actions button, .menu-hero .actions button"),
    ...shell.querySelectorAll<HTMLButtonElement>(".menu-library .menu-grid button"),
  ];

  for (const button of sources) {
    if (seen.has(button)) continue;
    seen.add(button);
    const label = getButtonLabel(button);
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

const renderLauncherHome = (shell: HTMLElement) => {
  const groups = collectMenuGroups(shell);
  const hero = shell.querySelector<HTMLElement>(".hero, .menu-hero");
  if (!hero) return;

  const account = document.querySelector<HTMLButtonElement>(".cloud-account-pill");
  const admin = document.querySelector<HTMLButtonElement>(".pr-admin-trigger");
  const version =
    textOf(hero.querySelector(".art-label")) ||
    textOf(shell.querySelector(".version")) ||
    "1.0 ALPHA";
  const heroSummary =
    textOf(hero.querySelector(".hero-copy > p:not(.eyebrow)")) ||
    "Baue deinen Run, entwickle deinen Trainer und erobere vier Regionen.";
  const tags = Array.from(hero.querySelectorAll<HTMLElement>(".hero-tags span"))
    .map((node) => textOf(node))
    .filter(Boolean)
    .slice(0, 3);

  const signature = JSON.stringify({
    groups: groups.map((group) => ({
      key: group.key,
      entries: group.entries.map((entry) => [
        entry.key,
        entry.label,
        entry.meta,
        entry.disabled,
      ]),
    })),
    version,
    heroSummary,
    tags,
    account: textOf(account),
    admin: Boolean(admin),
  });

  let sidebar = shell.querySelector<HTMLElement>(":scope > .pr-launcher-sidebar");
  let statusbar = shell.querySelector<HTMLElement>(":scope > .pr-launcher-statusbar");

  if (signature === launcherSignature && sidebar && statusbar) return;
  launcherSignature = signature;

  if (!sidebar) {
    sidebar = make("aside", "pr-launcher-sidebar");
    sidebar.setAttribute("aria-label", "PokéRegions Launcher Navigation");
    shell.querySelector(":scope > .pr-game-chrome")?.insertAdjacentElement("afterend", sidebar);
  }

  const sidebarHead = make("div", "pr-launcher-side-head");
  const sideMark = make("span", "pr-launcher-side-mark");
  sideMark.setAttribute("aria-hidden", "true");
  const sideCopy = make("span", "pr-launcher-side-copy");
  sideCopy.append(
    make("strong", "", "POKÉREGIONS"),
    make("small", "", "GAME LIBRARY"),
  );
  sidebarHead.append(sideMark, sideCopy);

  const sidebarBody = make("div", "pr-launcher-side-body");
  for (const group of groups) {
    const section = make("section", "pr-launcher-group");
    section.dataset.group = group.key;
    section.append(make("small", "pr-launcher-group-title", group.label));

    group.entries.forEach((entry, index) => {
      const button = make("button", "pr-launcher-entry");
      button.type = "button";
      button.disabled = Boolean(entry.disabled);
      button.dataset.group = group.key;
      if (group.key === "play" && index === 0) button.dataset.launcherPrimary = "true";

      const icon = make("span", "pr-launcher-entry-icon", entry.icon);
      const copy = make("span", "pr-launcher-entry-copy");
      copy.append(
        make("strong", "", entry.label),
        entry.meta ? make("small", "", entry.meta) : make("small", "", ""),
      );
      const arrow = make("span", "pr-launcher-entry-arrow", "›");
      button.append(icon, copy, arrow);
      button.addEventListener("click", entry.activate);
      section.append(button);
    });

    sidebarBody.append(section);
  }

  const sidebarFoot = make("footer", "pr-launcher-side-foot");
  const build = make("div", "pr-launcher-build");
  build.append(
    make("span", "pr-launcher-live-dot"),
    make("span", "", "OPEN ALPHA"),
    make("small", "", version.replace(/\s+/g, " ")),
  );
  sidebarFoot.append(build);

  if (account) {
    const accountButton = make("button", "pr-launcher-account");
    accountButton.type = "button";
    accountButton.innerHTML =
      '<span aria-hidden="true">☁</span><span><b>ACCOUNT & CLOUD</b><small></small></span><i aria-hidden="true">›</i>';
    const detail = accountButton.querySelector("small");
    if (detail) detail.textContent = textOf(account) || "Cloud-Spielstand";
    accountButton.addEventListener("click", () => account.click());
    sidebarFoot.append(accountButton);
  }

  if (admin) {
    const adminButton = make("button", "pr-launcher-admin", "◆ ADMIN CONTROL");
    adminButton.type = "button";
    adminButton.addEventListener("click", () => admin.click());
    sidebarFoot.append(adminButton);
  }

  sidebar.replaceChildren(sidebarHead, sidebarBody, sidebarFoot);

  if (!statusbar) {
    statusbar = make("div", "pr-launcher-statusbar");
    sidebar.insertAdjacentElement("afterend", statusbar);
  }

  const statusCopy = make("div", "pr-launcher-status-copy");
  statusCopy.append(
    make("small", "", "READY TO PLAY"),
    make("strong", "", heroSummary),
  );

  const statusMeta = make("div", "pr-launcher-status-meta");
  const buildChip = make("span", "pr-launcher-status-chip");
  buildChip.innerHTML = '<small>BUILD</small><b></b>';
  const buildValue = buildChip.querySelector("b");
  if (buildValue) buildValue.textContent = version.replace(/\s+/g, " ");

  const saveChip = make("span", "pr-launcher-status-chip");
  saveChip.innerHTML = '<small>SAVE</small><b></b>';
  const saveValue = saveChip.querySelector("b");
  if (saveValue) saveValue.textContent = account ? "CLOUD READY" : "LOCAL";

  statusMeta.append(buildChip, saveChip);
  if (tags[0]) {
    const progressChip = make("span", "pr-launcher-status-chip");
    progressChip.innerHTML = '<small>STATUS</small><b></b>';
    const progressValue = progressChip.querySelector("b");
    if (progressValue) progressValue.textContent = tags[0];
    statusMeta.append(progressChip);
  }

  const openMenu = make("button", "pr-launcher-more", "LIBRARY +");
  openMenu.type = "button";
  openMenu.addEventListener("click", openDrawer);

  statusbar.replaceChildren(statusCopy, statusMeta, openMenu);

  let news = shell.querySelector<HTMLElement>(".pr-launcher-news");
  if (!news) {
    news = make("section", "pr-launcher-news");
    news.setAttribute("aria-label", "Aktuelle Alpha Highlights");
    hero.insertAdjacentElement("afterend", news);
  }

  const newsHead = make("header", "pr-launcher-news-head");
  const newsTitle = make("span");
  newsTitle.append(
    make("small", "", "LATEST UPDATE"),
    make("strong", "", "ALPHA BUILD HIGHLIGHTS"),
  );
  const newsBuild = make("span", "pr-launcher-news-build", version.replace(/\s+/g, " "));
  newsHead.append(newsTitle, newsBuild);

  const newsGrid = make("div", "pr-launcher-news-grid");
  const stories = [
    {
      kicker: "GAMEPLAY",
      title: "Runs lesen sich schneller",
      copy: "Klarere Battles, kompakter Kampf-Log, sichtbare Keyboard-Navigation und weniger unnötige Unterbrechungen.",
      icon: "▶",
    },
    {
      kicker: "REGIONS",
      title: "Mehr Mystery-Varianz",
      copy: "Kanto, Johto, Hoenn und Sinnoh besitzen zusätzliche regionale Events mit eigenen Risiko- und Reward-Pfaden.",
      icon: "?",
    },
    {
      kicker: "OPEN ALPHA",
      title: "Dein Feedback baut das Spiel",
      copy: "PokéRegions wird weiter aktiv poliert. Bugs, Balance und UX-Feedback fließen direkt in kommende Builds.",
      icon: "●",
    },
  ];

  stories.forEach((story, index) => {
    const article = make("article", "pr-launcher-news-card");
    article.dataset.story = String(index + 1);
    const icon = make("span", "pr-launcher-news-icon", story.icon);
    const copy = make("span", "pr-launcher-news-copy");
    copy.append(
      make("small", "", story.kicker),
      make("strong", "", story.title),
      make("p", "", story.copy),
    );
    article.append(icon, copy);

    if (index === stories.length - 1) {
      const discord = shell.querySelector<HTMLAnchorElement>(".discord-community-link");
      if (discord?.href) {
        const community = make("button", "pr-launcher-news-action", "COMMUNITY →");
        community.type = "button";
        community.addEventListener("click", () =>
          window.open(discord.href, "_blank", "noopener,noreferrer"),
        );
        article.append(community);
      }
    }

    newsGrid.append(article);
  });

  news.replaceChildren(newsHead, newsGrid);
};

const clearLauncherHome = (shell: HTMLElement) => {
  launcherSignature = "";
  shell.querySelector(":scope > .pr-launcher-sidebar")?.remove();
  shell.querySelector(":scope > .pr-launcher-statusbar")?.remove();
  shell.querySelector(".pr-launcher-news")?.remove();
};

const enhanceHome = (shell: HTMLElement) => {
  renderLauncherHome(shell);

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

  let hint = hero.querySelector<HTMLButtonElement>(".pr-home-menu-hint");
  if (!hint) {
    hint = make("button", "pr-home-menu-hint");
    hint.type = "button";
    hint.innerHTML =
      '<span class="pr-home-menu-hint-icon">☰</span><span><b>TRAINER-MENÜ</b><small>Pokédex · Inventar · Fortschritt · System</small></span>';
    hint.addEventListener("click", openDrawer);
    hero.querySelector(".hero-tags")?.insertAdjacentElement("afterend", hint);
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
  else clearLauncherHome(shell);
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
