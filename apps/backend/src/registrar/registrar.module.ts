import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoModule } from "../crypto/crypto.module";
import { AccessCertificateService } from "./access-certificate.service";
import { RegistrarConfigEntity } from "./entities/registrar-config.entity";
import { RegistrarController } from "./registrar.controller";
import { RegistrarService } from "./registrar.service";
import { RegistrarAuthService } from "./registrar-auth.service";
import { RegistrarConfigService } from "./registrar-config.service";
import { RegistrationCertificateService } from "./registration-certificate.service";
import { SchemaMetadataService } from "./schema-metadata/schema-metadata.service";

/**
 * RegistrarModule is responsible for managing the registrar service.
 * It provides the RegistrarService and imports necessary modules.
 *
 * Registrar configuration can be:
 * - Set via API endpoints under /registrar/config
 * - Imported from config files (registrar.json in tenant folder)
 */
@Module({
    imports: [CryptoModule, TypeOrmModule.forFeature([RegistrarConfigEntity])],
    controllers: [RegistrarController],
    providers: [
        RegistrarAuthService,
        RegistrarConfigService,
        RegistrationCertificateService,
        AccessCertificateService,
        SchemaMetadataService,
        RegistrarService,
    ],
    exports: [RegistrarService, RegistrarConfigService, SchemaMetadataService],
})
export class RegistrarModule {}
