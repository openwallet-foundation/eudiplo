import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CryptoService } from "./crypto.service.js";
import { EncryptionService } from "./encryption/encryption.service.js";

@Module({
    imports: [ConfigModule],
    providers: [CryptoService, EncryptionService],
    exports: [CryptoService, EncryptionService],
})
export class CryptoModule {}
