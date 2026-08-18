import { readCliTextAsset } from "../sea-assets.js";
import { requiredSchemaFiles } from "./registry.js";

const manifestAssetKey = "templates/schemas.manifest.json";

export async function loadTenantConfigSchemas(): Promise<Map<string, Record<string, unknown>>> {
    const manifest = await readSchemaManifest();
    const schemas = new Map<string, Record<string, unknown>>();

    for (const schemaFile of requiredSchemaFiles()) {
        if (!manifest.includes(schemaFile)) {
            throw new Error(
                `Bundled schema manifest is missing "${schemaFile}". Run "pnpm --filter @eudiplo/cli assets:sync".`,
            );
        }

        const text = await readCliTextAsset(
            `templates/schemas/${schemaFile}`,
            new URL(`../../templates/schemas/${schemaFile}`, import.meta.url),
        );
        schemas.set(schemaFile, JSON.parse(text));
    }

    return schemas;
}

async function readSchemaManifest(): Promise<string[]> {
    const text = await readCliTextAsset(
        manifestAssetKey,
        new URL("../../templates/schemas.manifest.json", import.meta.url),
    );
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
        throw new Error("Bundled schema manifest is malformed.");
    }
    return parsed;
}
