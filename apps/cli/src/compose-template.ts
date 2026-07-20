import { randomBytes } from "node:crypto";
import { readCliTextAsset } from "./sea-assets.js";

export const defaultComposeFileName = "eudiplo.compose.yaml";
export const defaultComposeOverrideFileName = "eudiplo.compose.override.yaml";
export const defaultEnvFileName = ".eudiplo.env";

export function createComposeEnv(useDemoImage: boolean): string {
    const lines = [
        "EUDIPLO_ENV_FILE=.eudiplo.env",
        "PUBLIC_URL=http://localhost:3000",
        `MASTER_SECRET=${randomBytes(32).toString("base64")}`,
        "AUTH_CLIENT_ID=root",
        "AUTH_CLIENT_SECRET=root",
        "",
    ];

    if (useDemoImage) {
        lines.splice(1, 0, "EUDIPLO_IMAGE=ghcr.io/openwallet-foundation/eudiplo-demo:main");
    }

    return lines.join("\n");
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