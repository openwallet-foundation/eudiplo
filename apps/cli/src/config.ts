import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { CliConfig, InstanceConfig } from "./types.js";

const emptyConfig = (): CliConfig => ({ instances: {} });

export function resolveConfigPath(env: NodeJS.ProcessEnv): string {
    if (env.EUDIPLO_CLI_CONFIG) {
        return resolve(env.EUDIPLO_CLI_CONFIG);
    }

    const baseDir = env.EUDIPLO_CLI_HOME
        ? resolve(env.EUDIPLO_CLI_HOME)
        : join(homedir(), ".eudiplo");

    return join(baseDir, "config.json");
}

export async function loadConfig(path: string): Promise<CliConfig> {
    try {
        const contents = await readFile(path, "utf8");
        return validateConfig(JSON.parse(contents));
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
            return emptyConfig();
        }
        throw error;
    }
}

export async function saveConfig(path: string, config: CliConfig): Promise<void> {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, `${JSON.stringify(config, null, 4)}\n`, {
        encoding: "utf8",
        mode: 0o600,
    });
}

function validateConfig(value: unknown): CliConfig {
    if (!isRecord(value)) {
        throw new Error("Config must be a JSON object.");
    }

    if (!isRecord(value.instances)) {
        throw new Error("Config must define an instances object.");
    }

    const instances: Record<string, InstanceConfig> = {};
    for (const [name, instance] of Object.entries(value.instances)) {
        instances[name] = validateInstanceConfig(name, instance);
    }

    return {
        defaultInstance: validateDefaultInstance(value.defaultInstance, instances),
        instances,
    };
}

export function upsertInstance(
    config: CliConfig,
    name: string,
    instance: InstanceConfig,
): CliConfig {
    return {
        defaultInstance: config.defaultInstance ?? name,
        instances: {
            ...config.instances,
            [name]: instance,
        },
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}

function validateDefaultInstance(
    value: unknown,
    instances: Record<string, InstanceConfig>,
): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    if (!Object.hasOwn(instances, value)) {
        throw new Error(`Default instance ${value} is not defined in instances.`);
    }
    return value;
}

function validateInstanceConfig(name: string, value: unknown): InstanceConfig {
    if (!isRecord(value)) {
        throw new Error(`Instance ${name} must be an object.`);
    }
    if (value.target !== "compose" && value.target !== "external") {
        throw new Error(
            `Instance ${name} has unsupported target ${String(value.target)}.`,
        );
    }
    if (typeof value.url !== "string" || value.url.length === 0) {
        throw new Error(`Instance ${name} must define a url.`);
    }

    validateHttpUrl(value.url, `Instance ${name} url`);
    validateOptionalHttpUrl(value.clientUrl, `Instance ${name} clientUrl`);

    return {
        target: value.target,
        url: value.url,
        clientUrl: optionalString(value.clientUrl),
        composeFile: optionalString(value.composeFile),
        composeFiles: optionalStringArray(value.composeFiles),
        envFile: optionalString(value.envFile),
        projectName: optionalString(value.projectName),
    };
}

function optionalString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    if (value.some((item) => typeof item !== "string")) {
        throw new Error("composeFiles must contain only strings.");
    }
    return value;
}

function validateOptionalHttpUrl(value: unknown, label: string): void {
    if (typeof value === "string") {
        validateHttpUrl(value, label);
    }
}

function validateHttpUrl(value: string, label: string): void {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            throw new Error("Unsupported URL protocol.");
        }
    } catch {
        throw new Error(`${label} must be an absolute HTTP(S) URL.`);
    }
}