import { NotificationEvent } from "@openid4vc/openid4vci";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const NotificationRequestSchema = z
    .object({
        notification_id: z.string(),
        event: z.enum([
            "credential_accepted",
            "credential_failure",
            "credential_deleted",
        ]),
    })
    .strict();

export class NotificationRequestDto extends createZodDto(
    NotificationRequestSchema,
) {
    notification_id!: string;

    event!: NotificationEvent;
}
