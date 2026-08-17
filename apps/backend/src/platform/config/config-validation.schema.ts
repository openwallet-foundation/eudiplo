import { resolve } from "node:path";
import * as Joi from "joi";

/**
 * Validation schema for configuration
 */
export const CONFIG_VALIDATION_SCHEMA = Joi.object({
    CONFIG_IMPORT: Joi.boolean()
        .default(false)
        .description("Run one-off config import on startup")
        .meta({ group: "config", order: 10 }),

    CONFIG_IMPORT_FORCE: Joi.boolean()
        .default(false)
        .description("Force overwrite on config import")
        .meta({ group: "config", order: 20 }),

    CONFIG_FOLDER: Joi.string()
        .default(resolve(__dirname + "/../../../../../assets/config"))
        .description("Path to config import folder")
        .meta({ group: "config", order: 30 }),
    CONFIG_VARIABLE_STRICT: Joi.alternatives()
        .try(Joi.string().valid("abort", "skip", "ignore"), Joi.boolean())
        .default("skip")
        .description("Strict mode for config import.")
        .meta({ group: "config", order: 40 }),
});
