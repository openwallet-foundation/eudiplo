import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { jwtVerify, SignJWT } from "jose";
import { InternalTokenPayload, TokenPayload } from "./token.decorator.js";

export interface GenerateTokenOptions {
    expiresIn?: string;
    audience?: string;
    subject: string;
}

@Injectable()
export class JwtService {
    constructor(private readonly configService: ConfigService) {}

    /**
     * Generate a JWT token for integrated OAuth2 server
     */
    async generateToken(
        payload: InternalTokenPayload,
        options: GenerateTokenOptions,
    ): Promise<string> {
        if (this.isUsingExternalOIDC()) {
            throw new Error(
                "Token generation is not available when using external OIDC provider. Use your external OIDC provider for token generation.",
            );
        }

        const secret = this.configService.getOrThrow<string>("MASTER_SECRET");
        const issuer = this.configService.getOrThrow<string>("JWT_ISSUER");
        const expiresIn =
            options.expiresIn ||
            this.configService.getOrThrow<string>("JWT_EXPIRES_IN");

        const secretKey = new TextEncoder().encode(secret);

        const jwt = new SignJWT({
            ...payload,
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setIssuer(issuer)
            .setSubject(options.subject)
            .setExpirationTime(expiresIn);

        if (options.audience) {
            jwt.setAudience(options.audience);
        }

        return await jwt.sign(secretKey);
    }

    /**
     * Verify a JWT token (for additional validation if needed)
     */
    async verifyToken(token: string): Promise<TokenPayload> {
        if (this.isUsingExternalOIDC()) {
            throw new Error(
                "Token verification is handled by external OIDC provider.",
            );
        }

        const secret = this.configService.getOrThrow<string>("MASTER_SECRET");
        const issuer = this.configService.getOrThrow<string>("JWT_ISSUER");

        const secretKey = new TextEncoder().encode(secret);

        try {
            const { payload } = (await jwtVerify(token, secretKey, {
                issuer,
                algorithms: ["HS256"],
            })) as { payload: TokenPayload };
            return payload;
        } catch (error: any) {
            throw new Error(`Invalid token: ${error.message}`);
        }
    }

    /**
     * Check if the service is using external OIDC provider
     */
    isUsingExternalOIDC(): boolean {
        return this.configService.get<string>("OIDC") !== undefined;
    }
}
