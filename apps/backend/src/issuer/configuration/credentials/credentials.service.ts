import { ConflictException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type { Jwk } from "@openid4vc/oauth2";
import type { CredentialConfigurationSupported } from "@openid4vc/openid4vci";
import Ajv from "ajv/dist/2020";
import { Repository } from "typeorm";
import { CryptoImplementationService } from "../../../crypto/key/crypto-implementation/crypto-implementation.service";
import { Session } from "../../../session/entities/session.entity";
import { FederationTrustService } from "../../../shared/trust/federation-trust.service";
import { WebhookConfig } from "../../../shared/utils/webhook/webhook.dto";
import { WebhookService } from "../../../shared/utils/webhook/webhook.service";
import { VCT } from "../../issuance/oid4vci/metadata/dto/vct.dto";
import { AttributeProviderEntity } from "../attribute-provider/entities/attribute-provider.entity";
import { IssuanceService } from "../issuance/issuance.service";
import { AuthorizationIdentity } from "./dto/authorization-identity";
import { ClaimsWebhookResult } from "./dto/claims-webhook-result";
import {
    CredentialConfig,
    CredentialFormat,
} from "./entities/credential.entity";
import { MdocIssuerService } from "./issuer/mdoc-issuer/mdoc-issuer.service";
import { SdjwtvcIssuerService } from "./issuer/sdjwtvc-issuer/sdjwtvc-issuer.service";
import {
    buildMsoMdocConfig,
    buildSdJwtDcConfig,
    MSO_MDOC_FORMAT,
    type TypedCredentialConfig,
    toCredentialConfigurationSupported,
} from "./types/credential-config-types";
import { buildClaims, buildClaimsMetadata, buildJsonSchema } from "./utils";

/**
 * Service for managing credentials and their configurations.
 * Delegates actual credential issuance to format-specific services.
 */
@Injectable()
export class CredentialsService {
    /**
     * Constructor for CredentialsService.
     * @param configService
     * @param credentialConfigRepo
     * @param webhookService
     * @param sdjwtvcIssuerService
     * @param mdocIssuerService
     * @param cryptoImplementationService
     */
    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(CredentialConfig)
        private readonly credentialConfigRepo: Repository<CredentialConfig>,
        @InjectRepository(AttributeProviderEntity)
        private readonly attributeProviderRepo: Repository<AttributeProviderEntity>,
        private readonly webhookService: WebhookService,
        private readonly sdjwtvcIssuerService: SdjwtvcIssuerService,
        private readonly mdocIssuerService: MdocIssuerService,
        private readonly cryptoImplementationService: CryptoImplementationService,
        private readonly issuanceService: IssuanceService,
        private readonly federationTrustService: FederationTrustService,
    ) {}

    /**
     * Returns a single credential configuration by ID.
     * @param id The credential configuration ID
     * @param tenantId The tenant ID
     * @returns The credential configuration or null if not found
     */
    async getCredentialConfig(
        id: string,
        tenantId: string,
    ): Promise<CredentialConfig | null> {
        return this.credentialConfigRepo.findOneBy({ id, tenantId });
    }

    /**
     * Returns the credential configuration that is required for oid4vci
     * @param tenantId
     * @returns
     */
    async getCredentialConfigurationSupported(
        tenantId: string,
    ): Promise<Record<string, CredentialConfigurationSupported>> {
        const credentialConfigurationsSupported: Record<
            string,
            CredentialConfigurationSupported
        > = {};

        const configs = await this.credentialConfigRepo.findBy({
            tenantId,
        });

        for (const entity of configs) {
            const builtConfig = this.buildCredentialConfiguration(
                entity,
                tenantId,
            );
            credentialConfigurationsSupported[entity.id] =
                toCredentialConfigurationSupported(
                    builtConfig,
                ) as CredentialConfigurationSupported;
        }
        return credentialConfigurationsSupported;
    }

    /**
     * Builds a typed credential configuration from the stored entity.
     * Uses format-specific builders for proper type safety.
     * @param entity The credential config entity from the database
     * @param tenantId The tenant ID for generating URLs
     * @returns A properly typed credential configuration
     */
    private buildCredentialConfiguration(
        entity: CredentialConfig,
        tenantId: string,
    ): TypedCredentialConfig & { disclosure_policy?: unknown } {
        const format = entity.config.format;

        if (format === MSO_MDOC_FORMAT) {
            // For mDOC, algorithms are COSE numbers
            const algs = this.cryptoImplementationService.getAlgs(
                format,
            ) as number[];
            return this.buildMdocConfiguration(entity, algs);
        } else {
            // For SD-JWT, algorithms are JOSE strings
            const algs = this.cryptoImplementationService.getAlgs(
                format,
            ) as string[];
            return this.buildSdJwtConfiguration(entity, tenantId, algs);
        }
    }

    /**
     * Builds an mDOC credential configuration
     */
    private buildMdocConfiguration(
        entity: CredentialConfig,
        algs: number[],
    ): TypedCredentialConfig & { disclosure_policy?: unknown } {
        const doctype = entity.config.docType;
        if (!doctype) {
            throw new ConflictException(
                `mDOC credential configuration ${entity.id} missing required docType`,
            );
        }

        // Build credential_metadata with display and claims
        const credentialMetadata = entity.config.display
            ? {
                  display: entity.config.display,
                  ...(entity.fields.length > 0 && {
                      claims: buildClaimsMetadata(entity.fields as any),
                  }),
              }
            : entity.fields.length > 0
              ? { claims: buildClaimsMetadata(entity.fields as any) }
              : undefined;

        // Build proof_types_supported with optional key_attestations_required
        const keyAttestationsRequired = entity.config.keyAttestationsRequired;
        const jwtProofType = {
            proof_signing_alg_values_supported:
                this.cryptoImplementationService.getAlgs(
                    CredentialFormat.SD_JWT_VC,
                ) as string[],
            ...(keyAttestationsRequired && {
                key_attestations_required: { ...keyAttestationsRequired },
            }),
        };

        const config = buildMsoMdocConfig(
            doctype,
            {
                signingAlgorithms: algs,
                bindingMethods: ["cose_key"],
                proofTypesSupported: {
                    jwt: jwtProofType,
                },
            },
            credentialMetadata,
            entity.config.scope,
        );

        // Add disclosure policy if present
        if (entity.embeddedDisclosurePolicy) {
            const policy = { ...entity.embeddedDisclosurePolicy };
            delete (policy as Record<string, unknown>)["$schema"];
            return { ...config, disclosure_policy: policy };
        }

        return config;
    }

    /**
     * Builds an SD-JWT (dc+sd-jwt) credential configuration
     */
    private buildSdJwtConfiguration(
        entity: CredentialConfig,
        tenantId: string,
        algs: string[],
    ): TypedCredentialConfig & { disclosure_policy?: unknown } {
        // Resolve VCT - can be a string URI, an object (hosted by EUDIPLO), or null
        let vct: string;
        if (entity.vct && typeof entity.vct === "object") {
            // Generate URL for object-based vct hosted by EUDIPLO
            vct = `${this.configService.getOrThrow<string>("PUBLIC_URL")}/issuers/${tenantId}/credentials-metadata/vct/${entity.id}`;
        } else if (typeof entity.vct === "string") {
            // Use the string URI directly
            vct = entity.vct;
        } else {
            throw new ConflictException(
                `SD-JWT credential configuration ${entity.id} missing required vct`,
            );
        }

        // Build credential_metadata with display and claims
        const credentialMetadata = entity.config.display
            ? {
                  display: entity.config.display,
                  ...(entity.fields.length > 0 && {
                      claims: buildClaimsMetadata(entity.fields as any),
                  }),
              }
            : entity.fields.length > 0
              ? { claims: buildClaimsMetadata(entity.fields as any) }
              : undefined;

        // Build proof_types_supported with optional key_attestations_required
        const keyAttestationsRequired = entity.config.keyAttestationsRequired;
        const jwtProofType = {
            proof_signing_alg_values_supported: algs,
            ...(keyAttestationsRequired && {
                key_attestations_required: { ...keyAttestationsRequired },
            }),
        };

        const config = buildSdJwtDcConfig(
            vct,
            {
                signingAlgorithms: algs,
                bindingMethods: ["jwk"],
                proofTypesSupported: {
                    jwt: jwtProofType,
                },
            },
            credentialMetadata,
            entity.config.scope,
        );

        // Add disclosure policy if present
        if (entity.embeddedDisclosurePolicy) {
            const policy = { ...entity.embeddedDisclosurePolicy };
            delete (policy as Record<string, unknown>)["$schema"];
            return { ...config, disclosure_policy: policy };
        }

        return config;
    }

    /**
     * Validates the provided claims against the schema defined in the credential configuration.
     * @param credentialConfigurationId
     * @param claims
     * @returns
     */
    validateClaimsForCredential(
        credentialConfigurationId: string,
        claims: Record<string, unknown>,
    ) {
        // AJV instance with draft 2020-12 meta-schema support.
        // removeAdditional:"all" ensures only schema-declared properties remain on the claims object.
        const ajv = new Ajv({
            allErrors: true,
            strict: true,
            removeAdditional: "all", // strip properties not defined in the schema
            useDefaults: true, // optionally apply default values from schema
        });
        //fetch the credential configuration
        return this.credentialConfigRepo
            .findOneByOrFail({ id: credentialConfigurationId })
            .then((credentialConfiguration) => {
                //if a schema is defined, validate the claims against it
                const schema = buildJsonSchema(
                    credentialConfiguration.fields as any,
                );
                if (schema && Object.keys(schema.properties ?? {}).length > 0) {
                    const validate = ajv.compile(schema as any);
                    const valid = validate(claims); // claims mutated: unknown props removed, defaults applied
                    if (!valid) {
                        throw new ConflictException(
                            `Claims do not conform to the schema for credential configuration with id ${credentialConfigurationId}: ${ajv.errorsText(
                                validate.errors,
                            )}`,
                        );
                    }
                }
            });
    }

    /**
     * Fetches claims for a credential configuration from webhook.
     * Unified method that works for both internal and external AS flows.
     *
     * Webhook resolution priority:
     * 1. Webhook passed at offer time via session.credentialPayload.credentialClaims
     * 2. claimsWebhook configured on the credential configuration
     *
     * The webhook receives a unified payload:
     * - session: Session ID
     * - credential_configuration_id: The credential being requested
     * - identity: (optional) Identity context from AS token (iss, sub, token_claims)
     * - credentials: (optional) Presented credentials from presentation flow
     *
     * @param credentialConfigurationId The credential configuration ID
     * @param session The session associated with this request
     * @param options Optional parameters for the webhook
     * @param options.identity Identity context from authorization server (internal or external)
     * @param options.credentials Presented credentials (for presentation flows)
     * @param options.requireWebhook If true, throws if no webhook is configured (default: false)
     * @returns The fetched claims result including deferred flag, or undefined if no webhook is configured
     */
    async getClaimsFromWebhook(
        credentialConfigurationId: string,
        session: Session,
        options?: {
            identity?: AuthorizationIdentity;
            credentials?: any[];
            requireWebhook?: boolean;
        },
    ): Promise<ClaimsWebhookResult | undefined> {
        // First check for claims source passed at offer time via credentialClaims
        const claimsSource =
            session.credentialPayload?.credentialClaims?.[
                credentialConfigurationId
            ];
        let webhook: WebhookConfig | undefined | null;

        // Handle inline claims - return directly without webhook call
        if (claimsSource?.type === "inline") {
            return {
                deferred: false,
                claims: claimsSource.claims,
            };
        }

        // Handle webhook config passed directly at offer time
        if (claimsSource?.type === "webhook") {
            webhook = claimsSource.webhook;
        } else if (claimsSource?.type === "attributeProvider") {
            // Resolve the attribute provider by ID
            const provider = await this.attributeProviderRepo.findOneBy({
                id: claimsSource.attributeProviderId,
                tenantId: session.tenantId,
            });
            if (!provider) {
                throw new ConflictException(
                    `Attribute provider '${claimsSource.attributeProviderId}' not found`,
                );
            }
            webhook = { url: provider.url, auth: provider.auth };
        } else {
            // Fall back to credential config's attributeProviderId
            const credentialConfiguration =
                await this.credentialConfigRepo.findOneBy({
                    tenantId: session.tenantId,
                    id: credentialConfigurationId,
                });

            if (!credentialConfiguration) {
                throw new ConflictException(
                    `Credential configuration '${credentialConfigurationId}' not found`,
                );
            }

            if (credentialConfiguration.attributeProviderId) {
                const provider = await this.attributeProviderRepo.findOneBy({
                    id: credentialConfiguration.attributeProviderId,
                    tenantId: session.tenantId,
                });
                if (!provider) {
                    throw new ConflictException(
                        `Attribute provider '${credentialConfiguration.attributeProviderId}' not found`,
                    );
                }
                webhook = { url: provider.url, auth: provider.auth };
            }
        }

        // No webhook configured
        if (!webhook) {
            if (options?.requireWebhook) {
                throw new ConflictException(
                    `Authorization code flow requires an attribute provider to be configured on credential '${credentialConfigurationId}' ` +
                        `or provided at offer time.`,
                );
            }
            return undefined;
        }

        // Send webhook with unified payload
        const response = await this.webhookService.sendClaimsWebhook({
            webhook,
            session: session.id,
            credentialConfigurationId,
            identity: options?.identity,
            credentials: options?.credentials,
        });

        // Check if the webhook response indicates deferred issuance
        if (response.deferred) {
            return {
                deferred: true,
                interval: response.interval ?? 5,
            };
        }

        // Return claims for immediate issuance
        return {
            deferred: false,
            claims: response[credentialConfigurationId] as Record<string, any>,
        };
    }

    /**
     * Issues a credential based on the provided configuration and session.
     * Delegates to format-specific issuer services.
     * @param credentialConfigurationId
     * @param holderCnf
     * @param session
     * @param preloadedClaims Optional claims fetched from webhook (to avoid redundant calls in batch)
     * @returns
     */
    async getCredential(
        credentialConfigurationId: string,
        holderCnf: Jwk,
        session: Session,
        preloadedClaims?: Record<string, any>,
    ) {
        const credentialConfiguration =
            await this.credentialConfigRepo.findOneByOrFail({
                tenantId: session.tenantId,
                id: credentialConfigurationId,
            });

        if (!credentialConfiguration)
            throw new ConflictException(
                `Credential configuration with id ${credentialConfigurationId} not found`,
            );

        /**
         * Priority of the claims
         * 1. fetched via passed webhook (preloadedClaims)
         * 2. inline claims stored in the session
         * 3. webhook from the credential configuration
         * 4. static claims from the credential configuration
         */
        // Extract claims from the session's credentialClaims (discriminated union)
        let usedClaims = buildClaims(
            credentialConfiguration.fields as any,
        ) as Record<string, any>; // default fallback

        // Use preloaded claims if provided (from webhook or inline)
        if (preloadedClaims) {
            usedClaims = preloadedClaims;
        } else {
            // Fallback: check if inline claims are in the session
            const claimsSource =
                session.credentialPayload?.credentialClaims?.[
                    credentialConfigurationId
                ];
            if (claimsSource?.type === "inline") {
                usedClaims = claimsSource.claims;
            } else if (claimsSource?.type === "webhook") {
                // Use webhook config passed at offer time
                const webhookResponse = await this.webhookService.sendWebhook({
                    webhook: claimsSource.webhook,
                    session,
                    expectResponse: true,
                });
                if (webhookResponse?.[credentialConfigurationId]) {
                    usedClaims = webhookResponse[
                        credentialConfigurationId
                    ] as Record<string, any>;
                }
            } else if (credentialConfiguration.attributeProviderId) {
                const provider = await this.attributeProviderRepo.findOneBy({
                    id: credentialConfiguration.attributeProviderId,
                    tenantId: session.tenantId,
                });
                if (provider) {
                    const webhookResponse =
                        await this.webhookService.sendWebhook({
                            webhook: {
                                url: provider.url,
                                auth: provider.auth,
                            },
                            session,
                            expectResponse: true,
                        });
                    if (webhookResponse?.[credentialConfigurationId]) {
                        usedClaims = webhookResponse[
                            credentialConfigurationId
                        ] as Record<string, any>;
                    }
                }
            }
        }

        // Load issuance config to check for federation settings
        let federationEntityId: string | undefined;
        try {
            const issuanceConfig =
                await this.issuanceService.getIssuanceConfiguration(
                    session.tenantId,
                );
            if (
                issuanceConfig.federation &&
                this.federationTrustService.isEnabled(issuanceConfig.federation)
            ) {
                federationEntityId = issuanceConfig.federation.entityId;
            }
        } catch {
            // If issuance config not found, proceed without federation
        }

        // Delegate to format-specific issuer service
        const format = credentialConfiguration.config.format;

        if (format === "mso_mdoc") {
            // For mDOC, holderCnf is the device key
            return this.mdocIssuerService.issue({
                credentialConfiguration,
                deviceKey: holderCnf,
                session,
                claims: usedClaims,
            });
        } else {
            // Default to SD-JWT VC (handles "dc+sd-jwt" and "vc+sd-jwt" formats)
            return this.sdjwtvcIssuerService.issue({
                credentialConfiguration,
                holderCnf,
                session,
                claims: usedClaims,
                federationEntityId,
            });
        }
    }

    /**
     * Retrieves the VCT (Verifiable Credential Type) for a specific credential configuration.
     * @param credentialId
     * @param tenantId
     * @returns
     */
    async getVCT(credentialId: string, tenantId: string): Promise<VCT> {
        const credentialConfig = await this.credentialConfigRepo
            .findOneByOrFail({
                id: credentialId,
                tenantId,
            })
            .catch(() => {
                throw new ConflictException(
                    `Credential configuration with id ${credentialId} not found`,
                );
            });
        if (!credentialConfig.vct) {
            throw new ConflictException(
                `VCT for credential configuration with id ${credentialId} not found`,
            );
        }
        // If vct is a string URI, this endpoint doesn't apply
        if (typeof credentialConfig.vct === "string") {
            throw new ConflictException(
                `VCT for credential configuration with id ${credentialId} is a URI, not hosted by this server`,
            );
        }
        const host = this.configService.getOrThrow<string>("PUBLIC_URL");
        credentialConfig.vct.vct = `${host}/issuers/${tenantId}/credentials-metadata/vct/${credentialConfig.id}`;
        return credentialConfig.vct;
    }
}
