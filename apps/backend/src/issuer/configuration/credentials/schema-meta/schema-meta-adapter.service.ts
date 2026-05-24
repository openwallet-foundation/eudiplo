import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    type SchemaMeta,
    type SignedSchemaMeta,
    schemaMeta as schemaMetaBuilder,
    schemaURI as schemaURIBuilder,
    signSchemaMeta,
    trustAuthority as trustAuthorityBuilder,
    validateSchemaMeta,
} from "@owf/eudi-attestation-schema";
import { Signer } from "@sd-jwt/types";
import { PinoLogger } from "nestjs-pino";
import { KeyUsageType } from "../../../../crypto/key/entities/key-chain.entity";
import { KeyChainService } from "../../../../crypto/key/key-chain.service";
import { TrustListService } from "../../../trust-list/trustlist.service";
import { SchemaMetaConfig } from "../dto/schema-meta-config.dto";

/**
 * Adapter service that translates a CredentialConfig's schemaMeta configuration
 * into a TS11 SchemaMeta object using the @owf/eudi-attestation-schema library.
 *
 * @experimental The TS11 specification (EUDI Catalogue of Attestations) is not yet finalized.
 */
@Injectable()
export class SchemaMetaAdapterService {
    constructor(
        private readonly keyChainService: KeyChainService,
        private readonly trustListService: TrustListService,
        private readonly logger: PinoLogger,
        private readonly configService: ConfigService,
    ) {
        this.logger.setContext("SchemaMetaAdapterService");
    }

    private toPublicJwk(
        jwk?: Record<string, unknown>,
    ): Record<string, unknown> | undefined {
        if (!jwk || typeof jwk !== "object") {
            return undefined;
        }
        const { d, p, q, dp, dq, qi, oth, k, ...publicJwk } = jwk as Record<
            string,
            unknown
        >;
        void d;
        void p;
        void q;
        void dp;
        void dq;
        void qi;
        void oth;
        void k;
        return publicJwk;
    }

    private parseInternalTrustListRef(
        value: string,
    ): { tenantId: string; trustListId: string } | undefined {
        const match = /\/issuers\/([^/]+)\/trust-list\/([^/?#]+)/.exec(value);
        if (!match) {
            return undefined;
        }
        return {
            tenantId: decodeURIComponent(match[1] ?? ""),
            trustListId: decodeURIComponent(match[2] ?? ""),
        };
    }

    private async resolveInternalVerificationMethod(
        tenantId: string,
        value: string,
    ): Promise<Record<string, unknown> | undefined> {
        const ref = this.parseInternalTrustListRef(value);
        if (!ref || ref.tenantId !== tenantId) {
            return undefined;
        }

        try {
            const trustList = await this.trustListService.findOne(
                ref.tenantId,
                ref.trustListId,
            );
            if (!trustList.keyChainId) {
                return undefined;
            }

            const keyChain = await this.keyChainService.getEntity(
                ref.tenantId,
                trustList.keyChainId,
            );
            const publicKeyJwk = this.toPublicJwk(
                keyChain.activeJwk as Record<string, unknown> | undefined,
            );
            if (!publicKeyJwk) {
                return undefined;
            }

            return {
                type: "JsonWebKey2020",
                publicKeyJwk,
            };
        } catch {
            return undefined;
        }
    }

    private async buildTrustedAuthorities(
        tenantId: string,
        authorities: SchemaMetaConfig["trustedAuthorities"],
    ): Promise<Array<Record<string, unknown>>> {
        const result: Array<Record<string, unknown>> = [];
        for (const ta of authorities ?? []) {
            let built: Record<string, unknown>;

            if (ta.trustListId) {
                // Resolve trust list directly by ID — no URL needed from the client.
                const trustList = await this.trustListService.findOne(
                    tenantId,
                    ta.trustListId,
                );
                if (!trustList.keyChainId) {
                    throw new BadRequestException(
                        `Trust list ${ta.trustListId} has no key chain configured.`,
                    );
                }
                const keyChain = await this.keyChainService.getEntity(
                    tenantId,
                    trustList.keyChainId,
                );
                const publicKeyJwk = this.toPublicJwk(
                    keyChain.activeJwk as Record<string, unknown> | undefined,
                );
                if (!publicKeyJwk) {
                    throw new BadRequestException(
                        `Trust list ${ta.trustListId} key chain has no active key.`,
                    );
                }
                const publicUrl = this.configService
                    .getOrThrow<string>("PUBLIC_URL")
                    .replace(/\/$/, "");
                const trustListUrl = `${publicUrl}/issuers/${tenantId}/trust-list/${trustList.id}`;
                const base = trustAuthorityBuilder()
                    .frameworkType("etsi_tl" as any)
                    .value(trustListUrl)
                    .isLoTE(ta.isLoTE ?? true);
                built = base.build() as Record<string, unknown>;
                built["verificationMethod"] = {
                    type: "JsonWebKey2020",
                    publicKeyJwk,
                };
            } else {
                const base = trustAuthorityBuilder()
                    .frameworkType((ta.frameworkType ?? "etsi_tl") as any)
                    .value(ta.value!);
                if (ta.isLoTE !== undefined) {
                    base.isLoTE(ta.isLoTE);
                }
                built = base.build() as Record<string, unknown>;

                const verificationMethod =
                    ta.verificationMethod ??
                    (await this.resolveInternalVerificationMethod(
                        tenantId,
                        ta.value!,
                    ));

                if (!verificationMethod) {
                    throw new BadRequestException(
                        `Trusted authority ${ta.value} requires verificationMethod for external authorities. ` +
                            `For internal trust-list URLs, ensure the referenced trust list and key chain exist.`,
                    );
                }

                built["verificationMethod"] = verificationMethod;
            }

            result.push(built);
        }
        return result;
    }

    /**
     * Fetches the resource at `url` and returns its W3C Subresource Integrity
     * hash in `sha256-<base64>` form. Computing this server-side prevents
     * stale or attacker-supplied integrity values from being signed and
     * sidesteps browser CORS limitations the UI would otherwise hit.
     */
    private async computeSri(url: string, label: string): Promise<string> {
        let response: Response;
        try {
            response = await fetch(url);
        } catch (err) {
            throw new BadRequestException(
                `Failed to fetch ${label} (${url}) for integrity computation: ${
                    err instanceof Error ? err.message : String(err)
                }`,
            );
        }
        if (!response.ok) {
            throw new BadRequestException(
                `Failed to fetch ${label} (${url}) for integrity computation: HTTP ${response.status}`,
            );
        }
        const buffer = await response.arrayBuffer();
        const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
        const base64 = Buffer.from(digest).toString("base64");
        return `sha256-${base64}`;
    }

    /**
     * Signs an already-built SchemaMeta object using the specified or default key chain.
     *
     * Uses the {@link KeyChainService.signer} abstraction so that signing works
     * against any configured KMS provider — the raw private key is never
     * materialised here (an external KMS may not expose it at all).
     */
    private async signWithKeyChain(
        tenantId: string,
        schemaMetaObj: SchemaMeta,
        keyChainId?: string,
    ): Promise<SignedSchemaMeta> {
        const resolvedKeyChainId =
            keyChainId ??
            (
                await this.keyChainService.findByUsageType(
                    tenantId,
                    KeyUsageType.Access,
                )
            )?.id;

        const keyChain = await this.keyChainService.getEntity(
            tenantId,
            resolvedKeyChainId,
        );

        // KMS-agnostic signer: returns a (data) => base64url-signature callback.
        const signer: Signer = await this.keyChainService.signer(
            tenantId,
            resolvedKeyChainId,
        );

        const certificates: string[] = [];
        if (keyChain.activeCertificate) {
            const pemBlocks = (keyChain.activeCertificate as string)
                .split(/(?=-----BEGIN CERTIFICATE-----)/)
                .map((pem) => pem.trim())
                .filter(Boolean);
            certificates.push(...pemBlocks);
        }
        if (
            keyChain.rootCertificate &&
            !certificates.includes(keyChain.rootCertificate.trim())
        ) {
            certificates.push(keyChain.rootCertificate.trim());
        }

        if (certificates.length === 0) {
            throw new BadRequestException(
                "Cannot sign schema metadata: the key chain does not have a certificate chain configured. " +
                    "Generate or import a certificate for the key chain before signing.",
            );
        }

        const kid =
            (keyChain.activeJwk as { kid?: string } | undefined)?.kid ??
            keyChain.id;

        return signSchemaMeta({
            schemaMeta: schemaMetaObj,
            keyId: kid,
            certificates,
            signer,
        });
    }

    /**
     * Generates a signed SchemaMeta JWT from a raw SchemaMetaConfig object,
     * independent of any stored credential configuration.
     *
     * @experimental The TS11 specification (EUDI Catalogue of Attestations) is not yet finalized.
     */
    async signRawSchemaMetaConfig(
        tenantId: string,
        config: SchemaMetaConfig,
        keyChainId?: string,
    ): Promise<SignedSchemaMeta> {
        // Always (re)compute SRI hashes server-side from the live resources so
        // we never sign stale or attacker-supplied integrity values. Any
        // integrity field on the inbound config is ignored.
        const rulebookIntegrity = await this.computeSri(
            config.rulebookURI,
            "rulebookURI",
        );
        const rawSchemaUris = config.schemaURIs ?? [];
        for (const entry of rawSchemaUris) {
            if (!entry.format || !entry.uri || !entry.meta) {
                throw new BadRequestException(
                    "Each schemaURIs entry must include format, uri, and meta after preprocessing.",
                );
            }
        }

        const schemaURIsWithIntegrity = await Promise.all(
            rawSchemaUris.map(async (entry) => ({
                format: entry.format as string,
                uri: entry.uri as string,
                metadata: entry.meta,
                integrity: await this.computeSri(
                    entry.uri as string,
                    `schemaURIs[${entry.format as string}]`,
                ),
            })),
        );
        const trustedAuthorities = await this.buildTrustedAuthorities(
            tenantId,
            config.trustedAuthorities,
        );

        let builder = schemaMetaBuilder()
            .version(config.version)
            .rulebookURI(config.rulebookURI)
            .rulebookIntegrity(rulebookIntegrity)
            .attestationLoS(config.attestationLoS)
            .bindingType(config.bindingType);

        if (config.id) {
            builder = builder.id(config.id);
        }
        for (const entry of schemaURIsWithIntegrity) {
            const uriBuilder = schemaURIBuilder()
                .format(entry.format as any)
                .uri(entry.uri)
                .meta(entry.metadata)
                .integrity(entry.integrity);

            const builtSchemaUri = uriBuilder.build() as Record<
                string,
                unknown
            >;

            builder = builder.addSchemaURI(builtSchemaUri as any);
        }
        for (const taObj of trustedAuthorities) {
            builder = builder.addTrustAuthority(taObj as any);
        }

        const result = builder.build();

        if (trustedAuthorities.length > 0) {
            (result as Record<string, unknown>)["trustedAuthorities"] =
                trustedAuthorities;
        }

        const validation = validateSchemaMeta(result);
        if (!validation.valid) {
            const errors = validation.errors
                .map((e) => `${e.path}: ${e.message}`)
                .join("; ");
            throw new BadRequestException(
                `Generated SchemaMeta is invalid: ${errors}`,
            );
        }

        this.logger.info({ tenantId }, "Signing raw SchemaMetaConfig");

        return this.signWithKeyChain(tenantId, result, keyChainId);
    }
}
