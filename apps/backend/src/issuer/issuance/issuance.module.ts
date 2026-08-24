import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../../crypto/crypto.module";
import { RegistrarModule } from "../../registrar/registrar.module";
import { SessionModule } from "../../session/session.module";
import { TrustModule } from "../../trust/trust.module";
import { Oid4vpModule } from "../../verifier/oid4vp/oid4vp.module";
import { PresentationsModule } from "../../verifier/presentations/presentations.module";
import { WebhookModule } from "../../webhook/webhook.module";
import { ConfigurationModule } from "../configuration/configuration.module";
import { WebhookEndpointEntity } from "../configuration/webhook-endpoint/entities/webhook-endpoint.entity";
import { CredentialOfferController } from "./offer/credential-offer.controller";
import { AuthorizationModule } from "./oid4vci/authorization/authorization.module";
import { DeferredController } from "./oid4vci/deferred.controller";
import { DeferredCredentialService } from "./oid4vci/deferred-credential.service";
import { DeferredTransactionEntity } from "./oid4vci/entities/deferred-transaction.entity";
import { NonceEntity } from "./oid4vci/entities/nonces.entity";
import { Oid4vciMetadataController } from "./oid4vci/metadata/oid4vci-metadata.controller";
import { NonceService } from "./oid4vci/nonce.service";
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
        WebhookModule,
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
