import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import { ConfigBundleService } from "../../src/platform/config-portability/config-bundle.service";
import { ConfigFolderBundleService } from "../../src/platform/config-portability/config-folder-bundle.service";
import { ConfigOwnershipService } from "../../src/platform/config-portability/config-ownership.service";

describe("startup configuration reconciliation", () => {
    let app: INestApplication;
    let runtimeFolder: string;
    const originalEnvironment = {
        CONFIG_FOLDER: process.env.CONFIG_FOLDER,
        CONFIG_IMPORT_MODE: process.env.CONFIG_IMPORT_MODE,
        FOLDER: process.env.FOLDER,
    };

    beforeAll(async () => {
        runtimeFolder = mkdtempSync(join(tmpdir(), "eudiplo-startup-config-"));
        const configRoot = join(runtimeFolder, "config");
        mkdirSync(configRoot);
        cpSync(
            resolve(__dirname, "../../../../assets/config/demo"),
            join(configRoot, "demo"),
            { recursive: true },
        );
        cpSync(
            resolve(__dirname, "../fixtures/haip"),
            join(configRoot, "haip"),
            { recursive: true },
        );
        process.env.CONFIG_FOLDER = configRoot;
        process.env.CONFIG_IMPORT_MODE = "create";
        process.env.FOLDER = runtimeFolder;

        const { AppModule } = await import("../../src/app.module");
        const moduleFixture = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        await app.init();
    }, 30_000);

    afterAll(async () => {
        await app?.close();
        rmSync(runtimeFolder, { recursive: true, force: true });
        restoreEnvironment("CONFIG_FOLDER", originalEnvironment.CONFIG_FOLDER);
        restoreEnvironment(
            "CONFIG_IMPORT_MODE",
            originalEnvironment.CONFIG_IMPORT_MODE,
        );
        restoreEnvironment("FOLDER", originalEnvironment.FOLDER);
    });

    it("imports the demo folder through the versioned plan/apply pipeline", async () => {
        const configRoot = app
            .get(ConfigService)
            .getOrThrow<string>("CONFIG_FOLDER");
        const bundle = app
            .get(ConfigFolderBundleService)
            .buildBundle("demo", join(configRoot, "demo"));
        const plan = await app
            .get(ConfigBundleService)
            .plan(
                "demo",
                bundle,
                "create",
                `folder:${join(configRoot, "demo")}`,
            );
        expect(plan.applicable, JSON.stringify(plan, null, 2)).toBe(true);
        const metadata = await app.get(ConfigOwnershipService).list("demo");

        expect(metadata).toHaveLength(18);
        expect(metadata).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: "Tenant",
                    resourceId: "tenant",
                    ownership: "file-managed",
                }),
                expect.objectContaining({
                    kind: "PresentationConfig",
                    resourceId: "age-over-18",
                    ownership: "file-managed",
                }),
            ]),
        );
        expect(
            metadata.every((entry) => entry.source?.startsWith("folder:")),
        ).toBe(true);

        rmSync(join(configRoot, "demo/webhook-endpoints/notification.json"));
        const replaceBundle = app
            .get(ConfigFolderBundleService)
            .buildBundle("demo", join(configRoot, "demo"));
        const replacePlan = await app
            .get(ConfigBundleService)
            .plan(
                "demo",
                replaceBundle,
                "replace",
                `folder:${join(configRoot, "demo")}`,
            );
        expect(replacePlan.applicable).toBe(false);
        expect(replacePlan.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: "MISSING_RESOURCE_REFERENCE",
                    resource: {
                        kind: "PresentationConfig",
                        id: "pid",
                    },
                }),
            ]),
        );
    });

    it("accepts the HAIP OIDF configuration fixtures", async () => {
        const configRoot = app
            .get(ConfigService)
            .getOrThrow<string>("CONFIG_FOLDER");
        const tenantRoot = join(configRoot, "haip");
        const bundle = app
            .get(ConfigFolderBundleService)
            .buildBundle("haip", tenantRoot);
        const plan = await app
            .get(ConfigBundleService)
            .plan("haip", bundle, "create", `folder:${tenantRoot}`);

        expect(bundle.manifest.resources).toHaveLength(22);
        const documents = jsonFiles(tenantRoot)
            .filter((path) => path !== join(tenantRoot, "info.json"))
            .map((path) => JSON.parse(readFileSync(path, "utf8")));
        expect(documents).toHaveLength(22);
        for (const document of documents) {
            expect(document).toMatchObject({
                apiVersion: expect.stringMatching(/^eudiplo\.io\/.+\/v\d+$/),
                kind: expect.any(String),
                metadata: { id: expect.any(String), generation: 1 },
                spec: expect.any(Object),
            });
        }
        expect(plan.applicable, JSON.stringify(plan, null, 2)).toBe(true);
        expect(await app.get(ConfigOwnershipService).list("haip")).toHaveLength(
            23,
        );
    });
});

function restoreEnvironment(key: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}

function jsonFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return jsonFiles(path);
        return entry.name.endsWith(".json") ? [path] : [];
    });
}
