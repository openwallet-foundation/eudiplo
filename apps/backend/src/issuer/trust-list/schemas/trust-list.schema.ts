import { z } from "zod";

const TrustListEntityInfoSchema = z
    .object({
        name: z.string().min(1).describe("Display name of the trusted entity."),
        lang: z
            .string()
            .optional()
            .describe("Optional language tag for entity info."),
        locale: z.string().optional().describe("Optional locale identifier."),
        uri: z.string().optional().describe("Optional entity URI."),
        country: z
            .string()
            .optional()
            .describe("Optional country name or code."),
        locality: z.string().optional().describe("Optional locality or city."),
        postalCode: z.string().optional().describe("Optional postal code."),
        streetAddress: z
            .string()
            .optional()
            .describe("Optional street address."),
        contactUri: z
            .string()
            .optional()
            .describe("Optional contact URI for the entity."),
    })
    .describe("Human-readable metadata for a trust list entity.")
    .strict();

const InternalTrustListEntitySchema = z
    .object({
        type: z
            .literal("internal")
            .describe("Use locally managed key chains for trust material."),
        issuerKeyChainId: z
            .string()
            .min(1)
            .describe("Key chain id for issuer certificate material."),
        revocationKeyChainId: z
            .string()
            .min(1)
            .describe(
                "Key chain id for revocation/status list certificate material.",
            ),
        info: TrustListEntityInfoSchema.describe("Entity metadata."),
    })
    .describe("Trust list entity referencing internal key chains.")
    .strict();

const ExternalTrustListEntitySchema = z
    .object({
        type: z
            .literal("external")
            .describe("Provide external PEM certificates directly."),
        issuerCertPem: z
            .string()
            .min(1)
            .describe("Issuer certificate in PEM format."),
        revocationCertPem: z
            .string()
            .min(1)
            .describe("Revocation/status certificate in PEM format."),
        info: TrustListEntityInfoSchema.describe("Entity metadata."),
    })
    .describe("Trust list entity using externally supplied PEM certificates.")
    .strict();

export const TrustListCreateSchema = z
    .object({
        id: z
            .string()
            .min(1)
            .optional()
            .describe(
                "Optional trust list id. If omitted, one may be generated.",
            ),
        description: z
            .string()
            .optional()
            .describe("Optional trust list description."),
        keyChainId: z
            .string()
            .min(1)
            .optional()
            .describe(
                "Optional key chain id used to sign trust list payloads.",
            ),
        entities: z
            .array(
                z.discriminatedUnion("type", [
                    InternalTrustListEntitySchema,
                    ExternalTrustListEntitySchema,
                ]),
            )
            .min(1)
            .describe("One or more entities included in this trust list."),
        data: z
            .record(z.string(), z.unknown())
            .optional()
            .describe("Optional additional custom payload data."),
    })
    .describe("Payload for creating a trust list configuration.")
    .strict();
