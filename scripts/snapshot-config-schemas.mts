#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CONFIG_FORMATS,
  SCHEMA_BASE,
} from "../packages/eudiplo-config-format/src/config-format.js";

// Explicit, additive publication step. Existing snapshots are never overwritten.
const root = resolve(import.meta.dirname, "..");
const checkOnly = process.argv.includes("--check");
const requestedKind = process.argv
  .slice(2)
  .find((argument) => argument !== "--check");
if (requestedKind && !Object.hasOwn(CONFIG_FORMATS, requestedKind))
  throw new Error(`Unknown resource kind: ${requestedKind}`);
const pending = new Map<string, string>();
async function collect(name: string, version: number, envelope = false) {
  const path = `v${version}/${name}.schema.json`;
  if (pending.has(path)) return;
  const schema = JSON.parse(
    await readFile(resolve(root, "schemas", `${name}.schema.json`), "utf8"),
  );
  const output = envelope
    ? {
        $schema: schema.$schema,
        $id: `${SCHEMA_BASE}${path}`,
        title: name,
        ...schema.oneOf.find(
          (entry: any) =>
            entry.properties?.$schema && !entry.properties?.apiVersion,
        ),
      }
    : { ...schema, $id: `${SCHEMA_BASE}${path}` };
  if (envelope && !output.properties)
    throw new Error(`No canonical envelope in ${name}`);
  pending.set(path, `${JSON.stringify(output, null, 2)}\n`);
  const refs = new Set<string>();
  function visit(value: any) {
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string" && !value.$ref.startsWith("#")) {
      const match = /^\.\/([A-Za-z0-9]+)\.schema\.json(?:#.*)?$/.exec(
        value.$ref,
      );
      if (!match) throw new Error(`Non-local schema reference: ${value.$ref}`);
      refs.add(match[1]);
    }
    Object.values(value).forEach(visit);
  }
  visit(output);
  for (const ref of refs) await collect(ref, version);
}
for (const [kind, format] of Object.entries(CONFIG_FORMATS)) {
  if (requestedKind && kind !== requestedKind) continue;
  await collect(format.file, format.version, true);
}
// Bundle dependencies per resource. Shared DTO filenames must not couple the
// independent version histories of two different configuration resource types.
const bundled = new Map<string, string>();
for (const [path, text] of pending) {
  const envelope = JSON.parse(text);
  if (!envelope.properties?.$schema) continue;
  const version = path.split("/")[0];
  const definitions: Record<string, any> = {};
  function rewrite(value: any, owner?: string): any {
    if (Array.isArray(value)) return value.map((item) => rewrite(item, owner));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (key !== "$ref" || typeof item !== "string")
          return [key, rewrite(item, owner)];
        if (item.startsWith("#"))
          return [key, owner ? `#/$defs/${owner}${item.slice(1)}` : item];
        const match = /^\.\/([A-Za-z0-9]+)\.schema\.json(#.*)?$/.exec(item);
        if (!match) throw new Error(`Unsupported schema reference: ${item}`);
        const name = match[1];
        if (!(name in definitions)) {
          definitions[name] = {};
          const dependency = JSON.parse(
            pending.get(`${version}/${name}.schema.json`)!,
          );
          delete dependency.$id;
          delete dependency.$schema;
          definitions[name] = rewrite(dependency, name);
        }
        return [key, `#/$defs/${name}${(match[2] ?? "#").slice(1)}`];
      }),
    );
  }
  const body = rewrite(envelope);
  body.properties.$schema = envelope.properties.$schema;
  const output = {
    $schema: envelope.$schema,
    $id: envelope.$id,
    ...body,
    ...(Object.keys(definitions).length
      ? {
          $defs: Object.fromEntries(
            Object.entries(definitions).sort(([a], [b]) => a.localeCompare(b)),
          ),
        }
      : {}),
  };
  bundled.set(path, `${JSON.stringify(output, null, 2)}\n`);
}
pending.clear();
for (const [path, text] of bundled) pending.set(path, text);

// Preflight the whole graph before writing anything.
for (const [path, text] of pending) {
  const file = resolve(root, "schemas", path);
  if (checkOnly && !existsSync(file))
    throw new Error(`Missing published schema snapshot: ${path}`);
  if (existsSync(file) && (await readFile(file, "utf8")) !== text)
    throw new Error(
      `Published schema ${path} differs. Bump the resource format version; snapshots cannot be overwritten.`,
    );
}
for (const [path, text] of pending) {
  if (checkOnly) continue;
  const file = resolve(root, "schemas", path);
  await mkdir(resolve(file, ".."), { recursive: true });
  if (!existsSync(file)) await writeFile(file, text, { flag: "wx" });
}
console.log(
  `Verified/snapshotted ${pending.size} schemas. Run pnpm schemas:sync next.`,
);
