import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    Inject,
    Injectable,
    Logger,
    OnApplicationBootstrap,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type { UpDownCounter } from "@opentelemetry/api";
import { Request } from "express";
import { MetricService } from "nestjs-otel";
import { Repository } from "typeorm";
import { AuditLogService } from "../../audit-log/audit-log.service";
import {
    extractRequestMeta,
    getChangedFieldsForKeys,
    resolveAuditActor,
} from "../../audit-log/audit-log-context.util";
import { EncryptionService } from "../../crypto/encryption/encryption.service";
import { ConfigImportModeService } from "../../platform/config-import/config-import-mode.service";
import { ConfigImportOrchestratorService } from "../../platform/config-import/config-import-orchestrator.service";
import { ConfigMigrationService } from "../../platform/config-portability/config-migration.service";
import { ConfigOwnershipService } from "../../platform/config-portability/config-ownership.service";
import { RegistrarService } from "../../registrar/registrar.service";
import { FilesService } from "../../storage/files.service";
import { CLIENTS_PROVIDER, ClientsProvider } from "../client/client.provider";
import { Role } from "../roles/role.enum";
import { TokenPayload } from "../token.decorator";
import { TenantEntity } from "./entities/tenant.entity";
import type {
    CreateTenant,
    ImportTenant,
    UpdateTenant,
} from "./schemas/create-tenant.schema";
import { ImportTenantSchema } from "./schemas/create-tenant.schema";
@Injectable()
export class TenantService implements OnApplicationBootstrap {
    private readonly logger = new Logger(TenantService.name);
    private readonly tenantTotal: UpDownCounter;

    constructor(
        @Inject(CLIENTS_PROVIDER) private readonly clients: ClientsProvider,
        private readonly configService: ConfigService,
        private readonly encryptionService: EncryptionService,
        private readonly registrarService: RegistrarService,
        @InjectRepository(TenantEntity)
        private readonly tenantRepository: Repository<TenantEntity>,
        metricService: MetricService,
        private readonly filesService: FilesService,
        private readonly configImportOrchestrator: ConfigImportOrchestratorService,
        private readonly tenantActionLogService: AuditLogService,
        private readonly configOwnershipService: ConfigOwnershipService,
        private readonly configMigrationService: ConfigMigrationService,
        private readonly configImportModeService: ConfigImportModeService,
    ) {
        this.tenantTotal = metricService.getUpDownCounter("tenant_total", {
            description: "Total number of tenants",
        });

        // Register tenant setup - this runs first for each tenant before other imports
        this.configImportOrchestrator.registerTenantSetup(
            "tenants",
            (tenantId) => this.setupTenant(tenantId),
        );
    }

    async onApplicationBootstrap() {
        // Initialize the tenant metrics
        const count = await this.tenantRepository.count();
        this.tenantTotal.add(count);
    }

    /**
     * Setup a single tenant from config.
     * Creates the tenant from info.json if it doesn't exist.
     * @returns true if tenant is valid and ready for imports, false to skip this tenant
     */
    async setupTenant(tenantId: string): Promise<boolean> {
        const configPath = this.configService.getOrThrow("CONFIG_FOLDER");

        // Check if tenant already exists
        const existing = await this.tenantRepository.findOneBy({
            id: tenantId,
            status: "active",
        });

        if (existing) {
            const file = `${configPath}/${tenantId}/info.json`;
            if (existsSync(file)) {
                const configFile = readFileSync(file, "utf-8");
                const upgraded = this.upgradeTenantConfig(configFile);
                const validationResult = ImportTenantSchema.safeParse(
                    upgraded.spec,
                );
                if (validationResult.success) {
                    const mode = this.configImportModeService.resolve();
                    if (mode !== "create" && mode !== "disabled") {
                        const stored = await this.configOwnershipService.get(
                            tenantId,
                            "Tenant",
                            "tenant",
                        );
                        const generation =
                            upgraded.document.metadata.generation ?? 1;
                        if (generation < stored.generation) {
                            throw new Error(
                                `Tenant configuration generation ${generation} is older than stored generation ${stored.generation}`,
                            );
                        }
                        await this.tenantRepository.update(
                            { id: tenantId },
                            validationResult.data as any,
                        );
                        await this.configOwnershipService.markApplied({
                            tenantId,
                            kind: "Tenant",
                            resourceId: "tenant",
                            ownership: "file-managed",
                            generation,
                            source: `folder:${resolve(configPath, tenantId)}`,
                            sourceHash: createHash("sha256")
                                .update(configFile)
                                .digest("hex"),
                        });
                    }
                }
            }
            this.logger.debug(
                `[${tenantId}] Tenant already exists, proceeding with imports`,
            );
            return true;
        }

        // Look for info.json
        const file = `${configPath}/${tenantId}/info.json`;
        if (!existsSync(file)) {
            // Skip folders without info.json - they might be for other purposes
            this.logger.warn(
                `[${tenantId}] Skipping tenant folder - no info.json found`,
            );
            return false;
        }

        try {
            const configFile = readFileSync(file, "utf-8");
            const upgraded = this.upgradeTenantConfig(configFile);

            const validationResult = ImportTenantSchema.safeParse(
                upgraded.spec,
            );

            if (!validationResult.success) {
                this.logger.error(
                    {
                        errors: validationResult.error.issues.map((issue) => ({
                            path: issue.path.join("."),
                            message: issue.message,
                            code: issue.code,
                        })),
                    },
                    `[${tenantId}] Validation failed for tenant config`,
                );
                return false;
            }

            // ID is always derived from folder name, not from config file
            await this.createTenant({
                ...validationResult.data,
                id: tenantId,
            } as CreateTenant);
            await this.configOwnershipService.markApplied({
                tenantId,
                kind: "Tenant",
                resourceId: "tenant",
                ownership: "file-managed",
                generation: upgraded.document.metadata.generation ?? 1,
                source: `folder:${resolve(configPath, tenantId)}`,
                sourceHash: createHash("sha256")
                    .update(configFile)
                    .digest("hex"),
            });
            return true;
        } catch (error: any) {
            this.logger.error(
                `[${tenantId}] Failed to setup tenant: ${error.message}`,
            );
            return false;
        }
    }

    private upgradeTenantConfig(raw: string): {
        spec: Record<string, unknown>;
        document: import("../../platform/config-portability/config-resource.types").ConfigDocument;
    } {
        const payload = JSON.parse(raw) as Record<string, unknown>;
        const document = this.configMigrationService.isDocument(payload)
            ? payload
            : this.configMigrationService.wrapLegacy(
                  "Tenant",
                  payload,
                  "tenant",
              );
        const result = this.configMigrationService.upgrade(document);
        const blocking = result.issues.filter(
            (issue) => issue.severity !== "warning",
        );
        if (blocking.length) {
            throw new Error(blocking.map((issue) => issue.message).join("; "));
        }
        return {
            spec: this.configMigrationService.unwrapForLegacyImporter(
                result.document,
            ),
            document: result.document,
        };
    }

    /**
     * Get all tenants
     * @returns A list of all tenants
     */
    getAll() {
        return this.tenantRepository.find();
    }

    /**
     * Create a new tenant.
     * @param data
     * @returns The created tenant with optional client credentials (if roles were specified)
     */
    async createTenant(
        data: ImportTenant | CreateTenant,
        actorToken?: TokenPayload,
        req?: Request,
    ) {
        const tenant = (await this.tenantRepository.save(
            data as any,
        )) as TenantEntity;
        await this.setUpTenant(tenant);

        let clientCredentials:
            | { clientId: string; clientSecret: string }
            | undefined;

        if ((data as CreateTenant).roles) {
            const client = await this.clients.addClient(tenant.id, {
                clientId: `${tenant.id}-admin`,
                description: `auto generated admin client for tenant ${tenant.id}`,
                roles: [Role.Clients, ...((data as CreateTenant).roles || [])],
            });
            // Return the client credentials for one-time display
            clientCredentials = {
                clientId: client.clientId,
                clientSecret: (client as any).clientSecret,
            };
        }

        const result = {
            ...tenant,
            client: clientCredentials,
        };

        if (actorToken) {
            await this.tenantActionLogService.record({
                tenantId: tenant.id,
                actionType: "tenant_created",
                actor: resolveAuditActor(actorToken),
                after: this.sanitizeTenantForLog(tenant),
                requestMeta: extractRequestMeta(req),
            });
        }

        return result;
    }

    /**
     * Get a tenant by ID
     * @param id The ID of the tenant to retrieve
     * @returns The tenant entity
     */
    getTenant(id: string): Promise<TenantEntity> {
        return this.tenantRepository.findOneOrFail({
            where: { id },
            relations: {
                clients: true,
            },
        });
    }

    /**
     * Sends an event to set up a tenant, allowing all other services to listen and react accordingly.
     * @param tenant
     */
    async setUpTenant(tenant: TenantEntity) {
        await this.encryptionService.onTenantInit(tenant.id);
        await this.registrarService.onTenantInit(tenant);
        await this.tenantRepository.update(
            { id: tenant.id },
            { status: "active" },
        );
    }

    /**
     * Update a tenant by ID
     * @param id The ID of the tenant to update
     * @param data The updated tenant data
     * @returns The updated tenant entity
     */
    async updateTenant(
        id: string,
        data: UpdateTenant,
        actorToken?: TokenPayload,
        req?: Request,
    ): Promise<TenantEntity> {
        const existing = await this.getTenant(id);
        await this.tenantRepository.update({ id }, data as any);
        const updated = await this.getTenant(id);

        if (actorToken) {
            await this.tenantActionLogService.record({
                tenantId: id,
                actionType: "tenant_updated",
                actor: resolveAuditActor(actorToken),
                changedFields: this.getChangedFields(existing, updated),
                before: this.sanitizeTenantForLog(existing),
                after: this.sanitizeTenantForLog(updated),
                requestMeta: extractRequestMeta(req),
            });
        }

        return updated;
    }

    /**
     * Deletes a tenant by ID
     * @param tenantId The ID of the tenant to delete
     */
    async deleteTenant(
        tenantId: string,
        actorToken?: TokenPayload,
        req?: Request,
    ) {
        const existingTenant = await this.tenantRepository.findOne({
            where: { id: tenantId },
        });

        //delete all files associated with the tenant
        await this.filesService.deleteByTenant(tenantId);
        //because of cascading, all related entities will be deleted.
        await this.tenantRepository.delete({ id: tenantId });

        if (actorToken) {
            await this.tenantActionLogService.record({
                tenantId,
                actionType: "tenant_deleted",
                actor: resolveAuditActor(actorToken),
                before: existingTenant
                    ? this.sanitizeTenantForLog(existingTenant)
                    : undefined,
                requestMeta: extractRequestMeta(req),
            });
        }
    }

    private sanitizeTenantForLog(
        tenant: TenantEntity,
    ): Record<string, unknown> {
        return {
            id: tenant.id,
            name: tenant.name,
            description: tenant.description,
            status: tenant.status,
            sessionConfig: tenant.sessionConfig,
            statusListConfig: tenant.statusListConfig,
        };
    }

    private getChangedFields(
        before: TenantEntity,
        after: TenantEntity,
    ): string[] {
        return getChangedFieldsForKeys(before, after, [
            "name",
            "description",
            "sessionConfig",
            "statusListConfig",
        ]);
    }
}
