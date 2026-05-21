import { randomUUID } from "node:crypto";
import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import {
    type AuthorizationCodeGrantIdentifier,
    type AuthorizationServerMetadata,
    authorizationCodeGrantIdentifier,
    type HttpMethod,
    Jwk,
    Oauth2AuthorizationServer,
    PkceCodeChallengeMethod,
    PreAuthorizedCodeGrantIdentifier,
    preAuthorizedCodeGrantIdentifier,
    type RefreshTokenGrantIdentifier,
    refreshTokenGrantIdentifier,
} from "@openid4vc/oauth2";
import type { Request } from "express";
import { Repository } from "typeorm";
import { v4 } from "uuid";
import { CryptoService } from "../../../../crypto/crypto.service";
import { KeyChainService } from "../../../../crypto/key/key-chain.service";
import { SessionService } from "../../../../session/session.service";
import { WalletAttestationService } from "../../../../shared/trust/wallet-attestation.service";
import { IssuanceService } from "../../../configuration/issuance/issuance.service";
import { StatusListConfigService } from "../../../lifecycle/status/status-list-config.service";
import { NonceEntity } from "../entities/nonces.entity";
import { TokenErrorException } from "../exceptions";
import { getHeadersFromRequest } from "../util";
import { AuthorizeQueries } from "./dto/authorize-request.dto";

interface ParsedAccessTokenAuthorizationCodeRequestGrant {
    grantType: AuthorizationCodeGrantIdentifier;
    code: string;
}

interface ParsedAccessTokenPreAuthorizedCodeRequestGrant {
    grantType: PreAuthorizedCodeGrantIdentifier;
    preAuthorizedCode: string;
    txCode?: string;
}

interface ParsedAccessTokenRefreshTokenRequestGrant {
    grantType: RefreshTokenGrantIdentifier;
    refreshToken: string;
}

@Injectable()
export class AuthorizeService {
    private readonly logger = new Logger(AuthorizeService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly cryptoService: CryptoService,
        private readonly sessionService: SessionService,
        private readonly issuanceService: IssuanceService,
        private readonly walletAttestationService: WalletAttestationService,
        private readonly keyChainService: KeyChainService,
        @InjectRepository(NonceEntity)
        private readonly nonceRepository: Repository<NonceEntity>,
        private readonly statusListConfigService: StatusListConfigService,
    ) {}

    getAuthorizationServer(
        tenantId: string,
        sessionId?: string,
    ): Oauth2AuthorizationServer {
        const callbacks = this.cryptoService.getCallbackContext(
            tenantId,
            sessionId,
        );
        return new Oauth2AuthorizationServer({
            callbacks,
        });
    }

    /**
     * Map error codes from the OAuth library to OAuth 2.0 Token Error codes.
     * According to OID4VCI Section 6.3:
     * - invalid_request: Transaction code provided but not expected, or expected but not provided
     * - invalid_tx_code: Wrong transaction code in the Pre-Authorized Code Flow
     * - invalid_grant: Wrong pre-authorized code, or expired code
     * - invalid_client: Anonymous access with pre-authorized code but not supported
     * @param errorCode The error code from the OAuth library
     * @returns The appropriate OAuth 2.0 token error code
     */
    private mapToTokenErrorCode(
        errorCode: string | undefined,
    ):
        | "invalid_request"
        | "invalid_client"
        | "invalid_grant"
        | "invalid_tx_code" {
        if (!errorCode) {
            return "invalid_request";
        }
        // The OAuth library may return these error codes directly
        if (
            errorCode === "invalid_grant" ||
            errorCode === "invalid_client" ||
            errorCode === "invalid_request" ||
            errorCode === "invalid_tx_code"
        ) {
            return errorCode;
        }
        // Wrong tx_code has its own dedicated error code in OID4VCI 1.1 §6.3.
        if (
            errorCode.includes("tx_code") ||
            errorCode.includes("transaction")
        ) {
            return "invalid_tx_code";
        }
        // Wrong or expired pre-authorized code = invalid_grant
        if (
            errorCode.includes("pre-authorized") ||
            errorCode.includes("pre_authorized")
        ) {
            return "invalid_grant";
        }
        // Default to invalid_request for malformed requests
        return "invalid_request";
    }

    getAuthzIssuer(tenantId: string) {
        return `${this.configService.getOrThrow<string>("PUBLIC_URL")}/issuers/${tenantId}`;
    }

    /**
     * Build the RFC 9396 `authorization_details` array that must be bound to the
     * issued access token, per OID4VCI Section 6 / 7. The list of authorized
     * `credential_configuration_id` values is derived from the session:
     *
     *  - If the Wallet sent `authorization_details` in the Authorization /
     *    PAR request (Authorization Code Flow), those values are used.
     *  - Otherwise (Pre-Authorized Code Flow or issuer-initiated offer), the
     *    `credential_configuration_ids` from the Credential Offer are used.
     *
     * Returns `undefined` when no credential bindings can be derived, in which
     * case no `authorization_details` will be placed on the token.
     */
    private buildAuthorizationDetailsForToken(session: {
        auth_queries?: AuthorizeQueries;
        credentialPayload?: any;
    }): Record<string, unknown>[] | undefined {
        // 1. From authorization_details in the (pushed) authorization request.
        const raw = session.auth_queries?.authorization_details;
        let requested: Record<string, unknown>[] | undefined;
        if (typeof raw === "string") {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    requested = parsed as Record<string, unknown>[];
                }
            } catch {
                // ignore malformed JSON, fall through to offer-based defaulting
            }
        } else if (Array.isArray(raw)) {
            requested = raw;
        }

        if (requested && requested.length > 0) {
            return requested
                .filter(
                    (ad) =>
                        (ad.type as string | undefined) === "openid_credential",
                )
                .map((ad) => ({
                    type: "openid_credential",
                    credential_configuration_id: ad.credential_configuration_id,
                    // Per OID4VCI Final Section 6.2, credential_identifiers MUST be
                    // included when authorization_details are returned in the token
                    // response so the Wallet can reference them in the credential request.
                    credential_identifiers: [
                        ad.credential_configuration_id as string,
                    ],
                }))
                .filter(
                    (ad) =>
                        typeof ad.credential_configuration_id === "string" &&
                        (ad.credential_configuration_id as string).length > 0,
                );
        }

        // 2. Fallback: credential_configuration_ids from the Credential Offer.
        const offerIds: unknown =
            session.credentialPayload?.credentialConfigurationIds;
        if (Array.isArray(offerIds) && offerIds.length > 0) {
            return offerIds
                .filter((id): id is string => typeof id === "string")
                .map((id) => ({
                    type: "openid_credential",
                    credential_configuration_id: id,
                    // Per OID4VCI Final Section 6.2, credential_identifiers MUST be
                    // included when authorization_details are returned in the token
                    // response so the Wallet can reference them in the credential request.
                    credential_identifiers: [id],
                }));
        }

        return undefined;
    }

    async authzMetadata(
        tenantId: string,
    ): Promise<AuthorizationServerMetadata> {
        //TODO: read from config
        const useDpop = true;

        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);
        const walletAttestationRequired =
            issuanceConfig.walletAttestationRequired ?? false;

        const publicUrl = this.configService.getOrThrow<string>("PUBLIC_URL");
        const authServer = this.getAuthzIssuer(tenantId);

        // Check if status list aggregation is enabled for this tenant
        const statusListConfig =
            await this.statusListConfigService.getEffectiveConfig(tenantId);
        const statusListAggregationEndpoint = statusListConfig.enableAggregation
            ? `${authServer}/status-management/status-list-aggregation`
            : undefined;

        const metadata: AuthorizationServerMetadata = {
            issuer: authServer,
            token_endpoint: `${authServer}/authorize/token`,
            authorization_endpoint: `${authServer}/authorize`,
            interactive_authorization_endpoint: `${authServer}/authorize/interactive`,
            jwks_uri: `${publicUrl}/.well-known/jwks.json/issuers/${tenantId}`,
            grant_types_supported: [
                "authorization_code",
                "urn:ietf:params:oauth:grant-type:pre-authorized_code",
            ],
            dpop_signing_alg_values_supported: useDpop ? ["ES256"] : undefined,
            // TODO: verify this on the server
            require_pushed_authorization_requests: true,
            pushed_authorization_request_endpoint: `${authServer}/authorize/par`,
            code_challenge_methods_supported: [PkceCodeChallengeMethod.S256],
            authorization_details_types_supported: ["openid_credential"],
            token_endpoint_auth_methods_supported: ["none"],
            status_list_aggregation_endpoint: statusListAggregationEndpoint,
        };

        if (walletAttestationRequired) {
            metadata.token_endpoint_auth_methods_supported = [
                "attest_jwt_client_auth",
            ];
            metadata.challenge_endpoint = `${authServer}/authorize/challenge`;
            metadata.client_attestation_signing_alg_values_supported = [
                "ES256",
            ];
            metadata.client_attestation_pop_signing_alg_values_supported = [
                "ES256",
            ];
        }

        return this.getAuthorizationServer(
            tenantId,
        ).createAuthorizationServerMetadata(
            metadata as any,
        ) as AuthorizationServerMetadata;
    }

    /**
     * Client Attestation Challenge Endpoint.
     * Generates and stores a nonce for use in the Client Attestation PoP JWT.
     * @see OAuth2-ATCA07-8
     */
    async challengeRequest(
        tenantId: string,
    ): Promise<{ attestation_challenge: string }> {
        const nonce = v4();
        await this.nonceRepository.save({
            nonce,
            tenantId,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });
        return { attestation_challenge: nonce };
    }

    /**
     * Handle a Pushed Authorization Request (PAR).
     * Validates client attestation if provided/required, creates a session,
     * and returns a request_uri for the authorize endpoint.
     */
    async handlePar(
        tenantId: string,
        body: AuthorizeQueries,
        clientAttestation?: {
            clientAttestationJwt: string;
            clientAttestationPopJwt: string;
        },
    ): Promise<{ expires_in: number; request_uri: string }> {
        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);
        const authorizationServerMetadata = await this.authzMetadata(tenantId);

        try {
            await this.walletAttestationService.verifyWalletAttestation(
                tenantId,
                clientAttestation,
                authorizationServerMetadata.issuer,
                issuanceConfig.walletAttestationRequired ?? false,
                issuanceConfig.walletProviderTrustLists ?? [],
            );
        } catch {
            throw new TokenErrorException(
                "invalid_client",
                "Client attestation validation failed",
            );
        }

        const request_uri = `urn:${randomUUID()}`;
        await this.sessionService.add(body.issuer_state!, {
            request_uri,
            auth_queries: body,
        });

        return { expires_in: 500, request_uri };
    }

    sendAuthorizationResponse(values: AuthorizeQueries, tenantId) {
        if (values.request_uri) {
            return this.sessionService
                .getBy({ request_uri: values.request_uri })
                .then(async (session) => {
                    const code = await this.setAuthCode(session.id);
                    const iss = this.getAuthzIssuer(tenantId);
                    return `${session.auth_queries!.redirect_uri}?code=${code}&state=${session.auth_queries!.state}&iss=${iss}`;
                })
                .catch(async () => {
                    //if not found, this means the flow is initiated by the wallet and not the issuer which is also fine.
                    const code = v4();
                    await this.sessionService.create({
                        id: v4(),
                        tenantId,
                        authorization_code: code,
                        request_uri: values.request_uri,
                    });
                    return `${values.redirect_uri}?code=${code}`;
                });
        } else {
            throw new ConflictException(
                "request_uri not found or not provided in the request",
            );
        }
    }

    /**
     * Validate the token request.
     * This endpoint is used to exchange the authorization code for an access token.
     * Returns errors according to OID4VCI Section 6.3 Token Error Response.
     * @param body
     * @param req
     * @returns
     */
    async validateTokenRequest(
        body: any,
        req: Request,
        tenantId: string,
    ): Promise<any> {
        const url = `${this.configService.getOrThrow<string>("PUBLIC_URL")}${req.url}`;

        // Parse the access token request - malformed requests return invalid_request
        let parsedAccessTokenRequest;
        try {
            parsedAccessTokenRequest = this.getAuthorizationServer(
                tenantId,
            ).parseAccessTokenRequest({
                accessTokenRequest: body,
                request: {
                    method: req.method as HttpMethod,
                    url,
                    headers: getHeadersFromRequest(req),
                },
            });
        } catch (err: any) {
            // Malformed token request
            throw new TokenErrorException(
                "invalid_request",
                err?.message ?? "The token request is malformed",
            );
        }

        // Determine how to look up the session based on grant type
        let session;
        if (
            parsedAccessTokenRequest.grant.grantType ===
            refreshTokenGrantIdentifier
        ) {
            // For refresh_token grant, look up by refresh_token
            session = await this.sessionService
                .getBy({
                    refresh_token: parsedAccessTokenRequest.grant.refreshToken,
                })
                .catch(() => {
                    throw new TokenErrorException(
                        "invalid_grant",
                        "The provided refresh_token is invalid or expired",
                    );
                });
        } else {
            // For other grants (authorization_code, pre-authorized_code), look up by code
            const authorization_code =
                parsedAccessTokenRequest.accessTokenRequest[
                    "pre-authorized_code"
                ] ?? parsedAccessTokenRequest.accessTokenRequest["code"];
            session = await this.sessionService
                .getBy({
                    authorization_code,
                })
                .catch(() => {
                    throw new TokenErrorException(
                        "invalid_grant",
                        "The provided authorization code is invalid or expired",
                    );
                });
        }

        // Enforce single-use validation for sessions already consumed by
        // credential processing. Refresh token grant remains exempt.
        if (
            parsedAccessTokenRequest.grant.grantType !==
                refreshTokenGrantIdentifier &&
            session.consumed
        ) {
            throw new TokenErrorException(
                "invalid_grant",
                "The credential offer has already been used",
            );
        }

        const issuanceConfig =
            await this.issuanceService.getIssuanceConfiguration(tenantId);

        const authorizationServerMetadata = await this.authzMetadata(tenantId);

        // Verify wallet attestation if required or provided
        await this.walletAttestationService.verifyWalletAttestation(
            tenantId,
            parsedAccessTokenRequest.clientAttestation,
            authorizationServerMetadata.issuer,
            issuanceConfig.walletAttestationRequired ?? false,
            issuanceConfig.walletProviderTrustLists ?? [],
        );

        let dpopValue;

        if (
            parsedAccessTokenRequest.grant.grantType ===
            preAuthorizedCodeGrantIdentifier
        ) {
            // Brute-force protection: reject if session is already locked out
            if (session.credentialPayload?.tx_code) {
                const maxAttempts = issuanceConfig.txCodeMaxAttempts ?? 5;
                if ((session.txCodeFailedAttempts ?? 0) >= maxAttempts) {
                    this.logger.warn(
                        `Session ${session.id} is locked after ${session.txCodeFailedAttempts} failed tx_code attempts`,
                    );
                    throw new TokenErrorException(
                        "invalid_grant",
                        "Too many failed tx_code attempts. The pre-authorized code has been invalidated.",
                    );
                }
            }

            const { dpop } = await this.getAuthorizationServer(
                tenantId,
                session.id,
            )
                .verifyPreAuthorizedCodeAccessTokenRequest({
                    grant: parsedAccessTokenRequest.grant as ParsedAccessTokenPreAuthorizedCodeRequestGrant,
                    accessTokenRequest:
                        parsedAccessTokenRequest.accessTokenRequest,
                    request: {
                        method: req.method as HttpMethod,
                        url,
                        headers: getHeadersFromRequest(req),
                    },
                    dpop: {
                        required: issuanceConfig.dPopRequired,
                        allowedSigningAlgs:
                            authorizationServerMetadata.dpop_signing_alg_values_supported,
                        jwt: parsedAccessTokenRequest.dpop?.jwt,
                    },

                    authorizationServerMetadata,

                    expectedPreAuthorizedCode: session.authorization_code!,
                    expectedTxCode: session.credentialPayload?.tx_code,
                })
                .catch(async (err) => {
                    // Map verification errors to OAuth 2.0 error codes
                    const errorCode = this.mapToTokenErrorCode(err.error);
                    // On wrong tx_code, increment the failed attempt counter and check for lockout
                    if (errorCode === "invalid_tx_code") {
                        const maxAttempts =
                            issuanceConfig.txCodeMaxAttempts ?? 5;
                        const failedAttempts =
                            await this.sessionService.incrementTxCodeFailedAttempts(
                                session.id,
                            );
                        if (failedAttempts >= maxAttempts) {
                            this.logger.warn(
                                `Session ${session.id} locked after ${failedAttempts} failed tx_code attempts`,
                            );
                            throw new TokenErrorException(
                                "invalid_grant",
                                "Too many failed tx_code attempts. The pre-authorized code has been invalidated.",
                            );
                        }
                        this.logger.warn(
                            `Failed tx_code attempt ${failedAttempts}/${maxAttempts} for session ${session.id}`,
                        );
                    }
                    throw new TokenErrorException(
                        errorCode,
                        err.error_description,
                    );
                });
            dpopValue = dpop;
        }

        if (
            parsedAccessTokenRequest.grant.grantType ===
            authorizationCodeGrantIdentifier
        ) {
            //TODO: handle response
            const { dpop } = await this.getAuthorizationServer(
                tenantId,
                session.id,
            )
                .verifyAuthorizationCodeAccessTokenRequest({
                    grant: parsedAccessTokenRequest.grant as ParsedAccessTokenAuthorizationCodeRequestGrant,
                    accessTokenRequest:
                        parsedAccessTokenRequest.accessTokenRequest,
                    expectedCode: session.authorization_code as string,
                    request: {
                        method: req.method as HttpMethod,
                        url,
                        headers: getHeadersFromRequest(req),
                    },
                    dpop: {
                        required: issuanceConfig.dPopRequired,
                        allowedSigningAlgs:
                            authorizationServerMetadata.dpop_signing_alg_values_supported,
                        jwt: parsedAccessTokenRequest.dpop?.jwt,
                    },
                    authorizationServerMetadata,
                })
                .catch((err) => {
                    // Map verification errors to OAuth 2.0 error codes
                    const errorCode = this.mapToTokenErrorCode(err.error);
                    throw new TokenErrorException(
                        errorCode,
                        err.error_description,
                    );
                });
            dpopValue = dpop;
        }

        if (
            parsedAccessTokenRequest.grant.grantType ===
            refreshTokenGrantIdentifier
        ) {
            // For refresh_token grant, verify the token with the stored refresh_token
            await this.getAuthorizationServer(tenantId, session.id)
                .verifyRefreshTokenAccessTokenRequest({
                    grant: parsedAccessTokenRequest.grant as ParsedAccessTokenRefreshTokenRequestGrant,
                    accessTokenRequest:
                        parsedAccessTokenRequest.accessTokenRequest,
                    expectedRefreshToken: session.refresh_token!,
                    request: {
                        method: req.method as HttpMethod,
                        url,
                        headers: getHeadersFromRequest(req),
                    },
                    authorizationServerMetadata,
                    refreshTokenExpiresAt: session.refresh_token_expires_at,
                })
                .catch((err) => {
                    // Map verification errors to OAuth 2.0 error codes
                    const errorCode = this.mapToTokenErrorCode(err.error);
                    throw new TokenErrorException(
                        errorCode,
                        err.error_description,
                    );
                });
            // Note: dpopValue remains undefined for refresh_token grant
            // as DPoP is typically not required for refresh token requests
        }

        // Use pinned key from issuance config, or fall back to first available key
        const signingKeyId =
            issuanceConfig.signingKeyId ||
            (await this.keyChainService.getKid(tenantId));

        const publicKey = await this.keyChainService.getPublicKey(
            "jwk",
            tenantId,
            signingKeyId,
        );

        // Determine access token lifetime (use credential lifetime if available, otherwise 5 min default)
        const accessTokenExpiresInSeconds = 300;

        // Bind the issued access token to the Credential(s) the Wallet is
        // authorized to request, per OID4VCI Section 6. Both the JWT payload
        // (for resource-server enforcement) and the token response body (for
        // the Wallet) receive the same authorization_details.
        const authorizationDetails =
            this.buildAuthorizationDetailsForToken(session);

        const tokenResponse = await this.getAuthorizationServer(
            tenantId,
            session.id,
        )
            .createAccessTokenResponse({
                audience: `${this.configService.getOrThrow<string>("PUBLIC_URL")}/issuers/${tenantId}`,
                signer: {
                    method: "jwk",
                    alg: "ES256",
                    publicJwk: publicKey as Jwk,
                    kid: signingKeyId,
                },
                subject: session.id,
                expiresInSeconds: accessTokenExpiresInSeconds,
                authorizationServer: authorizationServerMetadata.issuer,
                clientId: req.body.client_id,
                dpop: dpopValue,
                refreshToken: issuanceConfig.refreshTokenEnabled ? true : false,
                additionalAccessTokenPayload: authorizationDetails
                    ? { authorization_details: authorizationDetails }
                    : undefined,
                additionalAccessTokenResponsePayload: authorizationDetails
                    ? { authorization_details: authorizationDetails }
                    : undefined,
            })
            .catch((err) => {
                this.logger.error("Error creating access token response:", err);
                // Internal errors during token response creation
                throw new TokenErrorException(
                    "invalid_request",
                    "Failed to create access token response",
                );
            });

        // Store the refresh_token in the session if it was generated
        if (tokenResponse.refresh_token) {
            // Calculate refresh token expiration based on configured lifetime
            let refreshTokenExpiresAt: Date | undefined;
            if (issuanceConfig.refreshTokenExpiresInSeconds) {
                const now = new Date();
                refreshTokenExpiresAt = new Date(
                    now.getTime() +
                        (issuanceConfig.refreshTokenExpiresInSeconds || 0) *
                            1000,
                );
            }

            await this.sessionService.add(session.id, {
                consumed: true, // Mark the session as consumed to prevent reuse
                refresh_token: tokenResponse.refresh_token,
                refresh_token_expires_at: refreshTokenExpiresAt,
            });
        }

        return tokenResponse;
    }

    /**
     * Set the authorization code for a session based on the issuer_state and return the code.
     * @param issuer_state
     * @returns
     */
    async setAuthCode(issuer_state: string) {
        const code = randomUUID();
        await this.sessionService.add(issuer_state, {
            authorization_code: code,
        });
        return code;
    }
}
