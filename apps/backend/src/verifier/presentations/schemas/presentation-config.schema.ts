import { z } from "zod";
import { RegistrationCertificateRequestSchema } from "../dto/vp-request.dto";

const TrustListRefSchema = z
    .object({
        trustListId: z
            .string()
            .optional()
            .describe("Optional trust list id reference."),
        url: z.url().optional().describe("Optional trust list URL reference."),
        verifierKey: z
            .record(z.string(), z.unknown())
            .optional()
            .describe("Optional verifier key material."),
        verifierX509Der: z
            .string()
            .optional()
            .describe("Optional verifier certificate in DER/base64 form."),
    })
    .describe("Reference to a trust list used for authority verification.")
    .strict();

const TrustedAuthorityQueryEtsiTlSchema = z
    .object({
        type: z
            .literal("etsi_tl")
            .describe(
                "Trusted authority type discriminator for ETSI trust lists.",
            ),
        values: z
            .array(TrustListRefSchema)
            .describe("Trust list references for ETSI TL verification."),
    })
    .describe("ETSI trusted authority query.")
    .strict();

const TrustedAuthorityQueryOpenIdFederationSchema = z
    .object({
        type: z
            .literal("openid_federation")
            .describe(
                "Trusted authority type discriminator for OpenID Federation.",
            ),
        values: z
            .array(z.string())
            .describe("OpenID Federation authority identifiers."),
    })
    .describe("OpenID Federation trusted authority query.")
    .strict();

const ClaimsQuerySchema = z
    .object({
        id: z.string().optional().describe("Optional claim query id."),
        path: z
            .array(z.union([z.string(), z.number()]))
            .describe("Path to the claim value in presented credentials."),
        values: z
            .array(z.string())
            .optional()
            .describe("Optional allowed values for the claim."),
    })
    .describe("Claim query constraint.")
    .strict();

const MsoMdocClaimsQuerySchema = ClaimsQuerySchema.extend({
    intent_to_retain: z
        .boolean()
        .optional()
        .describe("Whether relying party intends to retain the claim."),
}).strict();

const CredentialQueryBaseSchema = z
    .object({
        id: z.string().describe("Credential query identifier."),
        multiple: z
            .boolean()
            .optional()
            .describe("Allow multiple matching credentials."),
        claim_sets: z
            .array(z.array(z.string()))
            .optional()
            .describe("Optional claim set constraints."),
        trusted_authorities: z
            .array(
                z.discriminatedUnion("type", [
                    TrustedAuthorityQueryEtsiTlSchema,
                    TrustedAuthorityQueryOpenIdFederationSchema,
                ]),
            )
            .optional()
            .describe("Optional trusted authority constraints."),
    })
    .describe("Base credential query structure.")
    .strict();

const CredentialQueryDcSdJwtSchema = CredentialQueryBaseSchema.extend({
    format: z.literal("dc+sd-jwt").describe("Credential format discriminator."),
    meta: z
        .object({
            vct_values: z
                .array(z.string())
                .min(1)
                .describe("Accepted VCT values."),
        })
        .describe("Format-specific metadata for dc+sd-jwt queries.")
        .strict(),
    claims: z
        .array(ClaimsQuerySchema)
        .optional()
        .describe("Optional claim-level constraints."),
}).strict();

const CredentialQueryMsoMdocSchema = CredentialQueryBaseSchema.extend({
    format: z.literal("mso_mdoc").describe("Credential format discriminator."),
    meta: z
        .object({
            doctype_value: z
                .string()
                .min(1)
                .describe("Expected mDoc doctype value."),
        })
        .describe("Format-specific metadata for mso_mdoc queries.")
        .strict(),
    claims: z
        .array(MsoMdocClaimsQuerySchema)
        .optional()
        .describe("Optional mDoc claim-level constraints."),
}).strict();

const CredentialSetQuerySchema = z
    .object({
        options: z
            .array(z.array(z.string()).min(1))
            .min(1)
            .describe("Alternative credential query id combinations."),
        required: z
            .boolean()
            .optional()
            .describe("Whether this credential set is mandatory."),
    })
    .describe("Credential set query constraints.")
    .strict();

export const DCQLSchema = z
    .object({
        credentials: z
            .array(
                z.discriminatedUnion("format", [
                    CredentialQueryDcSdJwtSchema,
                    CredentialQueryMsoMdocSchema,
                ]),
            )
            .min(1)
            .describe("Credential queries requested by the verifier."),
        credential_sets: z
            .array(CredentialSetQuerySchema)
            .optional()
            .describe("Optional higher-level credential set requirements."),
    })
    .describe("Digital Credential Query Language payload.")
    .strict();

export const TransactionDataSchema = z
    .object({
        type: z.string().describe("Transaction data type identifier."),
        credential_ids: z
            .array(z.string())
            .describe("Credential query ids this transaction data applies to."),
    })
    .describe("Transaction data request descriptor.")
    .catchall(z.unknown());

const PresentationAttachmentSchema = z
    .object({
        format: z.string().describe("Attachment format identifier."),
        data: z.unknown().describe("Attachment payload."),
        credential_ids: z
            .array(z.string())
            .optional()
            .describe(
                "Optional credential query ids bound to this attachment.",
            ),
    })
    .describe("Additional presentation attachment.")
    .strict();

export const PresentationConfigCreateSchema = z
    .object({
        id: z
            .string()
            .min(1)
            .describe("Presentation configuration identifier."),
        description: z
            .string()
            .nullable()
            .optional()
            .describe("Optional presentation configuration description."),
        lifeTime: z.coerce
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Presentation request lifetime in seconds."),
        skewSeconds: z.coerce
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Clock skew tolerance in seconds."),
        statusCheckMode: z
            .enum(["strict", "best_effort", "disabled"])
            .optional()
            .describe("Revocation/status check mode."),
        dcql_query: DCQLSchema.describe(
            "DCQL query defining requested credentials and claims.",
        ),
        transaction_data: z
            .array(TransactionDataSchema)
            .optional()
            .describe("Optional transaction data descriptors."),
        registration_cert: RegistrationCertificateRequestSchema.nullable()
            .optional()
            .describe("Optional registration certificate request settings."),
        webhookEndpointId: z
            .string()
            .nullable()
            .optional()
            .describe(
                "Optional webhook endpoint id for presentation callbacks.",
            ),
        attached: z
            .array(PresentationAttachmentSchema)
            .nullable()
            .optional()
            .describe(
                "Optional attachments included with presentation requests.",
            ),
        redirectUri: z
            .string()
            .nullable()
            .optional()
            .describe("Optional redirect URI after presentation completion."),
        accessKeyChainId: z
            .string()
            .nullable()
            .optional()
            .describe(
                "Optional key chain id for access token/auth operations.",
            ),
        readerAuth: z
            .boolean()
            .nullable()
            .optional()
            .describe(
                "Whether reader authentication is required for mDoc requests.",
            ),
    })
    .describe("Payload for creating presentation verifier configuration.")
    .strict();
