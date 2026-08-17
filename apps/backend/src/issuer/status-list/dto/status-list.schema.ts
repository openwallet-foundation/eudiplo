import { z } from "zod";

export const StatusListImportSchema = z
    .object({
        id: z.string().min(1).describe("Status list identifier."),
        credentialConfigurationId: z
            .string()
            .min(1)
            .nullable()
            .optional()
            .describe(
                "Optional credential configuration binding. Null means shared list.",
            ),
        keyChainId: z
            .string()
            .min(1)
            .optional()
            .describe("Optional key chain used for signing this status list."),
        capacity: z.coerce
            .number()
            .int()
            .min(100)
            .optional()
            .describe("Optional list capacity override."),
        bits: z
            .union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)])
            .optional()
            .describe("Optional bits-per-status override."),
    })
    .describe("Payload for importing status lists from JSON config files.")
    .strict();

export const CreateStatusListSchema = z
    .object({
        credentialConfigurationId: z
            .string()
            .min(1)
            .optional()
            .describe("Optional credential configuration binding."),
        keyChainId: z
            .string()
            .min(1)
            .optional()
            .describe("Optional key chain to sign the list with."),
        bits: z
            .union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)])
            .optional()
            .describe("Optional bits-per-status value."),
        capacity: z.coerce
            .number()
            .int()
            .min(1000)
            .optional()
            .describe("Optional status list capacity."),
    })
    .describe("Payload for creating a status list.")
    .strict();

export const UpdateStatusListConfigSchema = z
    .object({
        capacity: z.coerce
            .number()
            .int()
            .min(100)
            .nullable()
            .optional()
            .describe("Capacity override. Set null to reset to defaults."),
        bits: z
            .union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)])
            .nullable()
            .optional()
            .describe(
                "Bits-per-status override. Set null to reset to defaults.",
            ),
        ttl: z.coerce
            .number()
            .int()
            .min(60)
            .nullable()
            .optional()
            .describe("JWT TTL override in seconds. Set null to reset."),
        immediateUpdate: z
            .boolean()
            .nullable()
            .optional()
            .describe("Immediate regeneration toggle. Set null to reset."),
        enableAggregation: z
            .boolean()
            .nullable()
            .optional()
            .describe("Aggregation URI toggle. Set null to reset."),
    })
    .describe("Payload for updating tenant status list configuration defaults.")
    .strict();

export const UpdateStatusListSchema = z
    .object({
        credentialConfigurationId: z
            .string()
            .min(1)
            .nullable()
            .optional()
            .describe(
                "Updated credential configuration binding. Null means shared list.",
            ),
        keyChainId: z
            .string()
            .min(1)
            .nullable()
            .optional()
            .describe("Updated key chain id. Null means use tenant default."),
    })
    .describe("Payload for updating status list bindings.")
    .strict();
