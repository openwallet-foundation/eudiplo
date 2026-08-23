import { randomBytes } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readCliBinaryAsset, readCliTextAsset } from "../sea-assets.js";

export const defaultComposeFileName = "eudiplo.compose.yaml";
export const defaultComposeOverrideFileName = "eudiplo.compose.override.yaml";
export const defaultEnvFileName = ".eudiplo.env";
export const demoComposeFileName = "eudiplo.demo.compose.yaml";
export const demoEnvFileName = ".eudiplo.demo.env";
export const configDirectoryName = "config";
const demoTenantId = "demo";
export const demoConfigDirectory = `${configDirectoryName}/${demoTenantId}`;
const demoConfigManifestAssetKey = "templates/demo-config.manifest.json";

type ComposeMode = "standard" | "demo";
export type ComposeDatabase = "sqlite" | "postgres";
export type ComposeStorage = "local" | "s3";
export type ComposeKms = "db" | "vault";

interface ComposeEnvOptions {
    mode: ComposeMode;
    imageTagOverride?: string;
    database?: ComposeDatabase;
    storage?: ComposeStorage;
    kms?: ComposeKms;
    publicUrl?: string;
    authClientId?: string;
    authClientSecret?: string;
}

export function createComposeEnv(options: ComposeEnvOptions): string {
    const imageTag = resolveImageTag(options.imageTagOverride);
    const envFileName =
        options.mode === "demo" ? demoEnvFileName : defaultEnvFileName;
    const database =
        options.mode === "demo" ? "sqlite" : (options.database ?? "sqlite");
    const storage =
        options.mode === "demo" ? "local" : (options.storage ?? "local");
    const kms = options.mode === "demo" ? "db" : (options.kms ?? "db");
    const publicUrl = options.publicUrl ?? "http://localhost:3000";
    const authClientId = options.authClientId ?? "root";
    const authClientSecret = options.authClientSecret ?? "root";
    const lines = [
        `EUDIPLO_ENV_FILE=${envFileName}`,
        `EUDIPLO_IMAGE=ghcr.io/openwallet-foundation/eudiplo:${imageTag}`,
        `EUDIPLO_CLIENT_IMAGE=ghcr.io/openwallet-foundation/eudiplo-client:${imageTag}`,
        ...(options.mode === "demo" ? ["EUDIPLO_BIND_ADDRESS=127.0.0.1"] : []),
        `EUDIPLO_CONFIG_MOUNT=./${configDirectoryName}:/app/config`,
        "CONFIG_FOLDER=/app/config",
        "CONFIG_IMPORT_MODE=create",
        `PUBLIC_URL=${escapeEnvValue(publicUrl)}`,
        `MASTER_SECRET=${randomBytes(32).toString("base64")}`,
        `AUTH_CLIENT_ID=${escapeEnvValue(authClientId)}`,
        `AUTH_CLIENT_SECRET=${escapeEnvValue(authClientSecret)}`,
    ];

    lines.push(
        "",
        ...databaseEnv(database),
        "",
        ...storageEnv(storage),
        "",
        ...kmsEnv(kms),
    );

    return `${lines.join("\n")}\n`;
}

export function createGlobalKmsConfig(kms: ComposeKms): string {
    const providers: Array<Record<string, string>> = [
        {
            id: "db",
            type: "db",
            description: "Database-backed key provider",
        },
    ];

    if (kms === "vault") {
        providers.push({
            id: "vault",
            type: "vault",
            description: "Local HashiCorp Vault",
            vaultUrl: "${VAULT_ADDR}",
            vaultToken: "${VAULT_TOKEN}",
        });
    }

    return `${JSON.stringify(
        {
            defaultProvider: kms,
            providers,
        },
        null,
        4,
    )}\n`;
}

function databaseEnv(database: ComposeDatabase): string[] {
    if (database === "sqlite") {
        return ["DB_TYPE=sqlite"];
    }

    return [
        "DB_TYPE=postgres",
        "DB_HOST=postgres",
        "DB_PORT=5432",
        "DB_USERNAME=eudiplo",
        `DB_PASSWORD=${randomSecret()}`,
        "DB_DATABASE=eudiplo",
    ];
}

function storageEnv(storage: ComposeStorage): string[] {
    if (storage === "local") {
        return ["STORAGE_DRIVER=local", "LOCAL_STORAGE_DIR=/app/uploads"];
    }

    const minioPassword = randomSecret();
    return [
        "STORAGE_DRIVER=s3",
        "S3_ENDPOINT=http://minio:9000",
        "S3_REGION=us-east-1",
        "S3_ACCESS_KEY_ID=minioadmin",
        `S3_SECRET_ACCESS_KEY=${minioPassword}`,
        "S3_BUCKET=uploads",
        "S3_FORCE_PATH_STYLE=true",
        "MINIO_ROOT_USER=minioadmin",
        `MINIO_ROOT_PASSWORD=${minioPassword}`,
    ];
}

function kmsEnv(kms: ComposeKms): string[] {
    if (kms === "db") {
        return ["KM_TYPE=db"];
    }

    return [
        "KM_TYPE=vault",
        "VAULT_ADDR=http://vault:8200",
        "VAULT_TOKEN=root",
    ];
}

function randomSecret(): string {
    return randomBytes(24).toString("base64url");
}

function escapeEnvValue(value: string): string {
    if (!/[\s#$'"\\]/.test(value)) {
        return value;
    }
    return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

export function resolveImageTag(imageTagOverride?: string): string {
    if (imageTagOverride && imageTagOverride.length > 0) {
        return imageTagOverride;
    }

    return "latest";
}

export async function createComposeFile(): Promise<string> {
    return readCliTextAsset(
        "templates/docker-compose.yml",
        new URL("../../templates/docker-compose.yml", import.meta.url),
    );
}

export function createNoClientComposeOverride(): string {
    return [
        "services:",
        "  eudiplo-client:",
        '    profiles: ["disabled"]',
        "",
    ].join("\n");
}

export async function copyBundledDemoConfig(
    targetDirectory: string,
    force: boolean,
): Promise<void> {
    if (force) {
        await rm(targetDirectory, { recursive: true, force: true });
    }

    const manifest = await readDemoConfigManifest();
    if (manifest) {
        await mkdir(targetDirectory, { recursive: true, mode: 0o700 });
        for (const relativePath of manifest) {
            const normalized = normalizeRelativePath(relativePath);
            const destinationPath = join(targetDirectory, normalized);
            await mkdir(dirname(destinationPath), {
                recursive: true,
                mode: 0o700,
            });
            const contents = await readCliBinaryAsset(
                `templates/demo-config/${normalized}`,
                new URL(
                    `../../templates/demo-config/${normalized}`,
                    import.meta.url,
                ),
            );
            await writeFile(destinationPath, contents, { mode: 0o600 });
        }
        return;
    }

    const fallbackDirectory = new URL(
        "../../../../assets/config/demo/",
        import.meta.url,
    );
    await cp(fallbackDirectory, targetDirectory, {
        recursive: true,
        force,
        errorOnExist: !force,
    });
}

export async function hasFiles(directory: string): Promise<boolean> {
    try {
        const entries = await readdir(directory);
        return entries.length > 0;
    } catch {
        return false;
    }
}

async function readDemoConfigManifest(): Promise<string[] | undefined> {
    try {
        const manifestText = await readCliTextAsset(
            demoConfigManifestAssetKey,
            new URL(
                "../../templates/demo-config.manifest.json",
                import.meta.url,
            ),
        );
        const parsed = JSON.parse(manifestText);
        if (
            Array.isArray(parsed) &&
            parsed.every((item) => typeof item === "string")
        ) {
            return parsed;
        }
    } catch {
        try {
            const localManifest = await readFile(
                new URL(
                    "../../templates/demo-config.manifest.json",
                    import.meta.url,
                ),
                "utf8",
            );
            const parsed = JSON.parse(localManifest);
            if (
                Array.isArray(parsed) &&
                parsed.every((item) => typeof item === "string")
            ) {
                return parsed;
            }
        } catch {
            return undefined;
        }
    }

    return undefined;
}

function normalizeRelativePath(pathValue: string): string {
    return pathValue.replaceAll("\\", "/").replace(/^\/+/, "");
}
