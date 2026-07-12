import { Injectable } from "@nestjs/common";
import { TenantEntity } from "../auth/tenant/entitites/tenant.entity";
import { AccessCertificateService } from "./access-certificate.service";
import { CreateAccessCertificateDto } from "./dto/create-access-certificate.dto";
import { CreateRegistrarConfigDto } from "./dto/create-registrar-config.dto";
import { UpdateRegistrarConfigDto } from "./dto/update-registrar-config.dto";
import { RegistrarConfigEntity } from "./entities/registrar-config.entity";
import { type RegistrationCertificateCreation } from "./generated";
import { RegistrarConfigService } from "./registrar-config.service";
import { RegistrationCertificateService } from "./registration-certificate.service";
import { SchemaMetadataService } from "./schema-metadata/schema-metadata.service";

/**
 * Facade that preserves the original public API of the registrar domain.
 * Actual logic lives in the focused sub-services:
 *  - {@link RegistrarConfigService}   — config CRUD and file-based import
 *  - {@link RegistrarAuthService}     — OAuth token management and API client
 *  - {@link RegistrationCertificateService} — registration cert lifecycle + DCQL fingerprints
 *  - {@link AccessCertificateService} — access certificate creation
 */
@Injectable()
export class RegistrarService {
    constructor(
        private readonly configSvc: RegistrarConfigService,
        private readonly regCertSvc: RegistrationCertificateService,
        private readonly accessCertSvc: AccessCertificateService,
        private readonly schemaMetadataSvc: SchemaMetadataService,
    ) {}

    // -------------------------------------------------------------------------
    // Config delegation → RegistrarConfigService
    // -------------------------------------------------------------------------

    isEnabledForTenant(tenantId: string): Promise<boolean> {
        return this.configSvc.isEnabledForTenant(tenantId);
    }

    onTenantInit(tenant: TenantEntity): Promise<void> {
        return this.configSvc.onTenantInit(tenant);
    }

    getConfig(tenantId: string): Promise<RegistrarConfigEntity | null> {
        return this.configSvc.getConfig(tenantId);
    }

    saveConfig(
        tenantId: string,
        dto: CreateRegistrarConfigDto,
    ): Promise<RegistrarConfigEntity> {
        return this.configSvc.saveConfig(tenantId, dto);
    }

    updateConfig(
        tenantId: string,
        dto: UpdateRegistrarConfigDto,
    ): Promise<RegistrarConfigEntity> {
        return this.configSvc.updateConfig(tenantId, dto);
    }

    deleteConfig(tenantId: string): Promise<void> {
        return this.configSvc.deleteConfig(tenantId);
    }

    // -------------------------------------------------------------------------
    // Access certificate delegation → AccessCertificateService
    // -------------------------------------------------------------------------

    createAccessCertificate(
        tenantId: string,
        dto: CreateAccessCertificateDto,
    ): Promise<{ id: string; certId: string; crt: string }> {
        return this.accessCertSvc.createAccessCertificate(tenantId, dto);
    }

    // -------------------------------------------------------------------------
    // Registration certificate delegation → RegistrationCertificateService
    // -------------------------------------------------------------------------

    addRegistrationCertificate(
        req: {
            id?: string;
            body?: Partial<RegistrationCertificateCreation>;
            jwt?: string;
        },
        dcqlQuery: any,
        requestId: string,
        tenantId: string,
    ): Promise<string> {
        return this.regCertSvc.addRegistrationCertificate(
            req,
            dcqlQuery,
            requestId,
            tenantId,
        );
    }

    resolveRegistrationCertificate(
        req: {
            id?: string;
            body?: Partial<RegistrationCertificateCreation>;
            jwt?: string;
        },
        dcqlQuery: any,
        requestId: string,
        tenantId: string,
    ): Promise<{
        jwt: string;
        payload: Record<string, any>;
        source: "imported" | "registrar";
    }> {
        return this.regCertSvc.resolveRegistrationCertificate(
            req,
            dcqlQuery,
            requestId,
            tenantId,
        );
    }

    computeDcqlFingerprint(dcqlQuery: any): string {
        return this.regCertSvc.computeDcqlFingerprint(dcqlQuery);
    }

    computeAuthorizedCredentialsFingerprint(credentials: unknown): string {
        return this.regCertSvc.computeAuthorizedCredentialsFingerprint(
            credentials,
        );
    }

    computeSpecFingerprint(spec: unknown): string {
        return this.regCertSvc.computeSpecFingerprint(spec);
    }

    // -------------------------------------------------------------------------
    // Schema metadata list lookup used by verifier/catalog flows.
    // -------------------------------------------------------------------------

    findAllSchemaMetadata(
        tenantId: string,
        filters: { attestationId?: string; version?: string },
    ) {
        return this.schemaMetadataSvc.findAll(tenantId, filters);
    }
}
