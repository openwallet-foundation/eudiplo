import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../audit-log/audit-log.module";
import { TrustListModule } from "../../issuer/trust-list/trustlist.module";
import { RegistrarModule } from "../../registrar/registrar.module";
import { TrustModule } from "../../shared/trust/trust.module";
import { ResolverModule } from "../resolver/resolver.module";
import { CredentialChainValidationService } from "./credential/credential-chain-validation.service";
import { MdocverifierService } from "./credential/mdocverifier/mdocverifier.service";
import { SdjwtvcverifierService } from "./credential/sdjwtvcverifier/sdjwtvcverifier.service";
import { PresentationConfig } from "./entities/presentation-config.entity";
import { PresentationManagementController } from "./presentations.controller";
import { PresentationsService } from "./presentations.service";

@Module({
    imports: [
        ResolverModule,
        HttpModule,
        TypeOrmModule.forFeature([PresentationConfig]),
        AuditLogModule,
        TrustListModule,
        TrustModule,
        RegistrarModule,
    ],
    controllers: [PresentationManagementController],
    providers: [
        PresentationsService,
        SdjwtvcverifierService,
        MdocverifierService,
        CredentialChainValidationService,
    ],
    exports: [
        PresentationsService,
        CredentialChainValidationService,
        MdocverifierService,
    ],
})
export class PresentationsModule {}
