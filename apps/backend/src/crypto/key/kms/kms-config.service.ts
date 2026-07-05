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
    private readonly globalConfig: KmsConfigDto;
    private readonly tenantConfigCache = new Map<string, KmsConfigDto>();

    constructor(private readonly configService: ConfigService) {
        this.globalConfig = this.loadGlobalConfig();
    }

    getDefaultProviderId(tenantId?: string): string {
        return this.getConfig(tenantId).defaultProvider || DEFAULT_PROVIDER_ID;
    }

    getProviders(tenantId?: string): KmsProviderConfigDto[] {
        return this.getConfig(tenantId).providers;
    }

    getConfig(tenantId?: string): KmsConfigDto {
        if (!tenantId) {
            return this.globalConfig;
        }

        const cached = this.tenantConfigCache.get(tenantId);
        if (cached) {
            return cached;
        }

        const tenantConfig = this.loadTenantConfig(tenantId);
        const merged = tenantConfig
            ? mergeConfigs(this.globalConfig, tenantConfig)
            : this.globalConfig;
        this.tenantConfigCache.set(tenantId, merged);
        return merged;
    }

    invalidateTenantCache(tenantId: string): void {
        this.tenantConfigCache.delete(tenantId);
    }

    invalidateAllCaches(): void {
        this.tenantConfigCache.clear();
    }

    private loadGlobalConfig(): KmsConfigDto {
        const globalPath = this.resolveConfigPath();
        if (!globalPath) {
            return defaultConfig();
        }

        try {
            const raw = readFileSync(globalPath, "utf8");
            const parsed = JSON.parse(raw) as KmsConfigDto;
            return resolveEnvPlaceholders(parsed) as KmsConfigDto;
        } catch (err) {
            this.logger.warn(
                `Failed to read kms.json, using default config: ${String(err)}`,
            );
            return defaultConfig();
        }
    }

    private loadTenantConfig(tenantId: string): KmsConfigDto | null {
        const tenantPath = this.resolveConfigPath(tenantId);
        if (!tenantPath) {
            return null;
        }

        try {
            const raw = readFileSync(tenantPath, "utf8");
            const parsed = JSON.parse(raw) as KmsConfigDto;
            return resolveEnvPlaceholders(parsed) as KmsConfigDto;
        } catch (err) {
            this.logger.warn(
                `Failed to read tenant kms.json for '${tenantId}', using global config: ${String(err)}`,
            );
            return null;
        }
    }

    private resolveConfigPath(tenantId?: string): string | null {
        const configFolder = this.configService.get<string>("CONFIG_FOLDER");
        if (!configFolder) {
            return null;
        }

        const path = tenantId
            ? join(configFolder, tenantId, "kms.json")
            : join(configFolder, "kms.json");

        return existsSync(path) ? path : null;
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

function mergeConfigs(global: KmsConfigDto, tenant: KmsConfigDto): KmsConfigDto {
    const mergedProviders = new Map<string, KmsProviderConfigDto>();

    for (const provider of global.providers ?? []) {
        mergedProviders.set(provider.id, provider);
    }

    for (const provider of tenant.providers ?? []) {
        mergedProviders.set(provider.id, provider);
    }

    return {
        defaultProvider: tenant.defaultProvider || global.defaultProvider,
        providers: [...mergedProviders.values()],
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
