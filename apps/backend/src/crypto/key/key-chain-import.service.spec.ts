import { describe, expect, it, vi } from "vitest";
import { KeyChainImportService } from "./key-chain-import.service.js";

describe("key replacement preparation", () => {
    it.each(["db", "vault"])(
        "keeps the live %s row when replacement certificate preparation fails",
        async (type) => {
            const service = Object.create(
                KeyChainImportService.prototype,
            ) as any;
            service.keyChainRepository = {
                existsBy: vi.fn().mockResolvedValue(true),
                save: vi.fn(),
                delete: vi.fn(),
            };
            service.tenantRepository = {
                findOneByOrFail: async () => ({ name: "Tenant" }),
            };
            service.getHostname = () => "issuer.example";
            service.resolveCertificateChain = () => undefined;
            const adapter = {
                type,
                importKey: vi
                    .fn()
                    .mockResolvedValue({ ref: { publicJwk: {} } }),
            };
            service.kmsRegistry = { resolve: () => adapter };
            service.certBuilder = {
                createSelfSignedCert: vi
                    .fn()
                    .mockRejectedValue(
                        new Error("certificate preparation failed"),
                    ),
            };
            const dto = {
                id: "key",
                key: { kid: "original-key-id" },
                usageType: "attestation",
            };
            await expect(service.importKeyChain("tenant", dto)).rejects.toThrow(
                "certificate preparation failed",
            );
            const imported = adapter.importKey.mock.calls[0][0];
            if (type === "db") expect(imported.kid).toBe("original-key-id");
            else expect(imported.kid).toMatch(/^key-import-/);
            expect(dto.key.kid).toBe("original-key-id");
            expect(service.keyChainRepository.save).not.toHaveBeenCalled();
            expect(service.keyChainRepository.delete).not.toHaveBeenCalled();
        },
    );
});
