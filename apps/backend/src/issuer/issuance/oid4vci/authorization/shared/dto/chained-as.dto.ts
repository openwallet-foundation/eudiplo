import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsOptional, IsString } from "class-validator";

/**
 * Pushed Authorization Request (PAR) body for Chained AS.
 */
export class ChainedAsParRequestDto {
    @ApiProperty({
        description: "OAuth response type (must be 'code')",
        example: "code",
    })
    @IsString()
    response_type!: string;

    @ApiProperty({
        description: "Client identifier (wallet identifier)",
        example: "https://wallet.example.com",
    })
    @IsString()
    client_id!: string;

    @ApiProperty({
        description: "URI to redirect the wallet after authorization",
        example: "https://wallet.example.com/callback",
    })
    @IsString()
    redirect_uri!: string;

    @ApiPropertyOptional({
        description: "PKCE code challenge",
    })
    @IsString()
    @IsOptional()
    code_challenge?: string;

    @ApiPropertyOptional({
        description: "PKCE code challenge method (e.g., S256)",
        example: "S256",
    })
    @IsString()
    @IsOptional()
    code_challenge_method?: string;

    @ApiPropertyOptional({
        description: "State parameter (returned in redirect)",
    })
    @IsString()
    @IsOptional()
    state?: string;

    @ApiPropertyOptional({
        description: "Scope requested",
        example: "openid credential",
    })
    @IsString()
    @IsOptional()
    scope?: string;

    @ApiPropertyOptional({
        description: "Issuer state from credential offer",
    })
    @IsString()
    @IsOptional()
    issuer_state?: string;

    @ApiPropertyOptional({
        description: "Authorization details (JSON array)",
    })
    @Transform(({ value }) => {
        if (typeof value === "string") {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        return value;
    })
    @IsArray()
    @IsOptional()
    authorization_details?: Record<string, unknown>[];
}

/**
 * Response from PAR endpoint.
 */
export class ChainedAsParResponseDto {
    @ApiProperty({
        description: "The request URI to use at the authorization endpoint",
        example: "urn:ietf:params:oauth:request_uri:abc123",
    })
    request_uri!: string;

    @ApiProperty({
        description: "The lifetime of the request URI in seconds",
        example: 600,
    })
    expires_in!: number;
}

/**
 * Query parameters for the authorize endpoint.
 */
export class ChainedAsAuthorizeQueryDto {
    @ApiProperty({
        description: "Client identifier",
    })
    @IsString()
    client_id!: string;

    @ApiProperty({
        description: "Request URI from PAR response",
        example: "urn:ietf:params:oauth:request_uri:abc123",
    })
    @IsString()
    request_uri!: string;
}

/**
 * Token request body for Chained AS.
 */
export class ChainedAsTokenRequestDto {
    @ApiProperty({
        description: "Grant type ('authorization_code' or 'refresh_token')",
        example: "authorization_code",
    })
    @IsString()
    grant_type!: string;

    @ApiPropertyOptional({
        description:
            "Authorization code received in the callback (authorization_code grant)",
    })
    @IsString()
    @IsOptional()
    code?: string;

    @ApiPropertyOptional({
        description: "Refresh token (refresh_token grant)",
    })
    @IsString()
    @IsOptional()
    refresh_token?: string;

    @ApiPropertyOptional({
        description: "Client identifier",
    })
    @IsString()
    @IsOptional()
    client_id?: string;

    @ApiPropertyOptional({
        description: "Redirect URI (must match the one used in PAR)",
    })
    @IsString()
    @IsOptional()
    redirect_uri?: string;

    @ApiPropertyOptional({
        description: "PKCE code verifier",
    })
    @IsString()
    @IsOptional()
    code_verifier?: string;
}

/**
 * Token response from Chained AS.
 */
export class ChainedAsTokenResponseDto {
    @ApiProperty({
        description: "The access token",
    })
    access_token!: string;

    @ApiProperty({
        description: "Token type (Bearer or DPoP)",
        example: "DPoP",
    })
    token_type!: string;

    @ApiProperty({
        description: "Token lifetime in seconds",
        example: 3600,
    })
    expires_in!: number;

    @ApiPropertyOptional({
        description: "Scope granted",
    })
    scope?: string;

    @ApiPropertyOptional({
        description: "Authorized credential configurations",
    })
    authorization_details?: Record<string, unknown>[];

    @ApiPropertyOptional({
        description: "C_NONCE for credential request",
    })
    c_nonce?: string;

    @ApiPropertyOptional({
        description: "C_NONCE lifetime in seconds",
    })
    c_nonce_expires_in?: number;

    @ApiPropertyOptional({
        description: "Refresh token (issued when refresh tokens are enabled)",
    })
    refresh_token?: string;
}

/**
 * OAuth error response.
 */
export class ChainedAsErrorResponseDto {
    @ApiProperty({
        description: "Error code",
        example: "invalid_request",
    })
    error!: string;

    @ApiPropertyOptional({
        description: "Human-readable error description",
    })
    error_description?: string;
}
