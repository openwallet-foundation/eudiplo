import {
    ApiHideProperty,
    ApiProperty,
    ApiPropertyOptional,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Validate,
    ValidateNested,
} from "class-validator";
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    UpdateDateColumn,
} from "typeorm";
import { TenantEntity } from "../../../auth/tenant/entitites/tenant.entity";
import { WebhookConfig } from "../../../shared/utils/webhook/webhook.dto";
import { WebhookEndpointEntity } from "../../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity";
import { RegistrationCertificateRequest } from "../dto/vp-request.dto";
import { IsTransactionData } from "../validators/transaction-data.validator";

export enum TrustedAuthorityType {
    ETSI_TL = "etsi_tl",
    OPENID_FEDERATION = "openid_federation",
}

/**
 * Attached attestations
 */
export class PresentationAttachment {
    @IsString()
    format!: string;

    @IsNotEmpty()
    data!: any;

    @IsOptional()
    @IsString({ each: true })
    credential_ids?: string[];
}
// TODO: extend: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-trusted-authorities-query
export class TrustedAuthorityQuery {
    @IsString()
    @IsEnum(TrustedAuthorityType)
    type!: TrustedAuthorityType;

    @IsArray()
    @IsString({ each: true })
    values!: string[];
}

//TODO: extend: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-credential-query
export class CredentialQuery {
    @IsString()
    id!: string;

    @IsString()
    format!: string;

    @IsOptional()
    @IsBoolean()
    multiple?: boolean;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => ClaimsQuery)
    claims?: ClaimsQuery[];

    @IsObject()
    meta!: any;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => TrustedAuthorityQuery)
    trusted_authorities?: TrustedAuthorityQuery[];
}

export class ClaimsQuery {
    @IsString()
    @IsOptional()
    id?: string;

    @IsArray()
    path!: string[];

    @IsArray()
    @IsOptional()
    values?: string[];
}

//TODO: extend: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-credential-set-query
export class CredentialSetQuery {
    @ApiProperty({
        type: "array",
        items: { type: "array", items: { type: "string" } },
    })
    @IsArray()
    options!: string[][];

    @IsBoolean()
    @IsOptional()
    required?: boolean;
}

export class DCQL {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CredentialQuery)
    credentials!: CredentialQuery[];

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CredentialSetQuery)
    credential_sets?: CredentialSetQuery[];
}

export class TransactionData {
    @IsString()
    type!: string;
    @IsArray()
    @IsString({ each: true })
    credential_ids!: string[];
    [key: string]: any;
}

/**
 * Cached/materialized registration certificate state for a presentation config.
 *
 * Server-managed; recomputed when {@link PresentationConfig.registration_cert} or
 * {@link PresentationConfig.dcql_query} change, or when the JWT expires.
 */
export interface RegistrationCertCache {
    /** The issued/imported registration certificate JWT. */
    jwt: string;
    /** Canonical-JSON hash of the cert's authorized `credentials` claim. */
    fingerprint: string;
    /** Canonical-JSON hash of the presentation's `dcql_query.credentials` at cache time. */
    dcqlFingerprint: string;
    /** Canonical-JSON hash of the {@link PresentationConfig.registration_cert} spec at cache time. */
    specFingerprint: string;
    /** JWT `iat` (seconds since epoch). */
    issuedAt?: number;
    /** JWT `exp` (seconds since epoch). */
    expiresAt?: number;
    /** Origin of the cached JWT. */
    source: "imported" | "registrar";
}

/**
 * Entity representing a configuration for a Verifiable Presentation (VP) request.
 */
@Entity()
export class PresentationConfig {
    /**
     * Unique identifier for the VP request.
     */
    @Column("varchar", { primary: true })
    @IsString()
    id!: string;

    /**
     * The tenant ID for which the VP request is made.
     */
    @ApiHideProperty()
    @Column("varchar", { primary: true })
    tenantId!: string;

    /**
     * The tenant that owns this object.
     */
    @ManyToOne(() => TenantEntity, { cascade: true, onDelete: "CASCADE" })
    tenant!: TenantEntity;

    /**
     * Description of the presentation configuration.
     */
    @Column("varchar", { nullable: true })
    @IsOptional()
    @IsString()
    description?: string | null;

    /**
     * Lifetime how long the presentation request is valid after creation, in seconds.
     */
    @IsNumber()
    @IsOptional()
    @Column("int", { default: 300 })
    lifeTime?: number;

    /**
     * The DCQL query to be used for the VP request.
     */
    @Column("json")
    @ValidateNested()
    @Type(() => DCQL)
    dcql_query!: DCQL;

    /**
     *
     */
    @Column("json", { nullable: true })
    @IsOptional()
    @IsArray()
    @IsTransactionData()
    @Type(() => TransactionData)
    transaction_data?: TransactionData[];

    /**
     * The registration certificate request containing the necessary details.
     */
    @IsOptional()
    @ValidateNested()
    @Type(() => RegistrationCertificateRequest)
    @Column("json", { nullable: true })
    registration_cert?: RegistrationCertificateRequest | null;

    /**
     * Cached/materialized registration certificate derived from {@link registration_cert}.
     *
     * This is a server-managed field (not user-editable). It stores the JWT that
     * was actually issued (or imported) together with fingerprints used to detect
     * configuration drift. The cache is invalidated automatically when either the
     * `registrationCert` spec or the `dcql_query` of this presentation config
     * changes, ensuring no stale/over-broad authorizations leak into VP requests.
     *
     * @example
     * {
     *   "jwt": "eyJ...",
     *   "fingerprint": "<canonical hash of authorized credentials[]>",
     *   "dcqlFingerprint": "<canonical hash of dcql_query.credentials>",
     *   "issuedAt": 1714050000,
     *   "expiresAt": 1714650000,
     *   "source": "registrar"
     * }
     */
    @ApiPropertyOptional({
        description:
            "Server-managed cache of the materialized registration certificate. Read-only; values supplied by clients are ignored.",
        readOnly: true,
        type: "object",
        additionalProperties: true,
        nullable: true,
    })
    @IsOptional()
    @IsObject()
    @Column("json", { nullable: true })
    registrationCertCache?: RegistrationCertCache | null;

    /**
     * Reference to the webhook endpoint used for notifications.
     * Optional: if set, notifications will be sent to this endpoint.
     */
    @IsOptional()
    @IsString()
    @Column("varchar", { nullable: true })
    webhookEndpointId?: string | null;

    @ManyToOne(() => WebhookEndpointEntity, {
        createForeignKeyConstraints: false,
    })
    @JoinColumn([
        { name: "webhookEndpointId", referencedColumnName: "id" },
        { name: "tenantId", referencedColumnName: "tenantId" },
    ])
    webhookEndpoint?: WebhookEndpointEntity;

    /**
     * Optional webhook URL to receive the response.
     * @deprecated This field is deprecated. Use webhookEndpointId and the WebhookEndpoint relationship instead.
     */
    @Column("json", { nullable: true })
    @IsOptional()
    @Validate(WebhookConfig)
    @Type(() => WebhookConfig)
    webhook?: WebhookConfig | null;

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

    /**
     * Attestation that should be attached
     */
    @IsOptional()
    @IsArray()
    @ValidateNested()
    @Type(() => PresentationAttachment)
    @Column("json", { nullable: true })
    attached?: PresentationAttachment[] | null;

    /**
     * Redirect URI to which the user-agent should be redirected after the presentation is completed.
     * You can use the `{sessionId}` placeholder in the URI, which will be replaced with the actual session ID.
     * @example "https://example.com/callback?session={sessionId}"
     */
    @IsOptional()
    @IsString()
    @Column("varchar", { nullable: true })
    redirectUri?: string | null;

    /**
     * Optional ID of the access certificate to use for signing the presentation request.
     * If not provided, the default access certificate for the tenant will be used.
     *
     * Note: This is intentionally NOT a TypeORM relationship because CertEntity uses
     * a composite primary key (id + tenantId), and SQLite cannot create foreign keys
     * that reference only part of a composite primary key. The relationship is handled
     * at the application level in the service layer.
     */
    @IsOptional()
    @IsString()
    @Column("varchar", { nullable: true })
    accessKeyChainId?: string | null;
}
