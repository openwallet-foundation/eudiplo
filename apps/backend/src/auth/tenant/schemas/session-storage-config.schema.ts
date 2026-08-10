import { z } from "zod";

const SessionCleanupModeSchema = z
    .enum(["full", "anonymize"])
    .describe("Cleanup strategy for expired sessions.");

export const SessionStorageConfigSchema = z
    .strictObject({
        ttlSeconds: z.coerce
            .number()
            .int()
            .min(60)
            .optional()
            .describe("Session time-to-live in seconds."),
        cleanupMode: SessionCleanupModeSchema.optional().describe(
            "Whether to fully delete or anonymize expired sessions.",
        ),
    })
    .describe("Tenant session storage configuration.");
