import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../../audit-log/audit-log.module.js";
import { WebhookModule } from "../../../webhook/webhook.module.js";
import { AttributeProviderController } from "./attribute-provider.controller.js";
import { AttributeProviderService } from "./attribute-provider.service.js";
import { AttributeProviderEntity } from "./entities/attribute-provider.entity.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([AttributeProviderEntity]),
        AuditLogModule,
        WebhookModule,
    ],
    controllers: [AttributeProviderController],
    providers: [AttributeProviderService],
    exports: [AttributeProviderService],
})
export class AttributeProviderModule {}
