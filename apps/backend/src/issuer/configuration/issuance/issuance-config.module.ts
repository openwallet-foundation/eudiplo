import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../../audit-log/audit-log.module";
import { RegistrarModule } from "../../../registrar/registrar.module";
import { CredentialConfigModule } from "../credentials/credential-config.module";
import { IssuanceConfig } from "./entities/issuance-config.entity";
import { IssuanceConfigController } from "./issuance-config.controller";
import { IssuanceService } from "./issuance.service";

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
