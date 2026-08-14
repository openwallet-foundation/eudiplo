import { ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const SessionResultQuerySchema = z
    .object({
        response_code: z.string().min(1).optional(),
    })
    .strict();

export class SessionResultQueryDto extends createZodDto(
    SessionResultQuerySchema,
) {
    @ApiPropertyOptional({
        description:
            "Opaque response code received via redirect_uri in same-device flows",
    })
    response_code?: string;
}
