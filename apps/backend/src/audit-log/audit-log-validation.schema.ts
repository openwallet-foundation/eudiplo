import Joi from "joi";

export const AUDIT_LOG_VALIDATION_SCHEMA = Joi.object({
    AUDIT_LOG_RETENTION_DAYS: Joi.number()
        .integer()
        .min(0)
        .default(0)
        .description(
            "Delete tenant activity audit log entries older than N days. Set to 0 to disable time-based pruning.",
        )
        .meta({ group: "log", order: 80 }),
    AUDIT_LOG_MAX_ENTRIES_PER_TENANT: Joi.number()
        .integer()
        .min(0)
        .default(0)
        .description(
            "Keep only the newest N tenant activity audit log entries per tenant. Set to 0 to disable count-based pruning.",
        )
        .meta({ group: "log", order: 90 }),
});
