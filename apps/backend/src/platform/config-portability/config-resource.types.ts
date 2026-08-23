export const CONFIG_RESOURCE_KINDS = [
    "Tenant",
    "Client",
    "KmsConfig",
    "KeyChain",
    "RegistrarConfig",
    "IssuanceConfig",
    "CredentialConfig",
    "PresentationConfig",
    "AttributeProvider",
    "WebhookEndpoint",
    "TrustList",
    "StatusList",
] as const;

export type ConfigResourceKind = (typeof CONFIG_RESOURCE_KINDS)[number];
export type ConfigOwnership = "unmanaged" | "file-managed";
export type ConfigImportMode = "create" | "upsert" | "replace";

interface ConfigDocumentMetadata {
    id: string;
    generation?: number;
    ownership?: ConfigOwnership;
}

export interface ConfigDocument<T = Record<string, unknown>> {
    apiVersion: string;
    kind: ConfigResourceKind;
    metadata: ConfigDocumentMetadata;
    spec: T;
}

type ConfigIssueSeverity = "warning" | "required-input" | "error";

export interface ConfigMigrationIssue {
    severity: ConfigIssueSeverity;
    code: string;
    path: string;
    message: string;
    resource?: {
        kind: ConfigResourceKind;
        id: string;
    };
}

export interface ConfigMigrationResult<T = Record<string, unknown>> {
    document: ConfigDocument<T>;
    issues: ConfigMigrationIssue[];
    migrations: string[];
}

interface ConfigBundleResource {
    kind: ConfigResourceKind;
    id: string;
    apiVersion: string;
    path: string;
    sha256: string;
    ownership: ConfigOwnership;
    generation: number;
}

export interface ConfigBundleRequirement {
    code: string;
    resource: { kind: ConfigResourceKind; id: string };
    path: string;
    message: string;
    placeholder?: string;
}

export interface ConfigBundleAsset {
    path: string;
    contentType?: string;
    sha256: string;
    data: string;
}

interface ConfigBundleManifest {
    format: "eudiplo.config-bundle";
    formatVersion: 1;
    sourceVersion: string;
    exportedAt: string;
    tenant: string;
    resources: ConfigBundleResource[];
    assets: Array<{
        path: string;
        contentType?: string;
        sha256: string;
    }>;
    requirements: ConfigBundleRequirement[];
    warnings: ConfigMigrationIssue[];
}

export interface ConfigBundle {
    manifest: ConfigBundleManifest;
    documents: ConfigDocument[];
    assets: ConfigBundleAsset[];
}

export interface ConfigImportPlanItem {
    kind: ConfigResourceKind;
    id: string;
    action: "create" | "update" | "skip" | "delete" | "blocked";
    sourceVersion: string;
    targetVersion: string;
    migrations: string[];
    issues: ConfigMigrationIssue[];
}

export interface ConfigImportPlan {
    tenantId: string;
    mode: ConfigImportMode;
    applicable: boolean;
    items: ConfigImportPlanItem[];
    issues: ConfigMigrationIssue[];
    generatedSecrets?: Array<{
        kind: "Client";
        id: string;
        path: "/spec/secret";
        value: string;
    }>;
}
