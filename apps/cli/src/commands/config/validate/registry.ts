import registryData from "./registry.json" with { type: "json" };
import type { TenantResourceDefinition } from "./types.js";

const TENANT_RESOURCE_REGISTRY: readonly TenantResourceDefinition[] =
    registryData as TenantResourceDefinition[];

/** Resources scanned by the CLI validator, excluding editor-only schemas. */
export const CLI_VALIDATED_REGISTRY: readonly TenantResourceDefinition[] =
    TENANT_RESOURCE_REGISTRY.filter((entry) => entry.cliValidated !== false);

export function requiredSchemaFiles(): string[] {
    return Array.from(new Set(CLI_VALIDATED_REGISTRY.map((entry) => entry.schemaFile)));
}
