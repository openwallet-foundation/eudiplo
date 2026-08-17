import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../../crypto/crypto.module";
import { WebhookEndpointEntity } from "../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity";
import { SessionModule } from "../../session/session.module";
import { SessionLoggingModule } from "../../session/logging/session-logging.module";
import { WebhookModule } from "../../webhook/webhook.module";
import { PresentationsModule } from "../presentations/presentations.module";
import { Iso18013Controller } from "./iso18013.controller";
import { Iso18013Service } from "./iso18013.service";

@Module({
    imports: [
        ConfigModule,
        CryptoModule,
        SessionModule,
        WebhookModule,
        TypeOrmModule.forFeature([WebhookEndpointEntity]),
        PresentationsModule,
        SessionLoggingModule,
    ],
    controllers: [Iso18013Controller],
    providers: [Iso18013Service],
    exports: [Iso18013Service],
})
export class Iso18013Module {}
