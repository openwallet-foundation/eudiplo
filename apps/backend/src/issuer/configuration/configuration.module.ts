import { Module } from "@nestjs/common";
import { SchemaMetadataModule } from "../../registrar/schema-metadata/schema-metadata.module";
import { StatusListModule } from "../status-list/status-list.module";
import { AttributeProviderModule } from "./attribute-provider/attribute-provider.module";
import { CredentialConfigModule } from "./credentials/credential-config.module";
import { CredentialIssuanceModule } from "./credentials/credential-issuance.module";
import { IssuanceConfigModule } from "./issuance/issuance-config.module";
import { WebhookEndpointModule } from "./webhook-endpoint/webhook-endpoint.module";

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
        AttributeProviderModule,
        CredentialConfigModule,
        CredentialIssuanceModule,
        IssuanceConfigModule,
        SchemaMetadataModule,
        StatusListModule,
        WebhookEndpointModule,
    ],
    exports: [
        AttributeProviderModule,
        CredentialConfigModule,
        CredentialIssuanceModule,
        IssuanceConfigModule,
        StatusListModule,
        WebhookEndpointModule,
    ],
})
export class ConfigurationModule {}
