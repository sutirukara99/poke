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

const script = document.createElement("script");
script.src = `${import.meta.env.BASE_URL}${ACTIVE_BUILD.javascriptAsset}`;
script.async = false;
script.dataset.recoveredBuild = RECOVERY_BASELINE.version;
script.dataset.activeBuild = ACTIVE_BUILD.version;

script.addEventListener("error", () => {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <main style="font-family:system-ui;padding:2rem;max-width:760px;margin:auto">
        <h1>1.0-Alpha konnte nicht geladen werden</h1>
        <p>Der rekonstruierte Build fehlt oder ist beschädigt. Führe <code>npm run rebuild:alpha</code> aus.</p>
      </main>
    `;
  }
});

document.head.appendChild(script);
