import { describe, expect, it } from "vitest";
import { ConfigDocumentValidationService } from "./config-document-validation.service";
import { ConfigMigrationService } from "./config-migration.service";
import { ConfigResourceRegistry } from "./config-resource.registry";

describe("ConfigDocumentValidationService", () => {
    const migrations = new ConfigMigrationService(new ConfigResourceRegistry());
    const service = new ConfigDocumentValidationService(migrations);

    it("accepts an explicit key-regeneration decision", () => {
        expect(
            service.validate({
                apiVersion: "eudiplo.io/key-chain/v2",
                kind: "KeyChain",
                metadata: { id: "issuer" },
                spec: {
                    id: "issuer",
                    usageType: "attestation",
                    kmsProvider: "db",
                    keySource: {
                        type: "regenerate",
                        keyChainType: "internalChain",
                    },
                },
            }),
        ).toEqual([]);
    });

    it("reports envelope/spec identity mismatches", () => {
        expect(
            service.validate({
                apiVersion: "eudiplo.io/client/v1",
                kind: "Client",
                metadata: { id: "expected" },
                spec: {
                    clientId: "different",
                    roles: ["clients:manage"],
                },
            }),
        ).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "RESOURCE_ID_MISMATCH" }),
            ]),
        );
    });
});
