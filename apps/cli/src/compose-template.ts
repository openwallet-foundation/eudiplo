import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

export const defaultComposeFileName = "eudiplo.compose.yaml";
export const defaultEnvFileName = ".eudiplo.env";

export function createDemoEnv(): string {
    return [
      "EUDIPLO_ENV_FILE=.eudiplo.env",
      "EUDIPLO_IMAGE=ghcr.io/openwallet-foundation/eudiplo-demo:main",
      "PUBLIC_URL=http://localhost:3000",
        `MASTER_SECRET=${randomBytes(32).toString("base64")}`,
        "AUTH_CLIENT_ID=root",
        "AUTH_CLIENT_SECRET=root",
        "",
    ].join("\n");
}

export async function createComposeFile(): Promise<string> {
    return readFile(new URL("../templates/docker-compose.yml", import.meta.url), "utf8");
}