#!/usr/bin/env tsx
import {
  CONFIG_FORMATS,
  CONFIG_SINGLETON_IDS,
  schemaUrl,
} from "../packages/eudiplo-config-format/src/config-format.js";
import "reflect-metadata";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { editorSchemaBundles } from "../apps/backend/src/platform/editor-schema.registry";

type SchemaEntry = {
  uri: string;
  fileMatch: string[];
  schema: Record<string, unknown>;
};

const checkOnly = process.argv.includes("--check");
const ROOT = resolve(process.cwd());
const SCHEMAS_DIR = join(ROOT, "schemas");
const CLIENT_SCHEMAS_FILE = join(
  ROOT,
  "apps/client/src/app/utils/schemas.json",
);
const CLIENT_API_SCHEMAS_FILE = join(
  ROOT,
  "apps/client/src/app/utils/api-schemas.json",
);
const TENANT_CONFIG_REGISTRY_FILE = join(
  ROOT,
  "apps/cli/src/commands/config/validate/registry.json",
);
const VSCODE_SETTINGS_FILE = join(ROOT, ".vscode/settings.json");

async function writeGeneratedFile(
  path: string,
  contents: string,
  encoding: "utf8" = "utf8",
) {
  if (process.argv.includes("--check")) {
    if ((await readFile(path, encoding)) !== contents)
      throw new Error(
        `Generated schema artifact is stale: ${path}. Run pnpm gen:api and review the config format version.`,
      );
    return;
  }
  await writeFile(path, contents, encoding);
}

function getIdBase(): string {
  const idBaseIndex = process.argv.indexOf("--id-base");
  if (idBaseIndex >= 0 && process.argv[idBaseIndex + 1]) {
    return process.argv[idBaseIndex + 1];
  }

  return "./";
}

const ID_BASE = getIdBase();

function emitSchema(name: string, schema: z.ZodTypeAny): SchemaEntry {
  const generated = z.toJSONSchema(schema, {
    target: "draft-2020-12",
  }) as Record<string, unknown>;

  const normalizedIdBase = ID_BASE.endsWith("/") ? ID_BASE : `${ID_BASE}/`;

  const finalSchema = {
    ...generated,
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${normalizedIdBase}${name}.schema.json`,
    title: name,
  };

  return {
    uri: `./${name}.schema.json`,
    fileMatch: [`a://b/${name}*.schema.json`],
    schema: finalSchema,
  };
}

function assertNoDuplicateSchemaNamesAndIds(schemaEntries: SchemaEntry[]) {
  const names = new Set<string>();
  const ids = new Set<string>();

  for (const entry of schemaEntries) {
    const name = entry.uri.replace(/^\.\//, "").replace(/\.schema\.json$/, "");
    if (names.has(name)) {
      throw new Error(`Duplicate schema name detected: ${name}`);
    }
    names.add(name);

    const id = entry.schema.$id as string | undefined;
    if (!id) {
      throw new Error(`Schema ${name} is missing $id`);
    }

    if (ids.has(id)) {
      throw new Error(`Duplicate schema id detected: ${id}`);
    }
    ids.add(id);
  }
}

async function writeSchemas(schemaEntries: SchemaEntry[]) {
  if (!existsSync(SCHEMAS_DIR)) {
    await mkdir(SCHEMAS_DIR, { recursive: true });
  }
  await Promise.all(
    schemaEntries.map(async ({ uri, schema }) => {
      const outputPath = join(SCHEMAS_DIR, `${uri.replace("./", "")}`);
      await writeGeneratedFile(
        outputPath,
        `${JSON.stringify(schema, null, 2)}\n`,
        "utf8",
      );
    }),
  );
}

async function mergeRegistry(
  schemaEntries: SchemaEntry[],
): Promise<SchemaEntry[]> {
  const generatedUris = new Set(schemaEntries.map((entry) => entry.uri));
  let currentRegistry: SchemaEntry[];
  if (existsSync(CLIENT_API_SCHEMAS_FILE)) {
    currentRegistry = JSON.parse(
      await readFile(CLIENT_API_SCHEMAS_FILE, "utf8"),
    ) as SchemaEntry[];
  } else if (existsSync(CLIENT_SCHEMAS_FILE)) {
    const existing = JSON.parse(
      await readFile(CLIENT_SCHEMAS_FILE, "utf8"),
    ) as SchemaEntry[];
    currentRegistry = existing.filter(
      (entry) => !generatedUris.has(entry.uri),
    );
    await writeGeneratedFile(
      CLIENT_API_SCHEMAS_FILE,
      `${JSON.stringify(currentRegistry, null, 2)}\n`,
      "utf8",
    );
  } else {
    throw new Error(
      `Missing ${CLIENT_API_SCHEMAS_FILE}. Restore the API schema baseline before generating client schemas.`,
    );
  }
  const preservedRegistry = currentRegistry.filter(
    (entry) => !generatedUris.has(entry.uri),
  );

  const mergedRegistry = [
    ...preservedRegistry,
    ...schemaEntries.toSorted((left, right) =>
      left.uri.localeCompare(right.uri),
    ),
  ];

  await writeGeneratedFile(
    CLIENT_SCHEMAS_FILE,
    `${JSON.stringify(mergedRegistry, null, 2)}\n`,
    "utf8",
  );

  return mergedRegistry;
}

type TenantConfigRegistryEntry = {
  schemaFile: string;
  fileMatch: string[];
};

/**
 * `apps/cli/src/commands/config/validate/registry.json` is the source of truth for which
 * tenant config-import files map to which schema; this keeps the editor's
 * `json.schemas` associations in `.vscode/settings.json` from drifting out of
 * sync with it.
 */
async function syncVSCodeSettingsJsonSchemas(): Promise<number> {
  // .vscode/ is excluded from Docker build contexts; skip when absent.
  if (!existsSync(VSCODE_SETTINGS_FILE)) return 0;

  const registryRaw = await readFile(TENANT_CONFIG_REGISTRY_FILE, "utf8");
  const registry = JSON.parse(registryRaw) as TenantConfigRegistryEntry[];

  const jsonSchemas = registry.map((entry) => ({
    fileMatch: entry.fileMatch,
    url: `./schemas/${entry.schemaFile}`,
  }));

  const settingsRaw = await readFile(VSCODE_SETTINGS_FILE, "utf8");
  const settings = JSON.parse(settingsRaw) as Record<string, unknown>;
  settings["json.schemas"] = jsonSchemas;

  await writeGeneratedFile(
    VSCODE_SETTINGS_FILE,
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf8",
  );
  return jsonSchemas.length;
}

async function main() {
  const schemaEntries = editorSchemaBundles.flatMap((bundle) =>
    bundle.schemas.map((definition) =>
      emitSchema(definition.name, definition.schema),
    ),
  );

  // Publish one canonical envelope so configuration identity always comes from $schema.
  for (const [kind, format] of Object.entries(CONFIG_FORMATS)) {
    const name = format.file;
    const uri = `./${name}.schema.json`;
    const generated = schemaEntries.find((entry) => entry.uri === uri);
    const schema =
      generated?.schema ??
      JSON.parse(
        await readFile(join(SCHEMAS_DIR, `${name}.schema.json`), "utf8"),
      );
    const alternatives = (schema.oneOf ?? schema.anyOf) as Record<
      string,
      any
    >[];
    const legacy = alternatives.find((item) => item.properties?.apiVersion);
    if (!legacy) {
      schema.description = "Configuration file identified by its $schema URL.";
      schema.oneOf = alternatives.filter((item) => item.properties?.$schema);
      if (generated) generated.schema = schema;
      continue;
    }
    const url = schemaUrl(kind as keyof typeof CONFIG_FORMATS);
    delete legacy.properties.$schema;
    const metadataSource = legacy.properties.metadata.$ref
      ? (schemaEntries.find(
          (entry) => entry.uri === legacy.properties.metadata.$ref,
        )?.schema ??
        JSON.parse(
          await readFile(
            join(SCHEMAS_DIR, legacy.properties.metadata.$ref),
            "utf8",
          ),
        ))
      : legacy.properties.metadata;
    const metadata = structuredClone(metadataSource);
    delete metadata.$id;
    delete metadata.$schema;
    delete metadata.title;
    delete metadata.properties.id;
    metadata.required = (metadata.required ?? []).filter(
      (field: string) => field !== "id",
    );
    if (!metadata.required.length) delete metadata.required;
    const idField = kind === "Client" ? "clientId" : "id";
    const spec = CONFIG_SINGLETON_IDS[kind as keyof typeof CONFIG_FORMATS]
      ? legacy.properties.spec
      : {
          allOf: [
            legacy.properties.spec,
            {
              type: "object",
              required: [idField],
              properties: { [idField]: { type: "string", minLength: 1 } },
            },
          ],
        };
    const historical = [];
    for (let version = 1; version < format.version; version++)
      historical.push(
        JSON.parse(
          await readFile(
            join(SCHEMAS_DIR, `v${version}`, `${name}.schema.json`),
            "utf8",
          ),
        ),
      );
    const canonical = {
      type: "object",
      properties: {
        $schema: { type: "string", const: url },
        metadata,
        spec,
      },
      required: ["$schema", "spec"],
      additionalProperties: false,
    };
    delete schema.anyOf;
    delete schema.oneOf;
    schema.oneOf = [canonical, ...historical];
    schema.description = "Configuration file identified by its $schema URL.";
    if (generated) generated.schema = schema;
    else
      schemaEntries.push({
        uri,
        fileMatch: [`a://b/${name}*.schema.json`],
        schema,
      });
  }

  assertNoDuplicateSchemaNamesAndIds(schemaEntries);
  const mergedRegistry = await mergeRegistry(schemaEntries);
  await writeSchemas(schemaEntries);
  const editorSchemaCount = await syncVSCodeSettingsJsonSchemas();

  const bundleNames = editorSchemaBundles
    .map((bundle) => bundle.domain)
    .join(", ");
  console.log(
    `✓ ${checkOnly ? "Verified" : "Wrote"} ${schemaEntries.length} generated schema(s) across ${bundleNames}; merged registry contains ${mergedRegistry.length} entries`,
  );
  console.log(
    `✓ ${checkOnly ? "Verified" : "Synced"} ${editorSchemaCount} tenant config-import association(s) into .vscode/settings.json`,
  );
}

main().catch((error) => {
  console.error("Schema generation failed:");
  console.error(error);
  process.exit(1);
});
