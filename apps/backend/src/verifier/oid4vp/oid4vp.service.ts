import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import { base64url } from "jose";
import { Span, TraceService } from "nestjs-otel";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { v4 } from "uuid";
import { EncryptionService } from "../../crypto/encryption/encryption.service";
import { CertService } from "../../crypto/key/cert/cert.service";
import { CryptoImplementationService } from "../../crypto/key/crypto-implementation/crypto-implementation.service";
import { KeyUsageType } from "../../crypto/key/entities/key-chain.entity";
import { KeyChainService } from "../../crypto/key/key-chain.service";
import { OfferResponse } from "../../issuer/issuance/oid4vci/dto/offer-request.dto";
import { RegistrarService } from "../../registrar/registrar.service";
import { SessionStatus } from "../../session/entities/session.entity";
import { SessionService } from "../../session/session.service";
import { AuditLogContext } from "../../shared/utils/logger/audit-log.service";
import { SessionLoggerService } from "../../shared/utils/logger/session-logger.service";
import { WebhookService } from "../../shared/utils/webhook/webhook.service";
import { AuthResponse } from "../presentations/dto/auth-response.dto";
import { IncompletePresentationException } from "../presentations/exceptions/incomplete-presentation.exception";
import { PresentationsService } from "../presentations/presentations.service";
import { AuthorizationResponse } from "./dto/authorization-response.dto";
import { PresentationRequestOptions } from "./dto/presentation-request-options.dto";
import { CredentialFormat } from "../../issuer/configuration/credentials/entities/credential.entity";

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
        private readonly cryptoImplementationService: CryptoImplementationService,
        private readonly traceService: TraceService,
    ) {}

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

        // No cached request - generate new one (for request_uri_method="post" flows)
        return this.createAuthorizationRequest(session.id, origin, noRedirect);
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

            const dcql_query = JSON.parse(
                JSON.stringify(presentationConfig.dcql_query).replaceAll(
                    "<TENANT_URL>",
                    tenantHost,
                ),
            );

            //remove trusted_authorities from dcql
            dcql_query.credentials = dcql_query.credentials.map((cred: any) => {
                const { trusted_authorities, ...rest } = cred;
                return rest;
            });

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

            // Per OID4VP spec Section 13.3: use walletNonce in wallet-facing URLs
            // to separate the wallet-facing identifier (request-id) from the
            // frontend-facing session ID (transaction-id).
            const walletFacingId = session.walletNonce ?? session.id;

            const request = {
                payload: {
                    response_type: "vp_token",
                    client_id: "x509_hash:" + certHash,
                    response_uri: `${host}/presentations/${walletFacingId}/oid4vp`,
                    response_mode: session.useDcApi
                        ? "dc_api.jwt"
                        : "direct_post.jwt",
                    nonce,
                    expected_origins: session.useDcApi ? [origin] : undefined,
                    dcql_query,
                    client_metadata: {
                        jwks: {
                            keys: [
                                await this.encryptionService.getEncryptionPublicKey(
                                    session.tenantId,
                                ),
                            ],
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
                    verifier_attestations: regCert
                        ? [
                              {
                                  format: "jwt",
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

            const session = await this.sessionService.create({
                id: values.session,
                walletNonce,
                parsedWebhook: values.webhook,
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
        const session = await this.resolveSessionByNonce(nonce);

        // Enforce single-use validation: prevent replay attacks
        // Check if this presentation request has already been consumed
        if (session.consumed) {
            throw new BadRequestException(
                "The presentation offer has already been used",
            );
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

        // Handle wallet error responses per OID4VP spec section 6.2
        // When wallet cannot fulfill the request, it sends an OAuth 2.0 error response
        if (body.error) {
            const errorMessage = body.error_description
                ? `${body.error}: ${body.error_description}`
                : body.error;

            // Create audit logging context for error response
            const logContext: AuditLogContext = {
                sessionId: session.id,
                tenantId: session.tenantId,
                flowType: "OID4VP",
                stage: "response_processing",
            };

            this.auditLogger.logFlowError(
                logContext,
                new Error(`Wallet error response: ${errorMessage}`),
                {
                    action: "wallet_error_response",
                    errorCode: body.error,
                    errorDescription: body.error_description,
                },
            );

            // Update session with failed status
            await this.sessionService.add(session.id, {
                status: SessionStatus.Failed,
                errorReason: `Wallet error: ${errorMessage}`,
            });

            // Return redirect_uri with error if configured
            // and propagate HTTP 400 while preserving response body shape.
            if (session.redirectUri) {
                const processedRedirectUri = decodeURIComponent(
                    session.redirectUri,
                ).replaceAll("{sessionId}", session.id);

                const separator = processedRedirectUri.includes("?")
                    ? "&"
                    : "?";
                throw new BadRequestException({
                    redirect_uri: `${processedRedirectUri}${separator}error=${encodeURIComponent(body.error)}${body.error_description ? `&error_description=${encodeURIComponent(body.error_description)}` : ""}`,
                });
            }

            // Return empty response body (session status indicates failure)
            // and propagate HTTP 400.
            throw new BadRequestException({});
        }

        // Ensure response field is present for success path
        if (!body.response) {
            throw new BadRequestException(
                "Missing response field in authorization response",
            );
        }

        const decrypted = await this.encryptionService.decryptJwe<AuthResponse>(
            body.response,
            session.tenantId,
        );

        // Validate decrypted response against AuthResponse class
        const res = plainToInstance(AuthResponse, decrypted);
        this.logger.trace(
            { decryptedResponse: decrypted },
            "[TRACE] Decrypted OID4VP authorization response",
        );
        try {
            await validateOrReject(res);
        } catch (errors) {
            throw new BadRequestException(
                `Invalid authorization response: ${JSON.stringify(errors)}`,
            );
        }

        //for dc api the state is no longer included in the res, see: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-request

        // Create audit logging context
        const logContext: AuditLogContext = {
            sessionId: session.id,
            tenantId: session.tenantId,
            flowType: "OID4VP",
            stage: "response_processing",
        };

        const presentationConfig =
            await this.presentationsService.getPresentationConfig(
                session.requestId!,
                session.tenantId,
            );
        const webhook = session.parsedWebhook || presentationConfig.webhook;

        this.auditLogger.logFlowStart(logContext, {
            action: "process_presentation_response",
            hasWebhook: !!webhook,
        });

        try {
            //TODO: load required fields from the config
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

            // Validate state matches the expected walletNonce / session ID
            // For DC API, state is not included in the response (per OID4VP spec).
            if (res.state && res.state !== expectedState) {
                throw new BadRequestException(
                    "State mismatch: response state does not match expected value",
                );
            }

            // Per OID4VP spec Section 13.3: generate a response_code after successful
            // VP Token processing. This is included in redirect_uri so only the
            // legitimate frontend (which receives the redirect) can confirm completion.
            const responseCode = randomUUID();

            await this.sessionService.add(session.id, {
                //TODO: not clear why it has to be any
                credentials: credentials as any,
                status: SessionStatus.Completed,
                responseCode,
                consumed: true,
                consumedAt: new Date(),
            });
            // if there a a webhook passed in the session, use it
            if (webhook) {
                const response = await this.webhookService
                    .sendWebhook({
                        webhook,
                        session,
                        credentials,
                        expectResponse: false,
                        // ==========================================================
                        // Direct Pass-through of the raw presentation payload.
                        // We intentionally do not persist this in the database (Session entity)
                        // to adhere to privacy-by-design principles (data minimization).
                        // Since webhooks currently do not support retries, keeping
                        // the raw PII/tokens only in memory for this call is sufficient.
                        // ==========================================================
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
                //override it when a redirect URI is returned by the webhook
                if (response?.redirectUri) {
                    session.redirectUri = response.redirectUri;
                }
            }

            this.auditLogger.logFlowComplete(logContext, {
                credentialCount: credentials?.length || 0,
                webhookSent: !!webhook,
            });

            //check if a redirect URI is defined and return it to the caller. If so, sendResponse is ignored
            if (session.redirectUri) {
                //TODO: not clear with the brackets are encoded
                // Replace {sessionId} placeholder with actual session ID
                const processedRedirectUri = decodeURIComponent(
                    session.redirectUri,
                ).replaceAll("{sessionId}", session.id);
                // Per OID4VP spec Section 13.3: include response_code in redirect_uri
                // so the frontend can use it to confirm the session completed legitimately.
                const separator = processedRedirectUri.includes("?")
                    ? "&"
                    : "?";
                return {
                    redirect_uri: `${processedRedirectUri}${separator}response_code=${responseCode}`,
                };
            }

            if (body.sendResponse) {
                return credentials;
            }

            return {};
        } catch (error: any) {
            this.auditLogger.logFlowError(logContext, error as Error, {
                action: "process_presentation_response",
            });

            // Per OID4VP spec, the verifier MUST always return HTTP 200.
            // Validation failures are documented in the session and communicated
            // via redirect_uri (if configured) or session status.
            const errorMessage =
                error instanceof IncompletePresentationException
                    ? error.message
                    : `Presentation validation failed: ${error.message}`;

            // Update session with failed status and error reason
            await this.sessionService.add(session.id, {
                status: SessionStatus.Failed,
                errorReason: errorMessage,
            });

            // If redirect_uri is configured, return it with error parameter,
            // while propagating HTTP 400.
            if (session.redirectUri) {
                const processedRedirectUri = decodeURIComponent(
                    session.redirectUri,
                ).replaceAll("{sessionId}", session.id);

                // Append error query parameter to redirect URI
                const separator = processedRedirectUri.includes("?")
                    ? "&"
                    : "?";
                throw new BadRequestException({
                    redirect_uri: `${processedRedirectUri}${separator}error=invalid_request&error_description=${encodeURIComponent(errorMessage)}`,
                });
            }

            // Return empty response body (session status indicates failure)
            // and propagate HTTP 400.
            throw new BadRequestException({});
        }
    }
}
