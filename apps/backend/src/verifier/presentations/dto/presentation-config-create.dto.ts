import { createZodDto } from "nestjs-zod";
import { PresentationConfigCreateSchema } from "../schemas/presentation-config.schema";

export class PresentationConfigCreateDto extends createZodDto(
    PresentationConfigCreateSchema,
) {}
