import type { Session } from "@supabase/supabase-js";
import { isCurrentUserAdmin } from "./backend";
import {
  cloudConfigured,
  getSession,
  signInWithPassword,
  signOut,
  supabase,
} from "./supabase";

const MAINTENANCE_FLAG = "maintenance_mode";
const BYPASS_KEY = "pokeregions-maintenance-admin-bypass";
const FORCE_MAINTENANCE = true;

type MaintenanceConfig = {
  eyebrow: string;
  title: string;
  message: string;
  detail: string;
  status: string;
};

type MaintenanceState = {
  active: boolean;
  backendReachable: boolean;
  config: MaintenanceConfig;
};

const DEFAULT_CONFIG: MaintenanceConfig = {
  eyebrow: "POKÉREGIONS · SYSTEM UPDATE",
  title: "Die nächste Expedition wird gerade vorbereitet.",
  message:
    "PokéRegions befindet sich kurz im Wartungsmodus. Wir überarbeiten Oberfläche, Spielfluss und Präsentation für die nächste Alpha-Version.",
  detail:
    "Dein lokaler Fortschritt und deine Cloud-Saves bleiben erhalten. Sobald die Arbeiten abgeschlossen sind, kannst du hier direkt weiterspielen.",
  status: "WARTUNGSARBEITEN",
};

const readConfig = (value: unknown): MaintenanceConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_CONFIG;
  const config = value as Record<string, unknown>;
  const stringValue = (key: keyof MaintenanceConfig) =>
    typeof config[key] === "string" && String(config[key]).trim()
      ? String(config[key]).trim()
      : DEFAULT_CONFIG[key];

  return {
    eyebrow: stringValue("eyebrow"),
    title: stringValue("title"),
    message: stringValue("message"),
    detail: stringValue("detail"),
    status: stringValue("status"),
  };
};

const loadMaintenanceState = async (): Promise<MaintenanceState> => {
  if (!cloudConfigured || !supabase) {
    return { active: true, backendReachable: false, config: DEFAULT_CONFIG };
  }

  try {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("flag_key,enabled,config")
      .eq("flag_key", MAINTENANCE_FLAG)
      .maybeSingle();

    if (error) throw error;

    return {
      active: data ? Boolean(data.enabled) : true,
      backendReachable: true,
      config: readConfig(data?.config),
    };
  } catch {
    // Maintenance fails closed. A temporary backend problem must never expose
    // a half-deployed game build to normal players.
    return { active: true, backendReachable: false, config: DEFAULT_CONFIG };
  }
};

const adminSession = async (session: Session | null) => {
  if (!session) return false;
  try {
    return await isCurrentUserAdmin();
  } catch {
    return false;
  }
};

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

const createRegionSignal = (name: string, code: string, modifier: string) => {
  const card = make("div", "pr-maint-region-card");
  card.dataset.region = modifier;
  const marker = make("span", "pr-maint-region-marker", code);
  const copy = make("span", "pr-maint-region-copy");
  copy.append(make("b", "", name), make("small", "", "REGION SIGNAL"));
  card.append(marker, copy);
  return card;
};

const renderMaintenance = (
  root: HTMLElement,
  state: MaintenanceState,
  session: Session | null,
  isAdmin: boolean,
  unlock: () => void,
) => {
  root.replaceChildren();
  document.body.classList.add("pr-maintenance-mode");

  const page = make("main", "pr-maintenance-page");
  page.setAttribute("aria-label", "PokéRegions Wartungsarbeiten");

  const topbar = make("header", "pr-maint-topbar");
  const brand = make("div", "pr-maint-brand");
  const ball = make("span", "pr-maint-ball");
  ball.setAttribute("aria-hidden", "true");
  const brandCopy = make("span", "pr-maint-brand-copy");
  brandCopy.append(
    make("b", "", "POKÉREGIONS"),
    make("small", "", "ROGUELIKE EXPEDITIONS"),
  );
  brand.append(ball, brandCopy);

  const adminButton = make(
    "button",
    "pr-maint-admin-button",
    isAdmin ? "ADMIN · SPIEL ÖFFNEN" : "ADMIN LOGIN",
  );
  adminButton.type = "button";
  topbar.append(brand, adminButton);

  const stage = make("section", "pr-maint-stage");
  const content = make("div", "pr-maint-content");
  const eyebrow = make("p", "pr-maint-eyebrow", state.config.eyebrow);
  const title = make("h1", "", state.config.title);
  const message = make("p", "pr-maint-lead", state.config.message);
  const detail = make("p", "pr-maint-detail", state.config.detail);

  const statusRow = make("div", "pr-maint-status-row");
  const status = make("span", "pr-maint-status");
  status.append(make("i"), document.createTextNode(state.config.status));
  const backend = make(
    "span",
    "pr-maint-backend",
    state.backendReachable ? "BACKEND VERBUNDEN" : "BACKEND WIRD GEPRÜFT",
  );
  backend.dataset.state = state.backendReachable ? "online" : "checking";
  statusRow.append(status, backend);

  const note = make("div", "pr-maint-note");
  note.append(
    make("strong", "", "DEIN FORTSCHRITT BLEIBT SICHER"),
    make(
      "small",
      "",
      "Lokale Saves und Cloud-Saves werden durch die Wartungsseite nicht verändert.",
    ),
  );

  content.append(eyebrow, title, message, detail, statusRow, note);

  const visual = make("aside", "pr-maint-visual");
  const visualHead = make("div", "pr-maint-visual-head");
  visualHead.append(
    make("span", "", "REGION NETWORK"),
    make("small", "", "GEN 1–4"),
  );

  const orbit = make("div", "pr-maint-orbit");
  const core = make("div", "pr-maint-core");
  core.append(make("b", "", "PR"), make("small", "", "ALPHA"));
  orbit.append(core);

  const regions = make("div", "pr-maint-regions");
  regions.append(
    createRegionSignal("KANTO", "01", "kanto"),
    createRegionSignal("JOHTO", "02", "johto"),
    createRegionSignal("HOENN", "03", "hoenn"),
    createRegionSignal("SINNOH", "04", "sinnoh"),
  );

  visual.append(visualHead, orbit, regions);
  stage.append(content, visual);

  const footer = make("footer", "pr-maint-footer");
  footer.append(
    make("span", "", "pokeregions.de"),
    make("span", "", "1.0 ALPHA"),
    make("span", "", "MAINTENANCE BUILD"),
  );

  const backdrop = make("div", "pr-maint-login-backdrop");
  backdrop.hidden = true;
  const panel = make("section", "pr-maint-login-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Admin Login");

  const close = make("button", "pr-maint-login-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Admin Login schließen");

  const kicker = make("p", "pr-maint-login-kicker", "POKÉREGIONS CONTROL");
  const panelTitle = make("h2", "", "Admin-Zugang");
  const panelCopy = make(
    "p",
    "pr-maint-login-copy",
    "Nur Accounts mit der Backend-Rolle admin können die Wartungsseite umgehen.",
  );
  const statusText = make("p", "pr-maint-login-status");

  const form = make("form", "pr-maint-login-form");
  const email = document.createElement("input");
  email.type = "email";
  email.autocomplete = "email";
  email.placeholder = "E-Mail";
  email.required = true;

  const password = document.createElement("input");
  password.type = "password";
  password.autocomplete = "current-password";
  password.placeholder = "Passwort";
  password.required = true;

  const submit = make("button", "pr-maint-login-submit", "ADMIN LOGIN");
  submit.type = "submit";
  form.append(email, password, submit);

  const accountHint = make("small", "pr-maint-login-hint");
  if (session && !isAdmin) {
    accountHint.textContent =
      "Es ist bereits ein normaler Account angemeldet. Der Admin-Login ersetzt diese Sitzung auf diesem Gerät.";
  } else {
    accountHint.textContent =
      "Die Berechtigung wird nach dem Login direkt gegen deine Backend-Rollen geprüft.";
  }

  panel.append(close, kicker, panelTitle, panelCopy, form, statusText, accountHint);
  backdrop.append(panel);
  page.append(topbar, stage, footer, backdrop);
  root.append(page);

  const setLoginStatus = (message: string, error = false) => {
    statusText.textContent = message;
    statusText.dataset.state = error ? "error" : "ok";
  };

  const openLogin = () => {
    if (isAdmin) {
      sessionStorage.setItem(BYPASS_KEY, "1");
      unlock();
      return;
    }
    backdrop.hidden = false;
    window.setTimeout(() => email.focus(), 20);
  };

  const closeLogin = () => {
    backdrop.hidden = true;
    setLoginStatus("");
  };

  adminButton.addEventListener("click", openLogin);
  close.addEventListener("click", closeLogin);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeLogin();
  });

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && !backdrop.hidden) closeLogin();
    },
    { once: false },
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    setLoginStatus("Zugang wird geprüft …");

    try {
      const nextSession = await signInWithPassword(email.value.trim(), password.value);
      const allowed = await adminSession(nextSession);
      if (!allowed) {
        await signOut();
        setLoginStatus("Dieser Account besitzt keine Admin-Berechtigung.", true);
        submit.disabled = false;
        return;
      }

      setLoginStatus("Admin bestätigt. PokéRegions wird geladen.");
      sessionStorage.setItem(BYPASS_KEY, "1");
      window.setTimeout(unlock, 180);
    } catch (error) {
      setLoginStatus(
        error instanceof Error ? error.message : "Admin-Login fehlgeschlagen.",
        true,
      );
      submit.disabled = false;
    }
  });
};

export const waitForMaintenanceAccess = async () => {
  const loaded = await loadMaintenanceState();
  const state = FORCE_MAINTENANCE ? { ...loaded, active: true } : loaded;
  if (!state.active) {
    sessionStorage.removeItem(BYPASS_KEY);
    return;
  }

  let session: Session | null = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }

  const isAdmin = await adminSession(session);
  if (isAdmin && sessionStorage.getItem(BYPASS_KEY) === "1") return;

  const root = document.getElementById("root");
  if (!root) throw new Error("PokéRegions Root-Element fehlt.");

  await new Promise<void>((resolve) => {
    const unlock = () => {
      document.body.classList.add("pr-maintenance-unlock");
      window.setTimeout(() => {
        root.replaceChildren();
        document.body.classList.remove(
          "pr-maintenance-mode",
          "pr-maintenance-unlock",
        );
        resolve();
      }, 180);
    };

    renderMaintenance(root, state, session, isAdmin, unlock);
  });
};
