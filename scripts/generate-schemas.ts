#!/usr/bin/env tsx
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

const ROOT = resolve(process.cwd());
const SCHEMAS_DIR = join(ROOT, "schemas");
const CLIENT_SCHEMAS_FILE = join(ROOT, "apps/client/src/app/utils/schemas.json");
const TENANT_CONFIG_REGISTRY_FILE = join(
    ROOT,
    "apps/cli/src/commands/config/validate/registry.json",
);
const VSCODE_SETTINGS_FILE = join(ROOT, ".vscode/settings.json");

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
            await writeFile(
                outputPath,
                `${JSON.stringify(schema, null, 2)}\n`,
                "utf8",
            );
        }),
    );
}

async function mergeRegistry(schemaEntries: SchemaEntry[]): Promise<SchemaEntry[]> {
    const currentRegistryRaw = await readFile(CLIENT_SCHEMAS_FILE, "utf8");
    const currentRegistry = JSON.parse(currentRegistryRaw) as SchemaEntry[];
    const generatedUris = new Set(schemaEntries.map((entry) => entry.uri));
    const preservedRegistry = currentRegistry.filter(
        (entry) => !generatedUris.has(entry.uri),
    );

    const mergedRegistry = [
        ...preservedRegistry,
        ...schemaEntries.toSorted((left, right) => left.uri.localeCompare(right.uri)),
    ];

    await writeFile(
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
    const registryRaw = await readFile(TENANT_CONFIG_REGISTRY_FILE, "utf8");
    const registry = JSON.parse(registryRaw) as TenantConfigRegistryEntry[];

    const jsonSchemas = registry.map((entry) => ({
        fileMatch: entry.fileMatch,
        url: `./schemas/${entry.schemaFile}`,
    }));

    const settingsRaw = await readFile(VSCODE_SETTINGS_FILE, "utf8");
    const settings = JSON.parse(settingsRaw) as Record<string, unknown>;
    settings["json.schemas"] = jsonSchemas;

    await writeFile(VSCODE_SETTINGS_FILE, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return jsonSchemas.length;
}

async function main() {
    const schemaEntries = editorSchemaBundles.flatMap((bundle) =>
        bundle.schemas.map((definition) => emitSchema(definition.name, definition.schema)),
    );

    assertNoDuplicateSchemaNamesAndIds(schemaEntries);
    const mergedRegistry = await mergeRegistry(schemaEntries);
    await writeSchemas(schemaEntries);
    const editorSchemaCount = await syncVSCodeSettingsJsonSchemas();

    const bundleNames = editorSchemaBundles
        .map((bundle) => bundle.domain)
        .join(", ");
    console.log(
        `✓ Wrote ${schemaEntries.length} generated schema(s) across ${bundleNames}; merged registry contains ${mergedRegistry.length} entries`,
    );
    console.log(
        `✓ Synced ${editorSchemaCount} tenant config-import association(s) into .vscode/settings.json`,
    );
}

main().catch((error) => {
    console.error("Schema generation failed:");
    console.error(error);
    process.exit(1);
});
