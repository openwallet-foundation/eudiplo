#!/usr/bin/env ts-node
/**
 * One-shot OpenAPI → JSON Schemas (+ TS types) generator.
 *
 * Usage:
 *   ts-node scripts/generate-from-openapi.ts \
 *     --url http://localhost:3000/api-json \
 *     --out generated
 *
 * Flags:
 *   --url <string>   OpenAPI endpoint (required)
 *   --out <dir>      Output directory (default: generated)
 *   --no-types       Skip generating TypeScript types
 *
 * Output:
 *   <out>/openapi.json
 *   <out>/json-schemas/*.schema.json (components + request/response schemas)
 *   <out>/openapi.d.ts (optional TS types)
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import fetch from "cross-fetch";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { openapiSchemaToJsonSchema } from "@openapi-contrib/openapi-schema-to-json-schema";
import { rmSync } from "node:fs";

type AnyObj = Record<string, any>;

const schemas: any[] = [];

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const URL: string = arg("url") || process.env.OPENAPI_URL || "";
const OUT_ROOT = resolve(arg("out", "generated")!);

if (!URL) {
  console.error("Error: --url is required (or set OPENAPI_URL).");
  process.exit(1);
}

const OUT_SPEC = join(OUT_ROOT, "openapi.json");
const OUT_SCHEMAS = join(OUT_ROOT);

function sanitize(name: string) {
  // Replace non-word characters with underscore
  let sanitized = String(name).replace(/[^\w.-]+/g, "_");
  
  // Remove leading underscores
  while (sanitized.startsWith("_")) {
    sanitized = sanitized.slice(1);
  }
  
  // Remove trailing underscores
  while (sanitized.endsWith("_")) {
    sanitized = sanitized.slice(0, -1);
  }
  
  return sanitized;
}

async function fetchOpenAPI(url: string, dest: string) {
  await mkdir(OUT_ROOT, { recursive: true });
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  await writeFile(dest, text, "utf8");
  console.log(`✓ Saved OpenAPI → ${dest}`);
}

async function loadAndBundle(specPath: string) {
  const raw = await readFile(specPath, "utf8");
  const spec: AnyObj = JSON.parse(raw);
  const version = String(spec.openapi || spec.swagger || "");
  // bundle() keeps $refs but resolves external files/anchors and avoids circular JSON
  const bundled = (await $RefParser.bundle(spec)) as AnyObj;
  return { bundled, version, isOAS31: version.startsWith("3.1") };
}

function withMeta(schema: AnyObj, name: string, baseUrl = "https://raw.githubusercontent.com/openwallet-foundation/eudiplo/refs/heads/main/schemas/") {
  const hasSchema = typeof schema?.$schema === "string";
  const hasId = typeof schema?.$id === "string";
  return {
    ...(hasSchema ? {} : { $schema: "https://json-schema.org/draft/2020-12/schema" }),
    ...(hasId ? {} : { $id: baseUrl + `${sanitize(name)}.schema.json` }),
    title: schema?.title ?? name,
    ...schema,
  };
}

/**
 * Recursively add additionalProperties: false to all object schemas
 * to ensure strict validation (no unknown properties allowed).
 */
function strictObjectSchemas(node: any): any {
  if (node == null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(strictObjectSchemas);

  const out: AnyObj = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = strictObjectSchemas(v);
  }

  // Add additionalProperties: false to object schemas that have properties
  // but don't already define additionalProperties
  if (
    out.type === "object" &&
    out.properties &&
    out.additionalProperties === undefined
  ) {
    out.additionalProperties = false;
  }

  return out;
}

/**
 * Rewrite internal OpenAPI component refs (#/components/schemas/Name[/tail])
 * into sibling file refs ("./Name.schema.json[/tail]").
 */
function rewriteComponentRefs(node: any): any {
  if (node == null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(rewriteComponentRefs);

  const out: AnyObj = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "$ref" && typeof v === "string") {
      // Match exactly: "#/components/schemas/Name" with optional trailing pointer
      const m = v.match(/^#\/components\/schemas\/([^\/#]+)(.*)$/);
      if (m) {
        const name = m[1];
        const tail = m[2] || "";
        out[k] = `./${sanitize(name)}.schema.json${tail}`;
        continue;
      }
    }
    out[k] = rewriteComponentRefs(v);
  }
  return out;
}

async function emitComponentSchemas(doc: AnyObj, isOAS31: boolean) {
  await mkdir(OUT_SCHEMAS, { recursive: true });
  const components = doc.components?.schemas || {};
  let count = 0;

  for (const [name, schema] of Object.entries<AnyObj>(components)) {
    const jsonSchema = isOAS31
      ? schema
      : openapiSchemaToJsonSchema(schema, { cloneSchema: true });
    const withIds = withMeta(jsonSchema, String(name));
    const rewritten = rewriteComponentRefs(withIds);
    const finalSchema = strictObjectSchemas(rewritten);
    const out = join(OUT_SCHEMAS, `${sanitize(String(name))}.schema.json`);
    await writeFile(out, JSON.stringify(finalSchema, null, 2), "utf8");
    count++;

    schemas.push({
      uri: finalSchema['$id'],
      fileMatch: [`a://b/${sanitize(name)}*.schema.json`],
      schema: finalSchema,
    });

  }

  console.log(`✓ Wrote ${count} component schema(s) → ${OUT_SCHEMAS}`);
}

function pickBestJsonResponse(responses: AnyObj): AnyObj | undefined {
  // Prefer 200, then other 2xx, then anything with application/json
  const keys = Object.keys(responses).sort((a, b) => {
    if (a === "200") return -1;
    if (b === "200") return 1;
    const a2xx = /^2\d\d$/.test(a);
    const b2xx = /^2\d\d$/.test(b);
    if (a2xx && !b2xx) return -1;
    if (!a2xx && b2xx) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
  for (const code of keys) {
    const c = responses[code]?.content?.["application/json"]?.schema;
    if (c) return c;
  }
  return undefined;
}

/**
 * Add manually-created schemas that don't come from OpenAPI components.
 * These schemas are imported directly from the schemas/ directory.
 * Currently empty - all schemas are auto-generated from the OpenAPI spec.
 */
async function addManualSchemas() {
  const manualSchemas: string[] = [];

  for (const filename of manualSchemas) {
    try {
      const schemaPath = join('schemas', filename);
      const content = await readFile(schemaPath, 'utf8');
      const schema = JSON.parse(content);
      const name = filename.replace('.schema.json', '');
      
      // Add additionalProperties: false to object items if not already set
      const finalSchema = strictObjectSchemas(schema);
      
      // Add defaultSnippets for better Monaco autocomplete
      if (finalSchema.type === 'array' && finalSchema.items?.type === 'object') {
        finalSchema.defaultSnippets = [{
          label: `${name} Entry`,
          description: `Add a ${name.toLowerCase()} entry`,
          body: Object.fromEntries(
            Object.keys(finalSchema.items.properties || {}).slice(0, 3).map(k => [k, `\${${k}}`])
          )
        }];
      }
      
      schemas.push({
        uri: finalSchema['$id'],
        fileMatch: [`a://b/${sanitize(name)}*.schema.json`],
        schema: finalSchema,
      });
      
      console.log(`✓ Added manual schema: ${filename}`);
    } catch (e) {
      console.warn(`⚠ Could not add manual schema ${filename}:`, e);
    }
  }
}

async function main() {

  // 0) clear folder
  await rmSync(OUT_SCHEMAS, { recursive: true, force: true });

  // 1) fetch spec
  await fetchOpenAPI(URL, OUT_SPEC);

  // 2) bundle (avoid circular JSON on stringify)
  const { bundled, isOAS31 } = await loadAndBundle(OUT_SPEC);

  // 3) emit JSON Schemas (components only, skip operations)
  await emitComponentSchemas(bundled, isOAS31);
  // await emitOperationSchemas(bundled, isOAS31); // Disabled: only store object schemas
  
  // 4) add manually-created schemas
  await addManualSchemas();
  
  writeFile('apps/client/src/app/utils/schemas.json', JSON.stringify(schemas, null, 2));

  // 5) remove openapi file
  rmSync(OUT_SPEC);

}

main().catch((e) => {
  console.error("Generation failed:");
  console.error(e);
  process.exit(1);
});
