import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../../audit-log/audit-log.module.js";
import { RegistrarModule } from "../../../registrar/registrar.module.js";
import { CredentialConfigModule } from "../credentials/credential-config.module.js";
import { IssuanceConfig } from "./entities/issuance-config.entity.js";
import { IssuanceService } from "./issuance.service.js";
import { IssuanceConfigController } from "./issuance-config.controller.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([IssuanceConfig]),
        AuditLogModule,
        CredentialConfigModule,
        RegistrarModule,
    ],
    controllers: [IssuanceConfigController],
    providers: [IssuanceService],
    exports: [IssuanceService],
})
export class IssuanceConfigModule {}
