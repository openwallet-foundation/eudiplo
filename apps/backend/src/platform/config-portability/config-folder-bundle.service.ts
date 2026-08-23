import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigImportService } from "../config-import/config-import.service";
import { ConfigImportOrchestratorService } from "../config-import/config-import-orchestrator.service";
import { ConfigBundleApplyService } from "./config-bundle-apply.service";
import { ConfigMigrationService } from "./config-migration.service";
import { ConfigResourceRegistry } from "./config-resource.registry";
import type {
    ConfigBundle,
    ConfigBundleAsset,
    ConfigDocument,
    ConfigImportMode,
    ConfigMigrationIssue,
    ConfigResourceKind,
} from "./config-resource.types";

type FolderResource =
    | { kind: ConfigResourceKind; file: string }
    | { kind: ConfigResourceKind; directory: string };

const FOLDER_RESOURCES: FolderResource[] = [
    { kind: "KmsConfig", file: "kms.json" },
    { kind: "Client", directory: "clients" },
    { kind: "KeyChain", directory: "key-chains" },
    { kind: "RegistrarConfig", file: "registrar.json" },
    { kind: "AttributeProvider", directory: "attribute-providers" },
    { kind: "WebhookEndpoint", directory: "webhook-endpoints" },
    { kind: "IssuanceConfig", file: "issuance/issuance.json" },
    { kind: "CredentialConfig", directory: "issuance/credentials" },
    { kind: "TrustList", directory: "trust-lists" },
    { kind: "PresentationConfig", directory: "presentation" },
    { kind: "StatusList", directory: "issuance/status-lists" },
];

const MIME_TYPES: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
};

@Injectable()
export class ConfigFolderBundleService {
    private readonly logger = new Logger(ConfigFolderBundleService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly configImportService: ConfigImportService,
        private readonly migrationService: ConfigMigrationService,
        private readonly resourceRegistry: ConfigResourceRegistry,
        private readonly applyService: ConfigBundleApplyService,
        orchestrator: ConfigImportOrchestratorService,
    ) {
        orchestrator.registerPortableRunner(
            "versioned folder plan/apply",
            (tenantId, mode) => this.applyTenantFolder(tenantId, mode),
        );
    }

    async applyTenantFolder(
        tenantId: string,
        mode: ConfigImportMode,
    ): Promise<void> {
        const configRoot = resolve(
            this.configService.getOrThrow<string>("CONFIG_FOLDER"),
        );
        const tenantRoot = join(configRoot, tenantId);
        const bundle = this.buildBundle(tenantId, tenantRoot);
        const source = `folder:${tenantRoot}`;
        const plan = await this.applyService.apply(
            tenantId,
            bundle,
            mode,
            source,
        );
        const counts = plan.items.reduce<Record<string, number>>(
            (result, item) => {
                result[item.action] = (result[item.action] ?? 0) + 1;
                return result;
            },
            {},
        );
        this.logger.log(
            `[${tenantId}] Startup config ${mode} completed: ${
                Object.entries(counts)
                    .map(([action, count]) => `${count} ${action}`)
                    .join(", ") || "no resources"
            }`,
        );
    }

    buildBundle(tenantId: string, tenantRoot: string): ConfigBundle {
        const documents: ConfigDocument[] = [];
        const warnings: ConfigMigrationIssue[] = [];

        for (const resource of FOLDER_RESOURCES) {
            for (const filePath of this.resourceFiles(tenantRoot, resource)) {
                const rawPayload = JSON.parse(
                    readFileSync(filePath, "utf8"),
                ) as Record<string, unknown>;
                const payload =
                    this.configImportService.replacePlaceholders(rawPayload);
                const fileId = filePath
                    .split(/[\\/]/)
                    .pop()!
                    .replace(/\.json$/i, "");
                const singletonId = this.resourceRegistry.get(
                    resource.kind,
                ).singletonId;
                const id = String(
                    (payload.metadata as Record<string, unknown> | undefined)
                        ?.id ??
                        singletonId ??
                        payload.id ??
                        payload.clientId ??
                        fileId,
                );
                const input = this.migrationService.isDocument(payload)
                    ? payload
                    : this.migrationService.wrapLegacy(
                          resource.kind,
                          payload,
                          id,
                      );
                const result = this.migrationService.upgrade(input);
                if (result.document.kind !== resource.kind) {
                    throw new Error(
                        `${filePath} contains ${result.document.kind}, expected ${resource.kind}`,
                    );
                }
                const blocking = result.issues.filter(
                    (issue) => issue.severity !== "warning",
                );
                if (blocking.length > 0) {
                    throw new Error(
                        `${filePath} requires input: ${blocking
                            .map((issue) => `${issue.path}: ${issue.message}`)
                            .join("; ")}`,
                    );
                }
                documents.push(result.document);
                warnings.push(...result.issues);
            }
        }

        const assets = this.loadAssets(tenantRoot);
        const resources = documents.map((document) => ({
            kind: document.kind,
            id: document.metadata.id,
            apiVersion: document.apiVersion,
            path: this.documentPath(tenantRoot, document),
            sha256: sha256(JSON.stringify(document)),
            ownership: "file-managed" as const,
            generation: document.metadata.generation ?? 1,
        }));
        return {
            manifest: {
                format: "eudiplo.config-bundle",
                formatVersion: 1,
                sourceVersion: "startup-folder",
                exportedAt: new Date(0).toISOString(),
                tenant: tenantId,
                resources,
                assets: assets.map(({ path, contentType, sha256: hash }) => ({
                    path,
                    contentType,
                    sha256: hash,
                })),
                requirements: [],
                warnings,
            },
            documents,
            assets,
        };
    }

    private resourceFiles(
        tenantRoot: string,
        resource: FolderResource,
    ): string[] {
        if ("file" in resource) {
            const path = join(tenantRoot, resource.file);
            return existsSync(path) ? [path] : [];
        }
        const directory = join(tenantRoot, resource.directory);
        if (!existsSync(directory)) {
            return [];
        }
        return readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
            .map((entry) => join(directory, entry.name))
            .sort();
    }

    private loadAssets(tenantRoot: string): ConfigBundleAsset[] {
        const directory = join(tenantRoot, "images");
        if (!existsSync(directory)) {
            return [];
        }
        return readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name !== ".gitkeep")
            .map((entry) => {
                const data = readFileSync(join(directory, entry.name));
                return {
                    path: `images/${entry.name}`,
                    contentType:
                        MIME_TYPES[extname(entry.name).toLowerCase()] ??
                        "application/octet-stream",
                    sha256: sha256(data),
                    data: data.toString("base64"),
                };
            })
            .sort((left, right) => left.path.localeCompare(right.path));
    }

    private documentPath(tenantRoot: string, document: ConfigDocument): string {
        const definition = FOLDER_RESOURCES.find(
            (candidate) => candidate.kind === document.kind,
        )!;
        if ("file" in definition) {
            return definition.file;
        }
        return `${definition.directory}/${document.metadata.id}.json`;
    }
}

function sha256(value: string | Buffer): string {
    return createHash("sha256").update(value).digest("hex");
}
