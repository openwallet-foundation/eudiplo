import {
    ApiExtraModels,
    ApiHideProperty,
    ApiProperty,
    ApiPropertyOptional,
    getSchemaPath,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from "class-validator";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { TenantEntity } from "../../../../auth/tenant/entitites/tenant.entity";
import { KeyChainEntity } from "../../../../crypto/key/entities/key-chain.entity";
import { VCT } from "../../../issuance/oid4vci/metadata/dto/vct.dto";
import { AttributeProviderEntity } from "../../attribute-provider/entities/attribute-provider.entity";
import { KeyAttestationsRequired } from "../../issuance/dto/key-attestations-required.dto";
import { WebhookEndpointEntity } from "../../webhook-endpoint/entities/webhook-endpoint.entity";
import { ClaimFieldDefinitionDto } from "../dto/claim-field-definition.dto";
import { SchemaMetaConfig } from "../dto/schema-meta-config.dto";
import {
    IaeAction,
    IaeActionBase,
    IaeActionOpenid4vpPresentation,
    IaeActionRedirectToWeb,
    IaeActionType,
} from "./iae-action.dto";
import {
    AllowListPolicy,
    AttestationBasedPolicy,
    EmbeddedDisclosurePolicy,
    NoneTrustPolicy,
    RootOfTrustPolicy,
} from "./policies.dto";

export class DisplayImage {
    @IsString()
    uri!: string;
}
export class Display {
    @IsString()
    name!: string;
    @IsString()
    description!: string;
    @IsString()
    locale!: string;
    @IsOptional()
    @IsString()
    background_color?: string;
    @IsOptional()
    @IsString()
    text_color?: string;
    @IsOptional()
    @ValidateNested()
    @Type(() => DisplayImage)
    background_image?: DisplayImage;
    @IsOptional()
    @ValidateNested()
    @Type(() => DisplayImage)
    logo?: DisplayImage;
}

export enum CredentialFormat {
    MSO_MDOC = "mso_mdoc",
    SD_JWT_VC = "dc+sd-jwt",
}

/**
 * Determines how SD-JWT credentials are signed and trust is established.
 * - "x5c": Include certificate chain in JWT header (certificate-based trust)
 * - "federation": Include issuer entity ID in 'iss' claim (federation-based trust)
 * - "auto": Legacy mode kept for backward compatibility (treated like x5c)
 */
export enum SdJwtTrustFormat {
    X5C = "x5c",
    FEDERATION = "federation",
}

export class IssuerMetadataCredentialConfig {
    @IsEnum(CredentialFormat)
    format!: CredentialFormat;
    @ValidateNested()
    @Type(() => Display)
    display!: Display[];
    @IsOptional()
    @IsString()
    scope?: string;

    /**
     * Document type for mDOC credentials (e.g., "org.iso.18013.5.1.mDL").
     * Only applicable when format is "mso_mdoc".
     */
    @IsOptional()
    @IsString()
    docType?: string;

    /**
     * Key attestation requirements for JWT proofs for this credential.
     * When set, this is published in proof_types_supported.jwt.key_attestations_required
     * for this specific credential configuration.
     *
     * @see https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-F
     */
    @ApiPropertyOptional({ type: () => KeyAttestationsRequired })
    @ValidateNested()
    @Type(() => KeyAttestationsRequired)
    @IsOptional()
    keyAttestationsRequired?: KeyAttestationsRequired;
}

@ApiExtraModels(
    AttestationBasedPolicy,
    NoneTrustPolicy,
    AllowListPolicy,
    RootOfTrustPolicy,
    VCT,
    IaeActionOpenid4vpPresentation,
    IaeActionRedirectToWeb,
    WebhookEndpointEntity,
)
@Entity()
export class CredentialConfig {
    @IsString()
    @Column("varchar", { primary: true })
    id!: string;

    @IsString()
    @Column("varchar", { nullable: true })
    description?: string | null;

    @ApiHideProperty()
    @Column("varchar", { primary: true })
    tenantId!: string;

    /**
     * The tenant that owns this object.
     */
    @ManyToOne(() => TenantEntity, { cascade: true, onDelete: "CASCADE" })
    tenant!: TenantEntity;

    @Column("json")
    @ValidateNested()
    @Type(() => IssuerMetadataCredentialConfig)
    config!: IssuerMetadataCredentialConfig;

    @Column("int", { default: 2 })
    @IsNumber()
    configVersion!: number;

    @Column("json")
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ClaimFieldDefinitionDto)
    fields!: ClaimFieldDefinitionDto[];

    /**
     * Reference to the attribute provider used for fetching claims.
     * Optional: if set, claims will be fetched from this provider during issuance.
     */
    @IsOptional()
    @IsString()
    @Column("varchar", { nullable: true })
    attributeProviderId?: string | null;

    @ManyToOne(() => AttributeProviderEntity, {
        createForeignKeyConstraints: false,
    })
    @JoinColumn([
        { name: "attributeProviderId", referencedColumnName: "id" },
        { name: "tenantId", referencedColumnName: "tenantId" },
    ])
    attributeProvider?: AttributeProviderEntity;

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

    @IsOptional()
    @ApiPropertyOptional({
        description:
            "VCT as a URI string (e.g., urn:eudi:pid:de:1) or as an object for EUDIPLO-hosted VCT",
        anyOf: [
            { type: "string", description: "VCT URI string" },
            { $ref: getSchemaPath(VCT) },
            { type: "null" },
        ],
    })
    @Column("json", { nullable: true })
    vct?: string | VCT | null;

    @IsOptional()
    @Column("boolean", { default: false })
    @IsBoolean()
    keyBinding?: boolean;

    /**
     * Reference to the key chain used for signing.
     * Optional: if not specified, the default attestation key chain will be used.
     */
    @IsOptional()
    @IsString()
    @Column("varchar", { nullable: true })
    keyChainId?: string;

    @ManyToOne(() => KeyChainEntity, { createForeignKeyConstraints: false })
    @JoinColumn([
        { name: "keyChainId", referencedColumnName: "id" },
        { name: "tenantId", referencedColumnName: "tenantId" },
    ])
    keyChain?: KeyChainEntity;

    @IsOptional()
    @Column("boolean", { default: false })
    @IsBoolean()
    statusManagement?: boolean;

    /**
     * List of Interactive Authorization Endpoint (IAE) actions to execute
     * before credential issuance. Actions are executed in order.
     *
     * Each action can be:
     * - `openid4vp_presentation`: Request a verifiable presentation from the wallet
     * - `redirect_to_web`: Redirect user to a web page for additional interaction
     *
     * If empty or not set, no interactive authorization is required.
     *
     * @example
     * [
     *   { "type": "openid4vp_presentation", "presentationConfigId": "pid-config" },
     *   { "type": "redirect_to_web", "url": "https://example.com/verify", "label": "Additional Verification" }
     * ]
     */
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => IaeActionBase, {
        discriminator: {
            property: "type",
            subTypes: [
                {
                    name: IaeActionType.OPENID4VP_PRESENTATION,
                    value: IaeActionOpenid4vpPresentation,
                },
                {
                    name: IaeActionType.REDIRECT_TO_WEB,
                    value: IaeActionRedirectToWeb,
                },
            ],
        },
        keepDiscriminatorProperty: true,
    })
    @ApiProperty({
        description:
            "List of IAE actions to execute before credential issuance",
        type: "array",
        items: {
            oneOf: [
                { $ref: getSchemaPath(IaeActionOpenid4vpPresentation) },
                { $ref: getSchemaPath(IaeActionRedirectToWeb) },
            ],
        },
        nullable: true,
        required: false,
    })
    @Column("json", { nullable: true })
    iaeActions?: IaeAction[] | null;

    /**
     * For SD-JWT credentials: determines whether to include certificate chain (x5c)
     * or use federation-based trust (iss claim).
     * Default: "x5c" (federation must be explicitly selected)
     */
    @IsOptional()
    @IsEnum(SdJwtTrustFormat)
    @Column("varchar", { nullable: true, default: "x5c" })
    sdJwtTrustFormat?: SdJwtTrustFormat | null;

    @IsOptional()
    @Column("int", { nullable: true })
    @IsNumber()
    lifeTime?: number;

    /**
     * TS11 schema metadata configuration for EUDI Catalogue of Attestations.
     *
     * When present, EUDIPLO can generate a SchemaMeta object per the TS11 spec
     * using the GET /issuer/credentials/:id/schema-metadata endpoint.
     *
     * @experimental The underlying TS11 specification is not yet finalized.
     */
    @IsOptional()
    @ValidateNested()
    @Type(() => SchemaMetaConfig)
    @ApiPropertyOptional({ type: () => SchemaMetaConfig })
    @Column("json", { nullable: true })
    schemaMeta?: SchemaMetaConfig | null;

    /**
     * Embedded disclosure policy (discriminated union by `policy`).
     * The discriminator makes class-transformer instantiate the right subclass,
     * and then class-validator runs that subclass’s rules.
     */
    @IsOptional()
    @ValidateNested()
    @ApiProperty({
        oneOf: [
            { $ref: getSchemaPath(AttestationBasedPolicy) },
            { $ref: getSchemaPath(NoneTrustPolicy) },
            { $ref: getSchemaPath(AllowListPolicy) },
            { $ref: getSchemaPath(RootOfTrustPolicy) },
        ],
    })
    @Type(() => AttestationBasedPolicy, {
        discriminator: {
            property: "policy",
            subTypes: [
                { name: "none", value: NoneTrustPolicy },
                { name: "allowList", value: AllowListPolicy },
                { name: "rootOfTrust", value: RootOfTrustPolicy },
                {
                    name: "attestationBased",
                    value: AttestationBasedPolicy,
                },
            ],
        },
        keepDiscriminatorProperty: true, // keep `policy` on the instance
    })
    @Column("json", { nullable: true })
    embeddedDisclosurePolicy?: EmbeddedDisclosurePolicy | null;
}
