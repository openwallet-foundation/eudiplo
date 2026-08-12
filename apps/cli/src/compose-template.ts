import { randomBytes } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readCliBinaryAsset, readCliTextAsset } from "./sea-assets.js";

export const defaultComposeFileName = "eudiplo.compose.yaml";
export const defaultComposeOverrideFileName = "eudiplo.compose.override.yaml";
export const defaultEnvFileName = ".eudiplo.env";
export const demoComposeFileName = "eudiplo.demo.compose.yaml";
export const demoEnvFileName = ".eudiplo.demo.env";
export const demoConfigDirectory = ".eudiplo/demo-config";
const demoConfigManifestAssetKey = "templates/demo-config.manifest.json";

type ComposeMode = "standard" | "demo";

interface ComposeEnvOptions {
    mode: ComposeMode;
    cliVersion: string;
    imageTagOverride?: string;
}

export function createComposeEnv(options: ComposeEnvOptions): string {
    const imageTag = resolveImageTag(options.cliVersion, options.imageTagOverride);
    const envFileName = options.mode === "demo" ? demoEnvFileName : defaultEnvFileName;
    const lines = [
        `EUDIPLO_ENV_FILE=${envFileName}`,
        "PUBLIC_URL=http://localhost:3000",
        `MASTER_SECRET=${randomBytes(32).toString("base64")}`,
        "AUTH_CLIENT_ID=root",
        "AUTH_CLIENT_SECRET=root",
        "",
    ];

    if (options.mode === "demo") {
        lines.splice(
            1,
            0,
            `EUDIPLO_IMAGE=ghcr.io/openwallet-foundation/eudiplo:${imageTag}`,
            `EUDIPLO_CLIENT_IMAGE=ghcr.io/openwallet-foundation/eudiplo-client:${imageTag}`,
            `EUDIPLO_CONFIG_MOUNT=./${demoConfigDirectory}:/app/config`,
            "CONFIG_IMPORT=true",
            "CONFIG_FOLDER=/app/config",
            "EUDIPLO_BIND_ADDRESS=127.0.0.1",
        );
    }

    return lines.join("\n");
}

export function resolveImageTag(cliVersion: string, imageTagOverride?: string): string {
    if (imageTagOverride && imageTagOverride.length > 0) {
        return imageTagOverride;
    }

    if (cliVersion.includes("-main.")) {
        return "main";
    }

    return cliVersion;
}

export async function createComposeFile(): Promise<string> {
    return readCliTextAsset(
        "templates/docker-compose.yml",
        new URL("../templates/docker-compose.yml", import.meta.url),
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

export async function copyBundledDemoConfig(targetDirectory: string, force: boolean): Promise<void> {
    if (force) {
        await rm(targetDirectory, { recursive: true, force: true });
    }

    const manifest = await readDemoConfigManifest();
    if (manifest) {
        await mkdir(targetDirectory, { recursive: true, mode: 0o700 });
        for (const relativePath of manifest) {
            const normalized = normalizeRelativePath(relativePath);
            const destinationPath = join(targetDirectory, normalized);
            await mkdir(dirname(destinationPath), { recursive: true, mode: 0o700 });
            const contents = await readCliBinaryAsset(
                `templates/demo-config/${normalized}`,
                new URL(`../templates/demo-config/${normalized}`, import.meta.url),
            );
            await writeFile(destinationPath, contents, { mode: 0o600 });
        }
        return;
    }

    const fallbackDirectory = new URL("../../../assets/config/demo/", import.meta.url);
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
            new URL("../templates/demo-config.manifest.json", import.meta.url),
        );
        const parsed = JSON.parse(manifestText);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
            return parsed;
        }
    } catch {
        try {
            const localManifest = await readFile(
                new URL("../templates/demo-config.manifest.json", import.meta.url),
                "utf8",
            );
            const parsed = JSON.parse(localManifest);
            if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
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