import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    Res,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuditLogService } from "../../audit-log/audit-log.service";
import {
    extractRequestMeta,
    resolveAuditActor,
} from "../../audit-log/audit-log-context.util";
import { Role } from "../../auth/roles/role.enum";
import { Secured } from "../../auth/secure.decorator";
import { Token, TokenPayload } from "../../auth/token.decorator";
import { ConfigBundleApplyService } from "./config-bundle-apply.service";
import { ConfigBundleArchiveService } from "./config-bundle-archive.service";
import { ConfigBundleService } from "./config-bundle.service";
import { ConfigMigrationService } from "./config-migration.service";
import { ConfigOwnershipService } from "./config-ownership.service";
import { CONFIG_RESOURCE_KINDS } from "./config-resource.types";
import type {
    ConfigBundle,
    ConfigDocument,
    ConfigImportMode,
    ConfigResourceKind,
} from "./config-resource.types";

@ApiTags("Configuration portability")
@Secured([
    Role.Tenants,
    Role.Issuances,
    Role.Presentations,
    Role.Clients,
    Role.Registrar,
])
@Controller("config-bundles")
export class ConfigPortabilityController {
    constructor(
        private readonly bundleService: ConfigBundleService,
        private readonly archiveService: ConfigBundleArchiveService,
        private readonly applyService: ConfigBundleApplyService,
        private readonly migrationService: ConfigMigrationService,
        private readonly ownershipService: ConfigOwnershipService,
        private readonly auditLogService: AuditLogService,
    ) {}

    @Get("export")
    @Secured([Role.Tenants])
    @ApiOperation({ summary: "Export the current tenant configuration" })
    async export(
        @Token() token: TokenPayload,
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
        @Query("format") format: "json" | "zip" = "json",
    ) {
        const tenantId = token.entity!.id;
        const bundle = await this.bundleService.exportBundle(tenantId);
        await this.auditLogService.record({
            tenantId,
            actionType: "config_bundle_exported",
            actor: resolveAuditActor(token),
            after: {
                resourceCount: bundle.documents.length,
                requirementCount: bundle.manifest.requirements.length,
            },
            requestMeta: extractRequestMeta(request),
        });
        if (format === "zip") {
            response.type("application/zip");
            response.setHeader(
                "Content-Disposition",
                `attachment; filename="eudiplo-config-${tenantId}.zip"`,
            );
            return this.archiveService.encode(bundle);
        }
        if (format !== "json") {
            throw new BadRequestException("Unsupported bundle format");
        }
        return bundle;
    }

    @Post("plan")
    @ApiOperation({
        summary: "Plan and validate a tenant configuration import",
    })
    plan(
        @Token() token: TokenPayload,
        @Body() bundle: ConfigBundle,
        @Query("mode") mode: ConfigImportMode = "upsert",
    ) {
        this.assertMode(mode);
        return this.bundleService.plan(token.entity!.id, bundle, mode);
    }

    @Post("plan/archive")
    @UseInterceptors(
        FileInterceptor("bundle", { limits: { fileSize: 50 * 1024 * 1024 } }),
    )
    @ApiConsumes("multipart/form-data")
    @ApiOperation({ summary: "Plan an import from a configuration ZIP" })
    planArchive(
        @Token() token: TokenPayload,
        @UploadedFile() file: { buffer: Buffer } | undefined,
        @Query("mode") mode: ConfigImportMode = "upsert",
    ) {
        this.assertMode(mode);
        if (!file?.buffer)
            throw new BadRequestException("bundle file is required");
        return this.bundleService.plan(
            token.entity!.id,
            this.archiveService.decode(file.buffer),
            mode,
        );
    }

    @Post("import")
    @Secured([Role.Tenants])
    @ApiOperation({ summary: "Apply a validated tenant configuration bundle" })
    async import(
        @Token() token: TokenPayload,
        @Req() request: Request,
        @Body() bundle: ConfigBundle,
        @Query("mode") mode: ConfigImportMode = "upsert",
        @Query("confirmReplace") confirmReplace?: string,
    ) {
        return this.applyAndAudit(token, request, bundle, mode, confirmReplace);
    }

    @Post("import/archive")
    @Secured([Role.Tenants])
    @UseInterceptors(
        FileInterceptor("bundle", { limits: { fileSize: 50 * 1024 * 1024 } }),
    )
    @ApiConsumes("multipart/form-data")
    @ApiOperation({ summary: "Apply a configuration ZIP" })
    importArchive(
        @Token() token: TokenPayload,
        @Req() request: Request,
        @UploadedFile() file: { buffer: Buffer } | undefined,
        @Query("mode") mode: ConfigImportMode = "upsert",
        @Query("confirmReplace") confirmReplace?: string,
    ) {
        if (!file?.buffer)
            throw new BadRequestException("bundle file is required");
        return this.applyAndAudit(
            token,
            request,
            this.archiveService.decode(file.buffer),
            mode,
            confirmReplace,
        );
    }

    private async applyAndAudit(
        token: TokenPayload,
        request: Request,
        bundle: ConfigBundle,
        mode: ConfigImportMode,
        confirmReplace?: string,
    ) {
        this.assertMode(mode);
        if (mode === "replace" && confirmReplace !== "true") {
            throw new BadRequestException(
                "replace mode requires confirmReplace=true",
            );
        }
        const tenantId = token.entity!.id;
        const plan = await this.applyService.apply(tenantId, bundle, mode);
        await this.auditLogService.record({
            tenantId,
            actionType: "config_bundle_imported",
            actor: resolveAuditActor(token),
            after: {
                mode,
                resources: plan.items.map((item) => ({
                    kind: item.kind,
                    id: item.id,
                    action: item.action,
                })),
            },
            requestMeta: extractRequestMeta(request),
        });
        if (plan.generatedSecrets?.length) {
            await this.auditLogService.record({
                tenantId,
                actionType: "config_client_secret_generated",
                actor: resolveAuditActor(token),
                after: {
                    clients: plan.generatedSecrets.map(({ id }) => id),
                    count: plan.generatedSecrets.length,
                },
                requestMeta: extractRequestMeta(request),
            });
        }
        return plan;
    }

    @Post("documents/upgrade")
    @ApiOperation({ summary: "Upgrade one configuration document" })
    upgrade(@Body() input: ConfigDocument) {
        return this.migrationService.upgrade(input);
    }

    @Get("resources")
    @ApiOperation({ summary: "List configuration resource ownership" })
    resources(@Token() token: TokenPayload) {
        return this.ownershipService.list(token.entity!.id);
    }

    @Post("resources/:kind/:id/detach")
    @Secured([Role.Tenants])
    @ApiOperation({ summary: "Detach a resource from file provisioning" })
    async detach(
        @Token() token: TokenPayload,
        @Req() request: Request,
        @Param("kind") rawKind: string,
        @Param("id") id: string,
    ) {
        if (!CONFIG_RESOURCE_KINDS.includes(rawKind as ConfigResourceKind)) {
            throw new BadRequestException(
                `Unsupported resource kind: ${rawKind}`,
            );
        }
        const kind = rawKind as ConfigResourceKind;
        const tenantId = token.entity!.id;
        const metadata = await this.ownershipService.detach(tenantId, kind, id);
        await this.auditLogService.record({
            tenantId,
            actionType: "config_resource_detached",
            actor: resolveAuditActor(token),
            after: { kind, id },
            requestMeta: extractRequestMeta(request),
        });
        return metadata;
    }

    private assertMode(mode: string): asserts mode is ConfigImportMode {
        if (!["create", "upsert", "replace"].includes(mode)) {
            throw new BadRequestException("Unsupported import mode");
        }
    }
}
