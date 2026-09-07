import Joi from "joi";

/**
 * Validation schema for verifier / OID4VP configuration
 */
export const VERIFIER_VALIDATION_SCHEMA = Joi.object({
    VP_REMOVE_TA: Joi.boolean()
        .default(false)
        .description(
            "If true, strip trusted_authorities from the DCQL query sent to wallets in OID4VP authorization requests. Use this as an escape hatch for wallets that do not yet handle trusted_authorities correctly.",
        )
        .meta({ group: "verifier", order: 10 }),
});
