import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigImportModeService } from "./config-import-mode.service";

describe("ConfigImportModeService", () => {
    afterEach(() => vi.restoreAllMocks());

    it.each(["disabled", "create", "upsert", "replace"] as const)(
        "uses explicit %s mode",
        (mode) => {
            const service = createService({ CONFIG_IMPORT_MODE: mode });
            expect(service.resolve()).toBe(mode);
        },
    );

    it("maps legacy disabled configuration", () => {
        expect(createService({ CONFIG_IMPORT: false }).resolve()).toBe(
            "disabled",
        );
    });

    it("maps legacy non-force import to create", () => {
        vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
        expect(
            createService({
                CONFIG_IMPORT: true,
                CONFIG_IMPORT_FORCE: false,
            }).resolve(),
        ).toBe("create");
    });

    it("maps legacy force import to upsert and warns once", () => {
        const warning = vi
            .spyOn(Logger.prototype, "warn")
            .mockImplementation(() => undefined);
        const service = createService({
            CONFIG_IMPORT: true,
            CONFIG_IMPORT_FORCE: true,
        });

        expect(service.resolve()).toBe("upsert");
        expect(service.resolve()).toBe("upsert");
        expect(warning).toHaveBeenCalledTimes(1);
    });
});

function createService(
    values: Record<string, unknown>,
): ConfigImportModeService {
    const config = {
        get: (key: string) => values[key],
    } as ConfigService;
    return new ConfigImportModeService(config);
}
