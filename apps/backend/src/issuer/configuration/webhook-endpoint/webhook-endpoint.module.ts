import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../../audit-log/audit-log.module";
import { WebhookModule } from "../../../webhook/webhook.module";
import { WebhookEndpointEntity } from "./entities/webhook-endpoint.entity";
import { WebhookEndpointController } from "./webhook-endpoint.controller";
import { WebhookEndpointService } from "./webhook-endpoint.service";

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
