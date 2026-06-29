import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../../crypto/crypto.module";
import { SessionModule } from "../../session/session.module";
import { TrustModule } from "../../shared/trust/trust.module";
import { WebhookService } from "../../shared/utils/webhook/webhook.service";
import { Oid4vpModule } from "../../verifier/oid4vp/oid4vp.module";
import { PresentationsModule } from "../../verifier/presentations/presentations.module";
import { ConfigurationModule } from "../configuration/configuration.module";
import { WebhookEndpointEntity } from "../configuration/webhook-endpoint/entities/webhook-endpoint.entity";
import { CredentialOfferController } from "./offer/credential-offer.controller";
import { AuthorizeController } from "./oid4vci/authorize/authorize.controller";
import { AuthorizeService } from "./oid4vci/authorize/authorize.service";
import { InteractiveAuthorizationController } from "./oid4vci/authorize/interactive-authorization.controller";
import { InteractiveAuthorizationService } from "./oid4vci/authorize/interactive-authorization.service";
import { ChainedAsController } from "./oid4vci/chained-as/chained-as.controller";
import { ChainedAsService } from "./oid4vci/chained-as/chained-as.service";
import { ChainedAsSessionEntity } from "./oid4vci/chained-as/entities/chained-as-session.entity";
import { AuthorizationServersController } from "./oid4vci/authorization-servers/authorization-servers.controller";
import { AuthorizationServersService } from "./oid4vci/authorization-servers/authorization-servers.service";
import { ChainedAsVpController } from "./oid4vci/chained-as-vp/chained-as-vp.controller";
import { ChainedAsVpService } from "./oid4vci/chained-as-vp/chained-as-vp.service";
import { DeferredController } from "./oid4vci/deferred.controller";
import { DeferredCredentialService } from "./oid4vci/deferred-credential.service";
import { DeferredTransactionEntity } from "./oid4vci/entities/deferred-transaction.entity";
import { InteractiveAuthSessionEntity } from "./oid4vci/entities/interactive-auth-session.entity";
import { NonceEntity } from "./oid4vci/entities/nonces.entity";
import { Oid4vciMetadataController } from "./oid4vci/metadata/oid4vci-metadata.controller";
import { Oid4vciController } from "./oid4vci/oid4vci.controller";
import { Oid4vciService } from "./oid4vci/oid4vci.service";
import { WellKnownController } from "./oid4vci/well-known/well-known.controller";
import { WellKnownService } from "./oid4vci/well-known/well-known.service";

/**
 * Issuance Module - Handles credential issuance operations
 *
 * Responsibilities:
 * - Creating credential offers
 * - OID4VCI protocol implementation
 * - Authorization and token management
 * - Credential issuance workflows
 */
@Module({
    imports: [
        CryptoModule,
        ConfigurationModule,
        Oid4vpModule,
        PresentationsModule,
        SessionModule,
        HttpModule,
        TrustModule,
        TypeOrmModule.forFeature([
            NonceEntity,
            DeferredTransactionEntity,
            InteractiveAuthSessionEntity,
            ChainedAsSessionEntity,
            WebhookEndpointEntity,
        ]),
    ],
    controllers: [
        Oid4vciController,
        AuthorizeController,
        InteractiveAuthorizationController,
        ChainedAsController,
        AuthorizationServersController,
        ChainedAsVpController,
        CredentialOfferController,
        DeferredController,
        Oid4vciMetadataController,
        WellKnownController,
    ],
    providers: [
        AuthorizeService,
        InteractiveAuthorizationService,
        ChainedAsService,
        AuthorizationServersService,
        ChainedAsVpService,
        DeferredCredentialService,
        Oid4vciService,
        WellKnownService,
        WebhookService,
    ],
    exports: [
        AuthorizeService,
        InteractiveAuthorizationService,
        ChainedAsService,
        AuthorizationServersService,
        ChainedAsVpService,
        Oid4vciService,
    ],
})
export class IssuanceModule {}
