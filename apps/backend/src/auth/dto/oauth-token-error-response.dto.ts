import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class OAuthTokenErrorResponseDto {
    @ApiProperty({ description: "OAuth2 error code" })
    error!: string;

    @ApiPropertyOptional({ description: "Human-readable error description" })
    error_description?: string;

    @ApiPropertyOptional({ description: "URI identifying the error" })
    error_uri?: string;
}
