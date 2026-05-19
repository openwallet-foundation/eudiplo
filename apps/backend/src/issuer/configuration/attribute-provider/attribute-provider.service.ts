import { Injectable, NotFoundException } from "@nestjs/common";
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
import { CreateAttributeProviderDto } from "./dto/create-attribute-provider.dto";
import { UpdateAttributeProviderDto } from "./dto/update-attribute-provider.dto";
import { AttributeProviderEntity } from "./entities/attribute-provider.entity";

@Injectable()
export class AttributeProviderService {
    constructor(
        @InjectRepository(AttributeProviderEntity)
        private readonly repo: Repository<AttributeProviderEntity>,
        private readonly configImportService: ConfigImportService,
        private readonly configImportOrchestrator: ConfigImportOrchestratorService,
        private readonly tenantActionLogService: AuditLogService,
    ) {
        this.configImportOrchestrator.register(
            "attribute-providers",
            ImportPhase.CORE,
            (tenantId) => this.importForTenant(tenantId),
        );
    }

    private async importForTenant(tenantId: string) {
        await this.configImportService.importConfigsForTenant<CreateAttributeProviderDto>(
            tenantId,
            {
                subfolder: "attribute-providers",
                fileExtension: ".json",
                validationClass: CreateAttributeProviderDto,
                resourceType: "attribute provider",
                checkExists: (tid, data) =>
                    this.getById(tid, data.id)
                        .then(() => true)
                        .catch(() => false),
                deleteExisting: (tid, data) =>
                    this.repo
                        .delete({ id: data.id, tenantId: tid })
                        .then(() => undefined),
                loadData: (filePath) =>
                    loadConfigDto(filePath, CreateAttributeProviderDto),
                processItem: async (tid, dto) => {
                    await this.create(tid, dto);
                },
            },
        );
    }

    getAll(tenantId: string) {
        return this.repo.find({ where: { tenantId } });
    }

    async getById(tenantId: string, id: string) {
        const entity = await this.repo.findOneBy({ id, tenantId });
        if (!entity) {
            throw new NotFoundException(`Attribute provider '${id}' not found`);
        }
        return entity;
    }

    async create(
        tenantId: string,
        dto: CreateAttributeProviderDto,
        actorToken?: TokenPayload,
        req?: Request,
    ) {
        const saved = await this.repo.save({ ...dto, tenantId });

        if (actorToken) {
            await this.tenantActionLogService.record({
                tenantId,
                actionType: "attribute_provider_created",
                actor: resolveAuditActor(actorToken),
                changedFields: getChangedFields(
                    undefined,
                    this.sanitizeAttributeProviderForLog(saved),
                ),
                after: this.sanitizeAttributeProviderForLog(saved),
                requestMeta: extractRequestMeta(req),
            });
        }

        return saved;
    }

    async update(
        tenantId: string,
        id: string,
        dto: UpdateAttributeProviderDto,
        actorToken?: TokenPayload,
        req?: Request,
    ) {
        const existing = await this.getById(tenantId, id);
        const saved = await this.repo.save({
            ...existing,
            ...dto,
            id,
            tenantId,
        });

        if (actorToken) {
            await this.tenantActionLogService.record({
                tenantId,
                actionType: "attribute_provider_updated",
                actor: resolveAuditActor(actorToken),
                changedFields: getChangedFields(
                    this.sanitizeAttributeProviderForLog(existing),
                    this.sanitizeAttributeProviderForLog(saved),
                ),
                before: this.sanitizeAttributeProviderForLog(existing),
                after: this.sanitizeAttributeProviderForLog(saved),
                requestMeta: extractRequestMeta(req),
            });
        }

        return saved;
    }

    async delete(
        tenantId: string,
        id: string,
        actorToken?: TokenPayload,
        req?: Request,
    ) {
        const existing = await this.getById(tenantId, id);
        const result = await this.repo.delete({ id, tenantId });

        if (actorToken) {
            await this.tenantActionLogService.record({
                tenantId,
                actionType: "attribute_provider_deleted",
                actor: resolveAuditActor(actorToken),
                before: this.sanitizeAttributeProviderForLog(existing),
                requestMeta: extractRequestMeta(req),
            });
        }

        return result;
    }

    private sanitizeAttributeProviderForLog(
        provider: AttributeProviderEntity,
    ): Record<string, unknown> {
        return {
            id: provider.id,
            name: provider.name,
            description: provider.description,
            url: provider.url,
            auth: provider.auth,
        };
    }
}
