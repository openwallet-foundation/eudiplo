import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Min,
    ValidateNested,
} from "class-validator";

/**
 * Configuration for the upstream OIDC provider (e.g., Keycloak).
 * EUDIPLO will delegate user authentication to this provider.
 */
export class UpstreamOidcConfig {
    /**
     * The OIDC issuer URL of the upstream provider.
     * @example "https://auth.example.com/realms/myrealm"
     */
    @ApiProperty({
        description: "The OIDC issuer URL of the upstream provider",
        example: "https://auth.example.com/realms/myrealm",
    })
    @IsUrl({ require_tld: false })
    issuer!: string;

    /**
     * The client ID registered with the upstream provider for EUDIPLO.
     */
    @ApiProperty({
        description: "The client ID registered with the upstream provider",
        example: "eudiplo-chained-as",
    })
    @IsString()
    clientId!: string;

    /**
     * The client secret for confidential clients.
     * Optional for public clients using PKCE only.
     */
    @ApiPropertyOptional({
        description: "The client secret for confidential clients",
    })
    @IsOptional()
    @IsString()
    clientSecret?: string;

    /**
     * The scopes to request from the upstream provider.
     * @default ["openid", "profile"]
     */
    @ApiPropertyOptional({
        description: "Scopes to request from the upstream provider",
        default: ["openid", "profile"],
    })
    @IsOptional()
    @IsString({ each: true })
    scopes?: string[];
}

/**
 * Configuration for the tokens issued by EUDIPLO in chained AS mode.
 */
export class ChainedAsTokenConfig {
    /**
     * The lifetime of access tokens in seconds.
     * @default 3600 (1 hour)
     */
    @ApiPropertyOptional({
        description: "Access token lifetime in seconds",
        default: 3600,
    })
    @IsOptional()
    @IsNumber()
    @Min(60)
    lifetimeSeconds?: number;

    /**
     * The key ID to use for signing tokens.
     * Must reference a key configured in the crypto service.
     */
    @ApiPropertyOptional({
        description: "Key ID for token signing",
    })
    @IsOptional()
    @IsString()
    signingKeyId?: string;

    /**
     * Whether to issue refresh tokens.
     * @default true
     */
    @ApiPropertyOptional({
        description: "Whether refresh tokens should be issued",
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    refreshTokenEnabled?: boolean;

    /**
     * Refresh token lifetime in seconds.
     * @default 2592000 (30 days)
     */
    @ApiPropertyOptional({
        description: "Refresh token lifetime in seconds",
        default: 2592000,
    })
    @IsOptional()
    @IsNumber()
    @Min(60)
    refreshTokenExpiresInSeconds?: number;
}

/**
 * Configuration for a VP-backed Authorization Server facade.
 *
 * In this mode, EUDIPLO acts as the AS for the wallet, but instead of
 * delegating authentication to an upstream OIDC provider, it starts an
 * OID4VP verifier flow and only returns the OAuth authorization code after
 * a successful presentation callback.
 */
export class ChainedAsVpConfig {
    /**
     * Whether the VP-backed AS is enabled.
     */
    @ApiProperty({
        description: "Enable VP-backed chained AS mode",
        default: false,
    })
    @IsBoolean()
    enabled!: boolean;

    /**
     * The presentation configuration ID used to start the OID4VP request.
     */
    @ApiProperty({
        description: "Presentation configuration ID used for OID4VP",
        example: "pid-no-hook",
    })
    @IsString()
    presentationConfigId!: string;
}

/**
 * Configuration for enabling "Chained Authorization Server" mode.
 *
 * In this mode, EUDIPLO acts as the Authorization Server for wallets,
 * but delegates user authentication to an upstream OIDC provider (e.g., Keycloak).
 *
 * Benefits:
 * - No modifications required to the upstream OIDC provider
 * - EUDIPLO can include `issuer_state` in access tokens for session correlation
 * - EUDIPLO handles wallet attestation and OID4VCI-specific requirements
 * - DPoP binding is managed by EUDIPLO
 *
 * Flow:
 * 1. Wallet receives credential offer with `authorization_server = EUDIPLO`
 * 2. Wallet calls EUDIPLO PAR/authorize endpoints
 * 3. EUDIPLO redirects user to upstream OIDC provider for login
 * 4. User authenticates with upstream provider
 * 5. Upstream provider redirects back to EUDIPLO callback
 * 6. EUDIPLO exchanges upstream code for tokens, extracts user identity
 * 7. EUDIPLO issues its own access token with `issuer_state`, DPoP binding, etc.
 * 8. Wallet uses EUDIPLO-issued token for credential requests
 */
export class ChainedAsConfig {
    /**
     * Whether chained AS mode is enabled.
     * When enabled, EUDIPLO acts as the AS and delegates to upstream for authentication.
     */
    @ApiProperty({
        description: "Enable chained AS mode",
        default: false,
    })
    @IsBoolean()
    enabled!: boolean;

    /**
     * Configuration for the upstream OIDC provider.
     * Required when enabled is true.
     */
    @ApiPropertyOptional({
        description: "Upstream OIDC provider configuration",
        type: () => UpstreamOidcConfig,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => UpstreamOidcConfig)
    upstream?: UpstreamOidcConfig;

    /**
     * Configuration for a VP-backed AS facade.
     */
    @ApiPropertyOptional({
        description: "VP-backed chained AS configuration",
        type: () => ChainedAsVpConfig,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => ChainedAsVpConfig)
    vp?: ChainedAsVpConfig;

    /**
     * Configuration for tokens issued by EUDIPLO.
     */
    @ApiPropertyOptional({
        description: "Token configuration",
        type: () => ChainedAsTokenConfig,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => ChainedAsTokenConfig)
    token?: ChainedAsTokenConfig;

    /**
     * Whether to require DPoP for token requests.
     * When true, wallets must provide DPoP proofs.
     * @default true
     */
    @ApiPropertyOptional({
        description: "Require DPoP binding for tokens",
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    requireDPoP?: boolean;
}
