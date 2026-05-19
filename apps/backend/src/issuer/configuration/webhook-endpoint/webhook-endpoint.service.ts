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
import { CreateWebhookEndpointDto } from "./dto/create-webhook-endpoint.dto";
import { UpdateWebhookEndpointDto } from "./dto/update-webhook-endpoint.dto";
import { WebhookEndpointEntity } from "./entities/webhook-endpoint.entity";

@Injectable()
export class WebhookEndpointService {
    constructor(
        @InjectRepository(WebhookEndpointEntity)
        private readonly repo: Repository<WebhookEndpointEntity>,
        private readonly configImportService: ConfigImportService,
        private readonly configImportOrchestrator: ConfigImportOrchestratorService,
        private readonly tenantActionLogService: AuditLogService,
    ) {
        this.configImportOrchestrator.register(
            "webhook-endpoints",
            ImportPhase.CORE,
            (tenantId) => this.importForTenant(tenantId),
        );
    }

    private async importForTenant(tenantId: string) {
        await this.configImportService.importConfigsForTenant<CreateWebhookEndpointDto>(
            tenantId,
            {
                subfolder: "webhook-endpoints",
                fileExtension: ".json",
                validationClass: CreateWebhookEndpointDto,
                resourceType: "webhook endpoint",
                checkExists: (tid, data) =>
                    this.getById(tid, data.id)
                        .then(() => true)
                        .catch(() => false),
                deleteExisting: (tid, data) =>
                    this.repo
                        .delete({ id: data.id, tenantId: tid })
                        .then(() => undefined),
                loadData: (filePath) =>
                    loadConfigDto(filePath, CreateWebhookEndpointDto),
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
            throw new NotFoundException(`Webhook endpoint '${id}' not found`);
        }
        return entity;
    }

    async create(
        tenantId: string,
        dto: CreateWebhookEndpointDto,
        actorToken?: TokenPayload,
        req?: Request,
    ) {
        const saved = await this.repo.save({ ...dto, tenantId });

        if (actorToken) {
            await this.tenantActionLogService.record({
                tenantId,
                actionType: "webhook_endpoint_created",
                actor: resolveAuditActor(actorToken),
                changedFields: getChangedFields(
                    undefined,
                    this.sanitizeWebhookEndpointForLog(saved),
                ),
                after: this.sanitizeWebhookEndpointForLog(saved),
                requestMeta: extractRequestMeta(req),
            });
        }

        return saved;
    }

    async update(
        tenantId: string,
        id: string,
        dto: UpdateWebhookEndpointDto,
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
                actionType: "webhook_endpoint_updated",
                actor: resolveAuditActor(actorToken),
                changedFields: getChangedFields(
                    this.sanitizeWebhookEndpointForLog(existing),
                    this.sanitizeWebhookEndpointForLog(saved),
                ),
                before: this.sanitizeWebhookEndpointForLog(existing),
                after: this.sanitizeWebhookEndpointForLog(saved),
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
                actionType: "webhook_endpoint_deleted",
                actor: resolveAuditActor(actorToken),
                before: this.sanitizeWebhookEndpointForLog(existing),
                requestMeta: extractRequestMeta(req),
            });
        }

        return result;
    }

    private sanitizeWebhookEndpointForLog(
        endpoint: WebhookEndpointEntity,
    ): Record<string, unknown> {
        return {
            id: endpoint.id,
            name: endpoint.name,
            url: endpoint.url,
            description: endpoint.description,
            auth: endpoint.auth,
        };
    }
}
