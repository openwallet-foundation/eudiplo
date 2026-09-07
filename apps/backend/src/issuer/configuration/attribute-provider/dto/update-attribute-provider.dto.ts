import { createZodDto } from "nestjs-zod";
import { UpdateAttributeProviderSchema } from "../schemas/attribute-provider.schema.js";

export class UpdateAttributeProviderDto extends createZodDto(
    UpdateAttributeProviderSchema,
) {}
