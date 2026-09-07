import { createZodDto } from "nestjs-zod";
import { CreateAttributeProviderSchema } from "../schemas/attribute-provider.schema.js";

export class CreateAttributeProviderDto extends createZodDto(
    CreateAttributeProviderSchema,
) {}
