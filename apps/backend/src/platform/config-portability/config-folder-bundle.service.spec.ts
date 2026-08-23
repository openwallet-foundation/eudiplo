import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { ConfigImportService } from "../config-import/config-import.service";
import { ConfigImportOrchestratorService } from "../config-import/config-import-orchestrator.service";
import { ConfigBundleApplyService } from "./config-bundle-apply.service";
import { ConfigFolderBundleService } from "./config-folder-bundle.service";
import { ConfigMigrationService } from "./config-migration.service";
import { ConfigResourceRegistry } from "./config-resource.registry";

describe("ConfigFolderBundleService", () => {
    it("builds a portable bundle from the demo tenant folder", () => {
        const registry = new ConfigResourceRegistry();
        const service = new ConfigFolderBundleService(
            {
                getOrThrow: () => resolve("../..", "assets/config"),
            } as unknown as ConfigService,
            {
                replacePlaceholders: <T>(value: T) => value,
            } as ConfigImportService,
            new ConfigMigrationService(registry),
            registry,
            { apply: vi.fn() } as unknown as ConfigBundleApplyService,
            {
                registerPortableRunner: vi.fn(),
            } as unknown as ConfigImportOrchestratorService,
        );

        const bundle = service.buildBundle(
            "demo",
            resolve("../..", "assets/config/demo"),
        );

        expect(bundle.documents).toHaveLength(17);
        expect(bundle.assets).toHaveLength(4);
        expect(bundle.documents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: "IssuanceConfig" }),
                expect.objectContaining({ kind: "PresentationConfig" }),
                expect.objectContaining({ kind: "KeyChain" }),
            ]),
        );
        expect(bundle.manifest.resources).toHaveLength(bundle.documents.length);
    });

    it("applies a tenant folder with a stable ownership source", async () => {
        const apply = vi.fn().mockResolvedValue({ items: [] });
        const registerPortableRunner = vi.fn();
        const registry = new ConfigResourceRegistry();
        const service = new ConfigFolderBundleService(
            {
                getOrThrow: () => resolve("../..", "assets/config"),
            } as unknown as ConfigService,
            {
                replacePlaceholders: <T>(value: T) => value,
            } as ConfigImportService,
            new ConfigMigrationService(registry),
            registry,
            { apply } as unknown as ConfigBundleApplyService,
            {
                registerPortableRunner,
            } as unknown as ConfigImportOrchestratorService,
        );

        await service.applyTenantFolder("demo", "replace");

        expect(registerPortableRunner).toHaveBeenCalledOnce();
        expect(apply).toHaveBeenCalledWith(
            "demo",
            expect.objectContaining({
                manifest: expect.objectContaining({ tenant: "demo" }),
            }),
            "replace",
            `folder:${resolve("../..", "assets/config/demo")}`,
        );
    });

    it("uses stable IDs for legacy singleton configuration files", () => {
        const tenantRoot = mkdtempSync(
            join(tmpdir(), "eudiplo-config-folder-"),
        );
        mkdirSync(join(tenantRoot, "issuance"), { recursive: true });
        writeFileSync(
            join(tenantRoot, "registrar.json"),
            JSON.stringify({
                registrarUrl: "https://registrar.example.com/api",
                oidcUrl: "https://auth.example.com/realms/registrar",
                clientId: "test-client",
                username: "test-user",
                password: "test-password",
            }),
        );
        writeFileSync(
            join(tenantRoot, "issuance", "issuance.json"),
            JSON.stringify({
                authorizationServers: [
                    { id: "issuer-built-in", type: "built-in" },
                ],
            }),
        );
        const registry = new ConfigResourceRegistry();
        const service = new ConfigFolderBundleService(
            {
                getOrThrow: () => resolve("../..", "assets/config"),
            } as unknown as ConfigService,
            {
                replacePlaceholders: <T>(value: T) => value,
            } as ConfigImportService,
            new ConfigMigrationService(registry),
            registry,
            { apply: vi.fn() } as unknown as ConfigBundleApplyService,
            {
                registerPortableRunner: vi.fn(),
            } as unknown as ConfigImportOrchestratorService,
        );

        try {
            const bundle = service.buildBundle("test", tenantRoot);

            expect(bundle.documents).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        kind: "RegistrarConfig",
                        metadata: expect.objectContaining({ id: "registrar" }),
                    }),
                    expect.objectContaining({
                        kind: "IssuanceConfig",
                        metadata: expect.objectContaining({ id: "issuance" }),
                    }),
                ]),
            );
        } finally {
            rmSync(tenantRoot, { recursive: true, force: true });
        }
    });
});
