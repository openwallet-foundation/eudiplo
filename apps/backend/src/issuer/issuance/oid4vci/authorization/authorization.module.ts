import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../../../../crypto/crypto.module";
import { SessionModule } from "../../../../session/session.module";
import { TrustModule } from "../../../../shared/trust/trust.module";
import { Oid4vpModule } from "../../../../verifier/oid4vp/oid4vp.module";
import { PresentationsModule } from "../../../../verifier/presentations/presentations.module";
import { ConfigurationModule } from "../../../configuration/configuration.module";
import { InteractiveAuthSessionEntity } from "../entities/interactive-auth-session.entity";
import { NonceEntity } from "../entities/nonces.entity";
import { AuthorizationServersController } from "./authorization-servers/authorization-servers.controller";
import { AuthorizationServersService } from "./authorization-servers/authorization-servers.service";
import { AuthorizeController } from "./authorize/authorize.controller";
import { AuthorizeService } from "./authorize/authorize.service";
import { InteractiveAuthorizationController } from "./authorize/interactive-authorization.controller";
import { InteractiveAuthorizationService } from "./authorize/interactive-authorization.service";
import { ChainedAsController } from "./chained-as/chained-as.controller";
import { ChainedAsService } from "./chained-as/chained-as.service";
import { ChainedAsVpController } from "./chained-as-vp/chained-as-vp.controller";
import { ChainedAsVpService } from "./chained-as-vp/chained-as-vp.service";
import { ChainedAsSessionEntity } from "./shared/entities/chained-as-session.entity";

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
