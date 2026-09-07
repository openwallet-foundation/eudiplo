import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../../../../crypto/crypto.module.js";
import { SessionModule } from "../../../../session/session.module.js";
import { TrustModule } from "../../../../trust/trust.module.js";
import { Oid4vpModule } from "../../../../verifier/oid4vp/oid4vp.module.js";
import { PresentationsModule } from "../../../../verifier/presentations/presentations.module.js";
import { ConfigurationModule } from "../../../configuration/configuration.module.js";
import { InteractiveAuthSessionEntity } from "../entities/interactive-auth-session.entity.js";
import { NonceEntity } from "../entities/nonces.entity.js";
import { AuthorizationServersController } from "./authorization-servers/authorization-servers.controller.js";
import { AuthorizationServersService } from "./authorization-servers/authorization-servers.service.js";
import { AuthorizeController } from "./authorize/authorize.controller.js";
import { AuthorizeService } from "./authorize/authorize.service.js";
import { InteractiveAuthorizationController } from "./authorize/interactive-authorization.controller.js";
import { InteractiveAuthorizationService } from "./authorize/interactive-authorization.service.js";
import { ChainedAsController } from "./chained-as/chained-as.controller.js";
import { ChainedAsService } from "./chained-as/chained-as.service.js";
import { ChainedAsVpController } from "./chained-as-vp/chained-as-vp.controller.js";
import { ChainedAsVpService } from "./chained-as-vp/chained-as-vp.service.js";
import { ChainedAsSessionEntity } from "./shared/entities/chained-as-session.entity.js";

/**
 * Authorization Module - Groups the OID4VCI authorization server implementations.
 *
 * Bundles the four authorization-server variants and their shared logic:
 * - `authorize` — the issuer-native OAuth 2.0 / OID4VCI authorization server
 *   (authorization code, pre-authorized code, refresh token, interactive auth).
 * - `authorization-servers` — managed OID4VP-backed authorization servers.
 * - `chained-as` — chained authorization server delegating to an upstream OIDC provider.
 * - `chained-as-vp` — chained authorization server backed by an OID4VP presentation flow.
 *
 * The authorization-server services are exported so the surrounding issuance
 * components (e.g. metadata and well-known endpoints) can consume them.
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
            InteractiveAuthSessionEntity,
            ChainedAsSessionEntity,
        ]),
    ],
    controllers: [
        AuthorizeController,
        InteractiveAuthorizationController,
        ChainedAsController,
        AuthorizationServersController,
        ChainedAsVpController,
    ],
    providers: [
        AuthorizeService,
        InteractiveAuthorizationService,
        ChainedAsService,
        AuthorizationServersService,
        ChainedAsVpService,
    ],
    exports: [
        AuthorizeService,
        InteractiveAuthorizationService,
        ChainedAsService,
        AuthorizationServersService,
        ChainedAsVpService,
    ],
})
export class AuthorizationModule {}
