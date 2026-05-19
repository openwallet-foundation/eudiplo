import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Request } from "express";
import { Repository } from "typeorm";
import { AuditLogService } from "../../../audit-log/audit-log.service";
import { TokenPayload } from "../../../auth/token.decorator";
import {
    extractRequestMeta,
    getChangedFields,
    resolveAuditActor,
} from "../../../shared/utils/audit-log-context.util";
import { loadConfigDto } from "../../../shared/utils/config-file-loader.util";
import { ConfigImportService } from "../../../shared/utils/config-import/config-import.service";
import {
    ConfigImportOrchestratorService,
    ImportPhase,
} from "../../../shared/utils/config-import/config-import-orchestrator.service";
import { FilesService } from "../../../storage/files.service";
import { DisplayInfo } from "./dto/display.dto";
import { IssuanceDto } from "./dto/issuance.dto";
import { IssuanceConfig } from "./entities/issuance-config.entity";
/**
 * Service for managing issuance configurations.
 * It provides methods to get, store, and delete issuance configurations.
 */
@Injectable()
export class IssuanceService {
    private readonly logger = new Logger(IssuanceService.name);

    /**
     * Constructor for IssuanceService.
     * @param issuanceConfigRepo
     * @param credentialsConfigService
     */
    constructor(
        @InjectRepository(IssuanceConfig)
        private readonly issuanceConfigRepo: Repository<IssuanceConfig>,
        private readonly filesService: FilesService,
        private readonly configImportService: ConfigImportService,
        private readonly configImportOrchestrator: ConfigImportOrchestratorService,
        private readonly tenantActionLogService: AuditLogService,
    ) {
        this.configImportOrchestrator.register(
            "issuance",
            ImportPhase.CONFIGURATION,
            (tenantId) => this.importForTenant(tenantId),
        );
    }

    /**
     * Import issuance configurations for a specific tenant.
     */
    private async importForTenant(tenantId: string) {
        await this.configImportService.importConfigsForTenant<IssuanceDto>(
            tenantId,
            {
                subfolder: "issuance",
                fileExtension: ".json",
                validationClass: IssuanceDto,
                resourceType: "issuance config",
                formatValidationError: (error) =>
                    this.configImportService.formatNestedValidationError(error),
                checkExists: (tid) => {
                    return this.getIssuanceConfiguration(tid)
                        .then(() => true)
                        .catch(() => false);
                },
                deleteExisting: (tid) =>
                    this.issuanceConfigRepo
                        .delete({ tenantId: tid })
                        .then(() => undefined),
                loadData: (filePath) => loadConfigDto(filePath, IssuanceDto),
                processItem: async (tid, issuanceDto) => {
                    // Replace relative URIs with public URLs
                    issuanceDto.display = await this.replaceUrl(
                        issuanceDto.display,
                        tid,
                    );

                    await this.storeIssuanceConfiguration(tid, issuanceDto);
                },
            },
        );
    }

    private replaceUrl(display: DisplayInfo[], tenantId: string) {
        return Promise.all(
            display.map(async (display) => {
                if (display.logo?.uri) {
                    const uri = await this.filesService.replaceUriWithPublicUrl(
                        tenantId,
                        display.logo.uri.trim(),
                    );
                    if (!uri) {
                        this.logger.warn(
                            `[${tenantId}] Could not find logo ${display.logo.uri}, skipping`,
                        );
                        delete display.logo;
                    } else {
                        display.logo.uri = uri;
                    }
                }
                return display;
            }),
        );
    }

    /**
     * Returns the issuance configuration for this tenant.
     * @param tenantId
     * @returns
     */
    public getIssuanceConfiguration(tenantId: string) {
        return this.issuanceConfigRepo.findOneByOrFail({ tenantId });
    }

    /**
     * Store the config. If it already exist, merge with existing values.
     * - Undefined values are ignored, preserving existing configuration.
     * - Null values explicitly clear/unset the field.
     * @param tenantId
     * @param value
     * @returns
     */
    async storeIssuanceConfiguration(
        tenantId: string,
        value: IssuanceDto,
        actorToken?: TokenPayload,
        req?: Request,
    ) {
        if (value.display) {
            value.display = await this.replaceUrl(value.display, tenantId);
        }

        // Fetch existing configuration (if any)
        let existingConfig: Partial<IssuanceConfig> = {};
        try {
            existingConfig = await this.getIssuanceConfiguration(tenantId);
        } catch {
            // No existing config, will create new
        }

        // Filter out undefined values from the incoming config.
        // Null values are kept to allow explicitly clearing a field.
        const filteredValue = Object.fromEntries(
            Object.entries(value).filter(([, v]) => v !== undefined),
        );

        const before =
            "tenantId" in existingConfig
                ? this.sanitizeIssuanceConfigForLog(
                      existingConfig as IssuanceConfig,
                  )
                : undefined;

        const saved = await this.issuanceConfigRepo.save({
            ...existingConfig,
            ...filteredValue,
            tenantId,
        });

        if (actorToken) {
            await this.tenantActionLogService.record({
                tenantId,
                actionType: "issuance_config_updated",
                actor: resolveAuditActor(actorToken),
                changedFields: getChangedFields(
                    before,
                    this.sanitizeIssuanceConfigForLog(saved),
                ),
                before,
                after: this.sanitizeIssuanceConfigForLog(saved),
                requestMeta: extractRequestMeta(req),
            });
        }

        return saved;
    }

    private sanitizeIssuanceConfigForLog(
        config: IssuanceConfig,
    ): Record<string, unknown> {
        return {
            display: config.display,
            authServers: config.authServers,
            batchSize: config.batchSize,
            dPopRequired: config.dPopRequired,
            walletAttestationRequired: config.walletAttestationRequired,
            walletProviderTrustLists: config.walletProviderTrustLists,
            signingKeyId: config.signingKeyId,
            preferredAuthServer: config.preferredAuthServer,
            chainedAs: config.chainedAs,
            federation: config.federation,
            credentialResponseEncryption: config.credentialResponseEncryption,
            credentialRequestEncryption: config.credentialRequestEncryption,
            refreshTokenEnabled: config.refreshTokenEnabled,
            refreshTokenExpiresInSeconds: config.refreshTokenExpiresInSeconds,
            txCodeMaxAttempts: config.txCodeMaxAttempts,
        };
    }
}
