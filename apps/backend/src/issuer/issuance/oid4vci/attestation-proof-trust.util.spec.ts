import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrustStoreService } from "../../../trust/trust-store.service.js";
import type { X509ValidationService } from "../../../trust/x509-validation.service.js";
import {
    validateAttestationProofTrust,
    validateJwtProofAttestationTrust,
} from "./attestation-proof-trust.util.js";

// Signature and holder binding are checked by the OID4VCI library before these
// helpers run. These tests isolate the additional provider trust decision.
function jwt(header: Record<string, unknown>): string {
    return `${Buffer.from(JSON.stringify(header)).toString("base64url")}.e30.c2ln`;
}

describe("credential proof attestation trust", () => {
    const refs = [
        { url: "https://trust.example/list", verifierX509Der: "cert" },
    ];
    const getTrustStore = vi.fn();
    const parseX5c = vi.fn();
    const parseTrustAnchors = vi.fn();
    const buildPath = vi.fn();
    const pathMatchesTrustedEntities = vi.fn();
    const deps = {
        trustStoreService: { getTrustStore } as unknown as TrustStoreService,
        x509ValidationService: {
            parseX5c,
            parseTrustAnchors,
            buildPath,
            pathMatchesTrustedEntities,
        } as unknown as X509ValidationService,
    };

    beforeEach(() => {
        vi.resetAllMocks();
        getTrustStore.mockResolvedValue({ entities: [{ services: [] }] });
        parseX5c.mockReturnValue(["provider-certificate"]);
        parseTrustAnchors.mockReturnValue(["anchor"]);
        buildPath.mockResolvedValue(["provider-certificate", "anchor"]);
        pathMatchesTrustedEntities.mockResolvedValue({ entity: {} });
    });

    for (const proofType of ["attestation", "jwt"] as const) {
        const validate = (attestation: string, trustLists = refs) =>
            proofType === "attestation"
                ? validateAttestationProofTrust(attestation, trustLists, deps)
                : validateJwtProofAttestationTrust(
                      jwt({ key_attestation: attestation, jwk: { kty: "EC" } }),
                      trustLists,
                      deps,
                  );

        describe(proofType, () => {
            it("rejects attestation when no provider trust is configured", async () => {
                await expect(
                    validate(jwt({ x5c: ["cert"] }), []),
                ).rejects.toMatchObject({
                    response: {
                        error: "invalid_proof",
                        error_description: expect.stringContaining(
                            "No wallet provider trust lists configured",
                        ),
                    },
                });
            });

            it("validates the attestation signer against issuer trust", async () => {
                await validate(jwt({ x5c: ["attestation-signer"] }));
                expect(parseX5c).toHaveBeenCalledWith(["attestation-signer"]);
                expect(getTrustStore).toHaveBeenCalledWith(
                    expect.objectContaining({ lotes: refs }),
                );
                expect(pathMatchesTrustedEntities).toHaveBeenCalled();
            });

            it("rejects an untrusted provider", async () => {
                pathMatchesTrustedEntities.mockResolvedValue(null);
                await expect(
                    validate(jwt({ x5c: ["untrusted"] })),
                ).rejects.toMatchObject({
                    response: {
                        error: "invalid_proof",
                        error_description: expect.stringContaining(
                            "signer is not trusted",
                        ),
                    },
                });
            });

            it("rejects missing certificates", async () => {
                await expect(
                    validate(jwt({ jwk: { kty: "EC" } })),
                ).rejects.toMatchObject({
                    response: {
                        error: "invalid_proof",
                        error_description: expect.stringContaining(
                            "must contain an x5c",
                        ),
                    },
                });
            });

            it("rejects unavailable trust lists", async () => {
                getTrustStore.mockRejectedValue(new Error("unavailable"));
                await expect(
                    validate(jwt({ x5c: ["cert"] })),
                ).rejects.toThrow();
            });
        });
    }

    it("allows plain JWT holder proofs without provider trust", async () => {
        await validateJwtProofAttestationTrust(
            jwt({ jwk: { kty: "EC" } }),
            [],
            deps,
        );
        expect(getTrustStore).not.toHaveBeenCalled();
    });

    it("rejects malformed embedded attestations", async () => {
        await expect(
            validateJwtProofAttestationTrust(
                jwt({ key_attestation: {} }),
                refs,
                deps,
            ),
        ).rejects.toMatchObject({
            response: {
                error: "invalid_proof",
                error_description: expect.stringContaining(
                    "must be a compact JWT",
                ),
            },
        });
    });
});
