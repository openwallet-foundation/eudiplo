import Joi from "joi";

export const CRYPTO_VALIDATION_SCHEMA = Joi.object({
    CRYPTO_ALG: Joi.string()
        .valid("ES256")
        .default("ES256")
        .description("The signing algorithm to use")
        .meta({ group: "crypto", order: 10 }),
    CRYPTO_TOLERANCE: Joi.number()
        .default(5)
        .description("Clock tolerance in seconds for JWT verification")
        .meta({ group: "crypto", order: 20 }),
});
