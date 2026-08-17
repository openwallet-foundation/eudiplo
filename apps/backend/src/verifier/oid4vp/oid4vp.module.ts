import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../../crypto/crypto.module";
import { WebhookEndpointEntity } from "../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity";
import { RegistrarModule } from "../../registrar/registrar.module";
import { SessionModule } from "../../session/session.module";
import { WebhookModule } from "../../webhook/webhook.module";
import { PresentationsModule } from "../presentations/presentations.module";
import { Oid4vpController } from "./oid4vp.controller";
import { Oid4vpService } from "./oid4vp.service";

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
