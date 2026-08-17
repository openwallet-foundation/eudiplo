import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CryptoImplementationService } from "./crypto-implementation.service";

@Global()
@Module({
    imports: [ConfigModule],
    providers: [CryptoImplementationService],
    exports: [CryptoImplementationService],
})
export class CryptoImplementationModule {}
