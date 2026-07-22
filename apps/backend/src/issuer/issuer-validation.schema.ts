import * as Joi from "joi";

export const ISSUER_VALIDATION_SCHEMA = Joi.object({
    PUBLIC_URL: Joi.string()
        .default("http://localhost:3000")
        .description("The public URL of the issuer")
        .meta({ group: "general", order: 10 }),

    OUTBOUND_URL_ALLOW_HTTP: Joi.boolean()
        .optional()
        .description("Allow HTTP (non-TLS) for outbound webhook calls")
        .meta({ group: "issuer", order: 20 }),

    OUTBOUND_URL_ALLOW_PRIVATE_NETWORK: Joi.boolean()
        .optional()
        .description(
            "Allow outbound webhook calls to private, loopback, or link-local IP ranges",
        )
        .meta({ group: "issuer", order: 30 }),

    OUTBOUND_URL_ALLOWED_HOSTS: Joi.string()
        .allow("")
        .optional()
        .description(
            "Comma-separated hostname allowlist for outbound webhook calls (supports exact host and subdomains)",
        )
        .meta({ group: "issuer", order: 40 }),
    ISSUER_MULTI_CONSUMPTION: Joi.boolean()
        .default(false)
        .description("Enable or disable multi-consumption for the issuer")
        .meta({ group: "issuer", order: 50 }),
});
