import { resolve } from "node:path";
import * as Joi from "joi";

/**
 * Validation schema for configuration
 */
export const CONFIG_VALIDATION_SCHEMA = Joi.object({
    CONFIG_IMPORT_MODE: Joi.string()
        .valid("disabled", "create", "upsert", "replace")
        .description(
            "Startup configuration reconciliation mode. Replaces CONFIG_IMPORT and CONFIG_IMPORT_FORCE.",
        )
        .meta({ group: "config", order: 10 }),

    CONFIG_IMPORT: Joi.boolean()
        .default(false)
        .description(
            "Deprecated: enable startup config import when CONFIG_IMPORT_MODE is unset",
        )
        .meta({ group: "config", order: 20 }),

    CONFIG_IMPORT_FORCE: Joi.boolean()
        .default(false)
        .description(
            "Deprecated: select upsert instead of create when CONFIG_IMPORT_MODE is unset",
        )
        .meta({ group: "config", order: 30 }),

    CONFIG_FOLDER: Joi.string()
        .default(resolve(__dirname + "/../../../../assets/config"))
        .description("Path to config import folder")
        .meta({ group: "config", order: 40 }),
    CONFIG_VARIABLE_STRICT: Joi.alternatives()
        .try(Joi.string().valid("abort", "skip", "ignore"), Joi.boolean())
        .default("skip")
        .description("Strict mode for config import.")
        .meta({ group: "config", order: 50 }),
});
