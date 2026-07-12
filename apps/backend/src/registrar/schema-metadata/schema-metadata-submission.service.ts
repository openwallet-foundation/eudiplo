import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchemaURIMeta } from "@owf/eudi-attestation-schema";
import { KeyChainService } from "../../crypto/key/key-chain.service";
import { SchemaMetadataService } from "./schema-metadata.service";
import { CredentialConfigService } from "../../issuer/configuration/credentials/credential-config/credential-config.service";
import {
    SignSchemaMetaConfigDto,
    SignVersionSchemaMetaConfigDto,
} from "../../issuer/configuration/credentials/dto/schema-meta-config.dto";
import { buildJsonSchema } from "../../issuer/configuration/credentials/utils";
import { TrustListService } from "../../issuer/trust-list/trustlist.service";

type TrustedAuthorityInput = NonNullable<
    SignSchemaMetaConfigDto["config"]["trustedAuthorities"]
>[number];

@Injectable()
export class SchemaMetadataSubmissionService {
    constructor(
        private readonly credentialsService: CredentialConfigService,
        private readonly schemaMetadataService: SchemaMetadataService,
        private readonly trustListService: TrustListService,
        private readonly keyChainService: KeyChainService,
        private readonly configService: ConfigService,
    ) {}

    private extractConfiguredVct(credentialConfig: {
        vct?: unknown;
    }): string | undefined {
        if (typeof credentialConfig.vct === "string") {
            return credentialConfig.vct;
        }

        if (
            credentialConfig.vct &&
            typeof credentialConfig.vct === "object" &&
            "vct" in credentialConfig.vct &&
            typeof (credentialConfig.vct as { vct?: unknown }).vct === "string"
        ) {
            return (credentialConfig.vct as { vct: string }).vct;
        }

        return undefined;
    }

    private deriveSchemaUriMetadata(
        credentialConfig: Awaited<
            ReturnType<CredentialConfigService["getById"]>
        >,
        format: string,
    ): SchemaURIMeta {
        if (format === "dc+sd-jwt") {
            const configuredVct = this.extractConfiguredVct(credentialConfig);

            if (!configuredVct) {
                throw new BadRequestException(
                    "schemaURIs metadata is required: unable to derive vct for dc+sd-jwt from credential config.",
                );
            }

            return { vct: configuredVct };
        }

        if (format === "mso_mdoc") {
            const docType =
                credentialConfig.config?.docType ??
                (credentialConfig.config as { doctype?: string } | undefined)
                    ?.doctype;

            if (!docType) {
                throw new BadRequestException(
                    "schemaURIs metadata is required: unable to derive docType for mso_mdoc from credential config.",
                );
            }

            return { doctype_value: docType };
        }

        throw new BadRequestException(
            `schemaURIs metadata is required: unsupported format '${format}'. Provide schemaURIs[].metadata explicitly.`,
        );
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
        if (ref?.tenantId !== tenantId) {
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

    private parseVerificationMethod(
        verificationMethod: string | Record<string, unknown> | undefined,
        index: number,
    ): Record<string, unknown> | undefined {
        if (verificationMethod === undefined) {
            return undefined;
        }

        if (typeof verificationMethod === "string") {
            const trimmed = verificationMethod.trim();
            if (trimmed.length === 0) {
                return undefined;
            }

            try {
                const parsed = JSON.parse(trimmed);
                if (
                    !parsed ||
                    Array.isArray(parsed) ||
                    typeof parsed !== "object"
                ) {
                    throw new Error("verificationMethod must be a JSON object");
                }

                return parsed as Record<string, unknown>;
            } catch (error) {
                throw new BadRequestException(
                    `trustedAuthorities[${index}].verificationMethod must be valid JSON object: ${
                        error instanceof Error ? error.message : "invalid JSON"
                    }`,
                );
            }
        }

        if (Array.isArray(verificationMethod)) {
            throw new BadRequestException(
                `trustedAuthorities[${index}].verificationMethod must be an object`,
            );
        }

        return verificationMethod;
    }

    private async normalizeTrustedAuthority(
        tenantId: string,
        entry: TrustedAuthorityInput,
        index: number,
    ): Promise<Record<string, unknown>> {
        if (entry.trustListId) {
            const trustList = await this.trustListService.findOne(
                tenantId,
                entry.trustListId,
            );
            if (!trustList.keyChainId) {
                throw new BadRequestException(
                    `Trust list ${entry.trustListId} has no key chain configured.`,
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
                    `Trust list ${entry.trustListId} key chain has no active key.`,
                );
            }

            const publicUrl = this.configService
                .getOrThrow<string>("PUBLIC_URL")
                .replace(/\/$/, "");

            return {
                frameworkType: "etsi_tl",
                value: `${publicUrl}/issuers/${tenantId}/trust-list/${trustList.id}`,
                verificationMethod: {
                    type: "JsonWebKey2020",
                    publicKeyJwk,
                },
            };
        }

        const verificationMethod =
            this.parseVerificationMethod(entry.verificationMethod, index) ??
            (entry.value
                ? await this.resolveInternalVerificationMethod(
                      tenantId,
                      entry.value,
                  )
                : undefined);

        if (!verificationMethod) {
            throw new BadRequestException(
                `trustedAuthorities[${index}] requires verificationMethod for external authorities.`,
            );
        }

        return {
            ...(entry.frameworkType
                ? { frameworkType: entry.frameworkType }
                : {}),
            ...(entry.value ? { value: entry.value } : {}),
            verificationMethod,
        };
    }

    private async resolveTrustedAuthoritiesForRegistrar(
        tenantId: string,
        authorities: SignSchemaMetaConfigDto["config"]["trustedAuthorities"],
    ): Promise<Array<Record<string, unknown>>> {
        return Promise.all(
            (authorities ?? []).map((entry, index) =>
                this.normalizeTrustedAuthority(tenantId, entry, index),
            ),
        );
    }

    private async fetchRemoteFile(
        sourceUrl: string,
        fallbackFileName: string,
        label: string,
    ): Promise<Blob | File> {
        let response: Response;
        try {
            response = await fetch(sourceUrl);
        } catch (error) {
            throw new BadRequestException(
                `Failed to fetch ${label} (${sourceUrl}): ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }

        if (!response.ok) {
            throw new BadRequestException(
                `Failed to fetch ${label} (${sourceUrl}): HTTP ${response.status}`,
            );
        }

        const contentType =
            response.headers.get("content-type") || "application/octet-stream";
        const bytes = await response.arrayBuffer();

        const parsedName = (() => {
            try {
                const pathname = new URL(sourceUrl).pathname;
                const segments = pathname.split("/");
                const last = segments.findLast((segment) => segment.length > 0);
                return last || fallbackFileName;
            } catch {
                return fallbackFileName;
            }
        })();

        return typeof File === "function"
            ? new File([bytes], parsedName, { type: contentType })
            : (new Blob([bytes], {
                  type: contentType,
              }) as Blob | File);
    }

    private async buildSchemaFileFromCredentialConfig(
        tenantId: string,
        credentialConfigId: string,
        fallbackFormat?: string,
    ): Promise<{
        format: string;
        meta: SchemaURIMeta;
        file: Blob | File;
    }> {
        const existing = await this.credentialsService.getById(
            tenantId,
            credentialConfigId,
        );
        const format = existing.config?.format ?? fallbackFormat ?? "dc+sd-jwt";

        const schema = buildJsonSchema(existing.fields as any);
        if (!schema || Object.keys(schema.properties ?? {}).length === 0) {
            throw new BadRequestException(
                `Credential config ${credentialConfigId} has no inline schema to upload. Provide schemaURIs explicitly or set the credential schema first.`,
            );
        }

        const fileName = `schema-${credentialConfigId}-${format}.json`;
        const schemaContent = JSON.stringify(schema, null, 2);
        const schemaFile =
            typeof File === "function"
                ? new File([schemaContent], fileName, {
                      type: "application/schema+json",
                  })
                : new Blob([schemaContent], {
                      type: "application/schema+json",
                  });

        return {
            format,
            meta: this.deriveSchemaUriMetadata(existing, format),
            file: schemaFile,
        };
    }

    private async resolveSchemaEntries(
        tenantId: string,
        config: SignSchemaMetaConfigDto["config"],
        credentialConfigId?: string,
    ): Promise<
        Array<{
            format: string;
            meta: SchemaURIMeta;
            file: Blob | File;
        }>
    > {
        let requestedEntries = config.schemaURIs ?? [];
        if (requestedEntries.length === 0 && credentialConfigId) {
            requestedEntries = [{ credentialConfigId }];
        }

        if (requestedEntries.length === 0) {
            throw new BadRequestException(
                "At least one schemaURIs entry is required. Provide schemaURIs or credentialConfigId.",
            );
        }

        return Promise.all(
            requestedEntries.map(async (entry, index) => {
                if (entry.credentialConfigId) {
                    return this.buildSchemaFileFromCredentialConfig(
                        tenantId,
                        entry.credentialConfigId,
                        entry.format,
                    );
                }

                if (!entry.uri) {
                    throw new BadRequestException(
                        `schemaURIs[${index}] requires either credentialConfigId or uri`,
                    );
                }

                if (!entry.format) {
                    throw new BadRequestException(
                        `schemaURIs[${index}].format is required for manual schema URI entries`,
                    );
                }

                if (!entry.meta) {
                    throw new BadRequestException(
                        `schemaURIs[${index}].meta is required for manual schema URI entries`,
                    );
                }

                const file = await this.fetchRemoteFile(
                    entry.uri,
                    `schema-${entry.format}.json`,
                    "schema",
                );

                return {
                    format: entry.format,
                    meta: entry.meta,
                    file,
                };
            }),
        );
    }

    private normalizeConfigFromFormInput(
        config: SignSchemaMetaConfigDto["config"],
    ): SignSchemaMetaConfigDto["config"] {
        const normalizedSchemaUris = (config.schemaURIs ?? []).map((entry) => ({
            ...(entry.credentialConfigId
                ? { credentialConfigId: entry.credentialConfigId }
                : {}),
            ...(entry.format ? { format: entry.format } : {}),
            ...(entry.uri ? { uri: entry.uri } : {}),
            ...(entry.meta ? { meta: entry.meta } : {}),
        }));

        const normalizedTrustedAuthorities = (
            config.trustedAuthorities ?? []
        ).map((entry) => ({
            ...(entry.trustListId ? { trustListId: entry.trustListId } : {}),
            ...(entry.frameworkType
                ? { frameworkType: entry.frameworkType }
                : {}),
            ...(entry.value ? { value: entry.value } : {}),
            ...(entry.verificationMethod
                ? { verificationMethod: entry.verificationMethod }
                : {}),
        }));

        return {
            ...config,
            schemaURIs: normalizedSchemaUris,
            trustedAuthorities: normalizedTrustedAuthorities,
        };
    }

    private buildRegistrarMetadata(
        config: SignSchemaMetaConfigDto["config"],
        schemaEntries: Array<{ format: string; meta: SchemaURIMeta }>,
        trustedAuthorities: Array<Record<string, unknown>>,
    ): Record<string, unknown> {
        const metadata: Record<string, unknown> = {
            ...(config.id ? { id: config.id } : {}),
            version: config.version,
            attestationLoS: config.attestationLoS,
            bindingType: config.bindingType,
            trustedAuthorities,
        };

        const category = (config as { category?: unknown }).category;
        if (typeof category === "string") {
            metadata.category = category;
        }

        const tags = (config as { tags?: unknown }).tags;
        if (
            Array.isArray(tags) &&
            tags.every((tag) => typeof tag === "string")
        ) {
            metadata.tags = tags;
        }

        metadata.schemas = schemaEntries.map((entry, fileIndex) => {
            let schemaTypeIdentifier: string | undefined;

            if (entry.format === "dc+sd-jwt") {
                const vct = (entry.meta as { vct?: unknown })?.vct;
                if (typeof vct === "string" && vct.length > 0) {
                    schemaTypeIdentifier = vct;
                }
            } else if (entry.format === "mso_mdoc") {
                const docType =
                    (entry.meta as { doctype_value?: unknown })
                        ?.doctype_value ??
                    (entry.meta as { doctype?: unknown })?.doctype;
                if (typeof docType === "string" && docType.length > 0) {
                    schemaTypeIdentifier = docType;
                }
            }

            if (!schemaTypeIdentifier) {
                throw new BadRequestException(
                    `Unable to derive schemaTypeIdentifier for format '${entry.format}'.`,
                );
            }

            return {
                formatIdentifier: entry.format,
                fileIndex,
                schemaTypeIdentifier,
            };
        });

        return metadata;
    }

    async submitSchemaMetadata(
        tenantId: string,
        body: SignSchemaMetaConfigDto,
    ) {
        const normalizedConfig = this.normalizeConfigFromFormInput(body.config);

        const [rulebookFile, schemaEntries, trustedAuthorities] =
            await Promise.all([
                this.fetchRemoteFile(
                    normalizedConfig.rulebookURI,
                    `rulebook-${normalizedConfig.version}.md`,
                    "rulebook",
                ),
                this.resolveSchemaEntries(
                    tenantId,
                    normalizedConfig,
                    body.credentialConfigId,
                ),
                this.resolveTrustedAuthoritiesForRegistrar(
                    tenantId,
                    normalizedConfig.trustedAuthorities,
                ),
            ]);

        const result = await this.schemaMetadataService.createSchemaMetadata(
            tenantId,
            {
                metadata: this.buildRegistrarMetadata(
                    normalizedConfig,
                    schemaEntries,
                    trustedAuthorities,
                ),
                rulebookFile,
                schemaFiles: schemaEntries.map((entry) => entry.file),
            },
        );

        if (body.credentialConfigId) {
            const existing = await this.credentialsService.getById(
                tenantId,
                body.credentialConfigId,
            );
            const schemaMetaForLink = {
                ...existing.schemaMeta,
                ...normalizedConfig,
                id: result.id,
            };
            await this.credentialsService.update(
                tenantId,
                body.credentialConfigId,
                {
                    schemaMeta: schemaMetaForLink as any,
                },
            );
        }

        return result;
    }

    async submitSchemaMetadataVersion(
        tenantId: string,
        body: SignVersionSchemaMetaConfigDto,
    ) {
        const normalizedConfig = this.normalizeConfigFromFormInput(body.config);

        if (!normalizedConfig.id) {
            throw new BadRequestException(
                "config.id is required when publishing a new version of an existing schema metadata entry",
            );
        }

        const [rulebookFile, schemaEntries, trustedAuthorities] =
            await Promise.all([
                this.fetchRemoteFile(
                    normalizedConfig.rulebookURI,
                    `rulebook-${normalizedConfig.version}.md`,
                    "rulebook",
                ),
                this.resolveSchemaEntries(tenantId, normalizedConfig),
                this.resolveTrustedAuthoritiesForRegistrar(
                    tenantId,
                    normalizedConfig.trustedAuthorities,
                ),
            ]);

        return this.schemaMetadataService.createSchemaMetadata(tenantId, {
            metadata: this.buildRegistrarMetadata(
                normalizedConfig,
                schemaEntries,
                trustedAuthorities,
            ),
            rulebookFile,
            schemaFiles: schemaEntries.map((entry) => entry.file),
        });
    }
}
