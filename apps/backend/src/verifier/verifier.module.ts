import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { CryptoModule } from "../crypto/crypto.module";
import { RegistrarModule } from "../registrar/registrar.module";
import { SessionModule } from "../session/session.module";
import { Iso18013Module } from "./iso18013/iso18013.module";
import { Oid4vpModule } from "./oid4vp/oid4vp.module";
import { PresentationsModule } from "./presentations/presentations.module";
import { VerifierOfferController } from "./verifier-offer/verifier-offer.controller";

@Module({
    imports: [
        CryptoModule,
        RegistrarModule,
        SessionModule,
        HttpModule,
        PresentationsModule,
        Oid4vpModule,
        Iso18013Module,
    ],
    controllers: [VerifierOfferController],
})
export class VerifierModule {}
