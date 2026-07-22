import * as Joi from "joi";

export const ISSUER_VALIDATION_SCHEMA = Joi.object({
    ISSUER_MULTI_CONSUMPTION: Joi.boolean()
        .default(false)
        .description("Enable or disable multi-consumption for the issuer")
        .meta({ group: "issuer", order: 10 }),
});
