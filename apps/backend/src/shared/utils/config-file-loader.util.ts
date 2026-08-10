import { readFileSync } from "node:fs";

function resolvePlaceholders<T>(value: T): T {
    if (typeof value === "string") {
        return value.replace(
            /\$\{([A-Z0-9_]+)(?::([^}]*))?\}/g,
            (_, name: string, defaultValue: string | undefined) => {
                const envValue = process.env[name];
                if (envValue !== undefined && envValue !== "") {
                    return envValue;
                }

                return defaultValue ?? `\${${name}}`;
            },
        ) as unknown as T;
    }

    if (Array.isArray(value)) {
        return value.map((item) => resolvePlaceholders(item)) as unknown as T;
    }

    if (value && typeof value === "object") {
        const resolved: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value)) {
            resolved[key] = resolvePlaceholders(item);
        }
        return resolved as T;
    }

    return value;
}

export function loadJsonFile<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function loadConfigDto<T extends object>(
    filePath: string,
    validationClass: any,
): T {
    const payload = resolvePlaceholders(loadJsonFile<object>(filePath));

    if (validationClass?.schema) {
        return validationClass.schema.parse(payload) as T;
    }

    if (typeof validationClass?.parse === "function") {
        return validationClass.parse(payload);
    }

    return payload as T;
}
