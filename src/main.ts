import { RECOVERY_BASELINE } from "./recovery/version";

declare global {
  interface Window {
    __POKEREGIONS_RECOVERY__?: typeof RECOVERY_BASELINE;
  }
}

window.__POKEREGIONS_RECOVERY__ = RECOVERY_BASELINE;

const script = document.createElement("script");
script.src = "/recovered/v0.9.4.js";
script.async = false;
script.dataset.recoveredBuild = RECOVERY_BASELINE.version;

script.addEventListener("error", () => {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <main style="font-family:system-ui;padding:2rem;max-width:760px;margin:auto">
        <h1>Recovery-Build konnte nicht geladen werden</h1>
        <p>Führe <code>npm run assemble:recovery</code> aus und starte den Server danach neu.</p>
      </main>
    `;
  }
});

document.head.appendChild(script);
