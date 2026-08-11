import { createZodDto } from "nestjs-zod";
import { PresentationConfigUpdateSchema } from "../schemas/presentation-config.schema";

export class PresentationConfigUpdateDto extends createZodDto(
    PresentationConfigUpdateSchema,
) {}
