import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ImportOptions, TenantImportOptions } from "./import-options";

function resolveValidationSchema(schemaOrDto: unknown): any | undefined {
    if (!schemaOrDto) {
        return undefined;
    }

    const candidate = schemaOrDto as any;
    if (typeof candidate.safeParse === "function") {
        return candidate;
    }

    if (typeof candidate.schema?.safeParse === "function") {
        return candidate.schema;
    }

    return undefined;
}

@Injectable()
export class ConfigImportService {
    private readonly logger = new Logger(ConfigImportService.name);

    constructor(private readonly configService: ConfigService) {}

    /**
     * Import configs for a specific tenant.
     * This is the preferred method when using the orchestrator's tenant-by-tenant approach.
     */
    async importConfigsForTenant<T extends object>(
        tenantId: string,
        options: TenantImportOptions<T>,
    ): Promise<void> {
        const configPath = this.configService.getOrThrow("CONFIG_FOLDER");
        const force = this.configService.get<boolean>("CONFIG_IMPORT_FORCE");
        const strictConfig = this.configService.get<any>(
            "CONFIG_VARIABLE_STRICT",
        );

        let counter = 0;
        const path = join(configPath, tenantId, options.subfolder);

        if (!existsSync(path)) {
            return;
        }

        const files = readdirSync(path);

        for (const file of files) {
            // Filter by extension if provided
            if (
                options.fileExtension &&
                !file.endsWith(options.fileExtension)
            ) {
                continue;
            }

            try {
                const filePath = join(path, file);

                // Load data using custom loader or default JSON loader
                let data: T;
                if (options.loadData) {
                    data = await Promise.resolve(options.loadData(filePath));
                } else {
                    const payload = JSON.parse(readFileSync(filePath, "utf8"));
                    data = payload as T;
                }

                // Replace placeholders like ${ENV_VAR} or ${ENV_VAR:default}
                data = this.replacePlaceholders(data);

                // Validate if validation schema is provided
                const schemaOrDto = options.validationSchema ?? options.validationClass;
                if (schemaOrDto) {
                    const validationResult = await this.validateConfig(
                        file,
                        data,
                        schemaOrDto,
                        { name: tenantId },
                        options.resourceType,
                        options.formatValidationError,
                    );

                    if (!validationResult.isValid) {
                        continue; // Skip invalid config
                    }

                    data = validationResult.data as T;
                }

                // Check if exists
                const exists = await options
                    .checkExists(tenantId, data, file)
                    .catch(() => false);

                if (exists && !force) {
                    this.logger.debug(
                        `[${tenantId}] ${options.resourceType} ${file} already exists, skipping`,
                    );
                    continue;
                }

                // Delete existing if force is enabled
                if (exists && force && options.deleteExisting) {
                    await options.deleteExisting(tenantId, data, file);
                }

                // Process and store item
                await options.processItem(tenantId, data, file);
                counter++;
            } catch (error: any) {
                this.logger.error(
                    `[${tenantId}] Failed to import ${options.resourceType} ${file}: ${error.message}`,
                );
                if (strictConfig === "abort") {
                    // Abort the entire import process in strict abort mode
                    throw error;
                }
            }
        }

        if (counter > 0) {
            this.logger.log(
                `[${tenantId}] ${counter} ${options.resourceType}(s) imported`,
            );
        }
    }

    /**
     * Generic import method that handles the common pattern across all services.
     * @deprecated Use importConfigsForTenant with the orchestrator's tenant-by-tenant approach instead.
     */
    async importConfigs<T extends object>(
        options: ImportOptions<T>,
    ): Promise<void> {
        if (!this.configService.get<boolean>("CONFIG_IMPORT")) {
            return;
        }

        const configPath = this.configService.getOrThrow("CONFIG_FOLDER");
        const force = this.configService.get<boolean>("CONFIG_IMPORT_FORCE");

        const tenantFolders = readdirSync(configPath, {
            withFileTypes: true,
        }).filter((tenant) => tenant.isDirectory());

        const strictConfig = this.configService.get<any>(
            "CONFIG_VARIABLE_STRICT",
        );

        for (const tenant of tenantFolders) {
            let counter = 0;
            const path = join(configPath, tenant.name, options.subfolder);

            if (!existsSync(path)) {
                continue;
            }

            const files = readdirSync(path);

            for (const file of files) {
                // Filter by extension if provided
                if (
                    options.fileExtension &&
                    !file.endsWith(options.fileExtension)
                ) {
                    continue;
                }

                try {
                    const filePath = join(path, file);

                    // Load data using custom loader or default JSON loader
                    let data: T;
                    if (options.loadData) {
                        data = await Promise.resolve(
                            options.loadData(filePath),
                        );
                    } else {
                        const payload = JSON.parse(
                            readFileSync(filePath, "utf8"),
                        );
                        data = payload as T;
                    }

                    // Replace placeholders like ${ENV_VAR} or ${ENV_VAR:default}
                    data = this.replacePlaceholders(data);

                    // Validate if validation class is provided
                    const schemaOrDto =
                        options.validationSchema ?? options.validationClass;
                    if (schemaOrDto) {
                        const validationResult = await this.validateConfig(
                            file,
                            data,
                            schemaOrDto,
                            tenant,
                            options.resourceType,
                            options.formatValidationError,
                        );

                        if (!validationResult.isValid) {
                            continue; // Skip invalid config
                        }

                        data = validationResult.data as T;
                    }

                    // Check if exists
                    const exists = await options
                        .checkExists(tenant.name, data, file)
                        .catch(() => false);

                    if (exists && !force) {
                        this.logger.debug(
                            `[${tenant.name}] ${options.resourceType} ${file} already exists, skipping`,
                        );
                        continue;
                    }

                    // Delete existing if force is enabled
                    if (exists && force && options.deleteExisting) {
                        await options.deleteExisting(tenant.name, data, file);
                    }

                    // Process and store item
                    await options.processItem(tenant.name, data, file);
                    counter++;
                } catch (error: any) {
                    this.logger.error(
                        `[${tenant.name}] Failed to import ${options.resourceType} ${file}: ${error.message}`,
                    );
                    if (strictConfig === "abort") {
                        // Abort the entire import process in strict abort mode
                        throw error;
                    }
                }
            }

            if (counter > 0) {
                this.logger.log(
                    `[${tenant.name}] ${counter} ${options.resourceType}(s) imported`,
                );
            }
        }
    }

    /**
     * Recursively replace placeholders of the form ${VAR} or ${VAR:default} in all string properties.
     * ${VAR} -> replaced with process.env.VAR if defined; if undefined and no default given, logs a warning and leaves placeholder intact.
     * ${VAR:default} -> replaced with env value if defined, otherwise with "default".
     */
    private replacePlaceholders<T>(input: T): T {
        const seen = new WeakSet();
        const isObject = (val: any) =>
            val && typeof val === "object" && !Array.isArray(val);
        const strictConfigInner = this.configService.get<any>(
            "CONFIG_VARIABLE_STRICT",
        );
        const strictMode =
            strictConfigInner === true
                ? "skip"
                : strictConfigInner === false || strictConfigInner === undefined
                  ? "ignore"
                  : (strictConfigInner as string);

        const processString = (str: string): string => {
            const pattern = /\$\{([A-Z0-9_]+)(?::([^}]*))?\}/g;
            return str.replaceAll(
                pattern,
                (fullMatch, varName: string, defVal: string) => {
                    const envVal = process.env[varName];
                    if (envVal !== undefined && envVal !== "") {
                        return envVal;
                    }
                    if (defVal !== undefined) {
                        return defVal;
                    }
                    if (
                        strictMode === "abort" ||
                        strictMode === "skip" ||
                        strictMode === "true"
                    ) {
                        // abort -> will bubble up and stop the whole process via outer catch
                        // skip/true -> outer catch will log and continue with next file
                        throw new Error(
                            `Missing required environment variable ${varName} for placeholder ${fullMatch}`,
                        );
                    }
                    // ignore/false/undefined: keep placeholder and warn
                    this.logger.warn(
                        `Environment variable ${varName} not set and no default provided (placeholder kept)`,
                    );
                    return fullMatch; // keep original placeholder
                },
            );
        };

        const recurse = (val: any): any => {
            if (typeof val === "string") return processString(val);
            if (Array.isArray(val)) return val.map(recurse);
            if (Buffer.isBuffer(val)) return val; // skip binary
            if (isObject(val)) {
                if (seen.has(val)) return val; // avoid circular refs
                seen.add(val);
                for (const key of Object.keys(val)) {
                    val[key] = recurse(val[key]);
                }
                return val;
            }
            return val;
        };

        return recurse(input);
    }

    /**
     * Validate configuration against a Zod schema or parse-capable DTO.
     */
    async validateConfig<T extends object>(
        file: string,
        payload: any,
        schemaOrDto: any,
        tenant: { name: string },
        resourceType: string,
        formatError?: (error: unknown) => any,
    ): Promise<{ isValid: boolean; data: T }> {
        const schema = resolveValidationSchema(schemaOrDto);
        if (!schema) {
            throw new Error(
                `Validation requested for ${resourceType} ${file} but no Zod schema was provided`,
            );
        }

        const parsed = schema.safeParse(payload) as
            | { success: true; data: T }
            | { success: false; error: any };

        if (!parsed.success) {
            const formatter =
                formatError ||
                ((error: unknown) => {
                    if (
                        error &&
                        typeof error === "object" &&
                        "path" in error &&
                        "message" in error
                    ) {
                        return error;
                    }
                    return { message: "Invalid config" };
                });

            this.logger.error(
                { errors: parsed.error.issues.map(formatter) },
                `[${tenant.name}] Validation failed for ${resourceType} ${file}`,
            );

            return { isValid: false, data: payload };
        }

        return { isValid: true, data: parsed.data as T };
    }

    /**
     * Extract nested error messages from validation errors
     */
    extractErrorMessages(error: unknown): string[] {
        if (
            error &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error as { message?: unknown }).message === "string"
        ) {
            return [(error as { message: string }).message];
        }

        return ["Invalid config"];
    }

    formatNestedValidationError(error: unknown): string {
        return this.extractErrorMessages(error).join(", ");
    }
}
