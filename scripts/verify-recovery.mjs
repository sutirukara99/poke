import { readFile } from "node:fs/promises";

const js = await readFile(new URL("../public/recovered/v0.9.4.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/recovered/v0.9.4.css", import.meta.url), "utf8");

const checks = [
  [js.includes("v0.9.4"), "JavaScript bundle does not contain v0.9.4 marker"],
  [js.includes("createRoot"), "JavaScript bundle does not contain React root bootstrap"],
  [js.length > 650_000, "JavaScript bundle is unexpectedly small"],
  [css.includes("@import"), "CSS bundle does not contain expected imports"],
  [css.length > 190_000, "CSS bundle is unexpectedly small"],
];

for (const [ok, message] of checks) {
  if (!ok) throw new Error(message);
}

console.log("Recovered v0.9.4 assets verified.");
console.log("JS chars:", js.length);
console.log("CSS chars:", css.length);
