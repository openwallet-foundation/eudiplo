import { BadRequestException, Injectable } from "@nestjs/common";
import { SchemaURIMeta } from "@owf/eudi-attestation-schema";
import { RegistrarService } from "../../../../registrar/registrar.service";
import { CredentialConfigService } from "../credential-config/credential-config.service";
import {
    SignSchemaMetaConfigDto,
    SignVersionSchemaMetaConfigDto,
} from "../dto/schema-meta-config.dto";
import { buildJsonSchema } from "../utils";
import { SchemaMetaAdapterService } from "./schema-meta-adapter.service";

type TrustedAuthorityInput = NonNullable<
    SignSchemaMetaConfigDto["config"]["trustedAuthorities"]
>[number];

@Injectable()
export class SchemaMetadataSigningService {
    constructor(
        private readonly credentialsService: CredentialConfigService,
        private readonly schemaMetaAdapterService: SchemaMetaAdapterService,
        private readonly registrarService: RegistrarService,
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

    private normalizeTrustedAuthority(
        entry: TrustedAuthorityInput,
        index: number,
    ) {
        if (entry.trustListId) {
            return {
                trustListId: entry.trustListId,
                ...(entry.isLoTE === undefined ? {} : { isLoTE: entry.isLoTE }),
            };
        }

        const verificationMethod = this.parseVerificationMethod(
            entry.verificationMethod,
            index,
        );

        return {
            ...(entry.frameworkType
                ? { frameworkType: entry.frameworkType }
                : {}),
            ...(entry.value ? { value: entry.value } : {}),
            ...(entry.isLoTE === undefined ? {} : { isLoTE: entry.isLoTE }),
            ...(verificationMethod ? { verificationMethod } : {}),
        };
    }

    private async uploadSchemaAssetFromCredentialConfig(
        tenantId: string,
        credentialConfigId: string,
        fallbackFormat?: string,
    ): Promise<{
        format: string;
        uri: string;
        meta: SchemaURIMeta;
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
        const schemaAsset =
            typeof File === "function"
                ? new File([schemaContent], fileName, {
                      type: "application/schema+json",
                  })
                : new Blob([schemaContent], {
                      type: "application/schema+json",
                  });

        const uploadedSchema =
            await this.registrarService.uploadSchemaMetadataAsset(
                tenantId,
                "schemas",
                schemaAsset,
            );

        return {
            format,
            uri: uploadedSchema.url,
            meta: this.deriveSchemaUriMetadata(existing, format),
        };
    }

    private async uploadSchemaMetaAssetsToRegistrar(
        tenantId: string,
        config: SignSchemaMetaConfigDto["config"],
        options?: { schemaUrisAlreadyHosted?: boolean },
    ): Promise<SignSchemaMetaConfigDto["config"]> {
        const uploadedRulebook =
            await this.registrarService.uploadSchemaMetadataAssetFromUrl(
                tenantId,
                "rulebooks",
                config.rulebookURI,
                `rulebook-${config.version}.md`,
            );

        const uploadedSchemaURIs = options?.schemaUrisAlreadyHosted
            ? (config.schemaURIs ?? [])
            : await Promise.all(
                  (config.schemaURIs ?? []).map(async (entry) => {
                      if (entry.credentialConfigId) {
                          return this.uploadSchemaAssetFromCredentialConfig(
                              tenantId,
                              entry.credentialConfigId,
                              entry.format,
                          );
                      }

                      if (!entry.uri) {
                          throw new BadRequestException(
                              "schemaURIs entry requires either credentialConfigId or uri",
                          );
                      }

                      if (!entry.meta) {
                          throw new BadRequestException(
                              "schemaURIs metadata is required for manual schema URI entries.",
                          );
                      }

                      const uploadedSchema =
                          await this.registrarService.uploadSchemaMetadataAssetFromUrl(
                              tenantId,
                              "schemas",
                              entry.uri,
                              `schema-${entry.format}.json`,
                          );
                      return {
                          ...entry,
                          uri: uploadedSchema.url,
                      };
                  }),
              );

        return {
            ...config,
            rulebookURI: uploadedRulebook.url,
            schemaURIs: uploadedSchemaURIs,
        };
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
        ).map((entry, index) => this.normalizeTrustedAuthority(entry, index));

        return {
            ...config,
            schemaURIs: normalizedSchemaUris,
            trustedAuthorities: normalizedTrustedAuthorities,
        };
    }

    private async ensureSchemaUrisFromCredentialConfig(
        tenantId: string,
        config: SignSchemaMetaConfigDto["config"],
        credentialConfigId?: string,
    ): Promise<{
        config: SignSchemaMetaConfigDto["config"];
        alreadyHosted: boolean;
    }> {
        if (config.schemaURIs?.length || !credentialConfigId) {
            return { config, alreadyHosted: false };
        }

        const existing = await this.credentialsService.getById(
            tenantId,
            credentialConfigId,
        );
        const format = existing.config?.format ?? "dc+sd-jwt";
        const uploadedSchema = await this.uploadSchemaAssetFromCredentialConfig(
            tenantId,
            credentialConfigId,
            format,
        );

        return {
            config: {
                ...config,
                schemaURIs: [
                    {
                        format: uploadedSchema.format,
                        uri: uploadedSchema.uri,
                        meta: uploadedSchema.meta,
                    },
                ],
            },
            alreadyHosted: true,
        };
    }

    async signSchemaMetaConfig(
        tenantId: string,
        body: SignSchemaMetaConfigDto,
    ) {
        const normalizedConfig = this.normalizeConfigFromFormInput(body.config);

        const { config: derivedConfig, alreadyHosted } =
            await this.ensureSchemaUrisFromCredentialConfig(
                tenantId,
                normalizedConfig,
                body.credentialConfigId,
            );

        let configToSign = derivedConfig;

        configToSign = await this.uploadSchemaMetaAssetsToRegistrar(
            tenantId,
            configToSign,
            { schemaUrisAlreadyHosted: alreadyHosted },
        );

        const { reservedId } =
            await this.registrarService.reserveSchemaId(tenantId);

        const signed =
            await this.schemaMetaAdapterService.signRawSchemaMetaConfig(
                tenantId,
                { ...configToSign, id: reservedId },
                body.keyChainId,
            );

        const result = await this.registrarService.submitSchemaMetadata(
            tenantId,
            signed.jws,
        );

        if (body.credentialConfigId) {
            const existing = await this.credentialsService.getById(
                tenantId,
                body.credentialConfigId,
            );
            const schemaMetaForLink = {
                ...existing.schemaMeta,
                ...configToSign,
                id: reservedId,
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

    async signVersionSchemaMetaConfig(
        tenantId: string,
        body: SignVersionSchemaMetaConfigDto,
    ) {
        const normalizedConfig = this.normalizeConfigFromFormInput(body.config);

        if (!normalizedConfig.id) {
            throw new BadRequestException(
                "config.id is required when publishing a new version of an existing schema metadata entry",
            );
        }

        const configToSign = await this.uploadSchemaMetaAssetsToRegistrar(
            tenantId,
            normalizedConfig,
        );

        const signed =
            await this.schemaMetaAdapterService.signRawSchemaMetaConfig(
                tenantId,
                configToSign,
                body.keyChainId,
            );

        return this.registrarService.submitSchemaMetadata(tenantId, signed.jws);
    }
}
