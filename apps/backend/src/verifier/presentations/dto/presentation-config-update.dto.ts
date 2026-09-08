import { ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { PresentationConfigUpdateSchema } from "../schemas/presentation-config.schema.js";

export class PresentationConfigUpdateDto extends createZodDto(
    PresentationConfigUpdateSchema,
) {
    @ApiPropertyOptional({
        type: String,
        nullable: true,
        description: "Optional presentation configuration description.",
    })
    declare description?: string | null;
}
