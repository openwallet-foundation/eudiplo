import { createZodDto } from "nestjs-zod";
import { UpdateRegistrarConfigSchema } from "../schemas/registrar.schema.js";

/**
 * DTO for updating a registrar configuration.
 * All fields are optional.
 */
export class UpdateRegistrarConfigDto extends createZodDto(
    UpdateRegistrarConfigSchema,
) {}
