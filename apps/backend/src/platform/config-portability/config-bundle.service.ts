import { createHash } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ClientEntity } from "../../auth/client/entities/client.entity";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";
import { KeyChainEntity } from "../../crypto/key/entities/key-chain.entity";
import { KmsTenantConfigService } from "../../crypto/key/kms/kms-tenant-config.service";
import { AttributeProviderEntity } from "../../issuer/configuration/attribute-provider/entities/attribute-provider.entity";
import { CredentialConfig } from "../../issuer/configuration/credentials/entities/credential.entity";
import { IssuanceConfig } from "../../issuer/configuration/issuance/entities/issuance-config.entity";
import { WebhookEndpointEntity } from "../../issuer/configuration/webhook-endpoint/entities/webhook-endpoint.entity";
import { StatusListEntity } from "../../issuer/status-list/entities/status-list.entity";
import { TrustList } from "../../issuer/trust-list/entities/trust-list.entity";
import { RegistrarConfigEntity } from "../../registrar/entities/registrar-config.entity";
import { FileEntity } from "../../storage/entities/files.entity";
import { FilesService } from "../../storage/files.service";
import { PresentationConfig } from "../../verifier/presentations/entities/presentation-config.entity";
import { ConfigDocumentValidationService } from "./config-document-validation.service";
import { ConfigKmsReferenceService } from "./config-kms-reference.service";
import { ConfigMigrationService } from "./config-migration.service";
import { ConfigOwnershipService } from "./config-ownership.service";
import { ConfigResourceRegistry } from "./config-resource.registry";
import type {
    ConfigBundle,
    ConfigBundleRequirement,
    ConfigDocument,
    ConfigImportMode,
    ConfigImportPlan,
    ConfigImportPlanItem,
    ConfigMigrationIssue,
    ConfigResourceKind,
} from "./config-resource.types";
import { CONFIG_RESOURCE_KINDS } from "./config-resource.types";

const OMITTED_FIELDS = new Set([
    "tenant",
    "tenantId",
    "createdAt",
    "updatedAt",
    "registrationCertificateCache",
    "readerAuthCache",
    "jwt",
    "cwt",
    "list",
    "statusList",
    "previousJwk",
    "previousCertificate",
    "previousKeyExpiry",
    "lastRotatedAt",
]);

function sha256(value: string | Buffer): string {
    return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(
                ([key, item]) => !OMITTED_FIELDS.has(key) && item !== undefined,
            )
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, canonicalize(item)]),
    );
}

function pathMatches(pattern: string, path: string): boolean {
    const expected = pattern.split(".");
    const actual = path.split(".");
    return (
        expected.length === actual.length &&
        expected.every((part, index) => part === "*" || part === actual[index])
    );
}

function placeholder(
    kind: ConfigResourceKind,
    id: string,
    path: string,
): string {
    return `${kind}_${id}_${path}`
        .replaceAll(/[^A-Za-z0-9]+/g, "_")
        .replaceAll(/^_+|_+$/g, "")
        .toUpperCase();
}

@Injectable()
export class ConfigBundleService {
    constructor(
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
        @InjectRepository(FileEntity)
        private readonly files: Repository<FileEntity>,
        private readonly filesService: FilesService,
        private readonly kmsTenantConfigService: KmsTenantConfigService,
        private readonly kmsReferenceService: ConfigKmsReferenceService,
        private readonly registry: ConfigResourceRegistry,
        private readonly migrationService: ConfigMigrationService,
        private readonly documentValidationService: ConfigDocumentValidationService,
        private readonly ownershipService: ConfigOwnershipService,
        private readonly configService: ConfigService,
    ) {}

    async exportBundle(tenantId: string): Promise<ConfigBundle> {
        const tenant = await this.tenants.findOneByOrFail({ id: tenantId });
        const requirements: ConfigBundleRequirement[] = [];
        const warnings: ConfigMigrationIssue[] = [];
        const documents: ConfigDocument[] = [];

        await this.addDocument(
            documents,
            requirements,
            tenantId,
            "Tenant",
            "tenant",
            {
                name: tenant.name,
                description: tenant.description,
                sessionConfig: tenant.sessionConfig,
                statusListConfig: tenant.statusListConfig,
            },
        );

        for (const client of await this.clients.find({ where: { tenantId } })) {
            const spec: Record<string, unknown> = {
                clientId: client.clientId,
                description: client.description,
                roles: client.roles,
                allowedPresentationConfigs: client.allowedPresentationConfigs,
                allowedIssuanceConfigs: client.allowedIssuanceConfigs,
            };
            if (client.secret || this.configService.get<string>("OIDC")) {
                const env = placeholder("Client", client.clientId, "secret");
                spec.secret = `\${${env}}`;
                requirements.push({
                    code: "CLIENT_SECRET_REQUIRED",
                    resource: { kind: "Client", id: client.clientId },
                    path: "/spec/secret",
                    placeholder: env,
                    message:
                        "Client secrets are one-way hashed. Supply a replacement or set secret to !generate during import.",
                });
            }
            await this.addDocument(
                documents,
                requirements,
                tenantId,
                "Client",
                client.clientId,
                spec,
                false,
            );
        }

        const kmsConfig = this.kmsTenantConfigService.getTenantConfig(tenantId);
        if (kmsConfig) {
            await this.addDocument(
                documents,
                requirements,
                tenantId,
                "KmsConfig",
                "kms",
                kmsConfig as unknown as Record<string, unknown>,
            );
        }

        for (const keyChain of await this.keyChains.find({
            where: { tenantId },
        })) {
            const publicJwk = this.toPublicJwk(
                keyChain.hasInternalCa()
                    ? keyChain.rootJwk
                    : keyChain.activeJwk,
            );
            const keySource = keyChain.externalKeyId
                ? {
                      type: "external-reference",
                      provider: keyChain.kmsProvider,
                      externalKeyId: keyChain.hasInternalCa()
                          ? keyChain.rootExternalKeyId
                          : keyChain.externalKeyId,
                      publicJwk,
                      activeExternalKeyId: keyChain.hasInternalCa()
                          ? keyChain.externalKeyId
                          : undefined,
                      activePublicJwk: keyChain.hasInternalCa()
                          ? this.toPublicJwk(keyChain.activeJwk)
                          : undefined,
                  }
                : { type: "required", publicJwk };
            const spec: Record<string, unknown> = {
                id: keyChain.id,
                description: keyChain.description,
                usageType: keyChain.usageType,
                kmsProvider: keyChain.kmsProvider,
                keySource,
                crt: keyChain.hasInternalCa()
                    ? [keyChain.rootCertificate]
                    : [keyChain.activeCertificate],
                activeCertificate: keyChain.hasInternalCa()
                    ? keyChain.activeCertificate
                    : undefined,
                rotationPolicy: {
                    enabled: keyChain.rotationEnabled,
                    intervalDays: keyChain.rotationIntervalDays,
                    certValidityDays: keyChain.certValidityDays,
                },
            };
            if (!keyChain.externalKeyId) {
                requirements.push({
                    code: "PRIVATE_KEY_REQUIRED",
                    resource: { kind: "KeyChain", id: keyChain.id },
                    path: "/spec/keySource",
                    message:
                        "Safe export does not include database-held private keys. Supply the key material or regenerate explicitly.",
                });
            }
            await this.addDocument(
                documents,
                requirements,
                tenantId,
                "KeyChain",
                keyChain.id,
                spec,
                false,
            );
        }

        const registrar = await this.registrarConfigs.findOneBy({ tenantId });
        if (registrar) {
            await this.addDocument(
                documents,
                requirements,
                tenantId,
                "RegistrarConfig",
                "registrar",
                this.canonicalEntitySpec("RegistrarConfig", registrar),
            );
        }

        const issuance = await this.issuanceConfigs.findOneBy({ tenantId });
        if (issuance) {
            await this.addDocument(
                documents,
                requirements,
                tenantId,
                "IssuanceConfig",
                "issuance",
                this.canonicalEntitySpec("IssuanceConfig", issuance),
            );
        }

        await this.addEntities(
            documents,
            requirements,
            tenantId,
            "CredentialConfig",
            await this.credentialConfigs.find({ where: { tenantId } }),
        );
        await this.addEntities(
            documents,
            requirements,
            tenantId,
            "PresentationConfig",
            await this.presentationConfigs.find({ where: { tenantId } }),
        );
        await this.addEntities(
            documents,
            requirements,
            tenantId,
            "AttributeProvider",
            await this.attributeProviders.find({ where: { tenantId } }),
        );
        await this.addEntities(
            documents,
            requirements,
            tenantId,
            "WebhookEndpoint",
            await this.webhookEndpoints.find({ where: { tenantId } }),
        );
        for (const trustList of await this.trustLists.find({
            where: { tenantId },
        })) {
            await this.addDocument(
                documents,
                requirements,
                tenantId,
                "TrustList",
                trustList.id,
                {
                    id: trustList.id,
                    description: trustList.description,
                    keyChainId: trustList.keyChainId,
                    entities: trustList.entityConfig ?? [],
                    data: trustList.data,
                },
            );
        }

        for (const status of await this.statusLists.find({
            where: { tenantId },
        })) {
            await this.addDocument(
                documents,
                requirements,
                tenantId,
                "StatusList",
                status.id,
                {
                    id: status.id,
                    credentialConfigurationId: status.credentialConfigurationId,
                    keyChainId: status.keyChainId,
                    capacity: status.elements.length,
                    bits: status.bits,
                },
            );
        }

        await this.rewriteAssetReferences(tenantId, documents);
        documents.sort((left, right) =>
            `${left.kind}/${left.metadata.id}`.localeCompare(
                `${right.kind}/${right.metadata.id}`,
            ),
        );
        const assets = await this.exportAssets(tenantId);
        const resources = documents.map((document) => {
            const definition = this.registry.get(document.kind);
            const serialized = JSON.stringify(document);
            return {
                kind: document.kind,
                id: document.metadata.id,
                apiVersion: document.apiVersion,
                path:
                    definition.bundlePath ??
                    `${definition.legacyFolders.at(-1)}/${document.metadata.id}.json`,
                sha256: sha256(serialized),
                ownership: document.metadata.ownership ?? "unmanaged",
                generation: document.metadata.generation ?? 1,
            };
        });

        return {
            manifest: {
                format: "eudiplo.config-bundle",
                formatVersion: 1,
                sourceVersion:
                    this.configService.get("VERSION") ??
                    process.env.VERSION ??
                    "main",
                exportedAt: new Date().toISOString(),
                tenant: tenantId,
                resources,
                assets: assets.map(({ path, contentType, sha256 }) => ({
                    path,
                    contentType,
                    sha256,
                })),
                requirements,
                warnings,
            },
            documents,
            assets,
        };
    }

    async plan(
        tenantId: string,
        bundle: ConfigBundle,
        mode: ConfigImportMode,
        ownershipSource = `bundle:${bundle.manifest.tenant}`,
    ): Promise<ConfigImportPlan> {
        this.assertBundle(bundle);
        const items: ConfigImportPlanItem[] = [];
        const issues: ConfigMigrationIssue[] = [];
        const upgradedDocuments: ConfigDocument[] = [];
        for (const input of bundle.documents) {
            const sourceVersion = input.apiVersion;
            const result = this.migrationService.upgrade(input);
            upgradedDocuments.push(result.document);
            const exists = await this.exists(
                tenantId,
                result.document.kind,
                result.document.metadata.id,
            );
            const metadata = await this.ownershipService.get(
                tenantId,
                result.document.kind,
                result.document.metadata.id,
            );
            const itemIssues = [...result.issues];
            itemIssues.push(
                ...this.documentValidationService.validate(result.document),
            );
            this.collectUnresolvedRequirements(result.document, itemIssues);
            if (
                exists &&
                (result.document.metadata.generation ?? 1) < metadata.generation
            ) {
                itemIssues.push({
                    severity: "error",
                    code: "STALE_GENERATION",
                    path: "/metadata/generation",
                    message: `Generation ${result.document.metadata.generation ?? 1} is older than stored generation ${metadata.generation}.`,
                    resource: {
                        kind: result.document.kind,
                        id: result.document.metadata.id,
                    },
                });
            }
            const skipExisting = exists && mode === "create";
            if (skipExisting) {
                itemIssues.push({
                    severity: "warning",
                    code: "RESOURCE_EXISTS",
                    path: "/metadata/id",
                    message:
                        "Resource already exists and will be skipped in create mode.",
                    resource: {
                        kind: result.document.kind,
                        id: result.document.metadata.id,
                    },
                });
            }
            const blocked = itemIssues.some(
                (issue) =>
                    issue.severity === "error" ||
                    issue.severity === "required-input",
            );
            items.push({
                kind: result.document.kind,
                id: result.document.metadata.id,
                action: blocked
                    ? "blocked"
                    : skipExisting
                      ? "skip"
                      : exists
                        ? "update"
                        : "create",
                sourceVersion,
                targetVersion: result.document.apiVersion,
                migrations: result.migrations,
                issues: itemIssues,
            });
            issues.push(...itemIssues);
        }
        const referenceIssues = await this.validateReferences(
            tenantId,
            upgradedDocuments,
            mode,
            ownershipSource,
        );
        for (const issue of referenceIssues) {
            const item = issue.resource
                ? items.find(
                      (candidate) =>
                          candidate.kind === issue.resource?.kind &&
                          candidate.id === issue.resource.id,
                  )
                : undefined;
            item?.issues.push(issue);
            if (item && issue.severity !== "warning") item.action = "blocked";
            issues.push(issue);
        }
        if (mode === "replace") {
            const included = new Set(
                bundle.documents.map(
                    (document) => `${document.kind}/${document.metadata.id}`,
                ),
            );
            const managed =
                await this.ownershipService.listManagedBySourceScope(
                    tenantId,
                    ownershipSource,
                );
            for (const metadata of managed) {
                if (
                    metadata.kind === "Tenant" ||
                    included.has(`${metadata.kind}/${metadata.resourceId}`)
                ) {
                    continue;
                }
                items.push({
                    kind: metadata.kind,
                    id: metadata.resourceId,
                    action: "delete",
                    sourceVersion: "stored",
                    targetVersion: "deleted",
                    migrations: [],
                    issues: [],
                });
            }
        }
        return {
            tenantId,
            mode,
            applicable: !issues.some(
                (issue) =>
                    issue.severity === "error" ||
                    issue.severity === "required-input",
            ),
            items,
            issues,
        };
    }

    private async validateReferences(
        tenantId: string,
        documents: ConfigDocument[],
        mode: ConfigImportMode,
        ownershipSource: string,
    ): Promise<ConfigMigrationIssue[]> {
        const available = new Map<ConfigResourceKind, Set<string>>();
        const load = (kind: ConfigResourceKind, ids: string[]) =>
            available.set(kind, new Set(ids));
        load(
            "KeyChain",
            (
                await this.keyChains.find({
                    where: { tenantId },
                    select: { id: true },
                })
            ).map((item) => item.id),
        );
        load(
            "CredentialConfig",
            (
                await this.credentialConfigs.find({
                    where: { tenantId },
                    select: { id: true },
                })
            ).map((item) => item.id),
        );
        load(
            "PresentationConfig",
            (
                await this.presentationConfigs.find({
                    where: { tenantId },
                    select: { id: true },
                })
            ).map((item) => item.id),
        );
        load(
            "WebhookEndpoint",
            (
                await this.webhookEndpoints.find({
                    where: { tenantId },
                    select: { id: true },
                })
            ).map((item) => item.id),
        );
        load(
            "AttributeProvider",
            (
                await this.attributeProviders.find({
                    where: { tenantId },
                    select: { id: true },
                })
            ).map((item) => item.id),
        );
        load(
            "TrustList",
            (
                await this.trustLists.find({
                    where: { tenantId },
                    select: { id: true },
                })
            ).map((item) => item.id),
        );
        for (const document of documents) {
            available.get(document.kind)?.add(document.metadata.id);
        }
        if (mode === "replace") {
            const included = new Set(
                documents.map(
                    (document) => `${document.kind}/${document.metadata.id}`,
                ),
            );
            const managed =
                await this.ownershipService.listManagedBySourceScope(
                    tenantId,
                    ownershipSource,
                );
            for (const metadata of managed) {
                if (!included.has(`${metadata.kind}/${metadata.resourceId}`)) {
                    available.get(metadata.kind)?.delete(metadata.resourceId);
                }
            }
        }

        const referenceFields: Record<string, ConfigResourceKind> = {
            keychainid: "KeyChain",
            signingkeyid: "KeyChain",
            credentialconfigid: "CredentialConfig",
            credentialconfigurationid: "CredentialConfig",
            presentationconfigid: "PresentationConfig",
            webhookendpointid: "WebhookEndpoint",
            attributeproviderid: "AttributeProvider",
            trustlistid: "TrustList",
        };
        const arrayReferenceFields: Record<string, ConfigResourceKind> = {
            allowedpresentationconfigs: "PresentationConfig",
            allowedissuanceconfigs: "CredentialConfig",
        };
        const issues: ConfigMigrationIssue[] = [];
        const visit = (
            document: ConfigDocument,
            value: unknown,
            path: string,
        ): void => {
            if (Array.isArray(value)) {
                value.forEach((item, index) =>
                    visit(document, item, `${path}/${index}`),
                );
                return;
            }
            if (!value || typeof value !== "object") return;
            for (const [key, item] of Object.entries(
                value as Record<string, unknown>,
            )) {
                const normalizedKey = key.toLowerCase();
                const target = normalizedKey.endsWith("keychainid")
                    ? "KeyChain"
                    : referenceFields[normalizedKey];
                if (
                    target &&
                    typeof item === "string" &&
                    item.length > 0 &&
                    !available.get(target)?.has(item)
                ) {
                    issues.push({
                        severity: "error",
                        code: "MISSING_RESOURCE_REFERENCE",
                        path: `${path}/${key}`,
                        message: `${target} '${item}' does not exist in the target instance or bundle.`,
                        resource: {
                            kind: document.kind,
                            id: document.metadata.id,
                        },
                    });
                }
                const arrayTarget = arrayReferenceFields[normalizedKey];
                if (arrayTarget && Array.isArray(item)) {
                    for (const [index, reference] of item.entries()) {
                        if (
                            typeof reference === "string" &&
                            reference.length > 0 &&
                            !available.get(arrayTarget)?.has(reference)
                        ) {
                            issues.push({
                                severity: "error",
                                code: "MISSING_RESOURCE_REFERENCE",
                                path: `${path}/${key}/${index}`,
                                message: `${arrayTarget} '${reference}' does not exist in the target instance or bundle.`,
                                resource: {
                                    kind: document.kind,
                                    id: document.metadata.id,
                                },
                            });
                        }
                    }
                }
                visit(document, item, `${path}/${key}`);
            }
        };
        for (const document of documents)
            visit(document, document.spec, "/spec");

        const includesKmsConfig = documents.some(
            (document) => document.kind === "KmsConfig",
        );
        for (const document of documents.filter(
            (candidate) => candidate.kind === "KeyChain",
        )) {
            const source = (document.spec as any).keySource;
            if (source?.type !== "external-reference") continue;
            try {
                await this.kmsReferenceService.verify(tenantId, source);
            } catch (error) {
                issues.push({
                    severity: includesKmsConfig ? "warning" : "error",
                    code: includesKmsConfig
                        ? "KMS_PREFLIGHT_DEFERRED"
                        : "KMS_REFERENCE_UNAVAILABLE",
                    path: "/spec/keySource",
                    message: includesKmsConfig
                        ? "The bundle changes KMS configuration, so this external key can only be verified after that configuration is applied."
                        : `The external KMS key could not sign a preflight challenge: ${error instanceof Error ? error.message : String(error)}`,
                    resource: {
                        kind: document.kind,
                        id: document.metadata.id,
                    },
                });
            }
        }
        return issues;
    }

    private async addEntities(
        documents: ConfigDocument[],
        requirements: ConfigBundleRequirement[],
        tenantId: string,
        kind: ConfigResourceKind,
        entities: Array<Record<string, any>>,
    ): Promise<void> {
        for (const entity of entities) {
            await this.addDocument(
                documents,
                requirements,
                tenantId,
                kind,
                String(entity.id),
                this.canonicalEntitySpec(kind, entity),
            );
        }
    }

    /**
     * Map persistence entities to the public desired-state schema explicitly.
     * This prevents later runtime/cache columns from silently entering exports.
     */
    private canonicalEntitySpec(
        kind: ConfigResourceKind,
        entity: Record<string, any>,
    ): Record<string, unknown> {
        switch (kind) {
            case "RegistrarConfig":
                return {
                    registrarUrl: entity.registrarUrl,
                    oidcUrl: entity.oidcUrl,
                    clientId: entity.clientId,
                    clientSecret: entity.clientSecret,
                    username: entity.username,
                    password: entity.password,
                    registrationCertificateDefaults:
                        entity.registrationCertificateDefaults,
                };
            case "IssuanceConfig":
                return {
                    batchSize: entity.batchSize,
                    dPopRequired: entity.dPopRequired,
                    walletAttestationRequired: entity.walletAttestationRequired,
                    walletProviderTrustLists: entity.walletProviderTrustLists,
                    signingKeyId: entity.signingKeyId,
                    authorizationServers: entity.authorizationServers,
                    federation: entity.federation,
                    registrationCertificate: entity.registrationCertificate,
                    display: entity.display,
                    notificationEndpointEnabled:
                        entity.notificationEndpointEnabled,
                    credentialResponseEncryption:
                        entity.credentialResponseEncryption,
                    credentialRequestEncryption:
                        entity.credentialRequestEncryption,
                    txCodeMaxAttempts: entity.txCodeMaxAttempts,
                };
            case "CredentialConfig":
                return {
                    id: entity.id,
                    description: entity.description,
                    config: entity.config,
                    fields: entity.fields,
                    attributeProviderId: entity.attributeProviderId,
                    webhookEndpointId: entity.webhookEndpointId,
                    vct: entity.vct,
                    keyBinding: entity.keyBinding,
                    keyChainId: entity.keyChainId,
                    statusManagement: entity.statusManagement,
                    iaeActions: entity.iaeActions,
                    sdJwtTrustFormat: entity.sdJwtTrustFormat,
                    lifeTime: entity.lifeTime,
                    schemaMeta: entity.schemaMeta,
                    embeddedDisclosurePolicy: entity.embeddedDisclosurePolicy,
                };
            case "PresentationConfig":
                return {
                    id: entity.id,
                    description: entity.description,
                    lifeTime: entity.lifeTime,
                    skewSeconds: entity.skewSeconds,
                    statusCheckMode: entity.statusCheckMode,
                    dcql_query: entity.dcql_query,
                    transaction_data: entity.transaction_data,
                    registration_cert: entity.registration_cert,
                    webhookEndpointId: entity.webhookEndpointId,
                    attached: entity.attached,
                    redirectUri: entity.redirectUri,
                    accessKeyChainId: entity.accessKeyChainId,
                    readerAuth: entity.readerAuth,
                };
            case "AttributeProvider":
            case "WebhookEndpoint":
                return {
                    id: entity.id,
                    name: entity.name,
                    description: entity.description,
                    url: entity.url,
                    auth: entity.auth,
                };
            default:
                throw new Error(
                    `No entity export mapper registered for ${kind}`,
                );
        }
    }

    private async addDocument(
        documents: ConfigDocument[],
        requirements: ConfigBundleRequirement[],
        tenantId: string,
        kind: ConfigResourceKind,
        id: string,
        rawSpec: Record<string, unknown>,
        redact = true,
    ): Promise<void> {
        const metadata = await this.ownershipService.get(tenantId, kind, id);
        const spec = redact
            ? this.redact(kind, id, canonicalize(rawSpec), requirements)
            : canonicalize(rawSpec);
        documents.push({
            apiVersion: this.registry.apiVersion(kind),
            kind,
            metadata: {
                id,
                generation: metadata.generation,
                ownership: metadata.ownership,
            },
            spec: spec as Record<string, unknown>,
        });
    }

    private redact(
        kind: ConfigResourceKind,
        id: string,
        value: unknown,
        requirements: ConfigBundleRequirement[],
        path = "",
    ): unknown {
        if (Array.isArray(value)) {
            return value.map((item, index) =>
                this.redact(
                    kind,
                    id,
                    item,
                    requirements,
                    path ? `${path}.${index}` : `${index}`,
                ),
            );
        }
        if (!value || typeof value !== "object") return value;
        const patterns = this.registry.get(kind).sensitivePaths;
        const output: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(
            value as Record<string, unknown>,
        )) {
            const itemPath = path ? `${path}.${key}` : key;
            if (patterns.some((pattern) => pathMatches(pattern, itemPath))) {
                const env = placeholder(kind, id, itemPath);
                output[key] = `\${${env}}`;
                requirements.push({
                    code: "SECRET_REQUIRED",
                    resource: { kind, id },
                    path: `/spec/${itemPath.replaceAll(".", "/")}`,
                    placeholder: env,
                    message: `Supply ${env} in the target environment.`,
                });
            } else {
                output[key] = this.redact(
                    kind,
                    id,
                    item,
                    requirements,
                    itemPath,
                );
            }
        }
        return output;
    }

    private toPublicJwk(value: unknown): Record<string, unknown> | undefined {
        if (!value || typeof value !== "object") return undefined;
        const { d, p, q, dp, dq, qi, k, ...publicJwk } = value as Record<
            string,
            unknown
        >;
        return publicJwk;
    }

    private async exportAssets(tenantId: string) {
        const assets = [];
        for (const file of await this.files.find({ where: { tenantId } })) {
            const stored = await this.filesService.getStream(file.id);
            const chunks: Buffer[] = [];
            for await (const chunk of stored.stream) {
                chunks.push(
                    Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
                );
            }
            const data = Buffer.concat(chunks);
            assets.push({
                path: `images/${file.filename}`,
                contentType: stored.contentType,
                sha256: sha256(data),
                data: data.toString("base64"),
            });
        }
        return assets.sort((left, right) =>
            left.path.localeCompare(right.path),
        );
    }

    private async rewriteAssetReferences(
        tenantId: string,
        documents: ConfigDocument[],
    ): Promise<void> {
        const byId = new Map(
            (await this.files.find({ where: { tenantId } })).map((file) => [
                file.id,
                file.filename,
            ]),
        );
        const rewrite = (value: unknown): unknown => {
            if (typeof value === "string") {
                const match = /\/storage\/([^/?#]+)(?:[?#].*)?$/.exec(value);
                return match && byId.has(match[1]) ? byId.get(match[1]) : value;
            }
            if (Array.isArray(value)) return value.map(rewrite);
            if (!value || typeof value !== "object") return value;
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>).map(
                    ([key, item]) => [key, rewrite(item)],
                ),
            );
        };
        for (const document of documents) {
            document.spec = rewrite(document.spec) as Record<string, unknown>;
        }
    }

    private assertBundle(bundle: ConfigBundle): void {
        if (
            bundle?.manifest?.format !== "eudiplo.config-bundle" ||
            bundle.manifest.formatVersion !== 1 ||
            !Array.isArray(bundle.documents)
        ) {
            throw new BadRequestException(
                "Invalid EUDIPLO configuration bundle",
            );
        }
        if (
            !Array.isArray(bundle.manifest.resources) ||
            !Array.isArray(bundle.assets) ||
            typeof bundle.manifest.tenant !== "string"
        ) {
            throw new BadRequestException(
                "Incomplete configuration bundle manifest",
            );
        }
        const seen = new Set<string>();
        for (const document of bundle.documents) {
            if (
                !this.migrationService.isDocument(document) ||
                !CONFIG_RESOURCE_KINDS.includes(document.kind)
            ) {
                throw new BadRequestException(
                    "Invalid configuration document envelope",
                );
            }
            const identity = `${document.kind}/${document.metadata.id}`;
            if (seen.has(identity)) {
                throw new BadRequestException(
                    `Duplicate resource: ${identity}`,
                );
            }
            seen.add(identity);
            const resource = bundle.manifest.resources.find(
                (candidate) =>
                    candidate.kind === document.kind &&
                    candidate.id === document.metadata.id,
            );
            if (!resource || resource.apiVersion !== document.apiVersion) {
                throw new BadRequestException(
                    `Missing or mismatched manifest entry: ${identity}`,
                );
            }
            this.assertSafeBundlePath(resource.path);
        }
        if (bundle.manifest.resources.length !== bundle.documents.length) {
            throw new BadRequestException(
                "Manifest resource count does not match bundle documents",
            );
        }
        for (const asset of bundle.assets) {
            this.assertSafeBundlePath(asset.path);
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data)) {
                throw new BadRequestException(
                    `Invalid base64 asset: ${asset.path}`,
                );
            }
            const bytes = Buffer.from(asset.data, "base64");
            const manifestAsset = bundle.manifest.assets?.find(
                (candidate) => candidate.path === asset.path,
            );
            if (
                sha256(bytes) !== asset.sha256 ||
                !manifestAsset ||
                manifestAsset.sha256 !== asset.sha256
            ) {
                throw new BadRequestException(
                    `Missing or mismatched asset manifest entry: ${asset.path}`,
                );
            }
        }
        if ((bundle.manifest.assets?.length ?? 0) !== bundle.assets.length) {
            throw new BadRequestException(
                "Manifest asset count does not match bundle assets",
            );
        }
    }

    private assertSafeBundlePath(path: string): void {
        if (
            !path ||
            path.startsWith("/") ||
            path.includes("\\") ||
            path.split("/").some((part) => part === ".." || part === "")
        ) {
            throw new BadRequestException(`Unsafe bundle path: ${path}`);
        }
    }

    private collectUnresolvedRequirements(
        document: ConfigDocument,
        issues: ConfigMigrationIssue[],
    ): void {
        const visit = (value: unknown, path: string): void => {
            if (
                typeof value === "string" &&
                value !== "!generate" &&
                /^\$\{[A-Z0-9_]+(?::[^}]*)?\}$/.test(value)
            ) {
                issues.push({
                    severity: "required-input",
                    code: "SECRET_REQUIRED",
                    path,
                    message: `Resolve ${value} before applying this resource.`,
                    resource: {
                        kind: document.kind,
                        id: document.metadata.id,
                    },
                });
                return;
            }
            if (Array.isArray(value)) {
                value.forEach((item, index) => visit(item, `${path}/${index}`));
                return;
            }
            if (value && typeof value === "object") {
                Object.entries(value as Record<string, unknown>).forEach(
                    ([key, item]) => visit(item, `${path}/${key}`),
                );
            }
        };
        visit(document.spec, "/spec");
        if (
            document.kind === "KeyChain" &&
            (document.spec as any).keySource?.type === "required"
        ) {
            issues.push({
                severity: "required-input",
                code: "PRIVATE_KEY_REQUIRED",
                path: "/spec/keySource",
                message:
                    "Supply private key material, an accessible external KMS reference, or explicitly regenerate the key.",
                resource: {
                    kind: document.kind,
                    id: document.metadata.id,
                },
            });
        }
    }

    private async exists(
        tenantId: string,
        kind: ConfigResourceKind,
        id: string,
    ): Promise<boolean> {
        switch (kind) {
            case "Tenant":
                return (await this.tenants.countBy({ id: tenantId })) > 0;
            case "Client":
                return (
                    (await this.clients.countBy({ tenantId, clientId: id })) > 0
                );
            case "KmsConfig":
                return (
                    this.kmsTenantConfigService.getTenantConfig(tenantId) !==
                    null
                );
            case "KeyChain":
                return (await this.keyChains.countBy({ tenantId, id })) > 0;
            case "RegistrarConfig":
                return (await this.registrarConfigs.countBy({ tenantId })) > 0;
            case "IssuanceConfig":
                return (await this.issuanceConfigs.countBy({ tenantId })) > 0;
            case "CredentialConfig":
                return (
                    (await this.credentialConfigs.countBy({ tenantId, id })) > 0
                );
            case "PresentationConfig":
                return (
                    (await this.presentationConfigs.countBy({ tenantId, id })) >
                    0
                );
            case "AttributeProvider":
                return (
                    (await this.attributeProviders.countBy({ tenantId, id })) >
                    0
                );
            case "WebhookEndpoint":
                return (
                    (await this.webhookEndpoints.countBy({ tenantId, id })) > 0
                );
            case "TrustList":
                return (await this.trustLists.countBy({ tenantId, id })) > 0;
            case "StatusList":
                return (await this.statusLists.countBy({ tenantId, id })) > 0;
        }
    }
}
