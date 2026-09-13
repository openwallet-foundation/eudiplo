#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");
const shared = "apps/backend/src/shared/config-format";
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
for (const name of [
  "config-format.ts",
  "config-validator.ts",
  "config-bundle.ts",
  "config-io.ts",
  "config-values.ts",
  "config-schemas.generated.ts",
]) {
  const text =
    name === "config-schemas.generated.ts"
      ? generated
      : readFileSync(resolve(root, shared, name), "utf8");
  emit(
    `apps/cli/src/generated/${name}`,
    `// Generated from ${shared}/${name}. Run pnpm schemas:sync.\n${text}`,
  );
}
console.log(
  check
    ? "Shared config format and schemas are in sync."
    : "Bundled shared config format and schemas.",
);
