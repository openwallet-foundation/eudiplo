import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../../crypto/crypto.module.js";
import { WebhookEndpointEntity } from "../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity.js";
import { RegistrarModule } from "../../registrar/registrar.module.js";
import { SessionModule } from "../../session/session.module.js";
import { WebhookModule } from "../../webhook/webhook.module.js";
import { PresentationsModule } from "../presentations/presentations.module.js";
import { Oid4vpController } from "./oid4vp.controller.js";
import { Oid4vpService } from "./oid4vp.service.js";

@Module({
    imports: [
        CryptoModule,
        RegistrarModule,
        SessionModule,
        WebhookModule,
        TypeOrmModule.forFeature([WebhookEndpointEntity]),
        PresentationsModule,
    ],
    controllers: [Oid4vpController],
    providers: [Oid4vpService],
    exports: [Oid4vpService],
})
export class Oid4vpModule {}
