#!/usr/bin/env tsx
import "reflect-metadata";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { editorSchemaBundles } from "../apps/backend/src/shared/common/zod/editor-schema.registry";
import type { EditorSchemaBundle } from "../apps/backend/src/shared/common/zod/editor-schema";

type SchemaEntry = {
    uri: string;
    fileMatch: string[];
    schema: Record<string, unknown>;
};

function addDiscriminatorHints(node: unknown): unknown {
    if (Array.isArray(node)) {
        return node.map((item) => addDiscriminatorHints(item));
    }

    if (!node || typeof node !== "object") {
        return node;
    }

    const out = Object.fromEntries(
        Object.entries(node as Record<string, unknown>).map(([key, value]) => [
            key,
            addDiscriminatorHints(value),
        ]),
    ) as Record<string, unknown>;

    const variants = Array.isArray(out.oneOf)
        ? (out.oneOf as Array<Record<string, unknown>>)
        : undefined;

    if (!variants || variants.length < 2) {
        return out;
    }

    const candidateTags = ["type", "format", "method", "policy"];

    const findTagValues = (tag: string) => {
        const values: string[] = [];

        for (const variant of variants) {
            if (!variant || typeof variant !== "object") {
                return undefined;
            }

            const properties = variant.properties as Record<string, unknown> | undefined;
            const property = properties?.[tag] as Record<string, unknown> | undefined;
            const value = property?.const;

            if (typeof value !== "string") {
                return undefined;
            }

            values.push(value);
        }

        return values;
    };

    let chosenTag: string | undefined;
    let chosenValues: string[] | undefined;

    for (const tag of candidateTags) {
        const values = findTagValues(tag);
        if (values) {
            chosenTag = tag;
            chosenValues = values;
            break;
        }
    }

    if (!chosenTag || !chosenValues) {
        return out;
    }

    const existingProperties =
        (out.properties as Record<string, unknown> | undefined) ?? {};
    const existingTagProperty =
        (existingProperties[chosenTag] as Record<string, unknown> | undefined) ??
        {};

    out.type ??= "object";
    out.properties = {
        ...existingProperties,
        [chosenTag]: {
            ...existingTagProperty,
            type: "string",
            enum: [...new Set(chosenValues)],
        },
    };

    out.discriminator = {
        propertyName: chosenTag,
        mapping: Object.fromEntries(
            chosenValues.map((value, index) => [value, `#/oneOf/${index}`]),
        ),
    };

    return out;
}

const ROOT = resolve(process.cwd());
const SCHEMAS_DIR = join(ROOT, "schemas");
const CLIENT_SCHEMAS_FILE = join(ROOT, "apps/client/src/app/utils/schemas.json");

function getIdBase(): string {
    const idBaseIndex = process.argv.indexOf("--id-base");
    if (idBaseIndex >= 0 && process.argv[idBaseIndex + 1]) {
        return process.argv[idBaseIndex + 1];
    }

    return "./";
}

const ID_BASE = getIdBase();

function emitSchema(bundle: EditorSchemaBundle, name: string, schema: z.ZodTypeAny): SchemaEntry {
    const generated = z.toJSONSchema(schema, {
        target: "draft-2020-12",
    }) as Record<string, unknown>;
    const enhanced = addDiscriminatorHints(generated) as Record<string, unknown>;

    const normalizedIdBase = ID_BASE.endsWith("/") ? ID_BASE : `${ID_BASE}/`;

    const finalSchema = {
        ...enhanced,
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

async function main() {
    const schemaEntries = editorSchemaBundles.flatMap((bundle) =>
        bundle.schemas.map((definition) => emitSchema(bundle, definition.name, definition.schema)),
    );

    assertNoDuplicateSchemaNamesAndIds(schemaEntries);
    const mergedRegistry = await mergeRegistry(schemaEntries);
    await writeSchemas(schemaEntries);

    const bundleNames = editorSchemaBundles
        .map((bundle) => bundle.domain)
        .join(", ");
    console.log(
        `✓ Wrote ${schemaEntries.length} generated schema(s) across ${bundleNames}; merged registry contains ${mergedRegistry.length} entries`,
    );
}

main().catch((error) => {
    console.error("Schema generation failed:");
    console.error(error);
    process.exit(1);
});