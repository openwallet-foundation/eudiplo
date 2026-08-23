import { exportJWK, generateKeyPair } from "jose";
import { describe, expect, it, vi } from "vitest";
import type { KmsProviderRegistry } from "../../crypto/key/kms/kms-provider.registry";
import { ConfigKmsReferenceService } from "./config-kms-reference.service";

describe("ConfigKmsReferenceService", () => {
    it("proves that the referenced KMS key matches the supplied public JWK", async () => {
        const pair = await generateKeyPair("ES256", { extractable: true });
        const publicJwk = await exportJWK(pair.publicKey);
        const sign = vi.fn(
            async (_ref, challenge: Uint8Array) =>
                new Uint8Array(
                    await globalThis.crypto.subtle.sign(
                        { name: "ECDSA", hash: "SHA-256" },
                        pair.privateKey,
                        challenge,
                    ),
                ),
        );
        const registry = {
            resolve: vi.fn(() => ({ sign })),
        } as unknown as KmsProviderRegistry;

        await new ConfigKmsReferenceService(registry).verify("tenant-a", {
            provider: "vault",
            externalKeyId: "issuer-key",
            publicJwk,
        });

        expect(registry.resolve).toHaveBeenCalledWith("vault", "tenant-a");
        expect(sign).toHaveBeenCalledWith(
            expect.objectContaining({
                externalKeyId: "issuer-key",
                publicJwk,
                alg: "ES256",
            }),
            expect.any(Uint8Array),
        );
    });

    it("rejects an accessible KMS key when its public JWK is different", async () => {
        const signingPair = await generateKeyPair("ES256", {
            extractable: true,
        });
        const otherPair = await generateKeyPair("ES256", {
            extractable: true,
        });
        const registry = {
            resolve: () => ({
                sign: async (_ref: unknown, challenge: Uint8Array) =>
                    new Uint8Array(
                        await globalThis.crypto.subtle.sign(
                            { name: "ECDSA", hash: "SHA-256" },
                            signingPair.privateKey,
                            challenge,
                        ),
                    ),
            }),
        } as unknown as KmsProviderRegistry;

        await expect(
            new ConfigKmsReferenceService(registry).verify("tenant-a", {
                provider: "vault",
                externalKeyId: "issuer-key",
                publicJwk: await exportJWK(otherPair.publicKey),
            }),
        ).rejects.toThrow("does not match its public JWK");
    });
});
