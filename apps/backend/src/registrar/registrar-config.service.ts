import { existsSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TenantEntity } from "../auth/tenant/entities/tenant.entity";
import {
    ConfigImportOrchestratorService,
    ImportPhase,
} from "../platform/config-import/config-import-orchestrator.service";
import { loadConfigDto } from "../shared/utils/config-file-loader.util";
import { CreateRegistrarConfigDto } from "./dto/create-registrar-config.dto";
import { RegistrarConfigEntity } from "./entities/registrar-config.entity";
import { RegistrarAuthService } from "./registrar-auth.service";
import type {
    CreateRegistrarConfig,
    UpdateRegistrarConfig,
} from "./schemas/registrar.schema";

/**
 * Manages per-tenant registrar configuration: CRUD, file-based import, and
 * lifecycle hooks. Auth-related credential testing is delegated to
 * {@link RegistrarAuthService}.
 */
@Injectable()
export class RegistrarConfigService {
    private readonly logger = new Logger(RegistrarConfigService.name);

    constructor(
        private readonly configService: ConfigService,
        configImportOrchestrator: ConfigImportOrchestratorService,
        @InjectRepository(RegistrarConfigEntity)
        private readonly configRepository: Repository<RegistrarConfigEntity>,
        private readonly authService: RegistrarAuthService,
    ) {
        configImportOrchestrator.register(
            "registrar",
            ImportPhase.CORE,
            (tenantId) => this.importForTenant(tenantId),
        );
    }

    /**
     * Import registrar configuration for a tenant from the config folder.
     * Looks for a `registrar.json` file in the tenant's folder.
     */
    private async importForTenant(tenantId: string): Promise<void> {
        const configPath = this.configService.getOrThrow("CONFIG_FOLDER");
        const force = this.configService.get<boolean>("CONFIG_IMPORT_FORCE");
        const filePath = join(configPath, tenantId, "registrar.json");

        if (!existsSync(filePath)) {
            return;
        }

        try {
            const existing = await this.configRepository.findOneBy({
                tenantId,
            });
            if (existing && !force) {
                this.logger.debug(
                    `[${tenantId}] Registrar config already exists, skipping`,
                );
                return;
            }

            if (existing && force) {
                await this.configRepository.delete({ tenantId });
            }

            const config = loadConfigDto(filePath, CreateRegistrarConfigDto);

            await this.configRepository.save({ tenantId, ...config });

            this.logger.log(`[${tenantId}] Registrar config imported`);
        } catch (error: any) {
            this.logger.error(
                `[${tenantId}] Failed to import registrar config: ${error.message}`,
            );
        }
    }

    /**
     * Check if a tenant has registrar configuration.
     */
    async isEnabledForTenant(tenantId: string): Promise<boolean> {
        const config = await this.configRepository.findOneBy({ tenantId });
        return !!config;
    }

    /**
     * Called when a tenant is initialized — no-op with per-tenant config.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onTenantInit(_tenant: TenantEntity): Promise<void> {}

    /**
     * Get the registrar configuration for a tenant.
     */
    getConfig(tenantId: string): Promise<RegistrarConfigEntity | null> {
        return this.configRepository.findOneBy({ tenantId });
    }

    /**
     * Create or replace the registrar configuration for a tenant.
     * Credentials are validated before saving.
     */
    async saveConfig(
        tenantId: string,
        dto: CreateRegistrarConfig,
    ): Promise<RegistrarConfigEntity> {
        await this.authService.testCredentials(dto);

        const config = await this.configRepository.save({
            tenantId,
            ...dto,
        });

        this.authService.invalidateToken(tenantId);
        this.logger.log(`[${tenantId}] Registrar configuration saved`);
        return config;
    }

    /**
     * Partially update the registrar configuration for a tenant.
     * Credentials are re-validated only when auth-related fields are changed.
     */
    async updateConfig(
        tenantId: string,
        dto: UpdateRegistrarConfig,
    ): Promise<RegistrarConfigEntity> {
        const existing = await this.configRepository.findOneBy({ tenantId });
        if (!existing) {
            throw new NotFoundException(
                `No registrar configuration found for tenant ${tenantId}`,
            );
        }

        const hasAuthChanges =
            dto.oidcUrl !== undefined ||
            dto.clientId !== undefined ||
            dto.clientSecret !== undefined ||
            dto.username !== undefined ||
            dto.password !== undefined;

        if (hasAuthChanges) {
            const testConfig = {
                registrarUrl: dto.registrarUrl ?? existing.registrarUrl,
                oidcUrl: dto.oidcUrl ?? existing.oidcUrl,
                clientId: dto.clientId ?? existing.clientId,
                clientSecret: dto.clientSecret ?? existing.clientSecret,
                username: dto.username ?? existing.username,
                password: dto.password ?? existing.password,
            };
            await this.authService.testCredentials(testConfig);
        }

        await this.configRepository.save({ ...existing, ...dto, tenantId });
        this.authService.invalidateToken(tenantId);

        return this.configRepository.findOneByOrFail({ tenantId });
    }

    /**
     * Delete the registrar configuration for a tenant.
     */
    async deleteConfig(tenantId: string): Promise<void> {
        await this.configRepository.delete({ tenantId });
        this.authService.invalidateToken(tenantId);
        this.logger.log(`[${tenantId}] Registrar configuration deleted`);
    }
}
