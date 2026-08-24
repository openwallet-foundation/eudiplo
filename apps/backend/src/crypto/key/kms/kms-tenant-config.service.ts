import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigMigrationService } from "../../../platform/config-portability/config-migration.service";
import {
    type KmsConfig,
    parseRawKmsConfig,
} from "../schemas/kms-config.schema";
import { KmsConfigService } from "./kms-config.service";
import { KmsProviderRegistry } from "./kms-provider.registry";

@Injectable()
export class KmsTenantConfigService {
    constructor(
        private readonly configService: ConfigService,
        private readonly kmsConfigService: KmsConfigService,
        private readonly kmsProviderRegistry: KmsProviderRegistry,
        private readonly configMigrationService: ConfigMigrationService,
    ) {}

    getTenantConfig(tenantId: string): KmsConfig | null {
        const path = this.getTenantConfigPath(tenantId);
        if (!path || !existsSync(path)) {
            return null;
        }
        const payload = JSON.parse(readFileSync(path, "utf8"));
        const document = this.configMigrationService.isDocument(payload)
            ? payload
            : this.configMigrationService.wrapLegacy(
                  "KmsConfig",
                  payload,
                  "kms",
              );
        if (document.kind !== "KmsConfig") {
            throw new Error(`Expected KmsConfig in ${path}`);
        }
        const upgraded = this.configMigrationService.upgrade(document);
        const blocking = upgraded.issues.filter(
            (issue) => issue.severity !== "warning",
        );
        if (blocking.length) {
            throw new Error(blocking.map((issue) => issue.message).join("; "));
        }
        return parseRawKmsConfig(
            this.configMigrationService.unwrapForLegacyImporter(
                upgraded.document,
            ),
            `tenant '${tenantId}' kms.json`,
        );
    }

    getEffectiveConfig(tenantId: string): KmsConfig {
        return this.kmsConfigService.getConfig(tenantId);
    }

    saveTenantConfig(tenantId: string, config: KmsConfig): KmsConfig {
        const path = this.getTenantConfigPath(tenantId);
        if (!path) {
            throw new NotFoundException("CONFIG_FOLDER is not configured");
        }

        const validatedConfig = this.validateConfig(config);

        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(
            path,
            `${JSON.stringify(validatedConfig, null, 4)}\n`,
            "utf8",
        );

        this.refreshTenantConfig(tenantId);
        return this.getEffectiveConfig(tenantId);
    }

    deleteTenantConfig(tenantId: string): void {
        const path = this.getTenantConfigPath(tenantId);
        if (path && existsSync(path)) {
            rmSync(path);
        }

        this.refreshTenantConfig(tenantId);
    }

    private refreshTenantConfig(tenantId: string): void {
        this.kmsConfigService.invalidateTenantCache(tenantId);
        this.kmsProviderRegistry.invalidateTenant(tenantId);
    }

    private getTenantConfigPath(tenantId: string): string | null {
        const configFolder = this.configService.get<string>("CONFIG_FOLDER");
        if (!configFolder) {
            return null;
        }
        return join(configFolder, tenantId, "kms.json");
    }

    private validateConfig(config: KmsConfig): KmsConfig {
        return parseRawKmsConfig(config, "tenant KMS configuration");
    }
}
