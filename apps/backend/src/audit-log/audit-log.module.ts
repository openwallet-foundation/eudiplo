import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogController } from "./audit-log.controller.js";
import { AuditLogService } from "./audit-log.service.js";
import { AuditLogEntity } from "./entities/audit-log.entity.js";

@Module({
    imports: [TypeOrmModule.forFeature([AuditLogEntity])],
    controllers: [AuditLogController],
    providers: [AuditLogService],
    exports: [AuditLogService],
})
export class AuditLogModule {}
