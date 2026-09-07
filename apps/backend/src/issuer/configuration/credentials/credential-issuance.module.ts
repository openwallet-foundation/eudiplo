import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TrustModule } from "../../../trust/trust.module.js";
import { WebhookModule } from "../../../webhook/webhook.module.js";
import { StatusListModule } from "../../status-list/status-list.module.js";
import { AttributeProviderEntity } from "../attribute-provider/entities/attribute-provider.entity.js";
import { IssuanceConfigModule } from "../issuance/issuance-config.module.js";
import { CredentialsService } from "./credentials.service.js";
import { CredentialConfig } from "./entities/credential.entity.js";
import { MdocIssuerService } from "./issuer/mdoc-issuer/mdoc-issuer.service.js";
import { SdjwtvcIssuerService } from "./issuer/sdjwtvc-issuer/sdjwtvc-issuer.service.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([CredentialConfig, AttributeProviderEntity]),
        IssuanceConfigModule,
        StatusListModule,
        TrustModule,
        WebhookModule,
    ],
    providers: [CredentialsService, SdjwtvcIssuerService, MdocIssuerService],
    exports: [CredentialsService],
})
export class CredentialIssuanceModule {}
