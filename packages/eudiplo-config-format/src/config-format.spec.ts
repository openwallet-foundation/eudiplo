import { describe, expect, it, vi } from "vitest";
import {
    CONFIG_RESOURCE_KINDS,
    CONFIG_SINGLETON_IDS,
    type ConfigMigration,
    isConfigDocument,
    migrateDocument,
    normalizeDocument,
    resolveConfigIdentity,
    resourceId,
    schemaUrl,
    serializeDocument,
} from "./config-format.js";
import { validateConfigDocument } from "./config-validator.js";

const file = {
    $schema: schemaUrl("Tenant"),
    metadata: { generation: 3 },
    spec: { name: "Example" },
};

describe("portable schema identity and migrations", () => {
    it.each(CONFIG_RESOURCE_KINDS)(
        "resolves schema identity for %s",
        (kind) => {
            expect(resolveConfigIdentity({ $schema: schemaUrl(kind) })).toEqual(
                {
                    kind,
                    version: 1,
                },
            );
            const document = normalizeDocument({
                $schema: schemaUrl(kind),
                spec: CONFIG_SINGLETON_IDS[kind]
                    ? {}
                    : { [kind === "Client" ? "clientId" : "id"]: "test" },
            });
            expect(resourceId(document)).toBe(
                CONFIG_SINGLETON_IDS[kind] ?? "test",
            );
            expect(() => validateConfigDocument(document)).not.toThrow();
        },
    );

    it("serializes canonical files without legacy identifiers", () => {
        expect(serializeDocument(file)).toEqual(file);
        expect(migrateDocument(file, validateConfigDocument).issues).toEqual(
            [],
        );
    });

    it.each([
        { ...file, apiVersion: "eudiplo.dev/tenant/v1" },
        {
            ...file,
            $schema:
                "https://attacker.example/schemas/v2/TenantConfigFile.schema.json",
        },
        { ...file, $schema: `${schemaUrl("Tenant")}?version=1` },
        { ...file, $schema: schemaUrl("Tenant", 99) },
        { ...file, $schema: schemaUrl("Tenant", 2) },
        { ...file, metadata: { generation: 0 } },
        { ...file, metadata: { id: "tenant" } },
        { ...file, spec: [] },
        { ...file, unexpected: true },
    ])("rejects non-canonical envelopes", (input) =>
        expect(() => normalizeDocument(input)).toThrow(),
    );

    it("recognizes only schema-marked documents", () => {
        expect(isConfigDocument({ $schema: null })).toBe(true);
        expect(isConfigDocument({ apiVersion: "eudiplo.dev/tenant/v1" })).toBe(
            false,
        );
        expect(isConfigDocument({ name: "Legacy" })).toBe(false);
    });

    const step: ConfigMigration = {
        id: "rename-name",
        kind: "Tenant",
        from: 1,
        to: 2,
        migrate: (spec, metadata) => ({
            spec: { displayName: spec.name },
            metadata: { generation: metadata.generation },
        }),
    };

    it("validates source and target before advancing the version", () => {
        const validate = vi.fn(() => []);
        const result = migrateDocument(file, validate, [step], 2);
        expect(validate).toHaveBeenCalledTimes(2);
        expect(result.document.$schema).toBe(schemaUrl("Tenant", 2));
        expect(result.document.spec).toEqual({ displayName: "Example" });
        expect(result.migrations).toEqual(["rename-name"]);
    });

    it("refuses missing migration steps", () =>
        expect(() => migrateDocument(file, () => [], [], 2)).toThrow(
            "No unique migration",
        ));
});
