import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../../crypto/crypto.module.js";
import { RegistrarModule } from "../../registrar/registrar.module.js";
import { SessionModule } from "../../session/session.module.js";
import { TrustModule } from "../../trust/trust.module.js";
import { Oid4vpModule } from "../../verifier/oid4vp/oid4vp.module.js";
import { PresentationsModule } from "../../verifier/presentations/presentations.module.js";
import { WebhookModule } from "../../webhook/webhook.module.js";
import { ConfigurationModule } from "../configuration/configuration.module.js";
import { WebhookEndpointEntity } from "../configuration/webhook-endpoint/entities/webhook-endpoint.entity.js";
import { StatusListModule } from "../status-list/status-list.module.js";
import { CredentialOfferController } from "./offer/credential-offer.controller.js";
import { AuthorizationModule } from "./oid4vci/authorization/authorization.module.js";
import { DeferredController } from "./oid4vci/deferred.controller.js";
import { DeferredCredentialService } from "./oid4vci/deferred-credential.service.js";
import { DeferredTransactionEntity } from "./oid4vci/entities/deferred-transaction.entity.js";
import { NonceEntity } from "./oid4vci/entities/nonces.entity.js";
import { Oid4vciMetadataController } from "./oid4vci/metadata/oid4vci-metadata.controller.js";
import { NonceService } from "./oid4vci/nonce.service.js";
import { Oid4vciController } from "./oid4vci/oid4vci.controller.js";
import { Oid4vciService } from "./oid4vci/oid4vci.service.js";
import { WellKnownController } from "./oid4vci/well-known/well-known.controller.js";
import { WellKnownService } from "./oid4vci/well-known/well-known.service.js";

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
        WebhookModule,
        StatusListModule,
        AuthorizationModule,
        RegistrarModule,
        TypeOrmModule.forFeature([
            NonceEntity,
            DeferredTransactionEntity,
            WebhookEndpointEntity,
        ]),
    ],
    controllers: [
        Oid4vciController,
        CredentialOfferController,
        DeferredController,
        Oid4vciMetadataController,
        WellKnownController,
    ],
    providers: [
        DeferredCredentialService,
        NonceService,
        Oid4vciService,
        WellKnownService,
    ],
    exports: [AuthorizationModule, Oid4vciService],
})
export class IssuanceModule {}
