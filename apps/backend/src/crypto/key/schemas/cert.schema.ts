import { z } from "zod";

export const CertImportSchema = z
    .object({
        id: z
            .string()
            .min(1)
            .optional()
            .describe(
                "Optional certificate id. If omitted, one may be generated.",
            ),
        keyId: z
            .string()
            .min(1)
            .optional()
            .describe(
                "Optional key chain id associated with this certificate chain.",
            ),
        description: z
            .string()
            .optional()
            .describe("Optional certificate description."),
        crt: z
            .array(z.string().min(1))
            .min(1)
            .describe(
                "Certificate chain entries, typically PEM-encoded certificates.",
            ),
    })
    .describe("Payload for importing certificate chains.")
    .strict();
