import { Injectable } from "@nestjs/common";
import type { ConfigResourceKind } from "./config-resource.types";

export interface ConfigResourceDefinition {
    kind: ConfigResourceKind;
    slug: string;
    currentVersion: number;
    importPhase: number;
    dependsOn: ConfigResourceKind[];
    legacyFolders: string[];
    bundlePath?: string;
    singletonId?: string;
    sensitivePaths: string[];
}

const DEFINITIONS: ConfigResourceDefinition[] = [
    {
        kind: "Tenant",
        slug: "tenant",
        currentVersion: 1,
        importPhase: 0,
        dependsOn: [],
        legacyFolders: ["info.json"],
        bundlePath: "info.json",
        singletonId: "tenant",
        sensitivePaths: [],
    },
    {
        kind: "Client",
        slug: "client",
        currentVersion: 1,
        importPhase: 30,
        dependsOn: ["Tenant"],
        legacyFolders: ["clients"],
        sensitivePaths: ["secret"],
    },
    {
        kind: "KmsConfig",
        slug: "kms-config",
        currentVersion: 1,
        importPhase: 10,
        dependsOn: ["Tenant"],
        legacyFolders: ["kms.json"],
        bundlePath: "kms.json",
        singletonId: "kms",
        sensitivePaths: [
            "providers.*.vaultToken",
            "providers.*.secretAccessKey",
            "providers.*.pin",
            "providers.*.clientSecret",
            "providers.*.sad",
            "providers.*.authorizeAuthData.*.value",
            "providers.*.auth.token",
            "providers.*.auth.clientSecret",
        ],
    },
    {
        kind: "KeyChain",
        slug: "key-chain",
        currentVersion: 2,
        importPhase: 20,
        dependsOn: ["Tenant", "KmsConfig"],
        legacyFolders: ["key-chains"],
        sensitivePaths: ["keySource.jwk"],
    },
    {
        kind: "RegistrarConfig",
        slug: "registrar-config",
        currentVersion: 1,
        importPhase: 40,
        dependsOn: ["Tenant", "KeyChain"],
        legacyFolders: ["registrar.json"],
        bundlePath: "registrar.json",
        singletonId: "registrar",
        sensitivePaths: ["clientSecret", "password"],
    },
    {
        kind: "IssuanceConfig",
        slug: "issuance-config",
        currentVersion: 2,
        importPhase: 70,
        dependsOn: [
            "Tenant",
            "KeyChain",
            "AttributeProvider",
            "WebhookEndpoint",
        ],
        legacyFolders: ["issuance"],
        bundlePath: "issuance/config.json",
        singletonId: "issuance",
        sensitivePaths: [],
    },
    {
        kind: "CredentialConfig",
        slug: "credential-config",
        currentVersion: 1,
        importPhase: 80,
        dependsOn: [
            "Tenant",
            "KeyChain",
            "AttributeProvider",
            "WebhookEndpoint",
        ],
        legacyFolders: ["issuance/credentials"],
        sensitivePaths: [],
    },
    {
        kind: "PresentationConfig",
        slug: "presentation-config",
        currentVersion: 2,
        importPhase: 100,
        dependsOn: ["Tenant", "KeyChain", "WebhookEndpoint", "TrustList"],
        legacyFolders: ["presentation"],
        sensitivePaths: [],
    },
    {
        kind: "AttributeProvider",
        slug: "attribute-provider",
        currentVersion: 1,
        importPhase: 50,
        dependsOn: ["Tenant"],
        legacyFolders: ["attribute-providers"],
        sensitivePaths: ["auth.config.value"],
    },
    {
        kind: "WebhookEndpoint",
        slug: "webhook-endpoint",
        currentVersion: 1,
        importPhase: 60,
        dependsOn: ["Tenant"],
        legacyFolders: ["webhook-endpoints"],
        sensitivePaths: ["auth.config.value"],
    },
    {
        kind: "TrustList",
        slug: "trust-list",
        currentVersion: 1,
        importPhase: 90,
        dependsOn: ["Tenant", "KeyChain"],
        legacyFolders: ["trust-lists"],
        sensitivePaths: [],
    },
    {
        kind: "StatusList",
        slug: "status-list",
        currentVersion: 1,
        importPhase: 110,
        dependsOn: ["Tenant", "KeyChain", "CredentialConfig"],
        legacyFolders: ["issuance/status-lists"],
        sensitivePaths: [],
    },
];

@Injectable()
export class ConfigResourceRegistry {
    private readonly byKind = new Map(
        DEFINITIONS.map((definition) => [definition.kind, definition]),
    );

    list(): readonly ConfigResourceDefinition[] {
        return DEFINITIONS;
    }

    get(kind: ConfigResourceKind): ConfigResourceDefinition {
        const definition = this.byKind.get(kind);
        if (!definition) {
            throw new Error(`Unsupported configuration resource kind: ${kind}`);
        }
        return definition;
    }

    apiVersion(kind: ConfigResourceKind, version?: number): string {
        const definition = this.get(kind);
        return `eudiplo.io/${definition.slug}/v${version ?? definition.currentVersion}`;
    }

    parseApiVersion(kind: ConfigResourceKind, apiVersion: string): number {
        const definition = this.get(kind);
        const match = new RegExp(
            `^eudiplo\\.io/${definition.slug}/v([1-9][0-9]*)$`,
        ).exec(apiVersion);
        if (!match) {
            throw new Error(
                `Invalid apiVersion '${apiVersion}' for ${kind}; expected eudiplo.io/${definition.slug}/vN`,
            );
        }
        return Number(match[1]);
    }

    inferKind(resourceType: string): ConfigResourceKind | undefined {
        const normalized = resourceType.toLowerCase().replaceAll(/[^a-z]/g, "");
        return DEFINITIONS.find((definition) => {
            const kind = definition.kind.toLowerCase();
            const slug = definition.slug.replaceAll("-", "");
            return (
                normalized === kind ||
                normalized === slug ||
                normalized === `${slug}s` ||
                normalized === `${slug}config`
            );
        })?.kind;
    }
}
