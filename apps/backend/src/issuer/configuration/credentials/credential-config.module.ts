import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../../audit-log/audit-log.module";
import { PresentationsModule } from "../../../verifier/presentations/presentations.module";
import { CredentialConfigService } from "./credential-config/credential-config.service";
import { CredentialConfigController } from "./credential-config.controller";
import { CredentialConfig } from "./entities/credential.entity";

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
