import { Request } from "express";
import { AuditLogActor } from "../../audit-log/audit-log.service";
import { TokenPayload } from "../../auth/token.decorator";

export function resolveAuditActor(token: TokenPayload): AuditLogActor {
    const clientId = token.client?.clientId || token.authorizedParty;

    if (token.subject && clientId && token.subject !== clientId) {
        return {
            type: "user",
            id: token.subject,
            display: clientId,
        };
    }

    if (clientId) {
        return {
            type: "client",
            id: clientId,
            display: clientId,
        };
    }

    if (token.subject) {
        return {
            type: "user",
            id: token.subject,
        };
    }

    return { type: "system" };
}

export function extractRequestMeta(req?: Request) {
    if (!req) return undefined;

    return {
        requestId: req.headers["x-request-id"]
            ? String(req.headers["x-request-id"])
            : undefined,
    };
}

export function getChangedFields(
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
): string[] {
    const fields = new Set([
        ...Object.keys(before ?? {}),
        ...Object.keys(after ?? {}),
    ]);

    return [...fields].filter((field) => {
        const beforeValue = before?.[field] ?? null;
        const afterValue = after?.[field] ?? null;
        return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
    });
}

export function getChangedFieldsForKeys<T extends object>(
    before: T,
    after: T,
    keys: Array<keyof T>,
): string[] {
    return keys.filter((key) => {
        const beforeValue =
            (before as Record<string, unknown>)[key as string] ?? null;
        const afterValue =
            (after as Record<string, unknown>)[key as string] ?? null;
        return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
    }) as string[];
}
