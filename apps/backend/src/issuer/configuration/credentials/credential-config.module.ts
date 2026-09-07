import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../../audit-log/audit-log.module.js";
import { PresentationsModule } from "../../../verifier/presentations/presentations.module.js";
import { CredentialConfigService } from "./credential-config/credential-config.service.js";
import { CredentialConfigController } from "./credential-config.controller.js";
import { CredentialConfig } from "./entities/credential.entity.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([CredentialConfig]),
        AuditLogModule,
        PresentationsModule,
    ],
    controllers: [CredentialConfigController],
    providers: [CredentialConfigService],
    exports: [CredentialConfigService],
})
export class CredentialConfigModule {}
