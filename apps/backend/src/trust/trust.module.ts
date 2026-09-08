import * as https from "node:https";
import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TrustListModule } from "../issuer/trust-list/trustlist.module.js";
import { CryptoModule } from "../crypto/crypto.module.js";
import { CacheController } from "./cache.controller.js";
import { FederationTrustService } from "./federation-trust.service.js";
import { LoteParserService } from "./lote-parser.service.js";
import { StatusListVerifierService } from "./status-list-verifier.service.js";
import { TrustStoreService } from "./trust-store.service.js";
import { TrustListJwtService } from "./trustlist-jwt.service.js";
import { WalletAttestationService } from "./wallet-attestation.service.js";
import { X509ValidationService } from "./x509-validation.service.js";

@Module({
    imports: [
        HttpModule.register({
            httpsAgent: new https.Agent({
                rejectUnauthorized: process.env.NODE_ENV === "production",
            }),
        }),
        CryptoModule,
        TrustListModule,
    ],
    controllers: [CacheController],
    providers: [
        TrustListJwtService,
        LoteParserService,
        TrustStoreService,
        X509ValidationService,
        StatusListVerifierService,
        WalletAttestationService,
        FederationTrustService,
    ],
    exports: [
        TrustStoreService,
        X509ValidationService,
        StatusListVerifierService,
        WalletAttestationService,
        FederationTrustService,
    ],
})
export class TrustModule {}
