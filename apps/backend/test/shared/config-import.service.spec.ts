import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateClientDto } from "../../src/auth/client/dto/create-client.dto";
import { CreateClientSchema } from "../../src/auth/client/schemas/client.schema";
import { ConfigImportService } from "../../src/shared/utils/config-import/config-import.service";

function createConfigServiceStub(configFolder: string) {
    return {
        getOrThrow: (key: string) => {
            if (key === "CONFIG_FOLDER") {
                return configFolder;
            }
            throw new Error(`Unexpected getOrThrow(${key})`);
        },
        get: (key: string) => {
            if (key === "CONFIG_IMPORT_FORCE") {
                return false;
            }
            if (key === "CONFIG_VARIABLE_STRICT") {
                return "ignore";
            }
            return undefined;
        },
    } as unknown as ConfigService;
}

describe("ConfigImportService", () => {
    let tmpRoot: string;
    let service: ConfigImportService;

    beforeEach(() => {
        tmpRoot = mkdtempSync(join(tmpdir(), "eudiplo-config-import-"));
        service = new ConfigImportService(createConfigServiceStub(tmpRoot));
    });

    afterEach(() => {
        rmSync(tmpRoot, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it("validates a raw Zod schema", async () => {
        const result = await service.validateConfig(
            "/tmp/tenant-a/clients/client.json",
            "client.json",
            {
                clientId: "alpha",
                roles: ["clients:manage"],
                allowedPresentationConfigs: null,
                allowedIssuanceConfigs: null,
            },
            CreateClientSchema,
            { name: "tenant-a" },
            "client config",
        );

        expect(result.isValid).toBe(true);
        expect(result.data).toMatchObject({
            clientId: "alpha",
            roles: ["clients:manage"],
        });
    });

    it("rejects invalid payloads with a raw Zod schema", async () => {
        const result = await service.validateConfig(
            "/tmp/tenant-a/clients/client.json",
            "client.json",
            {
                clientId: "",
                roles: [],
            },
            CreateClientSchema,
            { name: "tenant-a" },
            "client config",
        );

        expect(result.isValid).toBe(false);
    });

    it("rejects client IDs containing whitespace or unsupported characters", async () => {
        const result = await service.validateConfig(
            "/tmp/tenant-a/clients/client.json",
            "client.json",
            {
                clientId: "car entry",
                roles: ["clients:manage"],
            },
            CreateClientSchema,
            { name: "tenant-a" },
            "client config",
        );

        expect(result.isValid).toBe(false);
    });

    it("includes the file path in validation error logs", async () => {
        const errorSpy = vi
            .spyOn(Logger.prototype, "error")
            .mockImplementation(() => undefined as any);

        await service.validateConfig(
            "/tmp/tenant-a/clients/client.json",
            "client.json",
            {
                clientId: "",
                roles: [],
            },
            CreateClientSchema,
            { name: "tenant-a" },
            "client config",
        );

        expect(errorSpy).toHaveBeenCalledWith(
            expect.any(Object),
            expect.stringContaining("/tmp/tenant-a/clients/client.json"),
        );
    });

    it("supports createZodDto classes", async () => {
        const result = await service.validateConfig(
            "/tmp/tenant-a/clients/client.json",
            "client.json",
            {
                clientId: "alpha",
                roles: ["clients:manage"],
                allowedPresentationConfigs: null,
                allowedIssuanceConfigs: null,
            },
            CreateClientDto,
            { name: "tenant-a" },
            "client config",
        );

        expect(result.isValid).toBe(true);
    });

    it("fails closed when validation schema is unsupported", async () => {
        await expect(
            service.validateConfig(
                "/tmp/tenant-a/clients/client.json",
                "client.json",
                { clientId: "alpha" },
                {} as any,
                { name: "tenant-a" },
                "client config",
            ),
        ).rejects.toThrow(/no Zod schema/i);
    });

    it("skips invalid configs without executing create, update, or delete callbacks", async () => {
        const tenantFolder = join(tmpRoot, "tenant-a", "clients");
        rmSync(tenantFolder, { recursive: true, force: true });
        mkdirSync(tenantFolder, { recursive: true });
        writeFileSync(
            join(tenantFolder, "bad.json"),
            JSON.stringify({
                clientId: "",
                roles: [],
            }),
            "utf8",
        );

        const processItem = vi.fn();
        const deleteExisting = vi.fn();

        await service.importConfigsForTenant("tenant-a", {
            subfolder: "clients",
            fileExtension: ".json",
            validationSchema: CreateClientSchema,
            resourceType: "client config",
            loadData: (filePath) => JSON.parse(readFileSync(filePath, "utf8")),
            checkExists: vi.fn().mockResolvedValue(false),
            deleteExisting,
            processItem,
        });

        expect(processItem).not.toHaveBeenCalled();
        expect(deleteExisting).not.toHaveBeenCalled();
    });
});
