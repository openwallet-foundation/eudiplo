import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TokenResponse {
    @ApiProperty({ description: "Bearer access token" })
    access_token!: string;

    @ApiPropertyOptional({ description: "Optional refresh token" })
    refresh_token?: string;

    @ApiProperty({ description: "Token type" })
    token_type!: "Bearer";

    @ApiProperty({ description: "Access token lifetime in seconds" })
    expires_in!: number;

    @ApiProperty({ description: "Opaque state value echoed from the request" })
    state!: string;
}
