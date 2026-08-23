import { describe, expect, it } from "vitest";
import { ConfigMigrationService } from "./config-migration.service";
import { ConfigResourceRegistry } from "./config-resource.registry";

describe("ConfigMigrationService", () => {
    const registry = new ConfigResourceRegistry();
    const service = new ConfigMigrationService(registry);

    it("wraps bare legacy configuration and upgrades sequentially", () => {
        const input = service.wrapLegacy(
            "IssuanceConfig",
            { walletProviderTrustLists: ["https://example.com/trust-list"] },
            "issuance",
        );

        const result = service.upgrade(input);

        expect(result.document.apiVersion).toBe(
            "eudiplo.io/issuance-config/v2",
        );
        expect(result.document.spec.walletProviderTrustLists).toEqual([
            { url: "https://example.com/trust-list" },
        ]);
        expect(result.migrations).toEqual(["IssuanceConfig/1-to-2"]);
        expect(result.issues[0]).toMatchObject({
            severity: "required-input",
            code: "TRUST_LIST_VERIFIER_REQUIRED",
        });
    });

    it("migrates a legacy private JWK into an explicit key source", () => {
        const result = service.upgrade(
            service.wrapLegacy(
                "KeyChain",
                { id: "issuer", key: { kty: "EC", d: "private" } },
                "issuer",
            ),
        );

        expect(result.document.spec).toMatchObject({
            keySource: {
                type: "private-jwk",
                jwk: { kty: "EC", d: "private" },
            },
        });
        expect(service.unwrapForLegacyImporter(result.document)).toMatchObject({
            id: "issuer",
            key: { kty: "EC", d: "private" },
        });
    });

    it("reports every non-automatable presentation migration input", () => {
        const result = service.upgrade(
            service.wrapLegacy(
                "PresentationConfig",
                {
                    id: "age-check",
                    webhook: { url: "https://example.com/callback" },
                    dcql_query: {
                        credentials: [
                            {
                                trusted_authorities: [
                                    {
                                        type: "etsi_tl",
                                        values: ["https://example.com/tl"],
                                    },
                                ],
                            },
                        ],
                    },
                },
                "age-check",
            ),
        );

        expect(result.migrations).toEqual(["PresentationConfig/1-to-2"]);
        expect(result.issues.map((issue) => issue.code)).toEqual([
            "WEBHOOK_ENDPOINT_REFERENCE_REQUIRED",
            "TRUST_LIST_VERIFIER_REQUIRED",
        ]);
        expect(
            (
                result.document.spec.dcql_query.credentials[0]
                    .trusted_authorities[0].values as unknown[]
            )[0],
        ).toEqual({ url: "https://example.com/tl" });
    });

    it("rejects configuration newer than this runtime", () => {
        expect(() =>
            service.upgrade({
                apiVersion: "eudiplo.io/tenant/v99",
                kind: "Tenant",
                metadata: { id: "tenant" },
                spec: {},
            }),
        ).toThrow("newer than supported");
    });
});
