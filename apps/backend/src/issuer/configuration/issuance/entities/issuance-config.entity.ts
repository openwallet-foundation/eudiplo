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
import { DisplayInfo } from "../dto/display.dto";
import { FederationConfig } from "../dto/federation-config.dto";
import {
    IssuerRegistrationCertificateCache,
    IssuerRegistrationCertificateConfig,
} from "../dto/issuer-registration-certificate.dto";

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

    /**
     * Optional registration certificate configuration for issuer metadata (`issuer_info`).
     * Supports importing an existing JWT or generating one via registrar.
     */
    @ApiPropertyOptional({ type: () => IssuerRegistrationCertificateConfig })
    @ValidateNested()
    @Type(() => IssuerRegistrationCertificateConfig)
    @IsOptional()
    @Column({ type: "json", nullable: true })
    registrationCertificate?: IssuerRegistrationCertificateConfig | null;

    /**
     * Server-managed cache for generated issuer registration certificates.
     */
    @ApiPropertyOptional({
        type: () => IssuerRegistrationCertificateCache,
        readOnly: true,
    })
    @ValidateNested()
    @Type(() => IssuerRegistrationCertificateCache)
    @IsOptional()
    @Column({ type: "json", nullable: true })
    registrationCertificateCache?: IssuerRegistrationCertificateCache | null;

    @ValidateNested({ each: true })
    @Type(() => DisplayInfo)
    @Column("json", { nullable: true })
    display!: DisplayInfo[];

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
