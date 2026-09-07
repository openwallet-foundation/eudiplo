import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { ClientModule } from "./client/client.module.js";
import { JwtService } from "./jwt.service.js";
import { JwtStrategy } from "./jwt.strategy.js";
import { TenantModule } from "./tenant/tenant.module.js";
import { UserModule } from "./user/user.module.js";
@Module({
    imports: [
        PassportModule,
        ConfigModule,
        TenantModule,
        ClientModule,
        UserModule,
    ],
    providers: [JwtStrategy, JwtService, AuthService],
    controllers: [AuthController],
    exports: [PassportModule, JwtStrategy, JwtService],
})
export class AuthModule {}
