import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CryptoModule } from "../../crypto/crypto.module";
import { SessionModule } from "../../session/session.module";
import { WebhookService } from "../../shared/utils/webhook/webhook.service";
import { PresentationsModule } from "../presentations/presentations.module";
import { Iso18013Controller } from "./iso18013.controller";
import { Iso18013Service } from "./iso18013.service";

@Module({
    imports: [
        ConfigModule,
        CryptoModule,
        SessionModule,
        HttpModule,
        PresentationsModule,
    ],
    controllers: [Iso18013Controller],
    providers: [Iso18013Service, WebhookService],
    exports: [Iso18013Service],
})
export class Iso18013Module {}
