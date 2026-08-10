import { ApiProperty } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const VctSchema = z
    .object({
        vct: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        extends: z.string().optional(),
        "extends#integrity": z.string().optional(),
        schema_uri: z.string().optional(),
        "schema_uri#integrity": z.string().optional(),
    })
    .strict();

export class VCT extends createZodDto(VctSchema) {
    @ApiProperty({
        required: false,
    })
    vct?: string;
    name?: string;
    description?: string;
    extends?: string;
    "extends#integrity"?: string;
    schema_uri?: string;
    "schema_uri#integrity"?: string;
}
