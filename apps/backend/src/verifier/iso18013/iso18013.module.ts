import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../../crypto/crypto.module.js";
import { WebhookEndpointEntity } from "../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity.js";
import { SessionLoggingModule } from "../../session/logging/session-logging.module.js";
import { SessionModule } from "../../session/session.module.js";
import { WebhookModule } from "../../webhook/webhook.module.js";
import { PresentationsModule } from "../presentations/presentations.module.js";
import { Iso18013Controller } from "./iso18013.controller.js";
import { Iso18013Service } from "./iso18013.service.js";

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
