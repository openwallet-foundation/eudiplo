#!/usr/bin/env tsx
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
    AwsKmsConfigSchema,
    CscKmsConfigSchema,
    DbKmsConfigSchema,
    HttpKmsConfigSchema,
    KmsConfigSchema,
    Pkcs11KmsConfigSchema,
    VaultKmsConfigSchema,
} from "../src/crypto/key/schemas/kms-config.schema";

type SchemaEntry = {
    uri: string;
    fileMatch: string[];
    schema: Record<string, unknown>;
};

type SchemaDefinition = {
    name: string;
    schema: z.ZodTypeAny;
};

type SchemaBundle = {
    label: string;
    definitions: SchemaDefinition[];
};

const ROOT = resolve(process.cwd(), "../..");
const SCHEMAS_DIR = join(ROOT, "schemas");
const CLIENT_SCHEMAS_FILE = join(
    ROOT,
    "apps/client/src/app/utils/schemas.json",
);

const schemaBundles: SchemaBundle[] = [
    {
        label: "KMS",
        definitions: [
            { name: "DbKmsConfigDto", schema: DbKmsConfigSchema },
            { name: "VaultKmsConfigDto", schema: VaultKmsConfigSchema },
            { name: "AwsKmsConfigDto", schema: AwsKmsConfigSchema },
            { name: "Pkcs11KmsConfigDto", schema: Pkcs11KmsConfigSchema },
            { name: "HttpKmsConfigDto", schema: HttpKmsConfigSchema },
            { name: "CscKmsConfigDto", schema: CscKmsConfigSchema },
            { name: "KmsConfigDto", schema: KmsConfigSchema },
        ],
    },
];

function emitSchema(definition: SchemaDefinition): SchemaEntry {
    const generated = z.toJSONSchema(definition.schema, {
        target: "draft-2020-12",
    }) as Record<string, unknown>;

    const finalSchema = {
        ...generated,
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: `./${definition.name}.schema.json`,
        title: definition.name,
    };

    return {
        uri: `./${definition.name}.schema.json`,
        fileMatch: [`a://b/${definition.name}*.schema.json`],
        schema: finalSchema,
    };
}

async function writeSchemas(schemaEntries: SchemaEntry[]) {
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

async function mergeRegistry(schemaEntries: SchemaEntry[]) {
    const currentRegistryRaw = await readFile(CLIENT_SCHEMAS_FILE, "utf8");
    const currentRegistry = JSON.parse(currentRegistryRaw) as SchemaEntry[];
    const replacementByUri = new Map(
        schemaEntries.map((entry) => [entry.uri, entry]),
    );

    const mergedRegistry = currentRegistry.map(
        (entry) => replacementByUri.get(entry.uri) ?? entry,
    );
    for (const entry of schemaEntries) {
        if (!mergedRegistry.some((item) => item.uri === entry.uri)) {
            mergedRegistry.push(entry);
        }
    }

    await writeFile(
        CLIENT_SCHEMAS_FILE,
        `${JSON.stringify(mergedRegistry, null, 2)}\n`,
        "utf8",
    );
}

async function main() {
    const schemaEntries = schemaBundles.flatMap((bundle) =>
        bundle.definitions.map((definition) => emitSchema(definition)),
    );

    await writeSchemas(schemaEntries);
    await mergeRegistry(schemaEntries);

    const bundleNames = schemaBundles.map((bundle) => bundle.label).join(", ");
    console.log(
        `✓ Wrote ${schemaEntries.length} schema(s) across ${bundleNames}`,
    );
}

main().catch((error) => {
    console.error("Schema generation failed:");
    console.error(error);
    process.exit(1);
});
