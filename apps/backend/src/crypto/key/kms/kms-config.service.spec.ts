import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from "node:fs";
import { KmsConfigService } from "./kms-config.service";

describe("KmsConfigService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function createService(configFolder = "/config") {
        const configService = {
            get: vi.fn((key: string) => {
                if (key === "CONFIG_FOLDER") {
                    return configFolder;
                }
                return undefined;
            }),
        };

        return new KmsConfigService(configService as any);
    }

    it("returns global providers when no tenant kms.json exists", () => {
        vi.mocked(existsSync).mockImplementation((path) =>
            String(path) === "/config/kms.json",
        );
        vi.mocked(readFileSync).mockImplementation((path) => {
            if (String(path) === "/config/kms.json") {
                return JSON.stringify({
                    defaultProvider: "db",
                    providers: [
                        {
                            id: "db",
                            type: "db",
                            description: "Default database provider",
                        },
                        {
                            id: "global-csc",
                            type: "csc",
                            baseUrl: "https://global.example.com",
                            tokenUrl: "https://global.example.com/token",
                            clientId: "global",
                            clientSecret: "secret",
                        },
                    ],
                });
            }
            throw new Error(`unexpected path ${String(path)}`);
        });

        const service = createService();

        expect(service.getDefaultProviderId("tenant-a")).toBe("db");
        expect(service.getProviders("tenant-a").map((p) => p.id)).toEqual([
            "db",
            "global-csc",
        ]);
    });

    it("merges tenant providers with global providers", () => {
        vi.mocked(existsSync).mockImplementation((path) => {
            const value = String(path);
            return (
                value === "/config/kms.json" ||
                value === "/config/tenant-a/kms.json"
            );
        });
        vi.mocked(readFileSync).mockImplementation((path) => {
            const value = String(path);
            if (value === "/config/kms.json") {
                return JSON.stringify({
                    defaultProvider: "db",
                    providers: [
                        {
                            id: "db",
                            type: "db",
                            description: "Default database provider",
                        },
                        {
                            id: "global-vault",
                            type: "vault",
                            vaultUrl: "https://vault.global",
                            vaultToken: "token",
                        },
                    ],
                });
            }

            if (value === "/config/tenant-a/kms.json") {
                return JSON.stringify({
                    defaultProvider: "tenant-csc",
                    providers: [
                        {
                            id: "tenant-csc",
                            type: "csc",
                            baseUrl: "https://tenant.example.com",
                            tokenUrl: "https://tenant.example.com/token",
                            clientId: "tenant",
                            clientSecret: "secret",
                        },
                    ],
                });
            }

            throw new Error(`unexpected path ${value}`);
        });

        const service = createService();

        expect(service.getDefaultProviderId("tenant-a")).toBe("tenant-csc");
        expect(service.getProviders("tenant-a").map((p) => p.id)).toEqual([
            "db",
            "global-vault",
            "tenant-csc",
        ]);
    });

    it("lets tenant config override a global provider with the same id", () => {
        vi.mocked(existsSync).mockImplementation((path) => {
            const value = String(path);
            return (
                value === "/config/kms.json" ||
                value === "/config/tenant-a/kms.json"
            );
        });
        vi.mocked(readFileSync).mockImplementation((path) => {
            const value = String(path);
            if (value === "/config/kms.json") {
                return JSON.stringify({
                    defaultProvider: "shared",
                    providers: [
                        {
                            id: "shared",
                            type: "vault",
                            vaultUrl: "https://vault.global",
                            vaultToken: "token",
                        },
                    ],
                });
            }

            if (value === "/config/tenant-a/kms.json") {
                return JSON.stringify({
                    providers: [
                        {
                            id: "shared",
                            type: "csc",
                            baseUrl: "https://tenant.example.com",
                            tokenUrl: "https://tenant.example.com/token",
                            clientId: "tenant",
                            clientSecret: "secret",
                        },
                    ],
                });
            }

            throw new Error(`unexpected path ${value}`);
        });

        const service = createService();

        const provider = service
            .getProviders("tenant-a")
            .find((p) => p.id === "shared");

        expect(provider?.type).toBe("csc");
        expect(service.getDefaultProviderId("tenant-a")).toBe("shared");
    });
});
