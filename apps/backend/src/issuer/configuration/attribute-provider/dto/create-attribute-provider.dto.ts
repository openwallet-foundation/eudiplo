import { createZodDto } from "nestjs-zod";
import { CreateAttributeProviderSchema } from "../schemas/attribute-provider.schema";

export class CreateAttributeProviderDto extends createZodDto(
    CreateAttributeProviderSchema,
) {}
