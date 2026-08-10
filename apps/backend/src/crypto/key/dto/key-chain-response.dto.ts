import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { KeyUsageType } from "../types/key-usage-type";
import { KeyChainType } from "./key-chain-create.dto";

/**
 * Certificate info in the response.
 */
export class CertificateInfoDto {
    @ApiProperty({
        description: "Certificate in PEM format.",
    })
    pem!: string;

    @ApiPropertyOptional({
        description: "Certificate subject (CN).",
    })
    subject?: string;

    @ApiPropertyOptional({
        description: "Certificate issuer (CN).",
    })
    issuer?: string;

    @ApiPropertyOptional({
        description: "Certificate not before date.",
    })
    notBefore?: Date;

    @ApiPropertyOptional({
        description: "Certificate not after date.",
    })
    notAfter?: Date;

    @ApiPropertyOptional({
        description: "Serial number.",
    })
    serialNumber?: string;
}

/**
 * Public key info in the response.
 */
export class PublicKeyInfoDto {
    @ApiProperty({
        description: "Key type (e.g., EC).",
        example: "EC",
    })
    kty!: string;

    @ApiPropertyOptional({
        description: "Key algorithm (e.g., ES256).",
        example: "ES256",
    })
    alg?: string;

    @ApiPropertyOptional({
        description: "Key ID.",
    })
    kid?: string;

    @ApiPropertyOptional({
        description: "Curve (for EC keys).",
        example: "P-256",
    })
    crv?: string;
}

/**
 * Rotation policy in the response.
 */
export class RotationPolicyResponseDto {
    @ApiProperty({
        description: "Whether automatic key rotation is enabled.",
    })
    enabled!: boolean;

    @ApiPropertyOptional({
        description: "Rotation interval in days.",
    })
    intervalDays?: number;

    @ApiPropertyOptional({
        description: "Certificate validity in days.",
    })
    certValidityDays?: number;

    @ApiPropertyOptional({
        description: "Next scheduled rotation date.",
    })
    nextRotationAt?: Date;
}

/**
 * Response DTO for a key chain.
 */
export class KeyChainResponseDto {
    @ApiProperty({
        description: "Unique identifier for the key chain.",
    })
    id!: string;

    @ApiProperty({
        description: "Usage type of the key chain.",
        enum: KeyUsageType,
    })
    usageType!: KeyUsageType;

    @ApiProperty({
        description: "Type of key chain (standalone or internalChain).",
        enum: KeyChainType,
    })
    type!: KeyChainType;

    @ApiPropertyOptional({
        description: "Human-readable description.",
    })
    description?: string;

    @ApiProperty({
        description: "KMS provider used for this key chain.",
    })
    kmsProvider!: string;

    @ApiPropertyOptional({
        description: "Root CA certificate (only for internalChain type).",
        type: CertificateInfoDto,
    })
    rootCertificate?: CertificateInfoDto;

    @ApiProperty({
        description: "Active signing key's public key info.",
        type: PublicKeyInfoDto,
    })
    activePublicKey!: PublicKeyInfoDto;

    @ApiPropertyOptional({
        description:
            "Active signing key's certificate. Not present for encryption keys.",
        type: CertificateInfoDto,
    })
    activeCertificate?: CertificateInfoDto;

    @ApiPropertyOptional({
        description:
            "Previous signing key's public key info (if in grace period).",
        type: PublicKeyInfoDto,
    })
    previousPublicKey?: PublicKeyInfoDto;

    @ApiPropertyOptional({
        description: "Previous signing key's certificate (if in grace period).",
        type: CertificateInfoDto,
    })
    previousCertificate?: CertificateInfoDto;

    @ApiPropertyOptional({
        description: "Previous key expiry date.",
    })
    previousKeyExpiry?: Date;

    @ApiProperty({
        description: "Rotation policy configuration.",
        type: RotationPolicyResponseDto,
    })
    rotationPolicy!: RotationPolicyResponseDto;

    @ApiProperty({
        description: "Timestamp when the key chain was created.",
    })
    createdAt!: Date;

    @ApiProperty({
        description: "Timestamp when the key chain was last updated.",
    })
    updatedAt!: Date;
}
