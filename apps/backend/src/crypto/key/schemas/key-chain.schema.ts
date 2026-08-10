import { z } from "zod";
import { KeyUsageType } from "../types/key-usage-type";

export const RotationPolicyCreateSchema = z
    .object({
        enabled: z
            .boolean()
            .describe("Enable or disable automatic key rotation."),
        intervalDays: z
            .number()
            .min(1)
            .max(3650)
            .optional()
            .describe("Rotation interval in days."),
        certValidityDays: z
            .number()
            .min(1)
            .max(3650)
            .optional()
            .describe(
                "Certificate validity period in days for generated leaf certificates.",
            ),
    })
    .describe("Rotation policy used when creating key chains.")
    .strict();

export const KeyChainCreateSchema = z
    .object({
        usageType: z
            .enum(KeyUsageType)
            .describe("Key usage category for the key chain."),
        type: z
            .enum(["standalone", "internalChain"])
            .describe("Key chain mode."),
        description: z
            .string()
            .optional()
            .describe("Optional key chain description."),
        kmsProvider: z
            .string()
            .optional()
            .describe("Optional KMS provider id for key storage operations."),
        rotationPolicy: RotationPolicyCreateSchema.optional().describe(
            "Optional rotation policy.",
        ),
    })
    .describe("Payload for creating a key chain.")
    .strict();

export const EcJwkSchema = z
    .object({
        kty: z.string().describe("Key type (for example EC)."),
        x: z.string().describe("Elliptic curve public x coordinate."),
        y: z.string().describe("Elliptic curve public y coordinate."),
        crv: z.string().describe("Elliptic curve name."),
        d: z.string().describe("Private key value."),
        alg: z.string().optional().describe("Optional algorithm hint."),
        kid: z.string().optional().describe("Optional key identifier."),
    })
    .describe("EC private key in JWK format.")
    .strict();

export const RotationPolicyImportSchema = z
    .object({
        enabled: z
            .boolean()
            .describe("Enable automatic rotation for imported key chains."),
        intervalDays: z
            .number()
            .min(1)
            .max(3650)
            .optional()
            .describe("Rotation interval in days."),
        certValidityDays: z
            .number()
            .min(1)
            .max(3650)
            .optional()
            .describe("Certificate validity period in days."),
    })
    .describe("Rotation policy used when importing key chains.")
    .strict();

export const KeyChainImportSchema = z
    .object({
        id: z
            .string()
            .optional()
            .describe("Optional key chain id. If omitted, one is generated."),
        key: EcJwkSchema.describe("Private key material in JWK format."),
        description: z
            .string()
            .optional()
            .describe("Optional key chain description."),
        usageType: z
            .enum(KeyUsageType)
            .describe("Key usage category for the imported key chain."),
        crt: z
            .array(z.string())
            .optional()
            .describe(
                "Optional certificate chain values in PEM or base64 DER.",
            ),
        kmsProvider: z
            .string()
            .optional()
            .describe("Optional KMS provider id."),
        rotationPolicy: RotationPolicyImportSchema.optional().describe(
            "Optional rotation policy for imported key chains.",
        ),
    })
    .describe("Payload for importing key chains from JSON configuration.")
    .strict();

export const RotationPolicyUpdateSchema = z
    .object({
        enabled: z
            .boolean()
            .optional()
            .describe("Optional replacement for rotation enabled flag."),
        intervalDays: z
            .number()
            .min(1)
            .max(3650)
            .optional()
            .describe("Optional replacement for rotation interval in days."),
        certValidityDays: z
            .number()
            .min(1)
            .max(3650)
            .optional()
            .describe(
                "Optional replacement for certificate validity period in days.",
            ),
    })
    .describe("Payload fragment for updating key chain rotation policy.")
    .strict();

export const KeyChainUpdateSchema = z
    .object({
        description: z
            .string()
            .optional()
            .describe("Optional replacement description."),
        rotationPolicy: RotationPolicyUpdateSchema.optional().describe(
            "Optional rotation policy updates.",
        ),
        activeCertificate: z
            .string()
            .optional()
            .describe("Optional active certificate override."),
    })
    .describe("Payload for updating key chain metadata and rotation settings.")
    .strict();
