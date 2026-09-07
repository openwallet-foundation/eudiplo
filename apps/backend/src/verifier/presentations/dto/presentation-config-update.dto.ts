import { createZodDto } from "nestjs-zod";
import { PresentationConfigUpdateSchema } from "../schemas/presentation-config.schema.js";

export class PresentationConfigUpdateDto extends createZodDto(
    PresentationConfigUpdateSchema,
) {}
