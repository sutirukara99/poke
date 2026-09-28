import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const specs = [
  {
    name: "v0.9.4.js",
    dir: "recovery/chunks/js",
    parts: 10,
  },
  {
    name: "v0.9.4.css",
    dir: "recovery/chunks/css",
    parts: 3,
  },
];

await mkdir(new URL("../public/recovered/", import.meta.url), { recursive: true });

for (const spec of specs) {
  const chunks = [];
  for (let i = 1; i <= spec.parts; i += 1) {
    const part = String(i).padStart(2, "0") + ".part";
    chunks.push(await readFile(new URL(`../${spec.dir}/${part}`, import.meta.url)));
  }
  const output = Buffer.concat(chunks);
  await writeFile(new URL(`../public/recovered/${spec.name}`, import.meta.url), output);
  console.log(`assembled ${spec.name}: ${output.length} bytes`);
}
