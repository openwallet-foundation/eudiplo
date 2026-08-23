import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
    CLIENTS_PROVIDER,
    ClientsProvider,
} from "../../auth/client/client.provider";
import { ClientEntity } from "../../auth/client/entities/client.entity";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";
import { KeyChainType } from "../../crypto/key/dto/key-chain-create.dto";
import {
    KeyChainEntity,
    KeyUsage,
} from "../../crypto/key/entities/key-chain.entity";
import { KeyChainService } from "../../crypto/key/key-chain.service";
import { KmsTenantConfigService } from "../../crypto/key/kms/kms-tenant-config.service";
import { AttributeProviderService } from "../../issuer/configuration/attribute-provider/attribute-provider.service";
import { AttributeProviderEntity } from "../../issuer/configuration/attribute-provider/entities/attribute-provider.entity";
import { CredentialConfigService } from "../../issuer/configuration/credentials/credential-config/credential-config.service";
import { CredentialConfig } from "../../issuer/configuration/credentials/entities/credential.entity";
import { IssuanceConfig } from "../../issuer/configuration/issuance/entities/issuance-config.entity";
import { IssuanceService } from "../../issuer/configuration/issuance/issuance.service";
import { WebhookEndpointEntity } from "../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity";
import { WebhookEndpointService } from "../../issuer/configuration/webhook-endpoint/webhook-endpoint.service";
import { StatusListEntity } from "../../issuer/status-list/entities/status-list.entity";
import { StatusListService } from "../../issuer/status-list/status-list.service";
import { TrustList } from "../../issuer/trust-list/entities/trust-list.entity";
import { TrustListService } from "../../issuer/trust-list/trustlist.service";
import { RegistrarConfigEntity } from "../../registrar/entities/registrar-config.entity";
import { RegistrarConfigService } from "../../registrar/registrar-config.service";
import { FilesService } from "../../storage/files.service";
import { PresentationConfig } from "../../verifier/presentations/entities/presentation-config.entity";
import { PresentationsService } from "../../verifier/presentations/presentations.service";
import { ConfigBundleService } from "./config-bundle.service";
import { ConfigKmsReferenceService } from "./config-kms-reference.service";
import { ConfigMigrationService } from "./config-migration.service";
import { ConfigOwnershipService } from "./config-ownership.service";
import { ConfigResourceRegistry } from "./config-resource.registry";
import type {
    ConfigBundle,
    ConfigDocument,
    ConfigImportMode,
    ConfigImportPlan,
    ConfigResourceKind,
} from "./config-resource.types";

@Injectable()
export class ConfigBundleApplyService {
    constructor(
        private readonly bundleService: ConfigBundleService,
        private readonly migrationService: ConfigMigrationService,
        private readonly ownershipService: ConfigOwnershipService,
        private readonly filesService: FilesService,
        private readonly keyChainService: KeyChainService,
        private readonly kmsReferenceService: ConfigKmsReferenceService,
        private readonly resourceRegistry: ConfigResourceRegistry,
        private readonly kmsTenantConfigService: KmsTenantConfigService,
        private readonly registrarConfigService: RegistrarConfigService,
        private readonly issuanceService: IssuanceService,
        private readonly credentialConfigService: CredentialConfigService,
        private readonly presentationsService: PresentationsService,
        private readonly attributeProviderService: AttributeProviderService,
        private readonly webhookEndpointService: WebhookEndpointService,
        private readonly trustListService: TrustListService,
        private readonly statusListService: StatusListService,
        @Inject(CLIENTS_PROVIDER)
        private readonly clientsProvider: ClientsProvider,
        @InjectRepository(TenantEntity)
        private readonly tenants: Repository<TenantEntity>,
        @InjectRepository(ClientEntity)
        private readonly clients: Repository<ClientEntity>,
        @InjectRepository(KeyChainEntity)
        private readonly keyChains: Repository<KeyChainEntity>,
        @InjectRepository(RegistrarConfigEntity)
        private readonly registrarConfigs: Repository<RegistrarConfigEntity>,
        @InjectRepository(IssuanceConfig)
        private readonly issuanceConfigs: Repository<IssuanceConfig>,
        @InjectRepository(CredentialConfig)
        private readonly credentialConfigs: Repository<CredentialConfig>,
        @InjectRepository(PresentationConfig)
        private readonly presentationConfigs: Repository<PresentationConfig>,
        @InjectRepository(AttributeProviderEntity)
        private readonly attributeProviders: Repository<AttributeProviderEntity>,
        @InjectRepository(WebhookEndpointEntity)
        private readonly webhookEndpoints: Repository<WebhookEndpointEntity>,
        @InjectRepository(TrustList)
        private readonly trustLists: Repository<TrustList>,
        @InjectRepository(StatusListEntity)
        private readonly statusLists: Repository<StatusListEntity>,
    ) {}

    async apply(
        tenantId: string,
        bundle: ConfigBundle,
        mode: ConfigImportMode,
        ownershipSource = `bundle:${bundle.manifest.tenant}`,
    ): Promise<ConfigImportPlan> {
        const plan = await this.bundleService.plan(
            tenantId,
            bundle,
            mode,
            ownershipSource,
        );
        if (!plan.applicable) {
            throw new BadRequestException({
                message: "Configuration bundle has blocking issues",
                plan,
            });
        }
        // Resource importers resolve image filenames to stored public URLs, so
        // bundle assets must exist before the dependent resources are applied.
        await this.restoreAssets(tenantId, bundle, mode !== "create");
        const applicable = new Set(
            plan.items
                .filter(
                    (item) =>
                        item.action === "create" || item.action === "update",
                )
                .map((item) => `${item.kind}/${item.id}`),
        );
        const ordered = [...bundle.documents]
            .sort(
                (left, right) => this.order(left.kind) - this.order(right.kind),
            )
            .filter((document) =>
                applicable.has(`${document.kind}/${document.metadata.id}`),
            );
        const generatedSecrets: NonNullable<
            ConfigImportPlan["generatedSecrets"]
        > = [];
        for (const input of ordered) {
            const { document } = this.migrationService.upgrade(input);
            // A startup-folder KMS document is already the live backing file.
            // Record it as managed without rewriting an envelope into a bare spec.
            const generatedSecret =
                document.kind === "KmsConfig" &&
                ownershipSource.startsWith("folder:")
                    ? undefined
                    : await this.applyDocument(tenantId, document);
            if (generatedSecret) generatedSecrets.push(generatedSecret);
            await this.ownershipService.markApplied({
                tenantId,
                kind: document.kind,
                resourceId: document.metadata.id,
                ownership: "file-managed",
                generation: document.metadata.generation ?? 1,
                source: ownershipSource,
                sourceHash: createHash("sha256")
                    .update(JSON.stringify(document))
                    .digest("hex"),
            });
        }
        const deletions = plan.items
            .filter((item) => item.action === "delete")
            .sort(
                (left, right) => this.order(right.kind) - this.order(left.kind),
            );
        for (const item of deletions) {
            await this.deleteDocument(tenantId, item.kind, item.id);
            await this.ownershipService.remove(tenantId, item.kind, item.id);
        }
        return generatedSecrets.length ? { ...plan, generatedSecrets } : plan;
    }

    private async restoreAssets(
        tenantId: string,
        bundle: ConfigBundle,
        overwrite: boolean,
    ): Promise<void> {
        for (const asset of bundle.assets ?? []) {
            const data = Buffer.from(asset.data, "base64");
            if (
                createHash("sha256").update(data).digest("hex") !== asset.sha256
            ) {
                throw new BadRequestException(
                    `Asset checksum mismatch: ${asset.path}`,
                );
            }
            await this.filesService.saveImportedAsset(
                tenantId,
                asset.path.replace(/^images\//, ""),
                data,
                asset.contentType,
                overwrite,
            );
        }
    }

    private async deleteDocument(
        tenantId: string,
        kind: ConfigResourceKind,
        id: string,
    ): Promise<void> {
        switch (kind) {
            case "Tenant":
                throw new BadRequestException(
                    "Replace mode cannot delete a tenant",
                );
            case "Client":
                await this.clientsProvider.removeClient(tenantId, id);
                return;
            case "KmsConfig":
                this.kmsTenantConfigService.deleteTenantConfig(tenantId);
                return;
            case "KeyChain":
                await this.keyChainService.delete(tenantId, id);
                return;
            case "RegistrarConfig":
                await this.registrarConfigService.deleteConfig(tenantId);
                return;
            case "IssuanceConfig":
                await this.issuanceConfigs.delete({ tenantId });
                return;
            case "CredentialConfig":
                await this.credentialConfigService.delete(tenantId, id);
                return;
            case "PresentationConfig":
                await this.presentationsService.deletePresentationConfig(
                    id,
                    tenantId,
                );
                return;
            case "AttributeProvider":
                await this.attributeProviderService.delete(tenantId, id);
                return;
            case "WebhookEndpoint":
                await this.webhookEndpointService.delete(tenantId, id);
                return;
            case "TrustList":
                await this.trustListService.remove(tenantId, id);
                return;
            case "StatusList":
                await this.statusListService.deleteList(tenantId, id);
        }
    }

    private async applyDocument(
        tenantId: string,
        document: ConfigDocument,
    ): Promise<
        | {
              kind: "Client";
              id: string;
              path: "/spec/secret";
              value: string;
          }
        | undefined
    > {
        const spec = structuredClone(document.spec) as Record<string, any>;
        switch (document.kind) {
            case "Tenant":
                await this.tenants.update({ id: tenantId }, spec);
                return;
            case "Client": {
                const exists =
                    (await this.clients.countBy({
                        tenantId,
                        clientId: document.metadata.id,
                    })) > 0;
                const generated = spec.secret === "!generate";
                const secret = generated
                    ? exists
                        ? undefined
                        : randomBytes(32).toString("base64url")
                    : typeof spec.secret === "string"
                      ? spec.secret
                      : undefined;
                delete spec.secret;
                const client = {
                    ...spec,
                    clientId: document.metadata.id,
                } as any;
                if (exists) {
                    await this.clientsProvider.updateClient(
                        tenantId,
                        document.metadata.id,
                        client,
                    );
                    if (generated) {
                        const value =
                            await this.clientsProvider.rotateClientSecret(
                                tenantId,
                                document.metadata.id,
                            );
                        return {
                            kind: "Client",
                            id: document.metadata.id,
                            path: "/spec/secret",
                            value,
                        };
                    }
                    if (secret) {
                        await this.clientsProvider.setClientSecret(
                            tenantId,
                            document.metadata.id,
                            secret,
                        );
                    }
                } else {
                    await this.clientsProvider.addClient(tenantId, {
                        ...client,
                        secret,
                    });
                }
                return generated
                    ? {
                          kind: "Client",
                          id: document.metadata.id,
                          path: "/spec/secret",
                          value: secret!,
                      }
                    : undefined;
            }
            case "KmsConfig":
                this.kmsTenantConfigService.saveTenantConfig(
                    tenantId,
                    spec as any,
                );
                return;
            case "KeyChain":
                await this.applyKeyChain(tenantId, document);
                return;
            case "RegistrarConfig":
                await this.registrarConfigService.saveConfig(
                    tenantId,
                    spec as any,
                );
                return;
            case "IssuanceConfig":
                await this.issuanceService.storeIssuanceConfiguration(
                    tenantId,
                    spec as any,
                );
                return;
            case "CredentialConfig":
                await this.credentialConfigService.store(
                    tenantId,
                    { ...spec, id: document.metadata.id } as any,
                    true,
                );
                return;
            case "PresentationConfig":
                await this.presentationsService.storePresentationConfig(
                    tenantId,
                    { ...spec, id: document.metadata.id } as any,
                );
                return;
            case "AttributeProvider":
                if (
                    await this.attributeProviders.countBy({
                        tenantId,
                        id: document.metadata.id,
                    })
                ) {
                    await this.attributeProviderService.update(
                        tenantId,
                        document.metadata.id,
                        spec as any,
                    );
                } else {
                    await this.attributeProviderService.create(tenantId, {
                        ...spec,
                        id: document.metadata.id,
                    } as any);
                }
                return;
            case "WebhookEndpoint":
                if (
                    await this.webhookEndpoints.countBy({
                        tenantId,
                        id: document.metadata.id,
                    })
                ) {
                    await this.webhookEndpointService.update(
                        tenantId,
                        document.metadata.id,
                        spec as any,
                    );
                } else {
                    await this.webhookEndpointService.create(tenantId, {
                        ...spec,
                        id: document.metadata.id,
                    } as any);
                }
                return;
            case "TrustList": {
                const tenant = await this.tenants.findOneByOrFail({
                    id: tenantId,
                });
                if (
                    await this.trustLists.countBy({
                        tenantId,
                        id: document.metadata.id,
                    })
                ) {
                    await this.trustListService.update(
                        tenantId,
                        document.metadata.id,
                        { ...spec, id: document.metadata.id } as any,
                    );
                } else {
                    await this.trustListService.create(
                        { ...spec, id: document.metadata.id } as any,
                        tenant,
                    );
                }
                return;
            }
            case "StatusList":
                await this.statusLists.delete({
                    tenantId,
                    id: document.metadata.id,
                });
                await this.statusListService.processStatusListConfig(tenantId, {
                    ...spec,
                    id: document.metadata.id,
                } as any);
        }
    }

    private async applyKeyChain(
        tenantId: string,
        document: ConfigDocument,
    ): Promise<void> {
        const spec = document.spec as any;
        if (spec.keySource?.type === "regenerate") {
            await this.keyChainService.regenerate(
                tenantId,
                document.metadata.id,
                {
                    usageType: spec.usageType,
                    type:
                        spec.keySource.keyChainType ??
                        (spec.activeCertificate
                            ? KeyChainType.InternalChain
                            : KeyChainType.Standalone),
                    description: spec.description,
                    kmsProvider:
                        spec.keySource.provider ?? spec.kmsProvider ?? "db",
                    rotationPolicy: spec.rotationPolicy,
                },
            );
            return;
        }
        if (spec.keySource?.type === "private-jwk") {
            await this.keyChains.delete({ tenantId, id: document.metadata.id });
            if (spec.keySource.activeJwk) {
                await this.keyChains.save({
                    id: document.metadata.id,
                    tenantId,
                    description: spec.description,
                    usageType: spec.usageType,
                    usage: KeyUsage.Sign,
                    kmsProvider: "db",
                    rootJwk: spec.keySource.jwk,
                    rootCertificate: spec.crt?.at(-1),
                    activeJwk: spec.keySource.activeJwk,
                    activeCertificate: spec.activeCertificate,
                    rotationEnabled: spec.rotationPolicy?.enabled ?? true,
                    rotationIntervalDays: spec.rotationPolicy?.intervalDays,
                    certValidityDays: spec.rotationPolicy?.certValidityDays,
                });
                return;
            }
            await this.keyChainService.importKeyChain(
                tenantId,
                this.migrationService.unwrapForLegacyImporter(document) as any,
            );
            return;
        }
        if (spec.keySource?.type !== "external-reference") {
            throw new BadRequestException(
                `KeyChain '${document.metadata.id}' has no importable key source`,
            );
        }
        await this.kmsReferenceService.verify(tenantId, spec.keySource);
        await this.keyChains.save({
            id: document.metadata.id,
            tenantId,
            description: spec.description,
            usageType: spec.usageType,
            usage: KeyUsage.Sign,
            kmsProvider: spec.keySource.provider,
            rootJwk: spec.keySource.activeExternalKeyId
                ? spec.keySource.publicJwk
                : undefined,
            rootExternalKeyId: spec.keySource.activeExternalKeyId
                ? spec.keySource.externalKeyId
                : undefined,
            rootCertificate: spec.keySource.activeExternalKeyId
                ? spec.crt?.at(-1)
                : undefined,
            activeJwk:
                spec.keySource.activePublicJwk ?? spec.keySource.publicJwk,
            externalKeyId:
                spec.keySource.activeExternalKeyId ??
                spec.keySource.externalKeyId,
            activeCertificate:
                spec.activeCertificate ?? spec.crt?.join("\n") ?? "",
            rotationEnabled: spec.rotationPolicy?.enabled ?? false,
            rotationIntervalDays: spec.rotationPolicy?.intervalDays,
            certValidityDays: spec.rotationPolicy?.certValidityDays,
        });
    }

    private order(kind: ConfigResourceKind): number {
        return this.resourceRegistry.get(kind).importPhase;
    }
}
