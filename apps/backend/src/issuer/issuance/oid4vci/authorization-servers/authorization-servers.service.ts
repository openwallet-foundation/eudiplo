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
import { ManagedAuthorizationServerConfig } from "../../../configuration/issuance/dto/authorization-server-config.dto";
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
export class AuthorizationServersService {
    static readonly selectionPrefix = "authorization-server:";

    private readonly logger = new Logger(AuthorizationServersService.name);
    private readonly requestUriPrefix = "urn:ietf:params:oauth:request_uri:";
    private readonly sessionLifetimeSeconds = 600;
    private readonly authCodeLifetimeSeconds = 300;

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

    getSelectionValue(id: string): string {
        return `${AuthorizationServersService.selectionPrefix}${id}`;
    }

    isSelectionValue(value: string | undefined): boolean {
        return !!value?.startsWith(AuthorizationServersService.selectionPrefix);
    }

    extractAuthorizationServerId(selection: string): string {
        return selection.slice(
            AuthorizationServersService.selectionPrefix.length,
        );
    }

    getAuthorizationServerBaseUrl(
        tenantId: string,
        authorizationServerId: string,
    ): string {
        const publicUrl = this.configService.getOrThrow<string>("PUBLIC_URL");
        return `${publicUrl}/issuers/${tenantId}/authorization-servers/${authorizationServerId}`;
    }

    async getEnabledAuthorizationServers(
        tenantId: string,
    ): Promise<ManagedAuthorizationServerConfig[]> {
        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);

        return (issuanceConfig.authorizationServers ?? []).filter(
            (config) =>
                config.enabled !== false &&
                config.type === "oid4vp" &&
                typeof config.id === "string" &&
                config.id.length > 0 &&
                typeof config.presentationConfigId === "string" &&
                config.presentationConfigId.length > 0,
        );
    }

    async getExternalAuthorizationServerUrls(
        tenantId: string,
    ): Promise<string[]> {
        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);

        return (issuanceConfig.authorizationServers ?? [])
            .filter(
                (config) =>
                    config.enabled !== false &&
                    config.type === "external" &&
                    typeof config.issuer === "string" &&
                    config.issuer.length > 0,
            )
            .map((config) => config.issuer!)
            .filter((url, index, arr) => arr.indexOf(url) === index);
    }

    async hasEnabledChainedAuthorizationServer(
        tenantId: string,
    ): Promise<boolean> {
        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);

        return (issuanceConfig.authorizationServers ?? []).some(
            (config) =>
                config.enabled !== false &&
                config.type === "chained" &&
                !!config.upstream,
        );
    }

    async getAuthorizationServerConfig(
        tenantId: string,
        authorizationServerId: string,
    ): Promise<ManagedAuthorizationServerConfig> {
        const config = (
            await this.getEnabledAuthorizationServers(tenantId)
        ).find((entry) => entry.id === authorizationServerId);

        if (!config) {
            throw new NotFoundException(
                `Authorization server '${authorizationServerId}' is not configured for this tenant`,
            );
        }

        if (config.type !== "oid4vp") {
            throw new BadRequestException(
                `Unsupported authorization server type '${config.type}'`,
            );
        }

        return config;
    }

    async getAuthorizationServerIssuerUrls(
        tenantId: string,
    ): Promise<string[]> {
        const configs = await this.getEnabledAuthorizationServers(tenantId);
        return configs.map((config) =>
            this.getAuthorizationServerBaseUrl(tenantId, config.id!),
        );
    }

    async resolveSelectionToIssuer(
        tenantId: string,
        selection: string | undefined,
    ): Promise<string | undefined> {
        if (!selection || !this.isSelectionValue(selection)) {
            return selection;
        }

        const authorizationServerId =
            this.extractAuthorizationServerId(selection);
        await this.getAuthorizationServerConfig(
            tenantId,
            authorizationServerId,
        );
        return this.getAuthorizationServerBaseUrl(
            tenantId,
            authorizationServerId,
        );
    }

    async getDefaultAuthorizationServerUrl(
        tenantId: string,
        preferredSelection?: string,
    ): Promise<string | undefined> {
        if (preferredSelection && this.isSelectionValue(preferredSelection)) {
            return this.resolveSelectionToIssuer(tenantId, preferredSelection);
        }

        const configs = await this.getEnabledAuthorizationServers(tenantId);
        const first = configs[0];
        if (!first) {
            return undefined;
        }

        return this.getAuthorizationServerBaseUrl(tenantId, first.id!);
    }

    async handlePar(
        tenantId: string,
        authorizationServerId: string,
        request: ChainedAsParRequestDto,
        dpopJkt?: string,
        clientAttestation?: {
            clientAttestationJwt: string;
            clientAttestationPopJwt: string;
        },
    ): Promise<ChainedAsParResponseDto> {
        const config = await this.getAuthorizationServerConfig(
            tenantId,
            authorizationServerId,
        );
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
            this.getAuthorizationServerBaseUrl(tenantId, authorizationServerId),
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
            Date.now() + this.sessionLifetimeSeconds * 1000,
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
            vpPresentationConfigId: config.presentationConfigId,
        });

        await this.sessionRepository.save(session);

        this.traceService.getSpan()?.setAttributes({
            "session.id": issuerState,
            "authorization_server.session.id": sessionId,
            "session.tenantId": tenantId,
            "authorization_server.id": authorizationServerId,
            "authorization_server.endpoint": "par",
        });

        return {
            request_uri: `${this.requestUriPrefix}${sessionId}`,
            expires_in: this.sessionLifetimeSeconds,
        };
    }

    async handleAuthorize(
        tenantId: string,
        authorizationServerId: string,
        clientId: string,
        requestUri: string,
        origin?: string,
    ): Promise<string> {
        const config = await this.getAuthorizationServerConfig(
            tenantId,
            authorizationServerId,
        );

        if (!requestUri.startsWith(this.requestUriPrefix)) {
            throw new BadRequestException("Invalid request_uri format");
        }

        const sessionId = requestUri.slice(this.requestUriPrefix.length);
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
            "authorization_server.session.id": session.id,
            "session.tenantId": tenantId,
            "authorization_server.id": authorizationServerId,
            "authorization_server.endpoint": "authorize",
        });

        const callbackUrl = `${this.getAuthorizationServerBaseUrl(tenantId, authorizationServerId)}/vp-callback?cas=${encodeURIComponent(session.id)}`;

        await this.sessionService.create({
            id: session.id,
            tenantId,
            requestId: config.presentationConfigId!,
            redirectUri: callbackUrl,
        });

        const publicUrl = this.configService.getOrThrow<string>("PUBLIC_URL");
        const offer = await this.oid4vpService.createRequest(
            config.presentationConfigId!,
            {
                session: session.id,
                redirectUri: callbackUrl,
            },
            tenantId,
            false,
            origin || publicUrl,
        );

        this.logger.debug(
            `Redirecting session ${session.id} to OID4VP wallet invocation for ${authorizationServerId}`,
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
        authorizationServerId: string,
        chainedAsSessionId: string,
        responseCode?: string,
        error?: string,
        errorDescription?: string,
    ): Promise<string> {
        await this.getAuthorizationServerConfig(
            tenantId,
            authorizationServerId,
        );

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
            Date.now() + this.authCodeLifetimeSeconds * 1000,
        );
        session.vpResponseCode = responseCode;
        await this.sessionRepository.save(session);

        const redirectUrl = new URL(session.redirectUri);
        redirectUrl.searchParams.set("code", authorizationCode);
        redirectUrl.searchParams.set(
            "iss",
            this.getAuthorizationServerBaseUrl(tenantId, authorizationServerId),
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

    private async resolveSessionForTokenRequest(
        tenantId: string,
        request: ChainedAsTokenRequestDto,
    ): Promise<ChainedAsSessionEntity> {
        if (request.grant_type === "refresh_token") {
            if (!request.refresh_token) {
                throw new BadRequestException(
                    "refresh_token is required for refresh_token grant",
                );
            }
            const session = await this.sessionRepository.findOne({
                where: { tenantId, refreshToken: request.refresh_token },
            });
            if (!session) {
                throw new UnauthorizedException(
                    "Invalid or expired refresh_token",
                );
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

    private buildTokenPayload(
        tenantId: string,
        authorizationServerId: string,
        session: ChainedAsSessionEntity,
        tokenLifetime: number,
        jti: string,
        dpopJkt?: string,
    ): Record<string, unknown> {
        const now = Math.floor(Date.now() / 1000);
        const payload: Record<string, unknown> = {
            iss: this.getAuthorizationServerBaseUrl(
                tenantId,
                authorizationServerId,
            ),
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

    async handleToken(
        tenantId: string,
        authorizationServerId: string,
        request: ChainedAsTokenRequestDto,
        dpopJwt?: string,
    ): Promise<ChainedAsTokenResponseDto> {
        const config = await this.getAuthorizationServerConfig(
            tenantId,
            authorizationServerId,
        );

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

        let tokenType = "Bearer";
        let dpopJkt: string | undefined;
        if (dpopJwt) {
            tokenType = "DPoP";
            dpopJkt = session.dpopJkt;
        } else if (config.requireDPoP) {
            throw new BadRequestException("DPoP proof is required");
        }

        const tokenLifetime = config.token?.lifetimeSeconds || 3600;
        const jti = v4();
        const tokenPayload = this.buildTokenPayload(
            tenantId,
            authorizationServerId,
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

        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);
        let refreshToken: string | undefined;
        if (issuanceConfig.refreshTokenEnabled) {
            refreshToken = randomBytes(32).toString("base64url");
            let refreshTokenExpiresAt: Date | undefined;
            if (issuanceConfig.refreshTokenExpiresInSeconds) {
                refreshTokenExpiresAt = new Date(
                    Date.now() +
                        issuanceConfig.refreshTokenExpiresInSeconds * 1000,
                );
            }
            session.refreshToken = refreshToken;
            session.refreshTokenExpiresAt = refreshTokenExpiresAt;
        }

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

    async getMetadata(
        tenantId: string,
        authorizationServerId: string,
    ): Promise<Record<string, unknown>> {
        await this.getAuthorizationServerConfig(
            tenantId,
            authorizationServerId,
        );
        const baseUrl = this.getAuthorizationServerBaseUrl(
            tenantId,
            authorizationServerId,
        );
        const publicUrl = this.configService.getOrThrow<string>("PUBLIC_URL");

        const metadata: Record<string, unknown> = {
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/authorize`,
            token_endpoint: `${baseUrl}/token`,
            pushed_authorization_request_endpoint: `${baseUrl}/par`,
            jwks_uri: `${publicUrl}/.well-known/jwks.json/issuers/${tenantId}/authorization-servers/${authorizationServerId}`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            authorization_details_types_supported: ["openid_credential"],
            token_endpoint_auth_methods_supported: [
                "none",
                "attest_jwt_client_auth",
            ],
            code_challenge_methods_supported: ["S256"],
            dpop_signing_alg_values_supported: ["ES256", "ES384", "ES512"],
            client_attestation_signing_alg_values_supported: ["ES256"],
            client_attestation_pop_signing_alg_values_supported: ["ES256"],
        };

        return metadata;
    }

    async getJwks(
        tenantId: string,
        authorizationServerId: string,
    ): Promise<{ keys: Record<string, unknown>[] }> {
        const config = await this.getAuthorizationServerConfig(
            tenantId,
            authorizationServerId,
        );
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
}
