import { BadRequestException, Injectable } from "@nestjs/common";
import { CONFIG_RESOURCE_KINDS } from "./config-resource.types";
import type {
    ConfigDocument,
    ConfigMigrationIssue,
    ConfigMigrationResult,
    ConfigResourceKind,
} from "./config-resource.types";
import { ConfigResourceRegistry } from "./config-resource.registry";

type Spec = Record<string, any>;

interface ConfigMigration {
    id: string;
    kind: ConfigResourceKind;
    from: number;
    to: number;
    migrate(spec: Spec): { spec: Spec; issues?: ConfigMigrationIssue[] };
}

const migrateTrustListRefs = (
    spec: Spec,
    kind: ConfigResourceKind,
    resourceId: string,
): ConfigMigrationIssue[] => {
    const issues: ConfigMigrationIssue[] = [];
    const refs = spec.walletProviderTrustLists;
    if (Array.isArray(refs)) {
        spec.walletProviderTrustLists = refs.map(
            (entry: unknown, index: number) => {
                if (typeof entry !== "string") return entry;
                issues.push({
                    severity: "required-input",
                    code: "TRUST_LIST_VERIFIER_REQUIRED",
                    path: `/spec/walletProviderTrustLists/${index}`,
                    message:
                        "Provide verifierKey or verifierX509Der before import.",
                    resource: { kind, id: resourceId },
                });
                return { url: entry };
            },
        );
    }
    return issues;
};

const MIGRATIONS: ConfigMigration[] = [
    {
        id: "IssuanceConfig/1-to-2",
        kind: "IssuanceConfig",
        from: 1,
        to: 2,
        migrate(spec) {
            const clone = structuredClone(spec);
            return {
                spec: clone,
                issues: migrateTrustListRefs(
                    clone,
                    "IssuanceConfig",
                    "issuance",
                ),
            };
        },
    },
    {
        id: "PresentationConfig/1-to-2",
        kind: "PresentationConfig",
        from: 1,
        to: 2,
        migrate(spec) {
            const clone = structuredClone(spec);
            const issues: ConfigMigrationIssue[] = [];
            if (clone.webhook !== undefined) {
                issues.push({
                    severity: "required-input",
                    code: "WEBHOOK_ENDPOINT_REFERENCE_REQUIRED",
                    path: "/spec/webhook",
                    message:
                        "Create or select a webhook endpoint, set webhookEndpointId, and remove webhook.",
                    resource: {
                        kind: "PresentationConfig",
                        id: String(clone.id ?? "unknown"),
                    },
                });
            }

            const credentials = clone.dcql_query?.credentials;
            if (Array.isArray(credentials)) {
                for (
                    let credentialIndex = 0;
                    credentialIndex < credentials.length;
                    credentialIndex++
                ) {
                    const authorities =
                        credentials[credentialIndex]?.trusted_authorities;
                    if (!Array.isArray(authorities)) continue;
                    for (
                        let authorityIndex = 0;
                        authorityIndex < authorities.length;
                        authorityIndex++
                    ) {
                        const authority = authorities[authorityIndex];
                        if (
                            authority?.type !== "etsi_tl" ||
                            !Array.isArray(authority.values)
                        ) {
                            continue;
                        }
                        authority.values = authority.values.map(
                            (entry: unknown, valueIndex: number) => {
                                if (typeof entry !== "string") return entry;
                                issues.push({
                                    severity: "required-input",
                                    code: "TRUST_LIST_VERIFIER_REQUIRED",
                                    path: `/spec/dcql_query/credentials/${credentialIndex}/trusted_authorities/${authorityIndex}/values/${valueIndex}`,
                                    message:
                                        "Provide verifierKey, verifierX509Der, or replace the URL with trustListId before import.",
                                    resource: {
                                        kind: "PresentationConfig",
                                        id: String(clone.id ?? "unknown"),
                                    },
                                });
                                return { url: entry };
                            },
                        );
                    }
                }
            }
            return { spec: clone, issues };
        },
    },
    {
        id: "KeyChain/1-to-2",
        kind: "KeyChain",
        from: 1,
        to: 2,
        migrate(spec) {
            const clone = structuredClone(spec);
            const key = clone.key;
            delete clone.key;
            clone.keySource = { type: "private-jwk", jwk: key };
            return { spec: clone };
        },
    },
];

@Injectable()
export class ConfigMigrationService {
    constructor(private readonly registry: ConfigResourceRegistry) {}

    isDocument(input: unknown): input is ConfigDocument {
        if (!input || typeof input !== "object") return false;
        const candidate = input as Record<string, unknown>;
        return (
            typeof candidate.apiVersion === "string" &&
            typeof candidate.kind === "string" &&
            CONFIG_RESOURCE_KINDS.includes(
                candidate.kind as ConfigResourceKind,
            ) &&
            !!candidate.metadata &&
            typeof candidate.metadata === "object" &&
            !!candidate.spec &&
            typeof candidate.spec === "object"
        );
    }

    detectLegacyVersion(kind: ConfigResourceKind, spec: Spec): number {
        if (kind === "PresentationConfig") {
            if (spec.webhook !== undefined) return 1;
            const credentials = spec.dcql_query?.credentials;
            if (
                Array.isArray(credentials) &&
                credentials.some((credential: any) =>
                    credential?.trusted_authorities?.some(
                        (authority: any) =>
                            authority?.type === "etsi_tl" &&
                            authority.values?.some(
                                (value: unknown) => typeof value === "string",
                            ),
                    ),
                )
            ) {
                return 1;
            }
            return 2;
        }
        if (kind === "IssuanceConfig") {
            return spec.walletProviderTrustLists?.some?.(
                (entry: unknown) => typeof entry === "string",
            )
                ? 1
                : 2;
        }
        if (kind === "KeyChain") return spec.keySource ? 2 : 1;
        return 1;
    }

    wrapLegacy(
        kind: ConfigResourceKind,
        spec: Spec,
        id?: string,
    ): ConfigDocument {
        const definition = this.registry.get(kind);
        const version = this.detectLegacyVersion(kind, spec);
        const resourceId =
            id ??
            String(
                spec.id ?? spec.clientId ?? definition.singletonId ?? "unknown",
            );
        return {
            apiVersion: this.registry.apiVersion(kind, version),
            kind,
            metadata: { id: resourceId, generation: 1 },
            spec,
        };
    }

    upgrade(input: ConfigDocument): ConfigMigrationResult {
        const definition = this.registry.get(input.kind);
        let version: number;
        try {
            version = this.registry.parseApiVersion(
                input.kind,
                input.apiVersion,
            );
        } catch (error) {
            throw new BadRequestException(String(error));
        }
        if (version > definition.currentVersion) {
            throw new BadRequestException(
                `${input.kind} version ${version} is newer than supported version ${definition.currentVersion}`,
            );
        }

        let document = structuredClone(input);
        const issues: ConfigMigrationIssue[] = [];
        const applied: string[] = [];
        while (version < definition.currentVersion) {
            const migration = MIGRATIONS.find(
                (candidate) =>
                    candidate.kind === input.kind && candidate.from === version,
            );
            if (!migration || migration.to !== version + 1) {
                throw new BadRequestException(
                    `No migration registered for ${input.kind} v${version} to v${version + 1}`,
                );
            }
            const result = migration.migrate(document.spec as Spec);
            document.spec = result.spec;
            issues.push(...(result.issues ?? []));
            applied.push(migration.id);
            version = migration.to;
            document.apiVersion = this.registry.apiVersion(input.kind, version);
        }

        return { document, issues, migrations: applied };
    }

    unwrapForLegacyImporter(document: ConfigDocument): Record<string, unknown> {
        const spec = structuredClone(document.spec) as Spec;
        if (
            document.kind === "KeyChain" &&
            spec.keySource?.type === "private-jwk"
        ) {
            spec.key = spec.keySource.jwk;
            delete spec.keySource;
        }
        if (
            spec.id === undefined &&
            document.kind !== "Client" &&
            !this.registry.get(document.kind).singletonId
        ) {
            spec.id = document.metadata.id;
        }
        return spec;
    }
}
