import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsArray,
    IsEnum,
    IsOptional,
    IsString,
    ValidateNested,
} from "class-validator";
import type {
    AccessCertificate,
    MetadataSchema,
    SchemaMetadata,
    TrustAuthority,
    UpdateIssuerOfferDto as GeneratedUpdateIssuerOfferDto,
    UpdateSchemaMetadataDto as GeneratedUpdateSchemaMetadataDto,
    IssuerOfferEntry,
} from "../../generated";

const ATTESTATION_LOS_VALUES = [
    "iso_18045_high",
    "iso_18045_moderate",
    "iso_18045_enhanced-basic",
    "iso_18045_basic",
] as const;
export type AttestationLoS = (typeof ATTESTATION_LOS_VALUES)[number];

const BINDING_TYPE_VALUES = ["claim", "key", "biometric", "none"] as const;
export type BindingType = (typeof BINDING_TYPE_VALUES)[number];

const FORMAT_VALUES = ["dc+sd-jwt", "mso_mdoc"] as const;
export type CredentialFormatId = (typeof FORMAT_VALUES)[number];

const CATEGORY_VALUES = [
    "identity",
    "health",
    "finance",
    "education",
    "mobility",
    "employment",
    "other",
] as const;
export type SchemaMetadataCategory = (typeof CATEGORY_VALUES)[number];

const TAG_VALUES = [
    "pid",
    "eudi",
    "kyc",
    "aml",
    "age-verification",
    "residency",
    "membership",
    "education",
    "employment",
    "mobility",
] as const;
export type SchemaMetadataTag = (typeof TAG_VALUES)[number];

const VOCABULARY_STATUS_VALUES = ["active", "deprecated"] as const;
export type VocabularyStatus = (typeof VOCABULARY_STATUS_VALUES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Request bodies
// ─────────────────────────────────────────────────────────────────────────────

export class UpdateIssuerOfferDto implements GeneratedUpdateIssuerOfferDto {
    @ApiPropertyOptional({
        description:
            "URL where the user can receive a credential offer from this issuer.",
    })
    @IsOptional()
    @IsString()
    credentialOfferUrl?: string;

    @ApiPropertyOptional({
        description:
            "Human-readable description to help users choose the right issuer.",
    })
    @IsOptional()
    @IsString()
    description?: string;
}

/**
 * Request body for `PATCH /registrar/schema-metadata/:id`.
 */
export class UpdateSchemaMetadataDto
    implements GeneratedUpdateSchemaMetadataDto
{
    @ApiPropertyOptional({
        description: "Domain category for filtering",
        enum: CATEGORY_VALUES,
    })
    @IsOptional()
    @IsEnum(CATEGORY_VALUES)
    category?: SchemaMetadataCategory;

    @ApiPropertyOptional({
        description: "Predefined tags for filtering and search",
        type: [String],
        enum: TAG_VALUES,
    })
    @IsOptional()
    @IsArray()
    @IsEnum(TAG_VALUES, { each: true })
    tags?: SchemaMetadataTag[];

    @ApiPropertyOptional({
        description:
            "Optional human-readable schema name for UI display and search",
    })
    @IsOptional()
    @IsString()
    displayName?: string;

    @ApiPropertyOptional({
        description:
            "Issuer offer entries shown to users, each with credential-offer URL and description",
        type: [UpdateIssuerOfferDto],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateIssuerOfferDto)
    issuerOffers?: UpdateIssuerOfferDto[];
}

export class VocabularyEntryDto {
    @ApiProperty({
        description:
            "Stable machine-readable value to submit in schema metadata category/tags fields.",
    })
    code!: string;

    @ApiProperty({
        description: "Display label for UI rendering.",
    })
    label!: string;

    @ApiProperty({
        description: "Vocabulary lifecycle status.",
        enum: VOCABULARY_STATUS_VALUES,
    })
    status!: VocabularyStatus;

    @ApiPropertyOptional({
        description: "Replacement code when status is deprecated.",
    })
    replacedBy?: string;
}

export class SchemaMetadataVocabulariesDto {
    @ApiProperty({
        description: "Vocabulary publication version for cache invalidation.",
    })
    version!: string;

    @ApiProperty({
        description:
            "Allowed category values that can be used when updating schema metadata category.",
        type: [VocabularyEntryDto],
    })
    @ValidateNested({ each: true })
    @Type(() => VocabularyEntryDto)
    categories!: VocabularyEntryDto[];

    @ApiProperty({
        description:
            "Allowed tag values that can be used when updating schema metadata tags.",
        type: [VocabularyEntryDto],
    })
    @ValidateNested({ each: true })
    @Type(() => VocabularyEntryDto)
    tags!: VocabularyEntryDto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Response DTOs
// ─────────────────────────────────────────────────────────────────────────────

type MetadataSchemaBase = Omit<MetadataSchema, "schemaMetadata">;

export class MetadataSchemaDto implements MetadataSchemaBase {
    @ApiProperty({ description: "Unique identifier for this schema entry" })
    id!: string;

    @ApiProperty({
        description: "The credential format identifier",
        enum: FORMAT_VALUES,
    })
    formatIdentifier!: CredentialFormatId;

    @ApiPropertyOptional({ description: "URI to the schema definition" })
    uri?: string;

    @ApiPropertyOptional({
        description: "Format-specific metadata for the schema entry",
        type: "object",
        additionalProperties: true,
    })
    meta?: Record<string, unknown>;

    @ApiPropertyOptional({
        description: "Subresource Integrity hash for the schema",
    })
    integrity?: string;
}

type TrustAuthorityBase = Omit<TrustAuthority, "schemaMetadata">;

export class TrustAuthorityDto implements TrustAuthorityBase {
    @ApiProperty({
        description: "Unique identifier for this trust authority entry",
    })
    id!: string;

    @ApiProperty({
        description: "Type of trust framework",
        enum: ["etsi_tl"],
    })
    frameworkType!: "etsi_tl";

    @ApiProperty({
        description: "URI or identifier for the trust list / authority",
    })
    value!: string;

    @ApiPropertyOptional({
        description:
            "Verification method for the trust list signature (e.g., JWK)",
        type: "object",
        additionalProperties: true,
    })
    verificationMethod?: Record<string, unknown>;
}

type AccessCertificateRefBase = Pick<
    AccessCertificate,
    "id" | "relyingPartyId" | "certificate" | "revoked" | "createdAt"
>;

export class AccessCertificateRefDto implements AccessCertificateRefBase {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    relyingPartyId!: string;

    @ApiProperty()
    certificate!: string;

    @ApiProperty()
    revoked!: string;

    @ApiProperty()
    createdAt!: string;
}

export class IssuerOfferEntryDto implements IssuerOfferEntry {
    @ApiProperty({
        description:
            "URL where the user can receive a credential offer from this issuer.",
    })
    credentialOfferUrl!: string;

    @ApiProperty({
        description:
            "Human-readable description explaining when this issuer offer is relevant for the user.",
    })
    description!: string;
}

/**
 * Schema metadata record as returned by `GET/POST /registrar/schema-metadata` and friends.
 *
 * The shape mirrors the registrar-API response 1:1 so that the service can pass
 * upstream payloads through unchanged.
 */
type SchemaMetadataResponseBase = Omit<
    SchemaMetadata,
    "schemaURIs" | "trustedAuthorities" | "signerCertificate"
> & {
    schemaURIs: MetadataSchemaDto[];
    trustedAuthorities: TrustAuthorityDto[];
    signerCertificate?: AccessCertificateRefDto;
};

export class SchemaMetadataResponseDto implements SchemaMetadataResponseBase {
    @ApiProperty({
        description:
            "The unique, server-assigned identifier (UUID) for the schema metadata",
    })
    id!: string;

    @ApiProperty({ description: "Version of this schema metadata (SemVer)" })
    version!: string;

    @ApiPropertyOptional({
        description: "URI of the human-readable Rulebook document",
    })
    rulebookURI?: string;

    @ApiPropertyOptional({
        description: "Subresource Integrity hash for the rulebook URI",
    })
    rulebookIntegrity?: string;

    @ApiProperty({
        description: "Level of security (LoS) of this attestation",
        enum: ATTESTATION_LOS_VALUES,
    })
    attestationLoS!: AttestationLoS;

    @ApiProperty({
        description: "Required binding type between attestation and holder",
        enum: BINDING_TYPE_VALUES,
    })
    bindingType!: BindingType;

    @ApiProperty({
        description:
            "Credential formats in which this attestation is available",
        enum: FORMAT_VALUES,
        isArray: true,
    })
    supportedFormats!: CredentialFormatId[];

    @ApiProperty({
        description: "Format-specific schema URIs for this schema metadata",
        type: [MetadataSchemaDto],
    })
    @ValidateNested({ each: true })
    @Type(() => MetadataSchemaDto)
    schemaURIs!: MetadataSchemaDto[];

    @ApiProperty({
        description:
            "Trust frameworks / trust anchors applicable to this schema metadata",
        type: [TrustAuthorityDto],
    })
    @ValidateNested({ each: true })
    @Type(() => TrustAuthorityDto)
    trustedAuthorities!: TrustAuthorityDto[];

    @ApiPropertyOptional({
        description: "Domain category for filtering",
        enum: CATEGORY_VALUES,
    })
    category?: SchemaMetadataCategory;

    @ApiPropertyOptional({
        description: "Free-form tags for filtering and search",
        type: [String],
    })
    tags?: string[];

    @ApiPropertyOptional({
        description:
            "Optional human-readable schema name for UI display and filtering.",
    })
    displayName?: string;

    @ApiProperty({
        description:
            "Issuer offer entries for this schema metadata. Each entry provides a credential offer URL and user-facing description.",
        type: [IssuerOfferEntryDto],
    })
    @ValidateNested({ each: true })
    @Type(() => IssuerOfferEntryDto)
    issuerOffers!: IssuerOfferEntryDto[];

    @ApiProperty({ description: "The original signed JWT" })
    signedJwt!: string;

    @ApiProperty({ description: "Issuer from the JWT (`iss` claim)" })
    issuer!: string;

    @ApiPropertyOptional({
        description: "The access certificate used to sign this schema metadata",
        type: AccessCertificateRefDto,
    })
    @ValidateNested()
    @Type(() => AccessCertificateRefDto)
    signerCertificate?: AccessCertificateRefDto;

    @ApiProperty({
        description: "Timestamp when the JWT was issued (from the `iat` claim)",
    })
    issuedAt!: string;

    @ApiProperty({ description: "Server creation timestamp" })
    createdAt!: string;

    @ApiProperty({ description: "Last update timestamp" })
    updatedAt!: string;

    @ApiProperty({ description: "Whether this version is deprecated" })
    deprecated!: boolean;

    @ApiPropertyOptional({
        description: "Deprecation message shown to consumers",
    })
    deprecationMessage?: string;

    @ApiPropertyOptional({
        description: "The version that supersedes this one",
    })
    supersededByVersion?: string;

    @ApiPropertyOptional({
        description: "Timestamp when this version was marked as deprecated",
    })
    deprecatedAt?: string;
}

/**
 * Request body for `PATCH /registrar/schema-metadata/:id/versions/:version/deprecation`.
 */
export class DeprecateSchemaMetadataDto {
    @ApiProperty({ description: "Whether to mark this version as deprecated" })
    deprecated!: boolean;

    @ApiPropertyOptional({
        description: "Deprecation message shown to consumers",
    })
    @IsOptional()
    @IsString()
    message?: string;

    @ApiPropertyOptional({
        description: "The version that supersedes this one",
    })
    @IsOptional()
    @IsString()
    supersededByVersion?: string;
}
