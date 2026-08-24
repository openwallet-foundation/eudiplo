import * as Joi from "joi";

/**
 * Validation schema for built-in TLS/HTTPS termination.
 * Read directly from process.env in main.ts before the Nest/ConfigModule
 * bootstraps, but declared here so it is validated and documented alongside
 * the rest of the configuration.
 */
export const TLS_VALIDATION_SCHEMA = Joi.object({
    TLS_ENABLED: Joi.boolean()
        .default(false)
        .description("Enable built-in TLS termination (serve HTTPS directly)")
        .meta({ group: "tls", order: 10 }),
    TLS_CERT_PATH: Joi.string()
        .optional()
        .allow("")
        .description("Path to the TLS certificate file (PEM format)")
        .meta({ group: "tls", order: 20 }),
    TLS_KEY_PATH: Joi.string()
        .optional()
        .allow("")
        .description("Path to the TLS private key file (PEM format)")
        .meta({ group: "tls", order: 30 }),
    TLS_CA_PATH: Joi.string()
        .optional()
        .allow("")
        .description(
            "Path to CA certificate chain for client verification (PEM format)",
        )
        .meta({ group: "tls", order: 40 }),
    TLS_KEY_PASSPHRASE: Joi.string()
        .optional()
        .allow("")
        .description("Passphrase for an encrypted TLS_KEY_PATH private key")
        .meta({ group: "tls", order: 50, secret: true }),
});
