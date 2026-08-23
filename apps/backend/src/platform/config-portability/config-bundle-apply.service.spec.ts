import { describe, expect, it, vi } from "vitest";
import { ConfigBundleApplyService } from "./config-bundle-apply.service";
import type { ConfigBundle, ConfigImportPlan } from "./config-resource.types";

describe("ConfigBundleApplyService", () => {
    it("does not apply or claim ownership of resources skipped in create mode", async () => {
        const plan: ConfigImportPlan = {
            tenantId: "tenant-a",
            mode: "create",
            applicable: true,
            items: [
                {
                    kind: "Client",
                    id: "existing",
                    action: "skip",
                    sourceVersion: "eudiplo.io/client/v1",
                    targetVersion: "eudiplo.io/client/v1",
                    migrations: [],
                    issues: [],
                },
            ],
            issues: [],
        };
        const bundle: ConfigBundle = {
            manifest: {
                format: "eudiplo.config-bundle",
                formatVersion: 1,
                sourceVersion: "test",
                exportedAt: new Date(0).toISOString(),
                tenant: "tenant-a",
                resources: [],
                assets: [],
                requirements: [],
                warnings: [],
            },
            documents: [
                {
                    apiVersion: "eudiplo.io/client/v1",
                    kind: "Client",
                    metadata: { id: "existing", generation: 1 },
                    spec: { clientId: "existing" },
                },
            ],
            assets: [],
        };
        const service = Object.create(
            ConfigBundleApplyService.prototype,
        ) as any;
        service.bundleService = { plan: vi.fn().mockResolvedValue(plan) };
        service.filesService = { saveImportedAsset: vi.fn() };
        service.migrationService = { upgrade: vi.fn() };
        service.ownershipService = {
            markApplied: vi.fn(),
            remove: vi.fn(),
        };

        await expect(
            service.apply(
                "tenant-a",
                bundle,
                "create",
                "folder:/config/tenant-a",
            ),
        ).resolves.toBe(plan);
        expect(service.migrationService.upgrade).not.toHaveBeenCalled();
        expect(service.ownershipService.markApplied).not.toHaveBeenCalled();
    });
});
