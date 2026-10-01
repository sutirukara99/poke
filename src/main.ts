/// <reference types="vite/client" />
import "./styles/alpha.css";
import { ACTIVE_BUILD, RECOVERY_BASELINE } from "./recovery/version";
import { mountCloudAccountUi } from "./cloud/account-ui";
import { mountAdminUi } from "./cloud/admin-ui";
import { mountGameGrantSync } from "./cloud/game-grant-sync";
import { mountLeaderboardUi } from "./cloud/leaderboard-ui";
import { mountBattleVisualPolish } from "./polish/battle-visuals";

declare global {
  interface Window {
    __POKEREGIONS_RECOVERY__?: typeof RECOVERY_BASELINE;
    __POKEREGIONS_BUILD__?: typeof ACTIVE_BUILD;
    __POKEREGIONS_ACTIVE_RELICS__?: string[];
  }
}

window.__POKEREGIONS_RECOVERY__ = RECOVERY_BASELINE;
window.__POKEREGIONS_BUILD__ = ACTIVE_BUILD;

const guardBattlefieldInteraction = (event: Event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const battlefield = target.closest(".battle-field");
  if (!battlefield) return;
  if (target.closest("button, a, input, select, textarea, [role='button'], .floating-tooltip-trigger")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
};

document.addEventListener("pointerdown", guardBattlefieldInteraction, true);
document.addEventListener("click", guardBattlefieldInteraction, true);

const script = document.createElement("script");
script.src = `${import.meta.env.BASE_URL}${ACTIVE_BUILD.javascriptAsset}`;
script.async = false;
script.dataset.recoveredBuild = RECOVERY_BASELINE.version;
script.dataset.activeBuild = ACTIVE_BUILD.version;

let bootTimer: number | undefined;
let bootObserver: MutationObserver | undefined;

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

script.addEventListener("error", () => {
  showBootFailure("Eine Spieldatei konnte nicht geladen werden. Bitte lade die Seite neu.");
});

const root = document.getElementById("root");
if (root) {
  bootObserver = new MutationObserver(() => {
    if (root.childElementCount > 0 && !root.querySelector(".alpha-boot-recovery")) {
      stopBootWatch();
    }
  });
  bootObserver.observe(root, { childList: true });
}

document.head.appendChild(script);

// Avoid a silent blank screen if a browser extension, cache entry or network error
// interrupts startup before React can mount. The observer cancels this as soon as
// the application renders successfully.
bootTimer = window.setTimeout(() => {
  const currentRoot = document.getElementById("root");
  if (currentRoot && currentRoot.childElementCount === 0) {
    showBootFailure("Der Start dauert ungewöhnlich lange. Ein Neuladen behebt meist einen veralteten Cache.");
  }
}, 15_000);


void mountCloudAccountUi();
void mountAdminUi();
void mountGameGrantSync();
void mountLeaderboardUi();
mountBattleVisualPolish();
