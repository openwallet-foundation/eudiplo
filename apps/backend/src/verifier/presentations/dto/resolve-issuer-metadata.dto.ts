import { ApiProperty } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const ResolveIssuerMetadataSchema = z
    .object({
        issuerUrl: z.url(),
    })
    .strict();

export class ResolveIssuerMetadataDto extends createZodDto(
    ResolveIssuerMetadataSchema,
) {
    @ApiProperty({
        description:
            "Issuer URL or full OpenID4VCI metadata URL to resolve server-side.",
        example: "https://issuer.example.com/issuers/tenant-a",
    })
    issuerUrl!: string;
}
