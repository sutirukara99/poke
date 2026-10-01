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

const SCREEN_LABELS: Record<ScreenKey, string> = {
  menu: "EXPEDITION HUB",
  setup: "NEUE EXPEDITION",
  route: "REGIONSROUTE",
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

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const readScreen = (shell: HTMLElement): ScreenKey => {
  const value = shell.dataset.prScreen as ScreenKey | undefined;
  return value && value in SCREEN_LABELS ? value : "other";
};

const ensureChrome = () => {
  const shell = document.querySelector<HTMLElement>(".alpha-shell");
  if (!shell) return;

  shell.dataset.prOverhaul = "true";

  let chrome = shell.querySelector<HTMLElement>(":scope > .pr-app-chrome");
  if (!chrome) {
    chrome = el("header", "pr-app-chrome");
    chrome.setAttribute("aria-label", "PokéRegions Spielstatus");

    const brand = el("div", "pr-app-brand");
    const mark = el("span", "pr-app-mark");
    mark.setAttribute("aria-hidden", "true");
    const brandCopy = el("span", "pr-app-brand-copy");
    brandCopy.append(
      el("b", "", "POKÉREGIONS"),
      el("small", "", "ROGUELIKE EXPEDITIONS"),
    );
    brand.append(mark, brandCopy);

    const context = el("div", "pr-app-context");
    context.append(
      el("small", "pr-app-context-kicker", "CURRENT VIEW"),
      el("strong", "pr-app-context-screen", "POKÉREGIONS"),
    );

    const right = el("div", "pr-app-meta");
    right.append(
      el("span", "pr-app-region", "REGION NETWORK"),
      el("span", "pr-app-build", "1.0 ALPHA"),
    );

    chrome.append(brand, context, right);
    shell.prepend(chrome);
  }

  const screen = readScreen(shell);
  const region = shell.dataset.prRegion ?? "";
  const screenNode = chrome.querySelector<HTMLElement>(".pr-app-context-screen");
  const regionNode = chrome.querySelector<HTMLElement>(".pr-app-region");

  const screenLabel = SCREEN_LABELS[screen];
  if (screenNode && screenNode.textContent !== screenLabel) {
    screenNode.textContent = screenLabel;
  }

  const regionLabel = REGION_LABELS[region] ?? "REGION NETWORK";
  if (regionNode && regionNode.textContent !== regionLabel) {
    regionNode.textContent = regionLabel;
  }

  if (region) chrome.dataset.region = region;
  else delete chrome.dataset.region;
};

let queued = false;
const queueChrome = () => {
  if (queued) return;
  queued = true;
  window.requestAnimationFrame(() => {
    queued = false;
    ensureChrome();
  });
};

export const mountDesignOverhaul = () => {
  document.body.classList.add("pr-design-overhaul");
  ensureChrome();

  const root = document.getElementById("root") ?? document.body;
  const observer = new MutationObserver(queueChrome);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-pr-screen", "data-pr-region"],
  });

  window.addEventListener("resize", queueChrome, { passive: true });
};
