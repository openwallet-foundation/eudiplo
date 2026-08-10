import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { KeyUsageType } from "../types/key-usage-type";
import {
    KeyChainCreateSchema,
    RotationPolicyCreateSchema,
} from "../schemas/key-chain.schema";

/**
 * DTO for rotation policy configuration.
 */
export class RotationPolicyCreateDto extends createZodDto(
    RotationPolicyCreateSchema,
) {
    @ApiProperty({
        description: "Whether automatic key rotation is enabled.",
        default: false,
    })
    enabled!: boolean;

    @ApiPropertyOptional({
        description:
            "Rotation interval in days. Required when enabled is true.",
        example: 90,
        minimum: 1,
        maximum: 3650,
    })
    intervalDays?: number;

    @ApiPropertyOptional({
        description:
            "Certificate validity in days. Defaults to rotation interval + 30 days grace period.",
        example: 365,
        minimum: 1,
        maximum: 3650,
    })
    certValidityDays?: number;
}

/**
 * Key chain type determines the structure of the key chain.
 */
export enum KeyChainType {
    /** Single key with self-signed certificate */
    Standalone = "standalone",
    /** Internal CA + signing key with CA-signed certificate */
    InternalChain = "internalChain",
}

/**
 * DTO for creating a new key chain.
 *
 * A key chain is a unified object that represents a complete signing key setup:
 * - For standalone type: A single key with a self-signed certificate
 * - For internalChain type: An internal root CA + signing key with CA-signed certificate
 */
export class KeyChainCreateDto extends createZodDto(KeyChainCreateSchema) {
    @ApiProperty({
        description:
            "Usage type determines the purpose of this key chain (access, attestation, etc.).",
        enum: KeyUsageType,
        example: "attestation",
    })
    usageType!: KeyUsageType;

    @ApiProperty({
        description: "Type of key chain to create.",
        enum: KeyChainType,
        example: "internalChain",
    })
    type!: KeyChainType;

    @ApiPropertyOptional({
        description: "Human-readable description for the key chain.",
        example: "Production credential signing key",
    })
    description?: string;

    @ApiPropertyOptional({
        description:
            "KMS provider to use (defaults to the configured default provider).",
        example: "vault",
    })
    kmsProvider?: string;

    @ApiPropertyOptional({
        description:
            "Rotation policy configuration. Only applicable for the signing key (root CA never rotates).",
        type: RotationPolicyCreateDto,
    })
    rotationPolicy?: RotationPolicyCreateDto;
}
