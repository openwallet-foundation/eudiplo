import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ConfigImportMode } from "../config-portability/config-resource.types";

export type StartupConfigImportMode = "disabled" | ConfigImportMode;

@Injectable()
export class ConfigImportModeService {
    private readonly logger = new Logger(ConfigImportModeService.name);
    private legacyWarningLogged = false;

    constructor(private readonly configService: ConfigService) {}

    resolve(): StartupConfigImportMode {
        const configured =
            this.configService.get<StartupConfigImportMode>(
                "CONFIG_IMPORT_MODE",
            );
        if (configured) {
            return configured;
        }

        const enabled =
            this.configService.get<boolean>("CONFIG_IMPORT") ?? false;
        const force =
            this.configService.get<boolean>("CONFIG_IMPORT_FORCE") ?? false;
        if ((enabled || force) && !this.legacyWarningLogged) {
            this.legacyWarningLogged = true;
            this.logger.warn(
                "CONFIG_IMPORT and CONFIG_IMPORT_FORCE are deprecated; use CONFIG_IMPORT_MODE=disabled|create|upsert|replace.",
            );
        }
        if (!enabled) {
            return "disabled";
        }
        return force ? "upsert" : "create";
    }
}
