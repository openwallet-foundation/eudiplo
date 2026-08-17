import { Module } from "@nestjs/common";
import { CredentialConfigModule } from "../../issuer/configuration/credentials/credential-config.module";
import { TrustListModule } from "../../issuer/trust-list/trustlist.module";
import { RegistrarModule } from "../registrar.module";
import { SchemaMetadataController } from "./schema-metadata.controller";
import { SchemaMetadataSubmissionService } from "./schema-metadata-submission.service";

/**
 * Management and publishing API for schema metadata.
 *
 * The low-level registrar client remains owned by RegistrarModule; this module
 * composes it with credential configuration and trust-list capabilities.
 */
@Module({
    imports: [RegistrarModule, CredentialConfigModule, TrustListModule],
    controllers: [SchemaMetadataController],
    providers: [SchemaMetadataSubmissionService],
})
export class SchemaMetadataModule {}
