import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsBoolean,
    IsEnum,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from "class-validator";
import { JWK } from "jose";
import { KeyUsageType } from "../entities/key-chain.entity";

/**
 * JWK structure for EC keys (P-256).
 */
class EcJwk implements JWK {
    @IsString()
    kty!: string;

    @IsString()
    x!: string;

    @IsString()
    y!: string;

    @IsString()
    crv!: string;

    @IsString()
    d!: string;

    @IsString()
    @IsOptional()
    alg?: string;

    @IsString()
    @IsOptional()
    kid?: string;
}

/**
 * Rotation policy for imported key chains.
 * When enabled, the imported key becomes the root CA key,
 * and a new leaf key is generated for signing.
 */
class RotationPolicyImportDto {
    @ApiProperty({
        description:
            "Whether rotation is enabled. When true, the imported key becomes a root CA.",
        default: false,
    })
    @IsBoolean()
    enabled!: boolean;

    @ApiPropertyOptional({
        description: "Rotation interval in days.",
        example: 90,
        minimum: 1,
        maximum: 3650,
    })
    @IsNumber()
    @Min(1)
    @Max(3650)
    @IsOptional()
    intervalDays?: number;

    @ApiPropertyOptional({
        description: "Certificate validity in days.",
        example: 365,
        minimum: 1,
        maximum: 3650,
    })
    @IsNumber()
    @Min(1)
    @Max(3650)
    @IsOptional()
    certValidityDays?: number;
}

/**
 * DTO for importing a key chain from file configuration.
 *
 * This format supports importing keys with their certificates.
 * The import can be done in two ways:
 * 1. Combined: key + certificate in single JSON file
 * 2. Separate: key JSON references a certificate JSON via keyId matching
 */
export class KeyChainImportDto {
    @ApiPropertyOptional({
        description:
            "ID for the key chain. If not provided, a new UUID will be generated.",
    })
    @IsString()
    @IsOptional()
    id?: string;

    @ApiProperty({
        description: "The private key in JWK format.",
    })
    @IsObject()
    @ValidateNested()
    @Type(() => EcJwk)
    key!: EcJwk;

    @ApiPropertyOptional({
        description: "Human-readable description.",
    })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({
        description: "Usage type for this key chain.",
        enum: KeyUsageType,
    })
    @IsEnum(KeyUsageType)
    usageType!: KeyUsageType;

    @ApiPropertyOptional({
        description:
            "Certificate chain (leaf first). Each entry may be PEM or base64-encoded DER; values are normalized to PEM during import.",
    })
    @IsString({ each: true })
    @IsOptional()
    crt?: string[];

    @ApiPropertyOptional({
        description: "KMS provider to use. Defaults to 'db'.",
    })
    @IsString()
    @IsOptional()
    kmsProvider?: string;

    @ApiPropertyOptional({
        description:
            "Rotation policy. When enabled, the imported key becomes a root CA and a new leaf key is generated.",
    })
    @ValidateNested()
    @Type(() => RotationPolicyImportDto)
    @IsOptional()
    rotationPolicy?: RotationPolicyImportDto;
}
