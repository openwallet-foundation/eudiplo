import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../audit-log/audit-log.module.js";
import { ClientModule } from "../../auth/client/client.module.js";
import { ClientEntity } from "../../auth/client/entities/client.entity.js";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity.js";
import { KeyChainEntity } from "../../crypto/key/entities/key-chain.entity.js";
import { AttributeProviderEntity } from "../../issuer/configuration/attribute-provider/entities/attribute-provider.entity.js";
import { ConfigurationModule } from "../../issuer/configuration/configuration.module.js";
import { CredentialConfig } from "../../issuer/configuration/credentials/entities/credential.entity.js";
import { IssuanceConfig } from "../../issuer/configuration/issuance/entities/issuance-config.entity.js";
import { WebhookEndpointEntity } from "../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity.js";
import { StatusListEntity } from "../../issuer/status-list/entities/status-list.entity.js";
import { StatusListModule } from "../../issuer/status-list/status-list.module.js";
import { TrustList } from "../../issuer/trust-list/entities/trust-list.entity.js";
import { TrustListModule } from "../../issuer/trust-list/trustlist.module.js";
import { RegistrarConfigEntity } from "../../registrar/entities/registrar-config.entity.js";
import { RegistrarModule } from "../../registrar/registrar.module.js";
import { FileEntity } from "../../storage/entities/files.entity.js";
import { PresentationConfig } from "../../verifier/presentations/entities/presentation-config.entity.js";
import { PresentationsModule } from "../../verifier/presentations/presentations.module.js";
import { ConfigBundleService } from "./config-bundle.service.js";
import { ConfigBundleApplyService } from "./config-bundle-apply.service.js";
import { ConfigBundleArchiveService } from "./config-bundle-archive.service.js";
import { ConfigDocumentValidationService } from "./config-document-validation.service.js";
import { ConfigFolderBundleService } from "./config-folder-bundle.service.js";
import { ConfigGenerationInterceptor } from "./config-generation.interceptor.js";
import { ConfigKmsReferenceService } from "./config-kms-reference.service.js";
import { ConfigOwnershipService } from "./config-ownership.service.js";
import { ConfigOwnershipBootstrapService } from "./config-ownership-bootstrap.service.js";
import { ConfigPortabilityController } from "./config-portability.controller.js";
import { ConfigResourceCoreModule } from "./config-resource-core.module.js";
import { ConfigResourceRouteService } from "./config-resource-route.service.js";
import { ConfigResourceMetadataEntity } from "./entities/config-resource-metadata.entity.js";

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
