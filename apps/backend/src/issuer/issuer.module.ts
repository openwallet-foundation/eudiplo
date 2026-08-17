import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { setGlobalConfig } from "@openid4vc/openid4vci";
import { ConfigurationModule } from "./configuration/configuration.module";
import { IssuanceModule } from "./issuance/issuance.module";
import { StatusListModule } from "./status-list/status-list.module";
import { TrustListModule } from "./trust-list/trustlist.module";

/**
 * Issuer Module - Root module for credential issuance functionality
 *
 * This module orchestrates three main domains:
 * - Configuration: Issuer and credential configurations
 * - Issuance: Credential issuance operations and protocols
 * - Lifecycle: Credential status and lifecycle management
 * - TrustList: Management of trusted lists for credential verification
 */
@Module({
    imports: [
        ConfigurationModule,
        IssuanceModule,
        StatusListModule,
        TrustListModule,
    ],
    exports: [ConfigurationModule, IssuanceModule, StatusListModule],
})
export class IssuerModule {
    constructor(configService: ConfigService) {
        const unsecure = configService
            .getOrThrow<string>("PUBLIC_URL")
            .startsWith("http://");
        setGlobalConfig({ allowInsecureUrls: unsecure });
    }
}
