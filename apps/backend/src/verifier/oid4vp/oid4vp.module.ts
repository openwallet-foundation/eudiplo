import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../../crypto/crypto.module";
import { WebhookEndpointEntity } from "../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity";
import { RegistrarModule } from "../../registrar/registrar.module";
import { SessionModule } from "../../session/session.module";
import { OutboundUrlPolicyService } from "../../shared/utils/webhook/outbound-url-policy.service";
import { WebhookService } from "../../shared/utils/webhook/webhook.service";
import { PresentationsModule } from "../presentations/presentations.module";
import { Oid4vpController } from "./oid4vp.controller";
import { Oid4vpService } from "./oid4vp.service";

@Module({
    imports: [
        CryptoModule,
        RegistrarModule,
        SessionModule,
        HttpModule,
        TypeOrmModule.forFeature([WebhookEndpointEntity]),
        PresentationsModule,
    ],
    controllers: [Oid4vpController],
    providers: [Oid4vpService, WebhookService, OutboundUrlPolicyService],
    exports: [Oid4vpService],
})
export class Oid4vpModule {}
