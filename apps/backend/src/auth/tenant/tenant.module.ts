import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../audit-log/audit-log.module";
import { CryptoModule } from "../../crypto/crypto.module";
import { RegistrarModule } from "../../registrar/registrar.module";
import { ClientModule } from "../client/client.module";
import { TenantEntity } from "./entities/tenant.entity";
import { TenantController } from "./tenant.controller";
import { TenantService } from "./tenant.service";

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
