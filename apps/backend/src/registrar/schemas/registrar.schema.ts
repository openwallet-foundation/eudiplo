import { z } from "zod";

const RegistrationCertificateDefaultsSchema = z
    .record(z.string(), z.unknown())
    .nullable()
    .optional()
    .describe(
        "Optional default values used when generating registration certificates.",
    );

export const CreateRegistrarConfigSchema = z
    .object({
        registrarUrl: z.url().describe("Base URL of the registrar service."),
        oidcUrl: z
            .url()
            .describe("OIDC discovery or issuer URL used for authentication."),
        clientId: z
            .string()
            .min(1)
            .describe("OAuth client ID used against the registrar."),
        clientSecret: z
            .string()
            .min(1)
            .optional()
            .describe(
                "Optional OAuth client secret for registrar authentication.",
            ),
        username: z
            .string()
            .min(1)
            .describe("Username used for registrar authentication."),
        password: z
            .string()
            .min(1)
            .describe("Password used for registrar authentication."),
        registrationCertificateDefaults:
            RegistrationCertificateDefaultsSchema.describe(
                "Optional default registration certificate values.",
            ),
    })
    .describe("Payload for creating registrar integration settings.")
    .strict();

export const UpdateRegistrarConfigSchema = CreateRegistrarConfigSchema.partial()
    .describe("Payload for partially updating registrar integration settings.")
    .strict();

export const CreateAccessCertificateSchema = z
    .object({
        keyId: z
            .string()
            .min(1)
            .describe("Key chain id used to issue the access certificate."),
    })
    .describe("Payload for creating an access certificate.")
    .strict();

export type CreateRegistrarConfig = z.infer<typeof CreateRegistrarConfigSchema>;
export type UpdateRegistrarConfig = z.infer<typeof UpdateRegistrarConfigSchema>;
export type CreateAccessCertificate = z.infer<
    typeof CreateAccessCertificateSchema
>;
