import { createZodDto } from "nestjs-zod";
import { CreateRegistrarConfigSchema } from "../schemas/registrar.schema";

/**
 * DTO for creating or importing a registrar configuration.
 * Excludes the tenant field as it will be set from the request context.
 */
export class CreateRegistrarConfigDto extends createZodDto(
    CreateRegistrarConfigSchema,
) {}
