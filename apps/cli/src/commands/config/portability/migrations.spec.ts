import { describe, expect, it } from "vitest";
import { upgradeDocument } from "./migrations.js";

describe("offline configuration migrations", () => {
    it("matches the sequential issuance migration used by the API", () => {
        const result = upgradeDocument({
            apiVersion: "eudiplo.io/issuance-config/v1",
            kind: "IssuanceConfig",
            metadata: { id: "issuance", generation: 1 },
            spec: {
                walletProviderTrustLists: ["https://example.com/trust-list"],
            },
        });

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

    it("refuses to guess when a document is newer than the CLI", () => {
        expect(() =>
            upgradeDocument({
                apiVersion: "eudiplo.io/presentation-config/v99",
                kind: "PresentationConfig",
                metadata: { id: "future" },
                spec: {},
            }),
        ).toThrow("newer than supported");
    });
});
