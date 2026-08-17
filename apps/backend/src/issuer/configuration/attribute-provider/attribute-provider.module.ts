import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../../audit-log/audit-log.module";
import { WebhookModule } from "../../../webhook/webhook.module";
import { AttributeProviderController } from "./attribute-provider.controller";
import { AttributeProviderService } from "./attribute-provider.service";
import { AttributeProviderEntity } from "./entities/attribute-provider.entity";

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
