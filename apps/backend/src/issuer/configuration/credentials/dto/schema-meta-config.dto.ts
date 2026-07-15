import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SchemaURIMeta } from "@owf/eudi-attestation-schema";
import { Type } from "class-transformer";
import {
    IsArray,
    IsEnum,
    IsObject,
    IsOptional,
    IsString,
    ValidateNested,
} from "class-validator";

/**
 * Attestation Level of Security (LoS) as defined in TS11.
 */
export enum AttestationLoS {
    HIGH = "iso_18045_high",
    MODERATE = "iso_18045_moderate",
    ENHANCED_BASIC = "iso_18045_enhanced-basic",
    BASIC = "iso_18045_basic",
}

/**
 * Cryptographic binding type as defined in TS11.
 */
export enum SchemaMetaBindingType {
    CLAIM = "claim",
    KEY = "key",
    BIOMETRIC = "biometric",
    NONE = "none",
}

/**
 * Trust framework type for trusted authorities.
 */
export enum SchemaMetaFrameworkType {
    AKI = "aki",
    ETSI_TL = "etsi_tl",
    OPENID_FEDERATION = "openid_federation",
}

export enum SchemaMetadataPinMode {
    KEEP_CURRENT = "keep_current",
    UPDATE_TO_NEW_VERSION = "update_to_new_version",
    REPLACE_ID = "replace_id",
}

/**
 * Schema URI entry per attestation format.
 */
export class SchemaUriEntry {
    @ApiPropertyOptional({
        description:
            "Credential config ID to resolve and upload its schema content. " +
            "When set, uri can be omitted and is resolved server-side.",
        example: "pid_de_credential_config",
    })
    @IsOptional()
    @IsString()
    credentialConfigId?: string;

    @ApiPropertyOptional({
        description:
            "Attestation format this schema URI applies to (e.g. dc+sd-jwt, mso_mdoc)",
        example: "dc+sd-jwt",
    })
    @IsOptional()
    @IsString()
    format?: string;

    @ApiPropertyOptional({
        description: "URI pointing to the schema document for this format",
    })
    @IsOptional()
    @IsString()
    uri?: string;

    @ApiProperty({
        description:
            "Schema-format specific metadata (for example { vct: 'urn:example:vct' } for dc+sd-jwt).",
        type: "object",
        additionalProperties: true,
    })
    @IsOptional()
    @IsObject()
    meta?: SchemaURIMeta;
}

/**
 * Trust authority entry for TS11 SchemaMeta.
 */
export class TrustAuthorityEntry {
    @ApiPropertyOptional({
        description:
            "Trust list ID to resolve from the database. " +
            "When set, frameworkType, value, and verificationMethod are derived automatically.",
    })
    @IsOptional()
    @IsString()
    trustListId?: string;

    @ApiPropertyOptional({
        enum: SchemaMetaFrameworkType,
        description: "Trust framework type (ignored when trustListId is set)",
    })
    @IsOptional()
    @IsEnum(SchemaMetaFrameworkType)
    frameworkType?: SchemaMetaFrameworkType;

    @ApiPropertyOptional({
        description:
            "URI of the trust list or trust anchor (ignored when trustListId is set)",
    })
    @IsOptional()
    @IsString()
    value?: string;

    @ApiPropertyOptional({
        description:
            "Optional verification material for external trusted authorities (for example a JWK). " +
            "For internal trust-list URLs, EUDIPLO resolves verification material from the database.",
        oneOf: [
            {
                type: "object",
                additionalProperties: true,
            },
            {
                type: "string",
                description:
                    "JSON string representing an object. Parsed server-side for form submissions.",
            },
        ],
    })
    @IsOptional()
    verificationMethod?: Record<string, unknown> | string;
}

/**
 * TS11-specific configuration for schema metadata generation.
 *
 * When present on a CredentialConfig, EUDIPLO can generate a SchemaMeta
 * object per the EUDI Catalogue of Attestations specification (TS11).
 *
 * @see https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications/blob/main/docs/technical-specifications/ts11-interfaces-and-formats-for-catalogue-of-attributes-and-catalogue-of-schemes.md
 *
 * @experimental The underlying TS11 specification is not yet finalized.
 */
export class SchemaMetaConfig {
    @ApiPropertyOptional({
        description:
            "Optional override for the schema ID (attestation identifier URI). " +
            "When not set, derived from vct (dc+sd-jwt) or docType (mso_mdoc).",
        example: "https://example.com/attestations/my-credential",
    })
    @IsOptional()
    @IsString()
    id?: string;

    @ApiPropertyOptional({
        description:
            "Human-readable name of the schema metadata entry. Required when publishing new schema metadata; optional when linking an existing schema metadata id to a credential config.",
        example: "German PID",
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({
        description: "Schema version in SemVer format",
        example: "1.0.0",
    })
    @IsString()
    version!: string;

    @ApiPropertyOptional({
        description:
            "URI of the Attestation Rulebook. Required when publishing new schema metadata; optional when linking an existing schema metadata id to a credential config.",
        example: "https://example.com/rulebooks/my-credential/1.0.0.md",
    })
    @IsOptional()
    @IsString()
    rulebookURI?: string;

    @ApiPropertyOptional({
        enum: AttestationLoS,
        description: "Attestation Level of Security",
    })
    @IsEnum(AttestationLoS)
    attestationLoS!: AttestationLoS;

    @ApiPropertyOptional({
        enum: SchemaMetaBindingType,
        description: "Cryptographic binding type",
    })
    @IsEnum(SchemaMetaBindingType)
    bindingType!: SchemaMetaBindingType;

    @ApiPropertyOptional({
        type: () => [SchemaUriEntry],
        description:
            "Schema URIs per attestation format. " +
            "When omitted, the format is derived from the credential config format field.",
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SchemaUriEntry)
    schemaURIs?: SchemaUriEntry[];

    @ApiPropertyOptional({
        type: () => [TrustAuthorityEntry],
        description: "Trust authorities for this attestation schema",
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TrustAuthorityEntry)
    trustedAuthorities?: TrustAuthorityEntry[];
}

/**
 * Request body for schema metadata submission.
 *
 * The registrar builds and signs schema metadata from the submitted values.
 * EUDIPLO no longer performs local SchemaMetadata JWT signing for this flow.
 */
export class SignSchemaMetaConfigDto {
    @ApiProperty({
        type: () => SchemaMetaConfig,
        description:
            "The schema metadata configuration to submit. Registrar builds and signs the final schema metadata.",
    })
    @ValidateNested()
    @Type(() => SchemaMetaConfig)
    config!: SchemaMetaConfig;

    @ApiPropertyOptional({
        description:
            "ID of the credential config to link back after submission. " +
            "When provided, schemaMeta.id on the credential config is updated with the reserved attestation ID.",
    })
    @IsOptional()
    @IsString()
    credentialConfigId?: string;

    @ApiPropertyOptional({
        enum: SchemaMetadataPinMode,
        description:
            "How to update credential config pinning after publish. keep_current: do not change existing pin (unless empty). update_to_new_version: update pinned version under current id. replace_id: repoint pin to a different schema id.",
        default: SchemaMetadataPinMode.KEEP_CURRENT,
    })
    @IsOptional()
    @IsEnum(SchemaMetadataPinMode)
    pinMode?: SchemaMetadataPinMode;
}

/**
 * Request body for new schema metadata version submission.
 *
 * The registrar builds and signs the new version.
 */
export class SignVersionSchemaMetaConfigDto {
    @ApiProperty({
        type: () => SchemaMetaConfig,
        description:
            "The schema metadata configuration to submit as a new version. Must include the existing id.",
    })
    @ValidateNested()
    @Type(() => SchemaMetaConfig)
    config!: SchemaMetaConfig;

    @ApiPropertyOptional({
        description:
            "Optional credential config to update pinning for after successful version publish.",
    })
    @IsOptional()
    @IsString()
    credentialConfigId?: string;

    @ApiPropertyOptional({
        enum: SchemaMetadataPinMode,
        description:
            "How to update credential config pinning after version publish. keep_current: do not change existing pin (unless empty). update_to_new_version: update pinned version under current id. replace_id: repoint pin to config.id.",
        default: SchemaMetadataPinMode.KEEP_CURRENT,
    })
    @IsOptional()
    @IsEnum(SchemaMetadataPinMode)
    pinMode?: SchemaMetadataPinMode;
}
