import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const authorizationDetailsSchema = z.preprocess(
    (value) => {
        if (typeof value === "string") {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        return value;
    },
    z.array(z.record(z.string(), z.unknown())),
);

const ChainedAsParRequestSchema = z
    .object({
        response_type: z.string(),
        client_id: z.string(),
        redirect_uri: z.string(),
        code_challenge: z.string().optional(),
        code_challenge_method: z.string().optional(),
        state: z.string().optional(),
        scope: z.string().optional(),
        issuer_state: z.string().optional(),
        authorization_details: authorizationDetailsSchema.optional(),
    })
    .strict();

const ChainedAsAuthorizeQuerySchema = z
    .object({
        client_id: z.string(),
        request_uri: z.string(),
        state: z.string().optional(),
    })
    .strict();

const ChainedAsTokenRequestSchema = z
    .object({
        grant_type: z.string(),
        code: z.string().optional(),
        refresh_token: z.string().optional(),
        client_id: z.string().optional(),
        redirect_uri: z.string().optional(),
        code_verifier: z.string().optional(),
    })
    .strict();

/**
 * Pushed Authorization Request (PAR) body for Chained AS.
 */
export class ChainedAsParRequestDto extends createZodDto(
    ChainedAsParRequestSchema,
) {
    @ApiProperty({
        description: "OAuth response type (must be 'code')",
        example: "code",
    })
    response_type!: string;

    @ApiProperty({
        description: "Client identifier (wallet identifier)",
        example: "https://wallet.example.com",
    })
    client_id!: string;

    @ApiProperty({
        description: "URI to redirect the wallet after authorization",
        example: "https://wallet.example.com/callback",
    })
    redirect_uri!: string;

    @ApiPropertyOptional({
        description: "PKCE code challenge",
    })
    code_challenge?: string;

    @ApiPropertyOptional({
        description: "PKCE code challenge method (e.g., S256)",
        example: "S256",
    })
    code_challenge_method?: string;

    @ApiPropertyOptional({
        description: "State parameter (returned in redirect)",
    })
    state?: string;

    @ApiPropertyOptional({
        description: "Scope requested",
        example: "openid credential",
    })
    scope?: string;

    @ApiPropertyOptional({
        description: "Issuer state from credential offer",
    })
    issuer_state?: string;

    @ApiPropertyOptional({
        oneOf: [
            {
                type: "string",
                description: "JSON-encoded authorization details array",
            },
            {
                type: "array",
                items: { type: "object", additionalProperties: true },
            },
        ],
        description: "Authorization details",
    })
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
export class ChainedAsAuthorizeQueryDto extends createZodDto(
    ChainedAsAuthorizeQuerySchema,
) {
    @ApiProperty({
        description: "Client identifier",
    })
    client_id!: string;

    @ApiProperty({
        description: "Request URI from PAR response",
        example: "urn:ietf:params:oauth:request_uri:abc123",
    })
    request_uri!: string;

    @ApiPropertyOptional({
        description: "State parameter (returned in redirect)",
    })
    state?: string | undefined;
}

/**
 * Token request body for Chained AS.
 */
export class ChainedAsTokenRequestDto extends createZodDto(
    ChainedAsTokenRequestSchema,
) {
    @ApiProperty({
        description: "Grant type ('authorization_code' or 'refresh_token')",
        example: "authorization_code",
    })
    grant_type!: string;

    @ApiPropertyOptional({
        description:
            "Authorization code received in the callback (authorization_code grant)",
    })
    code?: string;

    @ApiPropertyOptional({
        description: "Refresh token (refresh_token grant)",
    })
    refresh_token?: string;

    @ApiPropertyOptional({
        description: "Client identifier",
    })
    client_id?: string;

    @ApiPropertyOptional({
        description: "Redirect URI (must match the one used in PAR)",
    })
    redirect_uri?: string;

    @ApiPropertyOptional({
        description: "PKCE code verifier",
    })
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
