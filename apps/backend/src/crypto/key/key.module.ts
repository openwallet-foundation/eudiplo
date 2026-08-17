import { HttpModule } from "@nestjs/axios";
import { DynamicModule, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";
import { CertService } from "./cert/cert.service";
import { CertificateBuilderService } from "./cert/certificate-builder.service";
import { CrlValidationService } from "./cert/crl-validation.service";
import { CryptoImplementationModule } from "./crypto-implementation/crypto-implementation.module";
import { KeyChainEntity } from "./entities/key-chain.entity";
import { KeyChainController } from "./key-chain.controller";
import { KeyChainImportService } from "./key-chain-import.service";
import { KeyChainService } from "./key-chain.service";
import { KeyChainSigningService } from "./key-chain-signing.service";
import { KeyRotationService } from "./key-rotation.service";
import { KmsConfigService } from "./kms/kms-config.service";
import { KmsProviderRegistry } from "./kms/kms-provider.registry";
import { KmsTenantConfigService } from "./kms/kms-tenant-config.service";

@Global()
export class KeyModule {
    static forRoot(): DynamicModule {
        return {
            module: KeyModule,
            imports: [
                HttpModule,
                ConfigModule,
                CryptoImplementationModule,
                TypeOrmModule.forFeature([KeyChainEntity, TenantEntity]),
            ],
            controllers: [KeyChainController],
            providers: [
                KmsConfigService,
                KmsProviderRegistry,
                KmsTenantConfigService,
                CertificateBuilderService,
                KeyChainSigningService,
                KeyChainImportService,
                KeyChainService,
                KeyRotationService,
                CertService,
                CrlValidationService,
            ],
            exports: [KeyChainService, CertService, CrlValidationService],
        };
    }
}
