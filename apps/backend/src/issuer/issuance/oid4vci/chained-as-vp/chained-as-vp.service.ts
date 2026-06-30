import { createHash, randomBytes } from "node:crypto";
import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { TraceService } from "nestjs-otel";
import { Repository } from "typeorm";
import { v4 } from "uuid";
import { KeyChainService } from "../../../../crypto/key/key-chain.service";
import { SessionStatus } from "../../../../session/entities/session.entity";
import { SessionService } from "../../../../session/session.service";
import { WalletAttestationService } from "../../../../shared/trust/wallet-attestation.service";
import type { ChainedAsConfig } from "../../../configuration/issuance/dto/chained-as-config.dto";
import { IssuanceService } from "../../../configuration/issuance/issuance.service";
import { Oid4vpService } from "../../../../verifier/oid4vp/oid4vp.service";
import {
    ChainedAsParRequestDto,
    ChainedAsParResponseDto,
    ChainedAsTokenRequestDto,
    ChainedAsTokenResponseDto,
} from "../chained-as/dto/chained-as.dto";
import {
    ChainedAsSessionEntity,
    ChainedAsSessionStatus,
} from "../chained-as/entities/chained-as-session.entity";

@Injectable()
export class ChainedAsVpService {
    private readonly logger = new Logger(ChainedAsVpService.name);
    private readonly REQUEST_URI_PREFIX = "urn:ietf:params:oauth:request_uri:";
    private readonly SESSION_LIFETIME_SECONDS = 600;
    private readonly AUTH_CODE_LIFETIME_SECONDS = 300;

    constructor(
        private readonly configService: ConfigService,
        private readonly keyChainService: KeyChainService,
        private readonly sessionService: SessionService,
        private readonly issuanceService: IssuanceService,
        private readonly walletAttestationService: WalletAttestationService,
        private readonly traceService: TraceService,
        private readonly oid4vpService: Oid4vpService,
        @InjectRepository(ChainedAsSessionEntity)
        private readonly sessionRepository: Repository<ChainedAsSessionEntity>,
    ) {}

    private getChainedAsVpBaseUrl(tenantId: string): string {
        const publicUrl = this.configService.getOrThrow<string>("PUBLIC_URL");
        return `${publicUrl}/issuers/${tenantId}/chained-as-vp`;
    }

    async getChainedAsVpConfig(tenantId: string): Promise<ChainedAsConfig> {
        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);

        const chainedServer = (issuanceConfig.authorizationServers ?? []).find(
            (server) =>
                server.enabled !== false &&
                server.type === "chained" &&
                (server as { vp?: { enabled?: boolean } }).vp?.enabled,
        );

        if (!chainedServer) {
            throw new NotFoundException(
                "VP-backed Chained Authorization Server is not enabled for this tenant",
            );
        }

        return chainedServer as unknown as ChainedAsConfig;
    }

    async handlePar(
        tenantId: string,
        request: ChainedAsParRequestDto,
        dpopJkt?: string,
        clientAttestation?: {
            clientAttestationJwt: string;
            clientAttestationPopJwt: string;
        },
    ): Promise<ChainedAsParResponseDto> {
        const config = await this.getChainedAsVpConfig(tenantId);
        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);

        if (request.response_type !== "code") {
            throw new BadRequestException(
                'Invalid response_type, must be "code"',
            );
        }

        if (config.requireDPoP && !dpopJkt) {
            throw new BadRequestException("DPoP is required");
        }

        await this.walletAttestationService.verifyWalletAttestation(
            tenantId,
            clientAttestation,
            this.getChainedAsVpBaseUrl(tenantId),
            issuanceConfig.walletAttestationRequired ?? false,
            issuanceConfig.walletProviderTrustLists ?? [],
        );

        let issuerState = request.issuer_state;
        if (issuerState) {
            try {
                await this.sessionService.get(issuerState);
            } catch {
                throw new BadRequestException("Invalid issuer_state");
            }
        } else {
            issuerState = v4();
        }

        const sessionId = v4();
        const expiresAt = new Date(
            Date.now() + this.SESSION_LIFETIME_SECONDS * 1000,
        );

        const session = this.sessionRepository.create({
            id: sessionId,
            tenantId,
            status: ChainedAsSessionStatus.PENDING_AUTHORIZE,
            issuerState,
            clientId: request.client_id,
            redirectUri: request.redirect_uri,
            codeChallenge: request.code_challenge,
            codeChallengeMethod: request.code_challenge_method,
            walletState: request.state,
            scope: request.scope,
            authorizationDetails: request.authorization_details,
            dpopJkt,
            expiresAt,
        });

        await this.sessionRepository.save(session);

        this.traceService.getSpan()?.setAttributes({
            "session.id": issuerState,
            "chained_as_vp.session.id": sessionId,
            "session.tenantId": tenantId,
            "chained_as_vp.endpoint": "par",
        });

        return {
            request_uri: `${this.REQUEST_URI_PREFIX}${sessionId}`,
            expires_in: this.SESSION_LIFETIME_SECONDS,
        };
    }

    async handleAuthorize(
        tenantId: string,
        clientId: string,
        requestUri: string,
        origin?: string,
    ): Promise<string> {
        const config = await this.getChainedAsVpConfig(tenantId);

        if (!config.vp?.presentationConfigId) {
            throw new BadRequestException(
                "Presentation configuration is not configured",
            );
        }

        if (!requestUri.startsWith(this.REQUEST_URI_PREFIX)) {
            throw new BadRequestException("Invalid request_uri format");
        }

        const sessionId = requestUri.slice(this.REQUEST_URI_PREFIX.length);
        const session = await this.sessionRepository.findOne({
            where: {
                id: sessionId,
                tenantId,
                status: ChainedAsSessionStatus.PENDING_AUTHORIZE,
            },
        });

        if (!session) {
            throw new BadRequestException("Invalid or expired request_uri");
        }

        if (session.clientId !== clientId) {
            throw new BadRequestException("Client ID mismatch");
        }

        if (session.expiresAt < new Date()) {
            session.status = ChainedAsSessionStatus.EXPIRED;
            await this.sessionRepository.save(session);
            throw new BadRequestException("Session expired");
        }

        session.status = ChainedAsSessionStatus.PENDING_VP_CALLBACK;
        await this.sessionRepository.save(session);

        this.traceService.getSpan()?.setAttributes({
            "session.id": session.issuerState,
            "chained_as_vp.session.id": session.id,
            "session.tenantId": tenantId,
            "chained_as_vp.endpoint": "authorize",
        });

        const callbackUrl = `${this.getChainedAsVpBaseUrl(tenantId)}/vp-callback?cas=${encodeURIComponent(session.id)}`;
        const publicUrl = this.configService.getOrThrow<string>("PUBLIC_URL");

        await this.sessionService.create({
            id: session.id,
            tenantId,
            requestId: config.vp.presentationConfigId,
            redirectUri: callbackUrl,
        });

        const offer = await this.oid4vpService.createRequest(
            config.vp.presentationConfigId,
            {
                session: session.id,
                redirectUri: callbackUrl,
            },
            tenantId,
            false,
            origin || publicUrl,
        );

        this.logger.debug(
            `Redirecting session ${session.id} to OID4VP wallet invocation`,
        );

        return `openid4vp://?${offer.uri}`;
    }

    private buildErrorRedirect(
        redirectUri: string,
        error: string,
        errorDescription?: string,
        walletState?: string,
    ): string {
        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.set("error", error);
        if (errorDescription) {
            redirectUrl.searchParams.set("error_description", errorDescription);
        }
        if (walletState) {
            redirectUrl.searchParams.set("state", walletState);
        }
        return redirectUrl.toString();
    }

    async handleVerifierCallback(
        tenantId: string,
        chainedAsSessionId: string,
        responseCode?: string,
        error?: string,
        errorDescription?: string,
    ): Promise<string> {
        const session = await this.sessionRepository.findOne({
            where: {
                id: chainedAsSessionId,
                tenantId,
                status: ChainedAsSessionStatus.PENDING_VP_CALLBACK,
            },
        });

        if (!session) {
            throw new BadRequestException(
                "Invalid or expired callback session",
            );
        }

        if (error) {
            session.status = ChainedAsSessionStatus.EXPIRED;
            await this.sessionRepository.save(session);
            return this.buildErrorRedirect(
                session.redirectUri,
                error,
                errorDescription,
                session.walletState,
            );
        }

        const verifierSession = await this.sessionService.get(session.id);
        if (
            verifierSession.status !== SessionStatus.Completed ||
            !responseCode ||
            verifierSession.responseCode !== responseCode
        ) {
            session.status = ChainedAsSessionStatus.EXPIRED;
            await this.sessionRepository.save(session);
            return this.buildErrorRedirect(
                session.redirectUri,
                "invalid_request",
                "OID4VP verification did not complete successfully",
                session.walletState,
            );
        }

        if (session.issuerState && verifierSession.credentials) {
            await this.sessionService.add(session.issuerState, {
                credentials: verifierSession.credentials as any,
            });
        }

        const authorizationCode = randomBytes(32).toString("base64url");
        session.status = ChainedAsSessionStatus.AUTHORIZED;
        session.authorizationCode = authorizationCode;
        session.authorizationCodeExpiresAt = new Date(
            Date.now() + this.AUTH_CODE_LIFETIME_SECONDS * 1000,
        );
        await this.sessionRepository.save(session);

        const redirectUrl = new URL(session.redirectUri);
        redirectUrl.searchParams.set("code", authorizationCode);
        redirectUrl.searchParams.set(
            "iss",
            this.getChainedAsVpBaseUrl(tenantId),
        );
        if (session.walletState) {
            redirectUrl.searchParams.set("state", session.walletState);
        }
        return redirectUrl.toString();
    }

    private verifyPkce(
        session: ChainedAsSessionEntity,
        codeVerifier?: string,
    ): void {
        if (session.codeChallenge && codeVerifier) {
            const expectedChallenge =
                session.codeChallengeMethod === "S256"
                    ? createHash("sha256")
                          .update(codeVerifier)
                          .digest("base64url")
                    : codeVerifier;
            if (expectedChallenge !== session.codeChallenge) {
                throw new UnauthorizedException("Invalid code_verifier");
            }
        } else if (session.codeChallenge && !codeVerifier) {
            throw new BadRequestException("code_verifier is required");
        }
    }

    private buildTokenPayload(
        tenantId: string,
        session: ChainedAsSessionEntity,
        tokenLifetime: number,
        jti: string,
        dpopJkt?: string,
    ): Record<string, unknown> {
        const now = Math.floor(Date.now() / 1000);
        const payload: Record<string, unknown> = {
            iss: this.getChainedAsVpBaseUrl(tenantId),
            sub: session.clientId,
            aud: `${this.configService.getOrThrow<string>("PUBLIC_URL")}/issuers/${tenantId}`,
            iat: now,
            exp: now + tokenLifetime,
            jti,
            issuer_state: session.issuerState,
            client_id: session.clientId,
        };
        if (dpopJkt) {
            payload.cnf = { jkt: dpopJkt };
        }
        if (
            Array.isArray(session.authorizationDetails) &&
            session.authorizationDetails.length > 0
        ) {
            payload.authorization_details = session.authorizationDetails;
        }
        return payload;
    }

    private async resolveSessionForTokenRequest(
        tenantId: string,
        request: ChainedAsTokenRequestDto,
    ): Promise<ChainedAsSessionEntity> {
        return request.grant_type === "refresh_token"
            ? this.resolveRefreshTokenSession(tenantId, request)
            : this.resolveAuthorizationCodeSession(tenantId, request);
    }

    private async resolveRefreshTokenSession(
        tenantId: string,
        request: ChainedAsTokenRequestDto,
    ): Promise<ChainedAsSessionEntity> {
        if (!request.refresh_token) {
            throw new BadRequestException(
                "refresh_token is required for refresh_token grant",
            );
        }

        const session = await this.sessionRepository.findOne({
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

    private async resolveAuthorizationCodeSession(
        tenantId: string,
        request: ChainedAsTokenRequestDto,
    ): Promise<ChainedAsSessionEntity> {
        if (!request.code) {
            throw new BadRequestException(
                "code is required for authorization_code grant",
            );
        }

        const session = await this.sessionRepository.findOne({
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

    private async assertTokenRequestSessionValid(
        session: ChainedAsSessionEntity,
        request: ChainedAsTokenRequestDto,
    ): Promise<void> {
        if (
            request.grant_type === "authorization_code" &&
            session.authorizationCodeExpiresAt &&
            session.authorizationCodeExpiresAt < new Date()
        ) {
            session.status = ChainedAsSessionStatus.EXPIRED;
            await this.sessionRepository.save(session);
            throw new UnauthorizedException("Authorization code expired");
        }

        if (
            request.redirect_uri &&
            request.redirect_uri !== session.redirectUri
        ) {
            throw new BadRequestException("redirect_uri mismatch");
        }

        if (request.grant_type === "authorization_code") {
            this.verifyPkce(session, request.code_verifier);
        }
    }

    private resolveTokenBinding(
        config: ChainedAsConfig,
        session: ChainedAsSessionEntity,
        dpopJwt?: string,
    ): { tokenType: string; dpopJkt?: string } {
        if (dpopJwt) {
            return {
                tokenType: "DPoP",
                dpopJkt: session.dpopJkt,
            };
        }

        if (config.requireDPoP) {
            throw new BadRequestException("DPoP proof is required");
        }

        return { tokenType: "Bearer" };
    }

    private async issueRefreshTokenIfEnabled(
        session: ChainedAsSessionEntity,
        tenantId: string,
    ): Promise<string | undefined> {
        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);

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

    async handleToken(
        tenantId: string,
        request: ChainedAsTokenRequestDto,
        dpopJwt?: string,
    ): Promise<ChainedAsTokenResponseDto> {
        if (
            request.grant_type !== "authorization_code" &&
            request.grant_type !== "refresh_token"
        ) {
            throw new BadRequestException(
                'Invalid grant_type, must be "authorization_code" or "refresh_token"',
            );
        }

        const session = await this.resolveSessionForTokenRequest(
            tenantId,
            request,
        );
        await this.assertTokenRequestSessionValid(session, request);

        const config = await this.getChainedAsVpConfig(tenantId);
        const { tokenType, dpopJkt } = this.resolveTokenBinding(
            config,
            session,
            dpopJwt,
        );

        const tokenLifetime = config.token?.lifetimeSeconds || 3600;
        const jti = v4();
        const tokenPayload = this.buildTokenPayload(
            tenantId,
            session,
            tokenLifetime,
            jti,
            dpopJkt,
        );

        const signingKeyId =
            config.token?.signingKeyId ||
            (await this.keyChainService.getKid(tenantId));
        const publicKey = await this.keyChainService.getPublicKey(
            "jwk",
            tenantId,
            signingKeyId,
        );
        const kid = (publicKey as { kid?: string }).kid || signingKeyId;

        const accessToken = await this.keyChainService.signJWT(
            tokenPayload as any,
            { alg: "ES256", kid, typ: "at+jwt" },
            tenantId,
            signingKeyId,
        );

        session.status = ChainedAsSessionStatus.TOKEN_ISSUED;
        session.accessTokenJti = jti;

        const refreshToken = await this.issueRefreshTokenIfEnabled(
            session,
            tenantId,
        );

        await this.sessionRepository.save(session);

        return {
            access_token: accessToken,
            token_type: tokenType,
            expires_in: tokenLifetime,
            scope: session.scope,
            ...(Array.isArray(session.authorizationDetails) &&
                session.authorizationDetails.length > 0 && {
                    authorization_details: session.authorizationDetails,
                }),
            ...(refreshToken && { refresh_token: refreshToken }),
        };
    }

    async getJwks(
        tenantId: string,
    ): Promise<{ keys: Record<string, unknown>[] }> {
        const config = await this.getChainedAsVpConfig(tenantId);
        const signingKeyId =
            config.token?.signingKeyId ||
            (await this.keyChainService.getKid(tenantId));
        const publicKey = await this.keyChainService.getPublicKey(
            "jwk",
            tenantId,
            signingKeyId,
        );

        return {
            keys: [
                {
                    ...publicKey,
                    kid: (publicKey as { kid?: string }).kid || signingKeyId,
                } as Record<string, unknown>,
            ],
        };
    }

    async getMetadata(tenantId: string): Promise<Record<string, unknown>> {
        const baseUrl = this.getChainedAsVpBaseUrl(tenantId);
        const publicUrl = this.configService.getOrThrow<string>("PUBLIC_URL");
        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);
        const walletAttestationRequired =
            issuanceConfig.walletAttestationRequired ?? false;

        const metadata: Record<string, unknown> = {
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/authorize`,
            token_endpoint: `${baseUrl}/token`,
            pushed_authorization_request_endpoint: `${baseUrl}/par`,
            jwks_uri: `${publicUrl}/.well-known/jwks.json/issuers/${tenantId}/chained-as-vp`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            code_challenge_methods_supported: ["S256"],
            dpop_signing_alg_values_supported: ["ES256", "ES384", "ES512"],
        };

        if (walletAttestationRequired) {
            metadata.token_endpoint_auth_methods_supported = [
                "attest_jwt_client_auth",
            ];
            metadata.client_attestation_signing_alg_values_supported = [
                "ES256",
            ];
            metadata.client_attestation_pop_signing_alg_values_supported = [
                "ES256",
            ];
        }

        return metadata;
    }
}
