import * as Joi from "joi";

/**
 * Module for managing user sessions.
 */

export const SESSION_VALIDATION_SCHEMA = Joi.object({
    SESSION_TIDY_UP_INTERVAL: Joi.number()
        .default(60 * 60)
        .description("Interval in seconds to run session tidy up")
        .meta({ group: "session", order: 10 }),
    SESSION_TTL: Joi.number()
        .default(24 * 60 * 60)
        .description(
            "Default time to live for sessions in seconds. Can be overridden per tenant.",
        )
        .meta({ group: "session", order: 20 }),
    SESSION_CLEANUP_MODE: Joi.string()
        .valid("full", "anonymize")
        .default("full")
        .description(
            "Default cleanup mode when sessions expire. 'full' deletes the entire session, 'anonymize' keeps metadata but removes personal data. Can be overridden per tenant.",
        )
        .meta({ group: "session", order: 30 }),
    SESSION_RESULT_CODE_TTL: Joi.number()
        .default(300)
        .description(
            "Time to live in seconds for RP-facing OID4VP response_code values.",
        )
        .meta({ group: "session", order: 40 }),
});
