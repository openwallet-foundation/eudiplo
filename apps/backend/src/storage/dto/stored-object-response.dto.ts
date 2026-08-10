import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StoredObjectResponseDto {
    @ApiProperty({ description: "Canonical storage key" })
    key!: string;

    @ApiPropertyOptional({ description: "ETag for the stored object" })
    etag?: string;

    @ApiPropertyOptional({ description: "Stored size in bytes" })
    size?: number;

    @ApiPropertyOptional({ description: "Public or presigned URL" })
    url?: string;

    @ApiPropertyOptional({ description: "MIME type of the stored object" })
    contentType?: string;

    @ApiPropertyOptional({
        description: "Object metadata",
        type: "object",
        additionalProperties: { type: "string" },
    })
    metadata?: Record<string, string>;
}
