import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const checks = [
  {
    dir: "recovery/chunks/js",
    parts: 10,
    sha256: "0f2a4c155d47de05eadd996f820b9fe8538e1e959dd4811ae1c6f7d5d68a425e",
    label: "v0.9.4 JavaScript",
  },
  {
    dir: "recovery/chunks/css",
    parts: 3,
    sha256: "b43de0091f6fe45df06262136b9d53add6c6cdbf30233b63ef05061e2248813f",
    label: "v0.9.4 CSS",
  },
];

for (const check of checks) {
  const chunks = [];
  for (let i = 1; i <= check.parts; i += 1) {
    const part = String(i).padStart(2, "0") + ".part";
    chunks.push(await readFile(new URL(`../${check.dir}/${part}`, import.meta.url)));
  }
  const digest = createHash("sha256").update(Buffer.concat(chunks)).digest("hex");
  if (digest !== check.sha256) {
    throw new Error(`${check.label} checksum mismatch: ${digest}`);
  }
  console.log(`verified ${check.label}: ${digest}`);
}
