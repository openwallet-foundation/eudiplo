import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../audit-log/audit-log.module.js";
import { CryptoModule } from "../../crypto/crypto.module.js";
import { RegistrarModule } from "../../registrar/registrar.module.js";
import { ClientModule } from "../client/client.module.js";
import { TenantEntity } from "./entities/tenant.entity.js";
import { TenantController } from "./tenant.controller.js";
import { TenantService } from "./tenant.service.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([TenantEntity]),
        AuditLogModule,
        ClientModule,
        CryptoModule,
        RegistrarModule,
    ],
    providers: [TenantService],
    controllers: [TenantController],
    exports: [TenantService],
})
export class TenantModule {}
