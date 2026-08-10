import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { JWK } from "jose";
import { createZodDto } from "nestjs-zod";
import { KeyUsageType } from "../types/key-usage-type";
import {
    EcJwkSchema,
    KeyChainImportSchema,
    RotationPolicyImportSchema,
} from "../schemas/key-chain.schema";

/**
 * JWK structure for EC keys (P-256).
 */
class EcJwk extends createZodDto(EcJwkSchema) implements JWK {
    kty!: string;

    x!: string;

    y!: string;

    crv!: string;

    d!: string;

    alg?: string;

    kid?: string;
}

/**
 * Rotation policy for imported key chains.
 * When enabled, the imported key becomes the root CA key,
 * and a new leaf key is generated for signing.
 */
class RotationPolicyImportDto extends createZodDto(RotationPolicyImportSchema) {
    @ApiProperty({
        description:
            "Whether rotation is enabled. When true, the imported key becomes a root CA signer.",
        default: false,
    })
    enabled!: boolean;

    @ApiPropertyOptional({
        description: "Rotation interval in days.",
        example: 90,
        minimum: 1,
        maximum: 3650,
    })
    intervalDays?: number;

    @ApiPropertyOptional({
        description: "Certificate validity in days.",
        example: 365,
        minimum: 1,
        maximum: 3650,
    })
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
export class KeyChainImportDto extends createZodDto(KeyChainImportSchema) {
    @ApiPropertyOptional({
        description:
            "ID for the key chain. If not provided, a new UUID will be generated.",
    })
    id?: string;

    @ApiProperty({
        description: "The private key in JWK format.",
    })
    key!: EcJwk;

    @ApiPropertyOptional({
        description: "Human-readable description.",
    })
    description?: string;

    @ApiProperty({
        description: "Usage type for this key chain.",
        enum: KeyUsageType,
    })
    usageType!: KeyUsageType;

    @ApiPropertyOptional({
        description:
            "Certificate chain (leaf first). Each entry may be PEM or base64-encoded DER; values are normalized to PEM during import. When rotationPolicy.enabled=true, the last certificate in the chain is treated as the root CA certificate.",
    })
    crt?: string[];

    @ApiPropertyOptional({
        description: "KMS provider to use. Defaults to 'db'.",
    })
    kmsProvider?: string;

    @ApiPropertyOptional({
        description:
            "Rotation policy. When enabled, the imported key becomes a root CA signer and a new leaf key is generated. If crt is provided, the selected root CA certificate must have CA=true and its public key must match the imported private key.",
    })
    rotationPolicy?: RotationPolicyImportDto;
}
