/**
 * ISO 18013-7 Annex C — org.iso.mdoc DC API flow.
 *
 * Handles offer creation (DeviceRequest + encryptionInfo) and
 * encrypted device response processing (HPKE decrypt → verify → webhook).
 */

import { randomBytes, randomUUID } from "node:crypto";
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { EncryptionService } from "../../crypto/encryption/encryption.service";
import { ServiceTypeIdentifier } from "../../issuer/trust-list/trustlist.service";
import { SessionStatus } from "../../session/entities/session.entity";
import { SessionService } from "../../session/session.service";
import { VerifierOptions } from "../../shared/trust/types";
import { AuditLogService } from "../../shared/utils/logger/audit-log.service";
import { WebhookService } from "../../shared/utils/webhook/webhook.service";
import { MdocverifierService } from "../presentations/credential/mdocverifier/mdocverifier.service";
import { TrustedAuthorityType } from "../presentations/entities/presentation-config.entity";
import { PresentationsService } from "../presentations/presentations.service";
import {
    buildBrowserHandoverTranscript,
    buildDeviceRequestCbor,
    buildEncryptionInfo,
} from "./cbor-request";
import { hpkeOpen } from "./hpke";

export interface Iso18013Offer {
    session: string;
    uri: string;
    crossDeviceUri: string;
    org_iso_mdoc: {
        device_request: string; // base64url CBOR DeviceRequest
        encryption_info: string; // base64url CBOR EncryptionInfo
    };
}

@Injectable()
export class Iso18013Service {
    constructor(
        private readonly presentationsService: PresentationsService,
        private readonly sessionService: SessionService,
        private readonly encryptionService: EncryptionService,
        private readonly mdocverifierService: MdocverifierService,
        private readonly webhookService: WebhookService,
        private readonly auditLogService: AuditLogService,
        private readonly configService: ConfigService,
        @InjectPinoLogger(Iso18013Service.name)
        private readonly logger: PinoLogger,
    ) {}

    /**
     * Create an ISO 18013-7 Annex C offer: build DeviceRequest + encryptionInfo
     * and persist a session for the response phase.
     */
    async createOffer(
        requestId: string,
        tenantId: string,
        origin: string,
    ): Promise<Iso18013Offer> {
        const config = await this.presentationsService.getPresentationConfig(
            requestId,
            tenantId,
        );

        const pubJwk =
            await this.encryptionService.getEncryptionPublicKey(tenantId);
        const nonce = randomBytes(16);
        const sessionId = randomUUID();

        // Find the first mso_mdoc credential in the DCQL query
        const mdocCred = config.dcql_query.credentials.find(
            (c) => c.format === "mso_mdoc",
        );
        if (!mdocCred) {
            throw new BadRequestException(
                `Presentation config "${requestId}" has no mso_mdoc credential`,
            );
        }

        const docType = (mdocCred.meta as { doctype?: string })?.doctype;
        if (!docType) {
            throw new BadRequestException(
                `Presentation config "${requestId}" mso_mdoc credential has no meta.doctype`,
            );
        }

        // Build namespace→claims map from DCQL claims
        const namespaces: Record<string, Record<string, boolean>> = {};
        for (const claim of mdocCred.claims ?? []) {
            if (claim.path.length === 0) continue;
            const ns = claim.path.length > 1 ? claim.path[0] : docType;
            const claimName =
                claim.path.length > 1 ? claim.path[1] : claim.path[0];
            if (!namespaces[ns]) namespaces[ns] = {};
            namespaces[ns][claimName] = false; // intentToRetain = false
        }
        if (Object.keys(namespaces).length === 0) {
            namespaces[docType] = {};
        }

        const deviceRequestCbor = buildDeviceRequestCbor(docType, namespaces);
        const encryptionInfoCbor = buildEncryptionInfo(
            pubJwk.x!,
            pubJwk.y!,
            nonce,
        );

        const expiresAt = new Date(
            Date.now() + (config.lifeTime ?? 300) * 1000,
        );

        await this.sessionService.create({
            id: sessionId,
            tenantId,
            requestId,
            useDcApi: true,
            dcApiProtocol: "iso-18013-7",
            browserOrigin: origin,
            vp_nonce: nonce.toString("hex"),
            parsedWebhook: config.webhook ?? undefined,
            redirectUri: config.redirectUri ?? undefined,
            expiresAt,
            status: SessionStatus.Active,
        });

        return {
            session: sessionId,
            uri: "",
            crossDeviceUri: "",
            org_iso_mdoc: {
                device_request: deviceRequestCbor.toString("base64url"),
                encryption_info: encryptionInfoCbor.toString("base64url"),
            },
        };
    }

    /**
     * Process the HPKE-encrypted DeviceResponse returned by the wallet via DC API.
     *
     * @param sessionId     Session UUID returned by createOffer
     * @param encryptedB64  base64url-encoded HPKE output: enc(65B) || ciphertext
     */
    async processResponse(
        sessionId: string,
        encryptedB64: string,
    ): Promise<Record<string, unknown>> {
        let session;
        try {
            session = await this.sessionService.getBy({
                id: sessionId,
                dcApiProtocol: "iso-18013-7",
            });
        } catch {
            throw new NotFoundException("ISO 18013-7 session not found");
        }

        if (session.consumed) {
            throw new BadRequestException(
                "The presentation offer has already been used",
            );
        }

        const logContext = {
            sessionId: session.id,
            tenantId: session.tenantId,
            flowType: "ISO18013" as const,
            stage: "response_processing",
        };

        this.auditLogService.logFlowStart(logContext, {
            action: "process_iso18013_response",
        });

        const privJwk = await this.encryptionService.getEncryptionPrivateJwk(
            session.tenantId,
        );

        const nonce = Buffer.from(session.vp_nonce!, "hex");
        const origin = session.browserOrigin!;

        // Reconstruct BrowserHandover session transcript from stored session data
        const transcript = buildBrowserHandoverTranscript(
            nonce,
            origin,
            privJwk.x!,
            privJwk.y!,
        );

        // Decrypt the HPKE ciphertext: first 65 bytes = enc (ephemeral P-256 key)
        const encryptedBytes = Buffer.from(encryptedB64, "base64url");
        if (encryptedBytes.length < 65 + 16) {
            throw new BadRequestException("Encrypted data too short");
        }
        const encKey = encryptedBytes.subarray(0, 65);
        const ciphertext = encryptedBytes.subarray(65);

        let deviceResponseCbor: Buffer;
        try {
            deviceResponseCbor = hpkeOpen(
                encKey,
                ciphertext,
                { x: privJwk.x!, y: privJwk.y!, d: privJwk.d! },
                transcript.hpkeInfo,
            );
        } catch (err: any) {
            const reason = `HPKE decryption failed: ${err?.message ?? err}`;
            this.logger.warn({ sessionId }, reason);
            await this.sessionService.add(session.id, {
                status: SessionStatus.Failed,
                errorReason: reason,
            });
            this.auditLogService.logFlowError(logContext, err as Error, {
                stage: "hpke_decryption",
            });
            throw new BadRequestException("HPKE decryption failed");
        }

        const config = await this.presentationsService.getPresentationConfig(
            session.requestId!,
            session.tenantId,
        );

        const mdocCred = config.dcql_query.credentials.find(
            (c) => c.format === "mso_mdoc",
        );
        if (!mdocCred) {
            throw new BadRequestException("No mso_mdoc credential in config");
        }

        // Build VerifierOptions from the credential's trusted_authorities config,
        // mirroring the trust validation applied in the OID4VP flow.
        const host = this.configService.getOrThrow<string>("PUBLIC_URL");
        const tenantHost = `${host}/issuers/${session.tenantId}`;

        const loteAuthorities = mdocCred.trusted_authorities?.find(
            (auth) => auth.type === TrustedAuthorityType.ETSI_TL,
        );
        const federationAuthorities = mdocCred.trusted_authorities?.find(
            (auth) => auth.type === TrustedAuthorityType.OPENID_FEDERATION,
        );

        const verifyOptions: VerifierOptions = {
            trustListSource: {
                lotes:
                    loteAuthorities?.values.map((url) => ({
                        url: url.replaceAll("<TENANT_URL>", tenantHost),
                    })) ?? [],
                acceptedServiceTypes: [
                    ServiceTypeIdentifier.EaaIssuance,
                    ServiceTypeIdentifier.PIDIssuance,
                ],
            },
            federationTrustSource: federationAuthorities?.values.length
                ? {
                      mode: "hybrid",
                      trustAnchors: federationAuthorities.values.map(
                          (value) => ({
                              entityId: value,
                              entityConfigurationUri: `${value.replace(/\/$/, "")}/.well-known/openid-federation`,
                          }),
                      ),
                  }
                : undefined,
            policy: {
                requireX5c: true,
            },
        };

        const deviceResponseB64 = deviceResponseCbor.toString("base64url");

        // Verify the mDOC using the pre-built BrowserHandover transcript
        const verifyResult = await this.mdocverifierService.verify(
            deviceResponseB64,
            {
                protocol: "iso-18013-7",
                transcriptBytes: transcript.verifyBytes,
            },
            verifyOptions,
            mdocCred.claims?.map((c) => c.path),
        );

        this.auditLogService.logCredentialVerification(
            logContext,
            verifyResult.verified,
            { docType: verifyResult.docType },
        );

        if (!verifyResult.verified) {
            const reason =
                verifyResult.failureReason ?? "mDOC verification failed";
            await this.sessionService.add(session.id, {
                status: SessionStatus.Failed,
                errorReason: reason,
            });
            this.auditLogService.logFlowError(logContext, new Error(reason), {
                stage: "mdoc_verification",
            });
            throw new BadRequestException(reason);
        }

        const credentials = [
            {
                id: mdocCred.id,
                format: "mso_mdoc",
                docType: verifyResult.docType,
                claims: verifyResult.claims,
            },
        ];

        const responseCode = randomUUID();

        await this.sessionService.add(session.id, {
            credentials: credentials as any,
            status: SessionStatus.Completed,
            responseCode,
            consumed: true,
            consumedAt: new Date(),
        });

        const webhook = session.parsedWebhook ?? config.webhook;
        if (webhook) {
            const webhookResponse = await this.webhookService
                .sendWebhook({
                    webhook,
                    session,
                    credentials,
                    expectResponse: false,
                })
                .catch((err: any) => {
                    this.logger.warn(
                        { sessionId },
                        `Webhook delivery failed: ${err?.message ?? err}`,
                    );
                    return undefined;
                });

            if (webhookResponse?.redirectUri) {
                session.redirectUri = webhookResponse.redirectUri;
            }
        }

        this.auditLogService.logFlowComplete(logContext, {
            credentialCount: credentials.length,
            webhookSent: !!webhook,
        });

        if (session.redirectUri) {
            const processedUri = decodeURIComponent(
                session.redirectUri,
            ).replaceAll("{sessionId}", session.id);
            const sep = processedUri.includes("?") ? "&" : "?";
            return {
                redirect_uri: `${processedUri}${sep}response_code=${responseCode}`,
            };
        }

        return {};
    }
}
