import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const StatusUpdateSchema = z
    .object({
        sessionId: z
            .string()
            .min(1)
            .describe(
                "Session identifier used to locate credentials for status updates.",
            ),
        credentialConfigurationId: z
            .string()
            .min(1)
            .optional()
            .describe(
                "Optional credential configuration id. If omitted, all credentials linked to the session are updated.",
            ),
        status: z
            .number()
            .int()
            .min(0)
            .max(2)
            .describe(
                "New credential status: 0 = valid, 1 = revoked, 2 = suspended.",
            ),
    })
    .describe(
        "Request payload for updating credential status entries by session.",
    )
    .strict();

export class StatusUpdateDto extends createZodDto(StatusUpdateSchema) {}
