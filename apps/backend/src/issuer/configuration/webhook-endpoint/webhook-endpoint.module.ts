import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../../audit-log/audit-log.module.js";
import { WebhookModule } from "../../../webhook/webhook.module.js";
import { WebhookEndpointEntity } from "./entities/webhook-endpoint.entity.js";
import { WebhookEndpointController } from "./webhook-endpoint.controller.js";
import { WebhookEndpointService } from "./webhook-endpoint.service.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([WebhookEndpointEntity]),
        AuditLogModule,
        WebhookModule,
    ],
    controllers: [WebhookEndpointController],
    providers: [WebhookEndpointService],
    exports: [WebhookEndpointService],
})
export class WebhookEndpointModule {}
