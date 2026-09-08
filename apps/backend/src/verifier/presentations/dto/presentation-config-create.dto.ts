import { ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { PresentationConfigCreateSchema } from "../schemas/presentation-config.schema.js";

export class PresentationConfigCreateDto extends createZodDto(
    PresentationConfigCreateSchema,
) {
    @ApiPropertyOptional({
        type: String,
        nullable: true,
        description: "Optional presentation configuration description.",
    })
    declare description?: string | null;
}
