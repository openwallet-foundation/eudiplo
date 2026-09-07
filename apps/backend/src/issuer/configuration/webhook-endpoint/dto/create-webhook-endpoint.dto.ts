import { createZodDto } from "nestjs-zod";
import { CreateWebhookEndpointSchema } from "../schemas/webhook-endpoint.schema.js";

export class CreateWebhookEndpointDto extends createZodDto(
    CreateWebhookEndpointSchema,
) {}
