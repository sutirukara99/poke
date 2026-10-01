import fs from "node:fs";
import vm from "node:vm";

const file = "public/recovered/v1.0.0-alpha.1-r7.js";
const code = fs.readFileSync(file, "utf8");

try {
  new vm.Script(code, { filename: file });
  console.log("Generated alpha JavaScript syntax verified.");
} catch (error) {
  console.error("Generated alpha syntax error:", error?.name, error?.message);
  process.exit(1);
}
