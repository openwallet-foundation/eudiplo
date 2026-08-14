import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { base64url } from "jose";
import { Span, TraceService } from "nestjs-otel";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { Repository } from "typeorm";
import { v4 } from "uuid";
import { EncryptionService } from "../../crypto/encryption/encryption.service";
import { CertService } from "../../crypto/key/cert/cert.service";
import { CryptoImplementationService } from "../../crypto/key/crypto-implementation/crypto-implementation.service";
import { KeyUsageType } from "../../crypto/key/types/key-usage-type";
import { KeyChainService } from "../../crypto/key/key-chain.service";
import { CredentialFormat } from "../../issuer/configuration/credentials/entities/credential.entity";
import { WebhookEndpointEntity } from "../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity";
import { OfferResponse } from "../../issuer/issuance/oid4vci/dto/offer-request.dto";
import { RegistrarService } from "../../registrar/registrar.service";
import {
    PresentationFailureCode,
    WALLET_PROTOCOL_ERROR_ALLOWLIST,
} from "../../session/entities/presentation-failure-code.enum";
import { SessionStatus } from "../../session/entities/session.entity";
import { SessionService } from "../../session/session.service";
import { DEFAULT_VERIFIER_SKEW_SECONDS } from "../../shared/trust/types";
import { AuditLogContext } from "../../shared/utils/logger/audit-log.service";
import { SessionLoggerService } from "../../shared/utils/logger/session-logger.service";
import { WebhookService } from "../../shared/utils/webhook/webhook.service";
import {
    AuthResponse,
    AuthResponseSchema,
} from "../presentations/dto/auth-response.dto";
import { PresentationVerificationException } from "../presentations/exceptions/presentation-verification.exception";
import { PresentationsService } from "../presentations/presentations.service";
import { applyTrustedAuthoritiesPolicy } from "./dcql-trusted-authorities.util";
import { AuthorizationResponse } from "./dto/authorization-response.dto";
import { PresentationRequestOptions } from "./dto/presentation-request.dto";

@Injectable()
export class Oid4vpService {
    constructor(
        @InjectPinoLogger(Oid4vpService.name)
        private readonly logger: PinoLogger,
        private readonly certService: CertService,
        public readonly keyChainService: KeyChainService,
        private readonly encryptionService: EncryptionService,
        private readonly configService: ConfigService,
        private readonly registrarService: RegistrarService,
        private readonly presentationsService: PresentationsService,
        private readonly sessionService: SessionService,
        private readonly auditLogger: SessionLoggerService,
        private readonly webhookService: WebhookService,
        @InjectRepository(WebhookEndpointEntity)
        private readonly webhookEndpointRepo: Repository<WebhookEndpointEntity>,
        private readonly cryptoImplementationService: CryptoImplementationService,
        private readonly traceService: TraceService,
    ) {}

    private async resolveWebhookFromEndpoint(
        webhookEndpointId: string | null | undefined,
        tenantId: string,
    ) {
        if (!webhookEndpointId) {
            return undefined;
        }

        const endpoint = await this.webhookEndpointRepo.findOneBy({
            id: webhookEndpointId,
            tenantId,
        });

        if (!endpoint) {
            this.logger.warn(
                {
                    tenantId,
                    webhookEndpointId,
                },
                "Webhook endpoint configured on presentation config was not found",
            );
            return undefined;
        }

        return {
            url: endpoint.url,
            auth: endpoint.auth,
        };
    }

    private normalizeWalletProtocolError(protocolError?: string):
        | string
        | undefined {
        if (!protocolError) {
            return undefined;
        }

        return WALLET_PROTOCOL_ERROR_ALLOWLIST.has(protocolError)
            ? protocolError
            : undefined;
    }

    private buildRedirectUriWithResponseCode(
        redirectUri: string,
        sessionId: string,
        responseCode: string,
    ): string {
        const resolvedRedirectUri = decodeURIComponent(redirectUri).replaceAll(
            "{sessionId}",
            sessionId,
        );

        try {
            const url = new URL(resolvedRedirectUri);
            url.searchParams.set("response_code", responseCode);
            return url.toString();
        } catch {
            const separator = resolvedRedirectUri.includes("?") ? "&" : "?";
            return `${resolvedRedirectUri}${separator}response_code=${encodeURIComponent(responseCode)}`;
        }
    }

    private mapFailureCode(error: unknown): PresentationFailureCode {
        if (error instanceof PresentationVerificationException) {
            return error.failureCode;
        }

        return PresentationFailureCode.VerificationFailed;
    }

    private async finalizeFailedSession(
        sessionId: string,
        failureCode: PresentationFailureCode,
        errorReason: string,
        protocolError?: string,
    ): Promise<{ redirect_uri?: string }> {
        const session = await this.sessionService.get(sessionId);
        const responseCode = session.redirectUri
            ? await this.sessionService.issueResponseCode(session.id)
            : undefined;

        await this.sessionService.add(session.id, {
            status: SessionStatus.Failed,
            errorReason,
            presentationFailureCode: failureCode,
            presentationFailureProtocolError: protocolError ?? (null as any),
            consumed: true,
            consumedAt: session.consumedAt ?? new Date(),
        });

        if (!session.redirectUri || !responseCode) {
            return {};
        }

        return {
            redirect_uri: this.buildRedirectUriWithResponseCode(
                session.redirectUri,
                session.id,
                responseCode,
            ),
        };
    }

    private async finalizeSuccessfulSession(
        sessionId: string,
        credentials: unknown[],
    ): Promise<{ redirect_uri?: string }> {
        const session = await this.sessionService.get(sessionId);
        const responseCode = session.redirectUri
            ? await this.sessionService.issueResponseCode(session.id)
            : undefined;

        await this.sessionService.add(session.id, {
            credentials: credentials as any,
            status: SessionStatus.Completed,
            consumed: true,
            consumedAt: session.consumedAt ?? new Date(),
            errorReason: null as any,
            presentationFailureCode: null as any,
            presentationFailureProtocolError: null as any,
        });

        if (!session.redirectUri || !responseCode) {
            return {};
        }

        return {
            redirect_uri: this.buildRedirectUriWithResponseCode(
                session.redirectUri,
                session.id,
                responseCode,
            ),
        };
    }

    /**
     * Resolves a session from a wallet-facing nonce.
     * Per OID4VP spec Section 13.3, wallet-facing URLs use a separate walletNonce
     * instead of the session ID. Falls back to session ID lookup for backward
     * compatibility with sessions created before the walletNonce migration.
     */
    private async resolveSessionByNonce(nonce: string) {
        const session = await this.sessionService.findByWalletNonce(nonce);
        if (session) {
            return session;
        }
        return this.sessionService.get(nonce);
    }

    /**
     * Gets the authorization request for a session.
     * Returns the cached requestObject if available (for request_uri_method="get"),
     * otherwise generates a new one.
     *
     * This ensures the wallet receives the exact same JWT that was stored during
     * session creation, which is essential for transaction_data hash validation.
     */
    @Span("oid4vp.getAuthorizationRequest")
    async getAuthorizationRequest(
        nonce: string,
        origin: string,
        noRedirect = false,
    ): Promise<string> {
        const session = await this.resolveSessionByNonce(nonce);

        // Add session context to span for trace correlation
        const span = this.traceService.getSpan();
        span?.setAttributes({
            "session.id": session.id,
            "session.tenantId": session.tenantId,
            "session.requestId": session.requestId ?? "",
            "oid4vp.cached": !!session.requestObject,
        });

        // Return cached requestObject if available (pre-generated during session creation)
        // This ensures transaction_data hash validation works correctly
        if (session.requestObject) {
            // Handle noRedirect flag even for cached requests
            if (noRedirect) {
                await this.sessionService.add(session.id, {
                    redirectUri: null,
                });
            }
            return session.requestObject;
        }

        // No cached request - generate and persist so nonce/audience stay stable
        // across repeated request_uri fetches.
        const requestObject = await this.createAuthorizationRequest(
            session.id,
            origin,
            noRedirect,
        );
        await this.sessionService.add(session.id, {
            requestObject,
        });
        return requestObject;
    }

    /**
     * Creates an authorization request for the OID4VP flow.
     * This method generates a JWT that includes the necessary parameters for the authorization request.
     * It initializes the session logging context and logs the start of the flow.
     * @param session
     * @param origin
     * @param noRedirect
     * @returns
     */
    @Span("oid4vp.createAuthorizationRequest")
    async createAuthorizationRequest(
        sessionId: string,
        origin: string,
        noRedirect = false,
    ): Promise<string> {
        const session = await this.sessionService.get(sessionId);

        // Add session context to span for trace correlation
        const span = this.traceService.getSpan();
        span?.setAttributes({
            "session.id": session.id,
            "session.tenantId": session.tenantId,
            "session.requestId": session.requestId ?? "",
        });

        // if noRedirect is true, we want to keep the redirectUri undefined in the session, as it will be used by the client to decide whether to redirect or not after receiving the response. If it's defined, the client will always redirect, even if it was instructed not to.
        if (noRedirect) {
            await this.sessionService.add(session.id, {
                redirectUri: null,
            });
        }

        // Create audit logging context
        const logContext: AuditLogContext = {
            sessionId: session.id,
            tenantId: session.tenantId,
            flowType: "OID4VP",
            stage: "authorization_request",
        };

        this.auditLogger.logFlowStart(logContext, {
            requestId: session.requestId,
            action: "create_authorization_request",
        });

        try {
            const host = this.configService.getOrThrow<string>("PUBLIC_URL");
            const tenantHost = `${host}/issuers/${session.tenantId}`;

            const presentationConfig =
                await this.presentationsService.getPresentationConfig(
                    session.requestId!,
                    session.tenantId,
                );
            let regCert: string | undefined = undefined;

            let dcql_query = JSON.parse(
                JSON.stringify(presentationConfig.dcql_query).replaceAll(
                    "<TENANT_URL>",
                    tenantHost,
                ),
            );

            // Transform internal etsi_tl trusted_authorities (TrustListRef objects)
            // to the DCQL-compliant aki format (base64url Subject Key Identifier
            // strings). Wallets must receive string values per OID4VP 1.0 Final §6.
            dcql_query =
                await this.presentationsService.transformDcqlTrustedAuthoritiesToAki(
                    dcql_query,
                    session.tenantId,
                );

            // Some wallets do not yet handle trusted_authorities correctly.
            // VP_REMOVE_TA is an escape hatch to strip it from the DCQL query
            // sent to wallets; disabled by default.
            dcql_query = applyTrustedAuthoritiesPolicy(
                dcql_query,
                !!this.configService.get<boolean>("VP_REMOVE_TA"),
            );

            if (
                presentationConfig.registration_cert &&
                (await this.registrarService.isEnabledForTenant(
                    session.tenantId,
                ))
            ) {
                regCert =
                    await this.presentationsService.getOrIssueRegistrationCertificate(
                        presentationConfig,
                        dcql_query,
                        session.requestId!,
                    );
            }
            const nonce = randomUUID();
            await this.sessionService.add(session.id, {
                vp_nonce: nonce,
            });

            const lifeTime = 60 * 60;

            const cert = await this.certService.find({
                tenantId: session.tenantId,
                type: KeyUsageType.Access,
                certId: presentationConfig.accessKeyChainId ?? undefined,
            });

            const certHash = this.certService.getCertHash(cert);

            // Use transaction_data from session (which may have been overridden) or fall back to config
            const transaction_data =
                (
                    session.transaction_data ??
                    presentationConfig.transaction_data
                )?.map((td) => base64url.encode(JSON.stringify(td))) ||
                undefined;

            const { publicJwk: responseEncryptionPublicJwk, privateJwk } =
                await this.encryptionService.generateEphemeralEncryptionKeyPair();
            await this.sessionService.add(session.id, {
                responseEncryptionPrivateJwk: privateJwk,
            });

            // Per OID4VP spec Section 13.3: use walletNonce in wallet-facing URLs
            // to separate the wallet-facing identifier (request-id) from the
            // frontend-facing session ID (transaction-id).
            const walletFacingId = session.walletNonce ?? session.id;
            const normalizedExpectedOrigin = session.useDcApi
                ? this.normalizeExpectedOrigin(origin)
                : undefined;

            if (session.useDcApi && !normalizedExpectedOrigin) {
                this.logger.warn(
                    { sessionId: session.id, origin },
                    "Missing or invalid Origin header for DC API request; expected_origins omitted",
                );
            }

            const request = {
                payload: {
                    response_type: "vp_token",
                    client_id: "x509_hash:" + certHash,
                    response_uri: `${host}/presentations/${walletFacingId}/oid4vp`,
                    response_mode: session.useDcApi
                        ? "dc_api.jwt"
                        : "direct_post.jwt",
                    nonce,
                    expected_origins: normalizedExpectedOrigin
                        ? [normalizedExpectedOrigin]
                        : undefined,
                    dcql_query,
                    client_metadata: {
                        jwks: {
                            keys: [responseEncryptionPublicJwk],
                        },
                        vp_formats_supported: {
                            mso_mdoc: {
                                alg: this.cryptoImplementationService.getAlgs(
                                    CredentialFormat.MSO_MDOC,
                                ),
                            },
                            "dc+sd-jwt": {
                                "kb-jwt_alg_values":
                                    this.cryptoImplementationService.getAlgs(
                                        CredentialFormat.SD_JWT_VC,
                                    ),
                                "sd-jwt_alg_values":
                                    this.cryptoImplementationService.getAlgs(
                                        CredentialFormat.SD_JWT_VC,
                                    ),
                            },
                        },
                        encrypted_response_enc_values_supported: [
                            "A128GCM",
                            "A256GCM",
                        ],
                    },
                    state: session.useDcApi ? undefined : walletFacingId,
                    transaction_data,
                    //TODO: check if this value is correct accroding to https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-aud-of-a-request-object
                    aud: "https://self-issued.me/v2",
                    exp: Math.floor(Date.now() / 1000) + lifeTime,
                    iat: Math.floor(Date.now() / 1000),
                    verifier_info: regCert
                        ? [
                              {
                                  format: "registration_cert",
                                  data: regCert,
                              },
                          ]
                        : undefined,
                },
                header: {
                    typ: "oauth-authz-req+jwt",
                },
            };

            const header = {
                ...request.header,
                alg: "ES256",
                x5c: this.certService.getCertChain(cert),
            };

            const signedJwt = await this.keyChainService.signJWT(
                request.payload,
                header,
                session.tenantId,
                cert.keyId,
            );

            return signedJwt;
        } catch (error) {
            this.auditLogger.logFlowError(logContext, error as Error, {
                requestId: session.requestId,
                action: "create_authorization_request",
            });
            throw error;
        }
    }

    private normalizeExpectedOrigin(origin: string): string | undefined {
        const trimmed = origin.trim();
        if (!trimmed) {
            return undefined;
        }

        const prefixed = /^https?:\/\//i.test(trimmed)
            ? trimmed
            : `http://${trimmed}`;

        try {
            return new URL(prefixed).origin;
        } catch {
            return undefined;
        }
    }

    /**
     * Creates a request for the OID4VP flow.
     * @param requestId
     * @param values
     * @param tenantId
     * @returns
     */
    async createRequest(
        requestId: string,
        values: PresentationRequestOptions,
        tenantId: string,
        useDcApi: boolean,
        origin: string,
    ): Promise<OfferResponse> {
        const presentationConfig =
            await this.presentationsService.getPresentationConfig(
                requestId,
                tenantId,
            );
        const fresh = values.session === undefined;
        values.session = values.session || v4();

        // Per OID4VP spec Section 13.3: generate a separate walletNonce for
        // wallet-facing URLs so the QR code / request_uri does not reveal the
        // session ID (transaction-id) used by the frontend for polling.
        const walletNonce = randomUUID();

        const request_uri_method: "get" | "post" = "get";

        const cert = await this.certService.find({
            tenantId: tenantId,
            type: KeyUsageType.Access,
            certId: presentationConfig.accessKeyChainId ?? undefined,
        });

        const certHash = this.certService.getCertHash(cert);

        const params = {
            client_id: "x509_hash:" + certHash,
            request_uri: `${this.configService.getOrThrow<string>("PUBLIC_URL")}/presentations/${walletNonce}/oid4vp/request`,
            request_uri_method,
        };
        const queryString = Object.entries(params)
            .map(
                ([key, value]) =>
                    `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
            )
            .join("&");

        // Create cross-device params with /no-redirect appended to request_uri
        const crossDeviceParams = {
            ...params,
            request_uri: `${this.configService.getOrThrow<string>("PUBLIC_URL")}/presentations/${walletNonce}/oid4vp/request/no-redirect`,
        };
        const crossDeviceQueryString = Object.entries(crossDeviceParams)
            .map(
                ([key, value]) =>
                    `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
            )
            .join("&");

        const expiresAt = new Date(
            Date.now() + (presentationConfig.lifeTime ?? 300) * 1000,
        );

        if (fresh) {
            const host = this.configService.getOrThrow<string>("PUBLIC_URL");
            const clientId = "x509_hash:" + certHash;
            const responseUri = useDcApi
                ? undefined
                : `${host}/presentations/${walletNonce}/oid4vp`;

            // Use transaction_data from options if provided, otherwise fall back to config
            const transaction_data =
                values.transaction_data ?? presentationConfig.transaction_data;
            const endpointWebhook = await this.resolveWebhookFromEndpoint(
                presentationConfig.webhookEndpointId,
                tenantId,
            );

            const session = await this.sessionService.create({
                id: values.session,
                walletNonce,
                webhookEndpointId:
                    presentationConfig.webhookEndpointId ?? undefined,
                parsedWebhook: values.webhook ?? endpointWebhook,
                redirectUri:
                    values.redirectUri ??
                    presentationConfig.redirectUri ??
                    undefined,
                tenantId,
                requestId,
                requestUrl: `openid4vp://?${queryString}`,
                expiresAt,
                useDcApi,
                clientId,
                responseUri,
                transaction_data,
                skewSeconds:
                    values.skewSeconds ??
                    presentationConfig.skewSeconds ??
                    DEFAULT_VERIFIER_SKEW_SECONDS,
            });

            if (request_uri_method === "get") {
                const signedJwt = await this.createAuthorizationRequest(
                    session.id,
                    origin,
                );
                this.sessionService.add(values.session, {
                    requestObject: signedJwt,
                });
            }
        } else {
            await this.sessionService.add(values.session, {
                walletNonce,
                requestUrl: `openid4vp://?${queryString}`,
                expiresAt,
                useDcApi,
            });
        }

        return {
            uri: queryString,
            crossDeviceUri: crossDeviceQueryString,
            session: values.session,
        };
    }

    /**
     * Processes the response from the wallet.
     * Per OID4VP spec Section 13.3, the nonce parameter is the walletNonce
     * from the URL path (not the session ID).
     * @param body
     * @param nonce - walletNonce from the URL path (or session ID for legacy sessions)
     */
    @Span("oid4vp.getResponse")
    async getResponse(body: AuthorizationResponse, nonce: string) {
        let session;

        try {
            session = await this.resolveSessionByNonce(nonce);
        } catch {
            return {};
        }

        // Add session context to span for trace correlation
        const span = this.traceService.getSpan();
        span?.setAttributes({
            "session.id": session.id,
            "session.tenantId": session.tenantId,
            "session.requestId": session.requestId ?? "",
        });

        // The expected state value is the walletNonce (or session.id for legacy sessions)
        const expectedState = session.walletNonce ?? session.id;

        // Create audit logging context
        const logContext: AuditLogContext = {
            sessionId: session.id,
            tenantId: session.tenantId,
            flowType: "OID4VP",
            stage: "response_processing",
        };

        if (session.consumed) {
            this.auditLogger.logFlowError(
                logContext,
                new Error("Replay detected for consumed presentation session"),
                {
                    action: "replay_detected",
                },
            );

            // Keep existing terminal states untouched to avoid rewriting completed outcomes.
            if (
                session.status === SessionStatus.Completed ||
                session.status === SessionStatus.Failed
            ) {
                return {};
            }

            return this.finalizeFailedSession(
                session.id,
                PresentationFailureCode.ReplayDetected,
                "Replay detected for consumed presentation session",
            );
        }

        const sessionExpiresAt = session.expiresAt
            ? new Date(session.expiresAt as unknown as string)
            : undefined;

        if (
            sessionExpiresAt &&
            !Number.isNaN(sessionExpiresAt.getTime())
        ) {
            const expirationCutoff = new Date(sessionExpiresAt);
            expirationCutoff.setHours(23, 59, 59, 999);

            if (expirationCutoff.getTime() < Date.now()) {
            return this.finalizeFailedSession(
                session.id,
                PresentationFailureCode.SessionExpired,
                "Presentation session expired",
            );
            }
        }

        // Handle wallet error responses per OID4VP spec section 6.2.
        if (body.error) {
            const errorMessage = body.error_description
                ? `${body.error}: ${body.error_description}`
                : body.error;
            const protocolError = this.normalizeWalletProtocolError(body.error);

            this.auditLogger.logFlowError(
                logContext,
                new Error(`Wallet error response: ${errorMessage}`),
                {
                    action: "wallet_error_response",
                    errorCode: body.error,
                    errorDescription: body.error_description,
                },
            );

            return this.finalizeFailedSession(
                session.id,
                PresentationFailureCode.WalletError,
                `Wallet error: ${errorMessage}`,
                protocolError,
            );
        }

        if (!body.response) {
            return this.finalizeFailedSession(
                session.id,
                PresentationFailureCode.ResponseInvalid,
                "Missing response field in authorization response",
            );
        }

        try {
            const decrypted =
                await this.encryptionService.decryptJweWithPrivateJwk<AuthResponse>(
                    body.response,
                    session.tenantId,
                    session.responseEncryptionPrivateJwk as
                        | Record<string, unknown>
                        | undefined,
                );

            const parsed = AuthResponseSchema.safeParse(decrypted);
            if (!parsed.success) {
                return this.finalizeFailedSession(
                    session.id,
                    PresentationFailureCode.ResponseInvalid,
                    "Invalid authorization response",
                );
            }

            const res: AuthResponse = parsed.data;
            this.logger.trace(
                { decryptedResponse: decrypted },
                "[TRACE] Decrypted OID4VP authorization response",
            );

            const presentationConfig =
                await this.presentationsService.getPresentationConfig(
                    session.requestId!,
                    session.tenantId,
                );
            const webhook =
                session.parsedWebhook ??
                (await this.resolveWebhookFromEndpoint(
                    session.webhookEndpointId ??
                        presentationConfig.webhookEndpointId,
                    session.tenantId,
                ));

            this.auditLogger.logFlowStart(logContext, {
                action: "process_presentation_response",
                hasWebhook: !!webhook,
            });

            if (res.state && res.state !== expectedState) {
                throw new PresentationVerificationException(
                    PresentationFailureCode.HolderBindingFailed,
                    "State mismatch: response state does not match expected value",
                );
            }

            const credentials = await this.presentationsService.parseResponse(
                res,
                presentationConfig,
                session,
            );

            this.auditLogger.logCredentialVerification(
                logContext,
                !!credentials && credentials.length > 0,
                {
                    credentialCount: credentials?.length || 0,
                    nonce: session.vp_nonce,
                },
            );

            if (webhook) {
                const response = await this.webhookService
                    .sendWebhook({
                        webhook,
                        session,
                        credentials,
                        expectResponse: false,
                        rawPresentationPayload: decrypted,
                    })
                    .catch((error) => {
                        this.auditLogger.logFlowError(
                            logContext,
                            error as Error,
                            {
                                action: "webhook_callback",
                            },
                        );
                    });

                if (response?.redirectUri) {
                    await this.sessionService.add(session.id, {
                        redirectUri: response.redirectUri,
                    });
                }
            }

            this.auditLogger.logFlowComplete(logContext, {
                credentialCount: credentials?.length || 0,
                webhookSent: !!webhook,
            });

            return this.finalizeSuccessfulSession(session.id, credentials);
        } catch (error) {
            this.auditLogger.logFlowError(logContext, error as Error, {
                action: "process_presentation_response",
            });

            const failureCode = this.mapFailureCode(error);
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Presentation validation failed";

            return this.finalizeFailedSession(
                session.id,
                failureCode,
                errorMessage,
            );
        }
    }
}
