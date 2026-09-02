import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../audit-log/audit-log.module";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";
import { CryptoModule } from "../../crypto/crypto.module";
import { ActiveCredentialSlot } from "./entities/active-credential-slot.entity";
import { StatusListEntity } from "./entities/status-list.entity";
import { StatusMapping } from "./entities/status-mapping.entity";
import { StatusListController } from "./status-list.controller";
import { StatusListService } from "./status-list.service";
import { StatusListConfigController } from "./status-list-config.controller";
import { StatusListConfigService } from "./status-list-config.service";
import { StatusListManagementController } from "./status-list-management.controller";
import { SubjectKeyService } from "./subject-key.service";

@Module({
    imports: [
        CryptoModule,
        AuditLogModule,
        TypeOrmModule.forFeature([
            StatusMapping,
            StatusListEntity,
            TenantEntity,
            ActiveCredentialSlot,
        ]),
    ],
    controllers: [
        StatusListController,
        StatusListConfigController,
        StatusListManagementController,
    ],
    providers: [StatusListService, StatusListConfigService, SubjectKeyService],
    exports: [StatusListService, StatusListConfigService, SubjectKeyService],
})
export class StatusListModule {}
