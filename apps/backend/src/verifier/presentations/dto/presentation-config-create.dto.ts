import { createZodDto } from "nestjs-zod";
import { PresentationConfigCreateSchema } from "../schemas/presentation-config.schema.js";

export class PresentationConfigCreateDto extends createZodDto(
    PresentationConfigCreateSchema,
) {}
