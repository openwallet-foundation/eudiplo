import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

export interface ValidationIssue {
    path: Array<string | number>;
    message: string;
    code: string;
}

export function withMeta<T extends z.ZodTypeAny>(
    schema: T,
    metadata: Record<string, unknown>,
): T {
    return schema.meta(metadata);
}

export function textField(description: string, example?: string) {
    return withMeta(z.string(), {
        description,
        ...(example ? { examples: [example] } : {}),
    });
}

export function optionalTextField(description: string, example?: string) {
    return withMeta(z.string().optional(), {
        description,
        ...(example ? { examples: [example] } : {}),
    });
}

export function booleanField(description: string, example?: boolean) {
    return withMeta(z.boolean().optional(), {
        description,
        ...(example !== undefined ? { examples: [example] } : {}),
    });
}

export function toValidationIssues(issues: z.ZodIssue[]): ValidationIssue[] {
    return issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
    }));
}

export function buildValidationBody(
    issues: ValidationIssue[],
    message = "Validation failed",
) {
    return {
        statusCode: 400,
        message,
        errors: issues,
        timestamp: new Date().toISOString(),
    };
}

export function createValidationException(
    issues: ValidationIssue[],
    message?: string,
) {
    return new BadRequestException(buildValidationBody(issues, message));
}

export function resolveEnvPlaceholders<T>(value: T): T {
    if (typeof value === "string") {
        return value.replace(
            /\$\{([A-Z0-9_]+)\}/g,
            (_, name: string) => process.env[name] ?? "",
        ) as unknown as T;
    }

    if (Array.isArray(value)) {
        return value.map((item) => resolveEnvPlaceholders(item)) as unknown as T;
    }

    if (value && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value)) {
            out[key] = resolveEnvPlaceholders(item);
        }
        return out as T;
    }

    return value;
}