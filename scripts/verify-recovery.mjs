import { readFile } from "node:fs/promises";

const js = await readFile(new URL("../public/recovered/v0.9.4.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/recovered/v0.9.4.css", import.meta.url), "utf8");

const checks = [
  [js.includes("v0.9.4"), "JavaScript bundle does not contain v0.9.4 marker"],
  [js.includes("createRoot"), "JavaScript bundle does not contain React root bootstrap"],
  [js.length > 650_000, "JavaScript bundle is unexpectedly small"],
  [js.includes("saveVersion:5"), "JavaScript bundle does not contain save schema v5"],
  [js.includes("pokerogue-regions-backup"), "JavaScript bundle does not contain the legacy backup compatibility marker"],
  [css.includes("@import"), "CSS bundle does not contain expected imports"],
  [css.includes("Press Start 2P"), "CSS bundle does not contain the expected pixel-font layer"],
  [css.includes(".achievement-toast"), "CSS bundle does not contain achievement UI styles"],
  [css.length > 190_000, "CSS bundle is unexpectedly small"],
];

for (const [ok, message] of checks) {
  if (!ok) throw new Error(message);
}

console.log("Recovered v0.9.4 assets verified.");
console.log("JS chars:", js.length);
console.log("CSS chars:", css.length);
