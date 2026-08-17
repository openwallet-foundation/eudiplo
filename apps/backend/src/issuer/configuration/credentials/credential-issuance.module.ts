import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TrustModule } from "../../../trust/trust.module";
import { WebhookModule } from "../../../webhook/webhook.module";
import { StatusListModule } from "../../status-list/status-list.module";
import { AttributeProviderEntity } from "../attribute-provider/entities/attribute-provider.entity";
import { IssuanceConfigModule } from "../issuance/issuance-config.module";
import { CredentialsService } from "./credentials.service";
import { CredentialConfig } from "./entities/credential.entity";
import { MdocIssuerService } from "./issuer/mdoc-issuer/mdoc-issuer.service";
import { SdjwtvcIssuerService } from "./issuer/sdjwtvc-issuer/sdjwtvc-issuer.service";

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
