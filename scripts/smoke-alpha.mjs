import { readFile } from "node:fs/promises";

const js = await readFile(new URL("../public/recovered/v1.0.0-alpha.1.js", import.meta.url), "utf8");
const required = [
  "1.0.0-alpha.1",
  "QalphaAscensionMax",
  "DAILY-",
  "Rogue Codex",
  "Species Mastery",
  "RUN SCORE",
  "bossTelegraph",
  "lootReroll",
  "rescued-return",
  "debt-collector",
  "rocket-cache",
  "shrine-guardian",
  "rogue-die",
  "black-feather",
  "secret-route",
  "QalphaCompletion",
  "QalphaSetLane",
];

const missing = required.filter((needle) => !js.includes(needle));
if (missing.length) {
  throw new Error(`Alpha smoke check failed; missing markers: ${missing.join(", ")}`);
}
if (js.length < 700_000) throw new Error(`Alpha bundle unexpectedly small: ${js.length}`);

console.log(`Alpha smoke check passed (${js.length} chars, ${required.length} system markers).`);
const forbidden = [
  "returnQalphaRelic",
  "returnQalphaDamage",
  "returnQalphaIncoming",
  "returnQalphaMoney",
  "returnQalphaXp",
];

const accidentalTokens = forbidden.filter((needle) => js.includes(needle));
if (accidentalTokens.length) {
  throw new Error(`Alpha bundle contains concatenated runtime identifiers: ${accidentalTokens.join(", ")}`);
}

if (!js.includes('const QalphaRelic=(a,i)=>a?.includes?.(i)')) {
  throw new Error("Alpha relic helper missing from generated bundle.");
}
