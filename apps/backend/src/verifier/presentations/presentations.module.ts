import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogModule } from "../../audit-log/audit-log.module.js";
import { TrustListModule } from "../../issuer/trust-list/trustlist.module.js";
import { RegistrarModule } from "../../registrar/registrar.module.js";
import { TrustModule } from "../../trust/trust.module.js";
import { ResolverModule } from "../resolver/resolver.module.js";
import { CredentialChainValidationService } from "./credential/credential-chain-validation.service.js";
import { MdocverifierService } from "./credential/mdocverifier/mdocverifier.service.js";
import { SdjwtvcverifierService } from "./credential/sdjwtvcverifier/sdjwtvcverifier.service.js";
import { PresentationConfig } from "./entities/presentation-config.entity.js";
import { MetadataFetchService } from "./metadata-fetch.service.js";
import { PresentationManagementController } from "./presentations.controller.js";
import { PresentationsService } from "./presentations.service.js";

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
        MetadataFetchService,
    ],
    exports: [
        PresentationsService,
        CredentialChainValidationService,
        MdocverifierService,
    ],
})
export class PresentationsModule {}
