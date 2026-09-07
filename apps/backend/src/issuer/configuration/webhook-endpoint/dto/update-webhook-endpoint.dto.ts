import { createZodDto } from "nestjs-zod";
import { UpdateWebhookEndpointSchema } from "../schemas/webhook-endpoint.schema.js";

export class UpdateWebhookEndpointDto extends createZodDto(
    UpdateWebhookEndpointSchema,
) {}
