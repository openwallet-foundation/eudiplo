import * as Joi from "joi";

/**
 * Validation schema for logging configuration
 */
export const LOG_VALIDATION_SCHEMA = Joi.object({
    LOG_LEVEL: Joi.string()
        .valid("trace", "debug", "info", "warn", "error", "fatal")
        .default(process.env.NODE_ENV === "production" ? "warn" : "debug")
        .description("Application log level")
        .meta({ group: "log", order: 10 }),
    LOG_ENABLE_HTTP_LOGGER: Joi.boolean()
        .default(false)
        .description("Enable HTTP request logging")
        .meta({ group: "log", order: 20 }),
    LOG_ENABLE_SESSION_LOGGER: Joi.boolean()
        .default(false)
        .description("Enable session flow logging")
        .meta({ group: "log", order: 30 }),
    LOG_SESSION_STORE: Joi.string()
        .valid("off", "errors", "all", "verbose")
        .default("off")
        .description(
            "Controls whether session log entries are persisted to the database. " +
                "'off' disables storage, 'errors' stores only warn/error entries, " +
                "'all' stores everything, 'verbose' stores everything including full request/response bodies and error stacks.",
        )
        .meta({ group: "log", order: 35 }),
    LOG_TO_FILE: Joi.boolean()
        .default(false)
        .description("Enable logging to file in addition to console")
        .meta({ group: "log", order: 60 }),
    LOG_FILE_PATH: Joi.string()
        .default("./logs/session.log")
        .description("File path for log output when LOG_TO_FILE is enabled")
        .meta({ group: "log", order: 70 }),
});
