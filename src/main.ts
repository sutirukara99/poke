/// <reference types="vite/client" />
import "./styles/alpha.css";
import "./styles/game-experience.css";
import "./styles/maintenance.css";
import "./styles/design-overhaul.css";
import "./styles/gameplay-overhaul.css";
import { ACTIVE_BUILD, RECOVERY_BASELINE } from "./recovery/version";
import { waitForMaintenanceAccess } from "./cloud/maintenance";
import { mountCloudAccountUi } from "./cloud/account-ui";
import { mountAdminUi } from "./cloud/admin-ui";
import { mountGameGrantSync } from "./cloud/game-grant-sync";
import { mountLeaderboardUi } from "./cloud/leaderboard-ui";
import { mountBattleVisualPolish } from "./polish/battle-visuals";
import { mountDesignOverhaul } from "./polish/design-overhaul";
import { mountGameExperience } from "./polish/game-experience";
import { mountGameSoundHooks } from "./polish/game-audio";

declare global {
  interface Window {
    __POKEREGIONS_RECOVERY__?: typeof RECOVERY_BASELINE;
    __POKEREGIONS_BUILD__?: typeof ACTIVE_BUILD;
    __POKEREGIONS_ACTIVE_RELICS__?: string[];
  }
}

window.__POKEREGIONS_RECOVERY__ = RECOVERY_BASELINE;
window.__POKEREGIONS_BUILD__ = ACTIVE_BUILD;

let bootTimer: number | undefined;
let bootObserver: MutationObserver | undefined;
let booted = false;
let launcherBoot: HTMLElement | null = null;
let launcherBootRemoveTimer: number | undefined;

const mountLauncherBoot = () => {
  if (launcherBoot?.isConnected) return launcherBoot;

  const overlay = document.createElement("div");
  overlay.id = "pokeregions-launcher-boot";
  overlay.className = "pr-launcher-boot";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="pr-launcher-boot-window">
      <div class="pr-launcher-boot-brand">
        <span class="pr-launcher-boot-mark" aria-hidden="true"></span>
        <span>
          <small>POKÉREGIONS CLIENT</small>
          <strong>PokéRegions</strong>
        </span>
      </div>
      <div class="pr-launcher-boot-copy">
        <span class="pr-launcher-boot-kicker">OPEN ALPHA · ${ACTIVE_BUILD.version}</span>
        <h1>Expedition wird vorbereitet.</h1>
        <p class="pr-launcher-boot-status">Lade Regionen, Trainerprofil und Spielsysteme …</p>
      </div>
      <div class="pr-launcher-boot-progress" aria-hidden="true"><i></i></div>
      <div class="pr-launcher-boot-foot">
        <span>LOCAL SAVE</span>
        <span>CLOUD SYNC</span>
        <span>GAME CLIENT</span>
      </div>
    </div>
  `;
  document.body.append(overlay);
  launcherBoot = overlay;
  return overlay;
};

const updateLauncherBoot = (message: string, stage: string) => {
  const overlay = launcherBoot;
  if (!overlay) return;
  overlay.dataset.stage = stage;
  const status = overlay.querySelector<HTMLElement>(".pr-launcher-boot-status");
  if (status) status.textContent = message;
};

const dismissLauncherBoot = () => {
  const overlay = launcherBoot;
  if (!overlay) return;
  overlay.classList.add("is-ready");
  if (launcherBootRemoveTimer !== undefined) window.clearTimeout(launcherBootRemoveTimer);
  launcherBootRemoveTimer = window.setTimeout(() => {
    overlay.remove();
    if (launcherBoot === overlay) launcherBoot = null;
  }, 360);
};

const stopBootWatch = () => {
  if (bootTimer !== undefined) {
    window.clearTimeout(bootTimer);
    bootTimer = undefined;
  }
  bootObserver?.disconnect();
  bootObserver = undefined;
};

const showBootFailure = (message: string) => {
  const root = document.getElementById("root");
  if (!root) return;

  stopBootWatch();
  if (launcherBootRemoveTimer !== undefined) window.clearTimeout(launcherBootRemoveTimer);
  launcherBoot?.remove();
  launcherBoot = null;
  document.body.classList.remove("pr-maintenance-mode", "pr-maintenance-unlock");
  document.body.classList.add("pr-design-overhaul");

  const recovery = document.createElement("main");
  recovery.className = "alpha-boot-recovery";
  recovery.setAttribute("role", "alert");

  const kicker = document.createElement("p");
  kicker.className = "alpha-boot-kicker";
  kicker.textContent = "POKÉREGIONS · 1.0 ALPHA";

  const heading = document.createElement("h1");
  heading.textContent = "Die Alpha konnte nicht vollständig geladen werden.";

  const copy = document.createElement("p");
  copy.textContent = message;

  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Neu laden";
  reload.addEventListener("click", () => window.location.reload());

  const note = document.createElement("small");
  note.textContent = "Dein lokaler Spielstand bleibt dabei erhalten.";

  recovery.append(kicker, heading, copy, reload, note);
  root.replaceChildren(recovery);
};

const guardBattlefieldInteraction = (event: Event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const battlefield = target.closest(".battle-field");
  if (!battlefield) return;
  if (
    target.closest(
      "button, a, input, select, textarea, [role='button'], .floating-tooltip-trigger",
    )
  ) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
};

const bootGame = () => {
  if (booted) return;
  booted = true;

  document.body.classList.add("pr-design-overhaul");
  document.addEventListener("pointerdown", guardBattlefieldInteraction, true);
  document.addEventListener("click", guardBattlefieldInteraction, true);

  const root = document.getElementById("root");
  if (!root) {
    showBootFailure("Das Root-Element der Anwendung wurde nicht gefunden.");
    return;
  }

  mountLauncherBoot();
  updateLauncherBoot("Prüfe Spielstand und starte den Alpha-Client …", "client");

  const script = document.createElement("script");
  script.src = `${import.meta.env.BASE_URL}${ACTIVE_BUILD.javascriptAsset}`;
  script.async = false;
  script.dataset.recoveredBuild = RECOVERY_BASELINE.version;
  script.dataset.activeBuild = ACTIVE_BUILD.version;

  script.addEventListener("load", () => {
    updateLauncherBoot("Client geladen. Baue deinen Trainer-Hub auf …", "profile");
  });

  script.addEventListener("error", () => {
    showBootFailure(
      "Eine Spieldatei konnte nicht geladen werden. Bitte lade die Seite neu.",
    );
  });

  bootObserver = new MutationObserver(() => {
    if (root.querySelector(".alpha-shell") && !root.querySelector(".alpha-boot-recovery")) {
      updateLauncherBoot("Bereit. Willkommen zurück, Trainer.", "ready");
      dismissLauncherBoot();
      stopBootWatch();
    }
  });
  bootObserver.observe(root, { childList: true, subtree: true });

  document.head.appendChild(script);

  // Avoid a silent blank screen if cache, extensions or a network problem stop
  // the recovered game client before React can mount.
  bootTimer = window.setTimeout(() => {
    const currentRoot = document.getElementById("root");
    if (currentRoot && !currentRoot.querySelector(".alpha-shell")) {
      showBootFailure(
        "Der Start dauert ungewöhnlich lange. Ein Neuladen behebt meist einen veralteten Cache.",
      );
    }
  }, 15_000);

  void mountCloudAccountUi();
  void mountAdminUi();
  void mountGameGrantSync();
  void mountLeaderboardUi();
  mountBattleVisualPolish();
  mountGameExperience();
  mountDesignOverhaul();
  mountGameSoundHooks();
};

const start = async () => {
  try {
    // The recovered game asset is intentionally not requested before this
    // resolves. Normal visitors therefore stay on the maintenance shell.
    await waitForMaintenanceAccess();
    bootGame();
  } catch (error) {
    showBootFailure(
      error instanceof Error
        ? error.message
        : "Der Start konnte nicht vorbereitet werden.",
    );
  }
};

void start();
