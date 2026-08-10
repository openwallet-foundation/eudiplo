import { ApiProperty } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const ResolveSchemaMetadataSchema = z
    .object({
        schemaMetadataUrl: z.url(),
    })
    .strict();

export class ResolveSchemaMetadataDto extends createZodDto(
    ResolveSchemaMetadataSchema,
) {
    @ApiProperty({
        description:
            "Schema metadata URL to resolve server-side. The response must contain a signedJwt field.",
        example:
            "https://registrar.example.com/schema-metadata/5c0d7dbb-ef2e-448b-b84f-b8103575947b",
    })
    schemaMetadataUrl!: string;
}
