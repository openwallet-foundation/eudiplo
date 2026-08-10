import { createZodDto } from "nestjs-zod";
import { CreateWebhookEndpointSchema } from "../schemas/webhook-endpoint.schema";

export class CreateWebhookEndpointDto extends createZodDto(
    CreateWebhookEndpointSchema,
) {}
