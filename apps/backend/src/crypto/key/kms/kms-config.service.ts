import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { KmsConfigDto, KmsProviderConfigDto } from "../dto/kms-config.dto";

const DEFAULT_PROVIDER_ID = "db";

/**
 * Loads, validates and exposes the parsed `kms.json` configuration.
 *
 * Centralises file-system access and `${ENV_VAR}` placeholder resolution
 * so the rest of the KMS code only ever sees a typed, resolved view.
 * The file is read once at construction time; subsequent calls are
 * pure reads.
 */
@Injectable()
export class KmsConfigService {
    private readonly logger = new Logger(KmsConfigService.name);
    private readonly config: KmsConfigDto;

    constructor(private readonly configService: ConfigService) {
        this.config = this.loadConfig();
    }

    getDefaultProviderId(): string {
        return this.config.defaultProvider || DEFAULT_PROVIDER_ID;
    }

    getProviders(): KmsProviderConfigDto[] {
        return this.config.providers;
    }

    getConfig(): KmsConfigDto {
        return this.config;
    }

    private loadConfig(): KmsConfigDto {
        const configFolder = this.configService.get<string>("CONFIG_FOLDER");
        const path = configFolder ? join(configFolder, "kms.json") : null;
        if (!path || !existsSync(path)) {
            return defaultConfig();
        }
        try {
            const raw = readFileSync(path, "utf8");
            const parsed = JSON.parse(raw) as KmsConfigDto;
            return resolveEnvPlaceholders(parsed) as KmsConfigDto;
        } catch (err) {
            this.logger.warn(
                `Failed to read kms.json, using default config: ${String(err)}`,
            );
            return defaultConfig();
        }
    }
}

function defaultConfig(): KmsConfigDto {
    return {
        defaultProvider: DEFAULT_PROVIDER_ID,
        providers: [
            {
                id: DEFAULT_PROVIDER_ID,
                type: "db",
                description: "Default database provider",
            },
        ],
    };
}

function resolveEnvPlaceholders<T>(value: T): T {
    if (typeof value === "string") {
        return value.replace(
            /\$\{([A-Z0-9_]+)\}/g,
            (_, name: string) => process.env[name] ?? "",
        ) as unknown as T;
    }
    if (Array.isArray(value)) {
        return value.map((v) => resolveEnvPlaceholders(v)) as unknown as T;
    }
    if (value && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = resolveEnvPlaceholders(v);
        }
        return out as T;
    }
    return value;
}
