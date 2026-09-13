#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");
const shared = "packages/eudiplo-config-format/src";
const files = [];
for (const version of readdirSync(resolve(root, "schemas"))
  .filter((name) => /^v[1-9][0-9]*$/.test(name))
  .sort()) {
  for (const file of readdirSync(resolve(root, "schemas", version))
    .filter((name) => name.endsWith(".schema.json"))
    .sort()) {
    files.push(
      JSON.parse(readFileSync(resolve(root, "schemas", version, file), "utf8")),
    );
  }
}
if (!files.length) throw new Error("No versioned config schema snapshots");
const generated = `// Generated from schemas/v*/. Run pnpm schemas:sync.\nexport const CONFIG_SCHEMAS: Record<string, any>[] = ${JSON.stringify(files, null, 2)};\n`;
function emit(path, text) {
  const file = resolve(root, path);
  if (check) {
    if (readFileSync(file, "utf8") !== text)
      throw new Error(`${path} is stale. Run pnpm schemas:sync.`);
  } else {
    mkdirSync(resolve(file, ".."), { recursive: true });
    writeFileSync(file, text);
  }
}
emit(`${shared}/config-schemas.generated.ts`, generated);
console.log(
  check
    ? "Config schemas snapshot is in sync."
    : "Generated config-schemas.generated.ts from schemas/v*/.",
);
