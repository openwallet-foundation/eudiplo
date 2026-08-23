import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";
import { ConfigImportModeService } from "../config-import/config-import-mode.service";
import { ConfigMigrationService } from "./config-migration.service";
import { ConfigOwnershipService } from "./config-ownership.service";

@Injectable()
export class ConfigOwnershipBootstrapService implements OnApplicationBootstrap {
    constructor(
        private readonly configService: ConfigService,
        private readonly ownershipService: ConfigOwnershipService,
        private readonly migrationService: ConfigMigrationService,
        private readonly importModeService: ConfigImportModeService,
        @InjectRepository(TenantEntity)
        private readonly tenants: Repository<TenantEntity>,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        if (this.importModeService.resolve() === "disabled") return;
        const configFolder = this.configService.get<string>("CONFIG_FOLDER");
        if (!configFolder) return;
        for (const tenant of await this.tenants.find({
            select: { id: true },
        })) {
            const file = join(configFolder, tenant.id, "kms.json");
            if (
                !existsSync(file) ||
                (await this.ownershipService.findStored(
                    tenant.id,
                    "KmsConfig",
                    "kms",
                ))
            ) {
                continue;
            }
            const raw = readFileSync(file);
            const payload = JSON.parse(raw.toString("utf8"));
            const document = this.migrationService.isDocument(payload)
                ? this.migrationService.upgrade(payload).document
                : this.migrationService.wrapLegacy("KmsConfig", payload, "kms");
            await this.ownershipService.markApplied({
                tenantId: tenant.id,
                kind: "KmsConfig",
                resourceId: "kms",
                ownership: "file-managed",
                generation: document.metadata.generation ?? 1,
                source: `folder:${resolve(configFolder, tenant.id)}`,
                sourceHash: createHash("sha256").update(raw).digest("hex"),
            });
        }
    }
}
