/// <reference types="vite/client" />
import "./styles/alpha.css";
import { ACTIVE_BUILD, RECOVERY_BASELINE } from "./recovery/version";

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

const showBootFailure = (message: string) => {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <main class="alpha-boot-recovery" role="alert">
      <p class="alpha-boot-kicker">POKÉREGIONS · 1.0 ALPHA</p>
      <h1>Die Alpha konnte nicht vollständig geladen werden.</h1>
      <p>${message}</p>
      <button type="button" onclick="location.reload()">Neu laden</button>
      <small>Dein lokaler Spielstand bleibt dabei erhalten.</small>
    </main>
  `;
};

script.addEventListener("error", () => {
  showBootFailure("Eine Spieldatei konnte nicht geladen werden. Bitte lade die Seite neu.");
});

document.head.appendChild(script);

// Avoid a silent blank screen if a browser extension, cache entry or network error
// interrupts startup before React can mount.
window.setTimeout(() => {
  const root = document.getElementById("root");
  if (root && root.childElementCount === 0) {
    showBootFailure("Der Start dauert ungewöhnlich lange. Ein Neuladen behebt meist einen veralteten Cache.");
  }
}, 12_000);
