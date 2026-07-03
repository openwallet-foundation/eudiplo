import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../audit-log/audit-log.module";
import { CryptoModule } from "../../crypto/crypto.module";
import { RegistrarModule } from "../../registrar/registrar.module";
import { SchemaMetadataController } from "../../registrar/schema-metadata.controller";
import { SessionModule } from "../../session/session.module";
import { TrustModule } from "../../shared/trust/trust.module";
import { OutboundUrlPolicyService } from "../../shared/utils/webhook/outbound-url-policy.service";
import { WebhookService } from "../../shared/utils/webhook/webhook.service";
import { PresentationsModule } from "../../verifier/presentations/presentations.module";
import { StatusListModule } from "../lifecycle/status/status-list.module";
import { TrustListModule } from "../trust-list/trustlist.module";
import { AttributeProviderController } from "./attribute-provider/attribute-provider.controller";
import { AttributeProviderService } from "./attribute-provider/attribute-provider.service";
import { AttributeProviderEntity } from "./attribute-provider/entities/attribute-provider.entity";
import { CredentialConfigService } from "./credentials/credential-config/credential-config.service";
import { CredentialConfigController } from "./credentials/credential-config.controller";
import { CredentialsService } from "./credentials/credentials.service";
import { CredentialConfig } from "./credentials/entities/credential.entity";
import { MdocIssuerService } from "./credentials/issuer/mdoc-issuer/mdoc-issuer.service";
import { SdjwtvcIssuerService } from "./credentials/issuer/sdjwtvc-issuer/sdjwtvc-issuer.service";
import { SchemaMetaAdapterService } from "./credentials/schema-meta/schema-meta-adapter.service";
import { SchemaMetadataSigningService } from "./credentials/schema-meta/schema-metadata-signing.service";
import { IssuanceConfig } from "./issuance/entities/issuance-config.entity";
import { IssuanceService } from "./issuance/issuance.service";
import { IssuanceConfigController } from "./issuance/issuance-config.controller";
import { WebhookEndpointEntity } from "./webhook-endpoint/entities/webhook-endpoint.entity";
import { WebhookEndpointController } from "./webhook-endpoint/webhook-endpoint.controller";
import { WebhookEndpointService } from "./webhook-endpoint/webhook-endpoint.service";

/**
 * Configuration Module - Manages issuer configurations and credential definitions
 *
 * Responsibilities:
 * - Issuance configuration management
 * - Credential type definitions
 * - Credential schemas and metadata
 */
@Module({
    imports: [
        CryptoModule,
        StatusListModule,
        TrustListModule,
        HttpModule,
        SessionModule,
        TrustModule,
        PresentationsModule,
        RegistrarModule,
        TypeOrmModule.forFeature([
            IssuanceConfig,
            CredentialConfig,
            AttributeProviderEntity,
            WebhookEndpointEntity,
        ]),
        AuditLogModule,
    ],
    controllers: [
        IssuanceConfigController,
        CredentialConfigController,
        SchemaMetadataController,
        AttributeProviderController,
        WebhookEndpointController,
    ],
    providers: [
        IssuanceService,
        CredentialsService,
        CredentialConfigService,
        WebhookService,
        OutboundUrlPolicyService,
        SdjwtvcIssuerService,
        MdocIssuerService,
        AttributeProviderService,
        WebhookEndpointService,
        SchemaMetaAdapterService,
        SchemaMetadataSigningService,
    ],
    exports: [
        IssuanceService,
        CredentialConfigService,
        CredentialsService,
        StatusListModule,
        AttributeProviderService,
        WebhookEndpointService,
    ],
})
export class ConfigurationModule {}
