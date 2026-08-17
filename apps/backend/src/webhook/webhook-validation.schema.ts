import * as Joi from "joi";

/**
 * Validation schema for outbound webhook configuration
 */
export const WEBHOOK_VALIDATION_SCHEMA = Joi.object({
    OUTBOUND_URL_ALLOW_HTTP: Joi.boolean()
        .optional()
        .description("Allow HTTP (non-TLS) for outbound webhook calls")
        .meta({ group: "webhook", order: 10 }),
    OUTBOUND_URL_ALLOW_PRIVATE_NETWORK: Joi.boolean()
        .optional()
        .description(
            "Allow outbound webhook calls to private, loopback, or link-local IP ranges",
        )
        .meta({ group: "webhook", order: 20 }),
    OUTBOUND_URL_ALLOWED_HOSTS: Joi.string()
        .allow("")
        .optional()
        .description(
            "Comma-separated hostname allowlist for outbound webhook calls (supports exact host and subdomains)",
        )
        .meta({ group: "webhook", order: 30 }),
});
