type Kind =
    | "Tenant"
    | "Client"
    | "KmsConfig"
    | "KeyChain"
    | "RegistrarConfig"
    | "IssuanceConfig"
    | "CredentialConfig"
    | "PresentationConfig"
    | "AttributeProvider"
    | "WebhookEndpoint"
    | "TrustList"
    | "StatusList";

export interface PortableDocument {
    apiVersion: string;
    kind: Kind;
    metadata: { id: string; generation?: number; ownership?: string };
    spec: Record<string, any>;
}

export interface UpgradeIssue {
    severity: "warning" | "required-input" | "error";
    code: string;
    path: string;
    message: string;
}

const CURRENT: Record<Kind, { slug: string; version: number }> = {
    Tenant: { slug: "tenant", version: 1 },
    Client: { slug: "client", version: 1 },
    KmsConfig: { slug: "kms-config", version: 1 },
    KeyChain: { slug: "key-chain", version: 2 },
    RegistrarConfig: { slug: "registrar-config", version: 1 },
    IssuanceConfig: { slug: "issuance-config", version: 2 },
    CredentialConfig: { slug: "credential-config", version: 1 },
    PresentationConfig: { slug: "presentation-config", version: 2 },
    AttributeProvider: { slug: "attribute-provider", version: 1 },
    WebhookEndpoint: { slug: "webhook-endpoint", version: 1 },
    TrustList: { slug: "trust-list", version: 1 },
    StatusList: { slug: "status-list", version: 1 },
};

export function upgradeDocument(input: PortableDocument): {
    document: PortableDocument;
    migrations: string[];
    issues: UpgradeIssue[];
} {
    const target = CURRENT[input.kind];
    if (!target) throw new Error(`Unsupported resource kind: ${input.kind}`);
    const match = new RegExp(
        `^eudiplo\\.io/${target.slug}/v([1-9][0-9]*)$`,
    ).exec(input.apiVersion);
    if (!match) {
        throw new Error(
            `Invalid apiVersion for ${input.kind}: ${input.apiVersion}`,
        );
    }
    let version = Number(match[1]);
    if (version > target.version) {
        throw new Error(
            `${input.kind} v${version} is newer than supported v${target.version}`,
        );
    }
    const document = structuredClone(input);
    const migrations: string[] = [];
    const issues: UpgradeIssue[] = [];

    if (input.kind === "KeyChain" && version === 1) {
        const key = document.spec.key;
        delete document.spec.key;
        document.spec.keySource = { type: "private-jwk", jwk: key };
        migrations.push("KeyChain/1-to-2");
        version = 2;
    }
    if (input.kind === "IssuanceConfig" && version === 1) {
        const values = document.spec.walletProviderTrustLists;
        if (Array.isArray(values)) {
            document.spec.walletProviderTrustLists = values.map(
                (value: unknown, index: number) => {
                    if (typeof value !== "string") return value;
                    issues.push({
                        severity: "required-input",
                        code: "TRUST_LIST_VERIFIER_REQUIRED",
                        path: `/spec/walletProviderTrustLists/${index}`,
                        message:
                            "Provide verifierKey or verifierX509Der before import.",
                    });
                    return { url: value };
                },
            );
        }
        migrations.push("IssuanceConfig/1-to-2");
        version = 2;
    }
    if (input.kind === "PresentationConfig" && version === 1) {
        if (document.spec.webhook !== undefined) {
            issues.push({
                severity: "required-input",
                code: "WEBHOOK_ENDPOINT_REFERENCE_REQUIRED",
                path: "/spec/webhook",
                message:
                    "Create or select a webhook endpoint, set webhookEndpointId, and remove webhook.",
            });
        }
        const credentials = document.spec.dcql_query?.credentials;
        if (Array.isArray(credentials)) {
            credentials.forEach((credential: any, credentialIndex: number) => {
                credential.trusted_authorities?.forEach(
                    (authority: any, authorityIndex: number) => {
                        if (
                            authority?.type !== "etsi_tl" ||
                            !Array.isArray(authority.values)
                        ) {
                            return;
                        }
                        authority.values = authority.values.map(
                            (value: unknown, valueIndex: number) => {
                                if (typeof value !== "string") return value;
                                issues.push({
                                    severity: "required-input",
                                    code: "TRUST_LIST_VERIFIER_REQUIRED",
                                    path: `/spec/dcql_query/credentials/${credentialIndex}/trusted_authorities/${authorityIndex}/values/${valueIndex}`,
                                    message:
                                        "Provide verifierKey, verifierX509Der, or trustListId before import.",
                                });
                                return { url: value };
                            },
                        );
                    },
                );
            });
        }
        migrations.push("PresentationConfig/1-to-2");
        version = 2;
    }
    if (version !== target.version) {
        throw new Error(
            `No migration path for ${input.kind} v${version} to v${target.version}`,
        );
    }
    document.apiVersion = `eudiplo.io/${target.slug}/v${target.version}`;
    return { document, migrations, issues };
}
