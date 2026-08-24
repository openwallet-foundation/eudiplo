import { HttpModule, HttpService } from "@nestjs/axios";
import { Global, Logger, Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { DataEncryptionService } from "./data-encryption.service";
import { initializeEncryptionTransformer } from "./encrypted-column.transformer";
import {
    AwsSecretsManagerEncryptionKeyProvider,
    AzureKeyVaultEncryptionKeyProvider,
    ENCRYPTION_KEY_PROVIDER,
    EncryptionKeySource,
    EnvEncryptionKeyProvider,
    VaultEncryptionKeyProvider,
} from "./providers";

/**
 * Global module that provides encryption services for data at rest.
 * This module initializes the encryption transformer on startup.
 *
 * Key source is configured via ENCRYPTION_KEY_SOURCE environment variable:
 * - "env" (default): Derive key from MASTER_SECRET (development only)
 * - "vault": Fetch from HashiCorp Vault at runtime (production)
 * - "aws": Fetch from AWS Secrets Manager at runtime (production)
 * - "azure": Fetch from Azure Key Vault at runtime (production)
 */
@Global()
@Module({
    imports: [ConfigModule, HttpModule],
    providers: [
        {
            provide: ENCRYPTION_KEY_PROVIDER,
            useFactory: (
                configService: ConfigService,
                httpService: HttpService,
            ) => {
                const keySource =
                    configService.get<EncryptionKeySource>(
                        "ENCRYPTION_KEY_SOURCE",
                    ) || "env";

                const logger = new Logger("EncryptionKeyProviderFactory");
                logger.log(`Using encryption key source: ${keySource}`);

                switch (keySource) {
                    case "vault":
                        return new VaultEncryptionKeyProvider(
                            configService,
                            httpService,
                        );
                    case "aws":
                        return new AwsSecretsManagerEncryptionKeyProvider(
                            configService,
                        );
                    case "azure":
                        return new AzureKeyVaultEncryptionKeyProvider(
                            configService,
                        );
                    case "env":
                    default:
                        return new EnvEncryptionKeyProvider(configService);
                }
            },
            inject: [ConfigService, HttpService],
        },
        DataEncryptionService,
    ],
    exports: [DataEncryptionService, ENCRYPTION_KEY_PROVIDER],
})
export class DataEncryptionModule implements OnModuleInit {
    constructor(private readonly moduleRef: ModuleRef) {}

    async onModuleInit() {
        // Initialize the encryption transformer with the service instance
        // This must happen before any database operations
        const encryptionService = this.moduleRef.get(DataEncryptionService, {
            strict: false,
        });

        // Fetch the key from the provider (async operation)
        await encryptionService.initialize();

        initializeEncryptionTransformer(encryptionService);
    }
}
