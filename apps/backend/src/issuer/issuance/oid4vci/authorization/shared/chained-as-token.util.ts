import { randomBytes } from "node:crypto";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { Repository } from "typeorm";
import { ChainedAsTokenRequestDto } from "./dto/chained-as.dto";
import {
    ChainedAsSessionEntity,
    ChainedAsSessionStatus,
} from "./entities/chained-as-session.entity";
import { verifyPkceCodeChallenge } from "./pkce.util";

export interface RefreshTokenIssuanceConfig {
    refreshTokenEnabled?: boolean;
    refreshTokenExpiresInSeconds?: number;
}

export async function resolveSessionForTokenRequest(
    sessionRepository: Repository<ChainedAsSessionEntity>,
    tenantId: string,
    request: ChainedAsTokenRequestDto,
): Promise<ChainedAsSessionEntity> {
    if (request.grant_type === "refresh_token") {
        if (!request.refresh_token) {
            throw new BadRequestException(
                "refresh_token is required for refresh_token grant",
            );
        }

        const session = await sessionRepository.findOne({
            where: { tenantId, refreshToken: request.refresh_token },
        });

        if (!session) {
            throw new UnauthorizedException("Invalid or expired refresh_token");
        }

        if (
            session.refreshTokenExpiresAt &&
            session.refreshTokenExpiresAt < new Date()
        ) {
            throw new UnauthorizedException("refresh_token has expired");
        }

        return session;
    }

    if (!request.code) {
        throw new BadRequestException(
            "code is required for authorization_code grant",
        );
    }

    const session = await sessionRepository.findOne({
        where: {
            tenantId,
            authorizationCode: request.code,
            status: ChainedAsSessionStatus.AUTHORIZED,
        },
    });

    if (!session) {
        throw new UnauthorizedException("Invalid authorization code");
    }

    return session;
}

export async function assertTokenRequestSessionValid(
    sessionRepository: Repository<ChainedAsSessionEntity>,
    session: ChainedAsSessionEntity,
    request: ChainedAsTokenRequestDto,
): Promise<void> {
    if (
        request.grant_type === "authorization_code" &&
        session.authorizationCodeExpiresAt &&
        session.authorizationCodeExpiresAt < new Date()
    ) {
        session.status = ChainedAsSessionStatus.EXPIRED;
        await sessionRepository.save(session);
        throw new UnauthorizedException("Authorization code expired");
    }

    if (request.redirect_uri && request.redirect_uri !== session.redirectUri) {
        throw new BadRequestException("redirect_uri mismatch");
    }

    if (request.grant_type === "authorization_code") {
        verifyPkceCodeChallenge(
            session.codeChallenge,
            session.codeChallengeMethod,
            request.code_verifier,
        );
    }
}

export function resolveTokenBinding(
    requireDPoP: boolean | undefined,
    session: ChainedAsSessionEntity,
    dpopJwt?: string,
): { tokenType: string; dpopJkt?: string } {
    if (dpopJwt) {
        return {
            tokenType: "DPoP",
            dpopJkt: session.dpopJkt,
        };
    }

    if (requireDPoP) {
        throw new BadRequestException("DPoP proof is required");
    }

    return { tokenType: "Bearer" };
}

export function issueRefreshTokenIfEnabled(
    session: ChainedAsSessionEntity,
    issuanceConfig: RefreshTokenIssuanceConfig,
): string | undefined {
    if (!issuanceConfig.refreshTokenEnabled) {
        return undefined;
    }

    const refreshToken = randomBytes(32).toString("base64url");
    let refreshTokenExpiresAt: Date | undefined;

    if (issuanceConfig.refreshTokenExpiresInSeconds) {
        refreshTokenExpiresAt = new Date(
            Date.now() + issuanceConfig.refreshTokenExpiresInSeconds * 1000,
        );
    }

    session.refreshToken = refreshToken;
    session.refreshTokenExpiresAt = refreshTokenExpiresAt;

    return refreshToken;
}
