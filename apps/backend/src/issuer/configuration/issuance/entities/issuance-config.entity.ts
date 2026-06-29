import {
    ApiExtraModels,
    ApiHideProperty,
    ApiPropertyOptional,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsArray,
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from "class-validator";
import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryColumn,
    UpdateDateColumn,
} from "typeorm";
import { TenantEntity } from "../../../../auth/tenant/entitites/tenant.entity";
import {
    AuthenticationMethodAuth,
    AuthenticationMethodNone,
    AuthenticationMethodPresentation,
} from "../dto/authentication-config.dto";
import { ManagedAuthorizationServerConfig } from "../dto/authorization-server-config.dto";
import { ChainedAsConfig } from "../dto/chained-as-config.dto";
import { DisplayInfo } from "../dto/display.dto";
import { FederationConfig } from "../dto/federation-config.dto";

/**
 * Entity to manage issuance configs
 */
@ApiExtraModels(
    AuthenticationMethodNone,
    AuthenticationMethodAuth,
    AuthenticationMethodPresentation,
)
@Entity()
export class IssuanceConfig {
    /**
     * Tenant ID for the issuance configuration.
     */
    @ApiHideProperty()
    @PrimaryColumn()
    tenantId!: string;

    /**
     * The tenant that owns this object.
     */
    @ManyToOne(() => TenantEntity, { cascade: true, onDelete: "CASCADE" })
    tenant!: TenantEntity;

    /**
     * Authentication server URL for the issuance process.
     */
    @IsArray()
    @IsOptional()
    @Column({ type: "json", nullable: true })
    authServers?: string[];

    /**
     * Value to determine the amount of credentials that are issued in a batch.
     * Default is 1.
     */
    @IsNumber()
    @IsOptional()
    @Column("int", { default: 1 })
    batchSize?: number;

    /**
     * Indicates whether DPoP is required for the issuance process. Default value is true.
     */
    @IsBoolean()
    @IsOptional()
    @Column("boolean", { default: true })
    dPopRequired?: boolean;

    /**
     * Indicates whether wallet attestation is required for the token endpoint.
     * When enabled, wallets must provide OAuth-Client-Attestation headers.
     * Default value is false.
     */
    @IsBoolean()
    @IsOptional()
    @Column("boolean", { default: false })
    walletAttestationRequired?: boolean;

    /**
     * URLs of trust lists containing trusted wallet providers.
     * The wallet attestation's X.509 certificate will be validated against these trust lists.
     * If empty and walletAttestationRequired is true, all wallet providers are rejected.
     */
    @IsArray()
    @IsOptional()
    @Column({ type: "json", nullable: true })
    walletProviderTrustLists?: string[];

    /**
     * Optional key ID to use for signing access tokens.
     * Must reference an existing key managed by the key service.
     * If not set, the first available signing key for the tenant is used.
     */
    @ApiPropertyOptional({
        description:
            "Key ID for signing access tokens. If unset, the default signing key is used.",
    })
    @IsOptional()
    @IsString()
    @Column({ type: "varchar", nullable: true })
    signingKeyId?: string;

    /**
     * The URL of the preferred authorization server for wallet-initiated flows.
     * When set, this AS is placed first in the `authorization_servers` array
     * of the credential issuer metadata, signaling wallets to use it by default.
     * Must match one of the configured auth servers, the chained AS URL, or "built-in".
     */
    @IsOptional()
    @IsString()
    @Column({ type: "varchar", nullable: true })
    preferredAuthServer?: string;

    /**
     * Configuration for Chained Authorization Server mode.
     * When enabled, EUDIPLO acts as an OAuth AS facade, delegating user authentication
     * to an upstream OIDC provider while issuing its own tokens with issuer_state.
     */
    @ApiPropertyOptional({ type: () => ChainedAsConfig })
    @ValidateNested()
    @Type(() => ChainedAsConfig)
    @IsOptional()
    @Column({ type: "json", nullable: true })
    chainedAs?: ChainedAsConfig | null;

    /**
     * Dedicated managed authorization servers hosted by this issuer.
     * Each entry creates a distinct AS endpoint and can be bound to a different
     * presentation configuration.
     */
    @ApiPropertyOptional({
        type: () => ManagedAuthorizationServerConfig,
        isArray: true,
    })
    @ValidateNested({ each: true })
    @Type(() => ManagedAuthorizationServerConfig)
    @IsOptional()
    @Column({ type: "json", nullable: true })
    authorizationServers?: ManagedAuthorizationServerConfig[] | null;

    /**
     * Optional OpenID Federation configuration used for trust evaluation.
     * When omitted, trust checks rely on existing LoTE trust-list behavior.
     */
    @ApiPropertyOptional({ type: () => FederationConfig })
    @ValidateNested()
    @Type(() => FederationConfig)
    @IsOptional()
    @Column({ type: "json", nullable: true })
    federation?: FederationConfig | null;

    @ValidateNested({ each: true })
    @Type(() => DisplayInfo)
    @Column("json", { nullable: true })
    display!: DisplayInfo[];

    /**
     * Whether to issue refresh tokens for access token requests.
     * Default: true
     */
    @ApiPropertyOptional({
        description:
            "Whether refresh tokens should be issued for OID4VCI token responses.",
        default: true,
    })
    @IsBoolean()
    @IsOptional()
    @Column("boolean", { default: true })
    refreshTokenEnabled?: boolean;

    /**
     * Whether to advertise support for credential response encryption in the
     * credential issuer metadata (`credential_response_encryption`). When
     * enabled, wallets MAY request encrypted credential responses. Some
     * wallets reject issuer metadata that advertises unsupported algorithms,
     * so this defaults to false.
     * Default: false
     */
    @ApiPropertyOptional({
        description:
            "Whether `credential_response_encryption` should be advertised in the credential issuer metadata.",
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    @Column("boolean", { default: false })
    credentialResponseEncryption?: boolean;

    /**
     * Whether to advertise `credential_request_encryption` in the credential issuer metadata.
     * When enabled, the issuer publishes its encryption public key so wallets can
     * send encrypted credential requests. Set `encryption_required` to enforce it.
     * Default: false
     */
    @ApiPropertyOptional({
        description:
            "Whether `credential_request_encryption` should be advertised in the credential issuer metadata.",
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    @Column("boolean", { default: false })
    credentialRequestEncryption?: boolean;

    /**
     * Lifetime of issued refresh tokens in seconds.
     * Default: 2592000 (30 days)
     * Set to null for non-expiring refresh tokens (not recommended for security).
     */
    @ApiPropertyOptional({
        description:
            "Refresh token lifetime in seconds. Defaults to 2592000 (30 days).",
        default: 2592000,
        nullable: true,
    })
    @IsNumber()
    @IsOptional()
    @Column("int", { default: 2592000, nullable: true })
    refreshTokenExpiresInSeconds?: number;

    /**
     * Maximum number of failed tx_code (transaction code) validation attempts
     * before the pre-authorized code is invalidated. Protects against brute-force
     * attacks on the OID4VCI pre-authorized code flow.
     * Default: 5. Set to null to disable the limit (not recommended).
     */
    @ApiPropertyOptional({
        description:
            "Maximum failed tx_code attempts before the pre-authorized code is invalidated. Defaults to 5.",
        default: 5,
        nullable: true,
    })
    @IsNumber()
    @IsOptional()
    @Column("int", { nullable: true })
    txCodeMaxAttempts?: number;

    /**
     * The timestamp when the VP request was created.
     */
    @CreateDateColumn()
    createdAt!: Date;

    /**
     * The timestamp when the VP request was last updated.
     */
    @UpdateDateColumn()
    updatedAt!: Date;
}
