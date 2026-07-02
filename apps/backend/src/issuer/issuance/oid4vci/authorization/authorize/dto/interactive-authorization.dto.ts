import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

/**
 * Authorization details for a credential request.
 */
export class AuthorizationDetailsDto {
    @ApiProperty({
        description: "Type of authorization details",
        example: "openid_credential",
    })
    @IsString()
    type!: string;

    @ApiPropertyOptional({
        description: "Credential format",
        example: "vc+sd-jwt",
    })
    @IsOptional()
    @IsString()
    format?: string;

    @ApiPropertyOptional({
        description: "Verifiable Credential Type",
        example: "IdentityCredential",
    })
    @IsOptional()
    @IsString()
    vct?: string;

    @ApiPropertyOptional({
        description: "Credential configuration ID",
    })
    @IsOptional()
    @IsString()
    credential_configuration_id?: string;
}

/**
 * Combined Interactive Authorization Request DTO.
 * Can be either an initial request or a follow-up request.
 */
export class InteractiveAuthorizationRequestDto {
    @ApiPropertyOptional({
        description: "Response type (for initial request)",
    })
    @IsOptional()
    @IsString()
    response_type?: string;

    @ApiPropertyOptional({
        description: "Client identifier (for initial request)",
    })
    @IsOptional()
    @IsString()
    client_id?: string;

    @ApiPropertyOptional({
        description:
            "Comma-separated list of supported interaction types (for initial request)",
    })
    @IsOptional()
    @IsString()
    interaction_types_supported?: string;

    @ApiPropertyOptional({
        description: "Redirect URI (for initial request)",
    })
    @IsOptional()
    @IsString()
    redirect_uri?: string;

    @ApiPropertyOptional({
        description: "OAuth scope",
    })
    @IsOptional()
    @IsString()
    scope?: string;

    @ApiPropertyOptional({
        description: "PKCE code challenge",
    })
    @IsOptional()
    @IsString()
    code_challenge?: string;

    @ApiPropertyOptional({
        description: "PKCE code challenge method",
    })
    @IsOptional()
    @IsString()
    code_challenge_method?: string;

    @ApiPropertyOptional({
        description: "Authorization details",
    })
    @IsOptional()
    authorization_details?: AuthorizationDetailsDto[] | string;

    @ApiPropertyOptional({
        description: "State parameter",
    })
    @IsOptional()
    @IsString()
    state?: string;

    @ApiPropertyOptional({
        description: "Issuer state from credential offer",
    })
    @IsOptional()
    @IsString()
    issuer_state?: string;

    @ApiPropertyOptional({
        description: "Auth session identifier (for follow-up request)",
    })
    @IsOptional()
    @IsString()
    auth_session?: string;

    @ApiPropertyOptional({
        description: "OpenID4VP response (for follow-up request)",
    })
    @IsOptional()
    @IsString()
    openid4vp_response?: string;

    @ApiPropertyOptional({
        description: "PKCE code verifier (for follow-up request)",
    })
    @IsOptional()
    @IsString()
    code_verifier?: string;

    @ApiPropertyOptional({
        description: "JAR request JWT (by value)",
    })
    @IsOptional()
    @IsString()
    request?: string;

    @ApiPropertyOptional({
        description: "JAR request URI (by reference)",
    })
    @IsOptional()
    @IsString()
    request_uri?: string;
}

/**
 * OpenID4VP request object in interactive authorization response.
 */
export class Openid4vpRequestDto {
    @ApiProperty({
        description: "JAR request JWT",
    })
    @IsString()
    request!: string;

    @ApiPropertyOptional({
        description: "Client ID",
    })
    @IsOptional()
    @IsString()
    client_id?: string;
}

/**
 * Response when interaction is required (openid4vp_presentation).
 */
export class InteractiveAuthorizationOpenid4vpResponseDto {
    @ApiProperty({
        description: "Response status",
        example: "require_interaction",
    })
    status!: "require_interaction";

    @ApiProperty({
        description: "Interaction type",
        example: "openid4vp_presentation",
    })
    type!: "openid4vp_presentation";

    @ApiProperty({
        description: "Auth session identifier for follow-up requests",
        example: "session-123",
    })
    auth_session!: string;

    @ApiProperty({
        description: "OpenID4VP authorization request",
        type: Openid4vpRequestDto,
    })
    openid4vp_request!: Openid4vpRequestDto;
}

/**
 * Response when interaction is required (redirect_to_web).
 */
export class InteractiveAuthorizationRedirectToWebResponseDto {
    @ApiProperty({
        description: "Response status",
        example: "require_interaction",
    })
    status!: "require_interaction";

    @ApiProperty({
        description: "Interaction type",
        example: "redirect_to_web",
    })
    type!: "redirect_to_web";

    @ApiProperty({
        description: "Auth session identifier for follow-up requests",
        example: "session-789",
    })
    auth_session!: string;

    @ApiProperty({
        description: "Request URI for PAR-based web authorization",
        example: "urn:ietf:params:oauth:request_uri:xyz",
    })
    request_uri!: string;

    @ApiPropertyOptional({
        description: "Expiration time in seconds",
        example: 600,
    })
    expires_in?: number;
}

/**
 * Successful authorization code response.
 */
export class InteractiveAuthorizationCodeResponseDto {
    @ApiProperty({
        description: "Response status",
        example: "ok",
    })
    status!: "ok";

    @ApiProperty({
        description: "Authorization code",
        example: "auth-code-123",
    })
    code!: string;
}

/**
 * Error response for interactive authorization.
 */
export class InteractiveAuthorizationErrorResponseDto {
    @ApiProperty({
        description: "OAuth error code",
        example: "invalid_request",
    })
    error!: string;

    @ApiPropertyOptional({
        description: "Human-readable error description",
        example: "Missing required parameter: interaction_types_supported",
    })
    error_description?: string;
}

/**
 * Union type for all possible interactive authorization responses.
 */
export type InteractiveAuthorizationResponse =
    | InteractiveAuthorizationCodeResponseDto
    | InteractiveAuthorizationOpenid4vpResponseDto
    | InteractiveAuthorizationRedirectToWebResponseDto
    | InteractiveAuthorizationErrorResponseDto;

/**
 * Interaction type enum.
 */
export enum InteractionType {
    OPENID4VP_PRESENTATION = "openid4vp_presentation",
    REDIRECT_TO_WEB = "redirect_to_web",
}

/**
 * Request type enum for internal use.
 */
export enum InteractiveAuthorizationRequestType {
    INITIAL = "initial",
    FOLLOW_UP = "follow_up",
}
