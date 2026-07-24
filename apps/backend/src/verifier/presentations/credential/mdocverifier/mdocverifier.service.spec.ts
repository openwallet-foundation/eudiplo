import { DeviceResponse, Verifier } from "@owf/mdoc";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MdocverifierService } from "./mdocverifier.service";

describe("MdocverifierService failure classification", () => {
    let service: MdocverifierService;

    beforeEach(() => {
        const chainValidation = {
            getTrustedCertificateBuffers: vi.fn().mockResolvedValue([]),
        };
        const logger = {
            setContext: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        };

        service = new MdocverifierService(
            chainValidation as any,
            logger as any,
        );
    });

    it("maps chain_build_failed to no_trust_chain_to_root", () => {
        const failureType = (service as any).mapChainErrorToFailureType(
            "chain_build_failed",
        );

        expect(failureType).toBe("no_trust_chain_to_root");
    });

    it("keeps signature_invalid when chain probe does not fail", async () => {
        vi.spyOn(DeviceResponse, "decode").mockReturnValue({
            documents: [{}],
        } as any);

        vi.spyOn(service as any, "extractErrorDetails").mockResolvedValue({
            docType: "org.iso.18013.5.1.mDL",
            issuerCertInfo: "issuer",
            issuerThumbprint: "thumb",
            issuerValidity: "validity",
            trustedCertsSummary: "none",
        });

        vi.spyOn(
            service as any,
            "validateIssuerCertificateChain",
        ).mockResolvedValue({
            verified: true,
            matchedEntity: null,
        });

        const result = await (service as any).handleVerificationError(
            "AA",
            new Error(
                "Unable to verify deviceAuth signature (ECDSA/EdDSA): Device signature must be valid",
            ),
            {
                trustListSource: { lotes: [] },
                policy: { requireX5c: true },
            },
        );

        expect(result.failureType).toBe("signature_invalid");
    });

    it("overrides signature_invalid with trust-chain failure when probe fails", async () => {
        vi.spyOn(DeviceResponse, "decode").mockReturnValue({
            documents: [{}],
        } as any);

        vi.spyOn(service as any, "extractErrorDetails").mockResolvedValue({
            docType: "org.iso.18013.5.1.mDL",
            issuerCertInfo: "issuer",
            issuerThumbprint: "thumb",
            issuerValidity: "validity",
            trustedCertsSummary: "none",
        });

        vi.spyOn(
            service as any,
            "validateIssuerCertificateChain",
        ).mockResolvedValue({
            verified: false,
            matchedEntity: null,
            error: "chain_build_failed",
            errorDetails: "No issuer chain to trusted root",
        });

        const result = await (service as any).handleVerificationError(
            "AA",
            new Error(
                "Unable to verify deviceAuth signature (ECDSA/EdDSA): Device signature must be valid",
            ),
            {
                trustListSource: { lotes: [] },
                policy: { requireX5c: true },
            },
        );

        expect(result.failureType).toBe("no_trust_chain_to_root");
        expect(result.failureReason).toBe("No issuer chain to trusted root");
    });
});

describe("MdocverifierService revocation mode", () => {
    let service: MdocverifierService;
    let chainValidation: {
        getTrustedCertificateBuffers: ReturnType<typeof vi.fn>;
        getTrustedStatusCertificateBuffers: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.restoreAllMocks();

        chainValidation = {
            getTrustedCertificateBuffers: vi
                .fn()
                .mockResolvedValue([new Uint8Array([1, 2, 3])]),
            getTrustedStatusCertificateBuffers: vi
                .fn()
                .mockResolvedValue([new Uint8Array([4, 5, 6])]),
        };

        const logger = {
            setContext: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
        };

        service = new MdocverifierService(
            chainValidation as any,
            logger as any,
        );

        vi.spyOn(DeviceResponse, "decode").mockReturnValue({
            documents: [
                {
                    docType: "org.iso.18013.5.1.mDL",
                    issuerSigned: {
                        issuerNamespaces: {
                            issuerNamespaces: new Map<string, unknown>(),
                        },
                        getPrettyClaims: vi.fn().mockReturnValue(undefined),
                        issuerAuth: {
                            x5chain: [new Uint8Array([9, 9, 9])],
                        },
                    },
                },
            ],
        } as any);

        vi.spyOn(
            service as any,
            "validateIssuerCertificateChain",
        ).mockResolvedValue({
            verified: true,
            matchedEntity: null,
        });
    });

    it("retries without status anchors in best-effort mode when status list is unavailable", async () => {
        const verifyDeviceResponse = vi
            .spyOn(Verifier, "verifyDeviceResponse")
            .mockRejectedValueOnce(
                new Error("Status list fetch timed out after 10000ms"),
            )
            .mockResolvedValueOnce(undefined as any);

        const result = await service.verify(
            "AA",
            {
                protocol: "iso-18013-7",
                sessionTranscript: {} as any,
            },
            {
                trustListSource: { lotes: [] },
                policy: {
                    requireX5c: true,
                    revocation: {
                        enabled: true,
                        failClosed: false,
                    },
                },
            } as any,
        );

        expect(result.verified).toBe(true);
        expect(verifyDeviceResponse).toHaveBeenCalledTimes(2);

        const firstCallTrusted = verifyDeviceResponse.mock.calls[0][0]
            .trustedCertificates as Array<Record<string, unknown>>;
        const secondCallTrusted = verifyDeviceResponse.mock.calls[1][0]
            .trustedCertificates as Array<Record<string, unknown>>;
        const firstDisableStatusValidation =
            verifyDeviceResponse.mock.calls[0][0].disableStatusValidation;
        const secondDisableStatusValidation =
            verifyDeviceResponse.mock.calls[1][0].disableStatusValidation;

        expect(firstCallTrusted[0].status).toBeDefined();
        expect(secondCallTrusted[0].status).toBeUndefined();
        expect(firstDisableStatusValidation).toBe(false);
        expect(secondDisableStatusValidation).toBe(true);
    });

    it("does not retry in strict mode when status list is unavailable", async () => {
        const verifyDeviceResponse = vi
            .spyOn(Verifier, "verifyDeviceResponse")
            .mockRejectedValueOnce(
                new Error("Status list fetch timed out after 10000ms"),
            );

        const result = await service.verify(
            "AA",
            {
                protocol: "iso-18013-7",
                sessionTranscript: {} as any,
            },
            {
                trustListSource: { lotes: [] },
                policy: {
                    requireX5c: true,
                    revocation: {
                        enabled: true,
                        failClosed: true,
                    },
                },
            } as any,
        );

        expect(result.verified).toBe(false);
        expect(verifyDeviceResponse).toHaveBeenCalledTimes(1);
    });

    it("passes only trusted issuance anchors to the mdoc library when available", async () => {
        const verifyDeviceResponse = vi
            .spyOn(Verifier, "verifyDeviceResponse")
            .mockResolvedValueOnce(undefined as any);

        await service.verify(
            "AA",
            {
                protocol: "iso-18013-7",
                sessionTranscript: {} as any,
            },
            {
                trustListSource: { lotes: [] },
                policy: {
                    requireX5c: true,
                    revocation: {
                        enabled: true,
                        failClosed: true,
                    },
                },
            } as any,
        );

        const trustedCertificates = verifyDeviceResponse.mock.calls[0][0]
            .trustedCertificates as Array<Record<string, Uint8Array[]>>;
        const disableStatusValidation =
            verifyDeviceResponse.mock.calls[0][0].disableStatusValidation;

        expect(trustedCertificates).toHaveLength(1);
        expect(trustedCertificates[0].issuance).toEqual([
            new Uint8Array([1, 2, 3]),
        ]);
        expect(trustedCertificates[0].status).toEqual([
            new Uint8Array([4, 5, 6]),
        ]);
        expect(disableStatusValidation).toBe(false);
    });

    it("attaches status anchors for mdoc compatibility even when revocation is disabled", async () => {
        const verifyDeviceResponse = vi
            .spyOn(Verifier, "verifyDeviceResponse")
            .mockResolvedValueOnce(undefined as any);

        await service.verify(
            "AA",
            {
                protocol: "iso-18013-7",
                sessionTranscript: {} as any,
            },
            {
                trustListSource: { lotes: [] },
                policy: {
                    requireX5c: true,
                    revocation: {
                        enabled: false,
                        failClosed: false,
                    },
                },
            } as any,
        );

        const trustedCertificates = verifyDeviceResponse.mock.calls[0][0]
            .trustedCertificates as Array<Record<string, Uint8Array[]>>;
        const disableStatusValidation =
            verifyDeviceResponse.mock.calls[0][0].disableStatusValidation;

        expect(trustedCertificates).toHaveLength(1);
        expect(trustedCertificates[0].issuance).toEqual([
            new Uint8Array([1, 2, 3]),
        ]);
        expect(trustedCertificates[0].status).toEqual([
            new Uint8Array([4, 5, 6]),
        ]);
        expect(disableStatusValidation).toBe(true);
    });
});
