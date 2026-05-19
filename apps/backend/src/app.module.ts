import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { MulterModule } from "@nestjs/platform-express";
import { ScheduleModule } from "@nestjs/schedule";
import { memoryStorage } from "multer";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module";
import { CoreModule } from "./core/core.module";
import { CryptoModule } from "./crypto/crypto.module";
import { KeyModule } from "./crypto/key/key.module";
import { DatabaseModule } from "./database/database.module";
import { IssuerModule } from "./issuer/issuer.module";
import { RegistrarModule } from "./registrar/registrar.module";
import { SessionModule } from "./session/session.module";
import { ConfigImportModule } from "./shared/utils/config-import/config-import.module";
import { VALIDATION_SCHEMA } from "./shared/utils/config-printer/combined.schema";
import { EncryptionModule } from "./shared/utils/encryption/encryption.module";
import { createLoggerOptions } from "./shared/utils/logger/logger.factory";
import { StorageModule } from "./storage/storage.module";
import { VerifierModule } from "./verifier/verifier.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            validationSchema: VALIDATION_SCHEMA,
            isGlobal: true,
            expandVariables: true,
        }),
        EventEmitterModule.forRoot(),
        LoggerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: createLoggerOptions,
        }),
        // EncryptionModule must be imported early to initialize transformers
        // before TypeORM entities are loaded
        EncryptionModule,
        CoreModule,
        AuthModule,
        KeyModule.forRoot(),
        MulterModule.register({
            storage: memoryStorage(),
            limits: { fileSize: 5 * 1024 * 1024 },
        }),
        CryptoModule,
        IssuerModule,
        VerifierModule,
        RegistrarModule,
        ScheduleModule.forRoot(),
        SessionModule,
        DatabaseModule,
        StorageModule.forRoot(),
        ConfigImportModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
