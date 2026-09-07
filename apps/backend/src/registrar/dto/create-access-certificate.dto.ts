import { createZodDto } from "nestjs-zod";
import { CreateAccessCertificateSchema } from "../schemas/registrar.schema.js";

/**
 * DTO for requesting an access certificate for a specific key.
 */
export class CreateAccessCertificateDto extends createZodDto(
    CreateAccessCertificateSchema,
) {}
