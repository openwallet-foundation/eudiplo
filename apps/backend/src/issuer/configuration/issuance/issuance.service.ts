import { BadRequestException, Injectable, Logger } from "@nestjs/common";
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
     * Updates only the server-managed registration certificate cache.
     */
    async updateRegistrationCertificateCache(
        tenantId: string,
        registrationCertificateCache: IssuanceConfig["registrationCertificateCache"],
    ): Promise<void> {
        await this.issuanceConfigRepo.save({
            ...(await this.getIssuanceConfiguration(tenantId)),
            tenantId,
            registrationCertificateCache,
        });
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
        value: Partial<IssuanceDto>,
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

        const hasIncomingAuthorizationServers =
            Object.prototype.hasOwnProperty.call(
                filteredValue,
                "authorizationServers",
            );
        const effectiveAuthorizationServers = hasIncomingAuthorizationServers
            ? (filteredValue as Partial<IssuanceDto>).authorizationServers
            : existingConfig.authorizationServers;

        if (!Array.isArray(effectiveAuthorizationServers)) {
            throw new BadRequestException(
                "At least one authorization server must be configured",
            );
        }

        const configuredAuthorizationServers =
            effectiveAuthorizationServers as Array<{
                id?: string;
                type?: string;
            }>;

        if (configuredAuthorizationServers.length < 1) {
            throw new BadRequestException(
                "At least one authorization server must be configured",
            );
        }

        const builtInCount = configuredAuthorizationServers.filter(
            (server) => server?.type === "built-in",
        ).length;
        if (builtInCount > 1) {
            throw new BadRequestException(
                "Only one built-in authorization server can be configured",
            );
        }

        const reservedIds = new Set(["built-in", "chained-as"]);
        const seenIds = new Set<string>();
        for (const server of configuredAuthorizationServers) {
            if (typeof server.id !== "string" || server.id.trim().length < 1) {
                throw new BadRequestException(
                    "Each authorization server must define a non-empty id",
                );
            }

            const normalizedId = server.id.trim();
            if (reservedIds.has(normalizedId)) {
                throw new BadRequestException(
                    `Authorization server id '${normalizedId}' is reserved`,
                );
            }

            if (seenIds.has(normalizedId)) {
                throw new BadRequestException(
                    `Authorization server id '${normalizedId}' is duplicated`,
                );
            }

            seenIds.add(normalizedId);
            server.id = normalizedId;
        }

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
        const registrationCertificate = config.registrationCertificate
            ? {
                  ...config.registrationCertificate,
                  jwt: config.registrationCertificate.jwt
                      ? "[REDACTED]"
                      : undefined,
              }
            : config.registrationCertificate;

        const registrationCertificateCache = config.registrationCertificateCache
            ? {
                  ...config.registrationCertificateCache,
                  jwt: "[REDACTED]",
              }
            : config.registrationCertificateCache;

        return {
            display: config.display,
            batchSize: config.batchSize,
            dPopRequired: config.dPopRequired,
            walletAttestationRequired: config.walletAttestationRequired,
            walletProviderTrustLists: config.walletProviderTrustLists,
            signingKeyId: config.signingKeyId,
            authorizationServers: config.authorizationServers,
            federation: config.federation,
            registrationCertificate,
            registrationCertificateCache,
            credentialResponseEncryption: config.credentialResponseEncryption,
            credentialRequestEncryption: config.credentialRequestEncryption,
            txCodeMaxAttempts: config.txCodeMaxAttempts,
        };
    }
}
