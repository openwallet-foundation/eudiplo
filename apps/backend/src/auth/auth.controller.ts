import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import {
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { KeyResponseDto } from "../crypto/key/dto/key-response.dto";
import { AuthService } from "./auth.service";
import { ClientCredentialsDto } from "./dto/client-credentials.dto";
import { OidcDiscoveryDto } from "./dto/oidc-discovery.dto";
import { RoleDto } from "./dto/role.dto";
import { TokenResponse } from "./dto/token-response.dto";

/**
 * Authentication Controller
 */
@ApiExtraModels(RoleDto)
@ApiTags("Authentication")
@Controller()
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    /**
     * OAuth2 Token endpoint - supports client credentials flow only
     * Accepts client credentials either in Authorization header (Basic auth) or request body
     * @param body
     * @param headers
     * @returns
     */
    @Post("api/oauth2/token")
    @ApiBody({
        type: ClientCredentialsDto,
        examples: {
            client_credentials: {
                summary: "Client Credentials Flow",
                value: {
                    grant_type: "client_credentials",
                    client_id: "root",
                    client_secret: "root",
                },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: "OAuth2 token response",
        type: TokenResponse,
        examples: {
            success: {
                summary: "Successful response",
                value: {
                    access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    token_type: "Bearer",
                    expires_in: 86400,
                    state: "abc123",
                },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: "Invalid client credentials",
    })
    getOAuth2Token(
        @Body() body: any,
        @Headers() headers: any,
    ): Promise<TokenResponse> {
        return this.authService.getOAuth2Token(body, headers);
    }

    /**
     * OIDC Discovery endpoint for client credentials flow.
     * This endpoint provides the OpenID Connect configuration for applications
     * that need to authenticate using client_id and client_secret.
     */
    @Get(".well-known/oauth-authorization-server")
    @ApiOperation({
        summary: "OIDC Discovery Configuration",
        description:
            "Returns the OpenID Connect discovery configuration for client credentials authentication.",
    })
    @ApiResponse({
        status: 200,
        description: "OIDC Discovery Configuration",
    })
    getOidcDiscovery(): OidcDiscoveryDto {
        return this.authService.getOidcDiscovery();
    }

    /**
     * Global JWKS endpoint for client credentials flow.
     * This provides the JSON Web Key Set for verifying tokens issued by this server.
     */
    @Get(".well-known/jwks.json")
    @ApiOperation({
        summary: "JSON Web Key Set",
        description: "Returns the JSON Web Key Set for token verification.",
    })
    @ApiResponse({
        status: 200,
        description: "JSON Web Key Set",
    })
    getGlobalJwks(): KeyResponseDto {
        // For now, return an empty key set since the actual keys are tenant-specific
        // This can be enhanced later to include global signing keys if needed
        return {
            keys: [],
        };
    }
}
