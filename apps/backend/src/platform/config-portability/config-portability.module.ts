import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../audit-log/audit-log.module";
import { ClientModule } from "../../auth/client/client.module";
import { ClientEntity } from "../../auth/client/entities/client.entity";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";
import { KeyChainEntity } from "../../crypto/key/entities/key-chain.entity";
import { AttributeProviderEntity } from "../../issuer/configuration/attribute-provider/entities/attribute-provider.entity";
import { ConfigurationModule } from "../../issuer/configuration/configuration.module";
import { CredentialConfig } from "../../issuer/configuration/credentials/entities/credential.entity";
import { IssuanceConfig } from "../../issuer/configuration/issuance/entities/issuance-config.entity";
import { WebhookEndpointEntity } from "../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity";
import { StatusListEntity } from "../../issuer/status-list/entities/status-list.entity";
import { StatusListModule } from "../../issuer/status-list/status-list.module";
import { TrustList } from "../../issuer/trust-list/entities/trust-list.entity";
import { TrustListModule } from "../../issuer/trust-list/trustlist.module";
import { RegistrarConfigEntity } from "../../registrar/entities/registrar-config.entity";
import { RegistrarModule } from "../../registrar/registrar.module";
import { FileEntity } from "../../storage/entities/files.entity";
import { PresentationConfig } from "../../verifier/presentations/entities/presentation-config.entity";
import { PresentationsModule } from "../../verifier/presentations/presentations.module";
import { ConfigBundleService } from "./config-bundle.service";
import { ConfigBundleApplyService } from "./config-bundle-apply.service";
import { ConfigBundleArchiveService } from "./config-bundle-archive.service";
import { ConfigDocumentValidationService } from "./config-document-validation.service";
import { ConfigFolderBundleService } from "./config-folder-bundle.service";
import { ConfigGenerationInterceptor } from "./config-generation.interceptor";
import { ConfigKmsReferenceService } from "./config-kms-reference.service";
import { ConfigOwnershipService } from "./config-ownership.service";
import { ConfigOwnershipBootstrapService } from "./config-ownership-bootstrap.service";
import { ConfigPortabilityController } from "./config-portability.controller";
import { ConfigResourceCoreModule } from "./config-resource-core.module";
import { ConfigResourceRouteService } from "./config-resource-route.service";
import { ConfigResourceMetadataEntity } from "./entities/config-resource-metadata.entity";

@Global()
@Module({
    imports: [
        AuditLogModule,
        ClientModule,
        ConfigResourceCoreModule,
        ConfigurationModule,
        StatusListModule,
        TrustListModule,
        RegistrarModule,
        PresentationsModule,
        TypeOrmModule.forFeature([
            ConfigResourceMetadataEntity,
            TenantEntity,
            ClientEntity,
            KeyChainEntity,
            RegistrarConfigEntity,
            IssuanceConfig,
            CredentialConfig,
            PresentationConfig,
            AttributeProviderEntity,
            WebhookEndpointEntity,
            TrustList,
            StatusListEntity,
            FileEntity,
        ]),
    ],
    controllers: [ConfigPortabilityController],
    providers: [
        ConfigDocumentValidationService,
        ConfigOwnershipService,
        ConfigResourceRouteService,
        ConfigBundleService,
        ConfigBundleArchiveService,
        ConfigKmsReferenceService,
        ConfigOwnershipBootstrapService,
        ConfigFolderBundleService,
        ConfigBundleApplyService,
        {
            provide: APP_INTERCEPTOR,
            useClass: ConfigGenerationInterceptor,
        },
    ],
    exports: [ConfigResourceCoreModule, ConfigOwnershipService],
})
export class ConfigPortabilityModule {}
