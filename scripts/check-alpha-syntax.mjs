import fs from "node:fs";
import vm from "node:vm";

const file = "public/recovered/v1.0.0-alpha.1-r7.js";
const code = fs.readFileSync(file, "utf8");

try {
  new vm.Script(code, { filename: file });
  console.log("Generated alpha JavaScript syntax verified.");
} catch (error) {
  console.error("Generated alpha syntax error:", error?.name, error?.message);
  const stack = String(error?.stack ?? "");
  const header = stack.match(/v1\.0\.0-alpha\.1-r7\.js:(\d+)/);
  const lineNumber = header ? Number(header[1]) : 0;
  const stackLines = stack.split("\n");
  const caretLine = stackLines.find((line) => /^\s*\^+\s*$/.test(line));
  const column = caretLine ? caretLine.indexOf("^") + 1 : 0;
  if (lineNumber && column) {
    const sourceLine = code.split("\n")[lineNumber - 1] ?? "";
    const start = Math.max(0, column - 180);
    const end = Math.min(sourceLine.length, column + 180);
    console.error(`Location: line ${lineNumber}, column ${column}`);
    console.error(sourceLine.slice(start, end));
    console.error(" ".repeat(Math.max(0, column - start - 1)) + "^");
  }
  process.exit(1);
}
