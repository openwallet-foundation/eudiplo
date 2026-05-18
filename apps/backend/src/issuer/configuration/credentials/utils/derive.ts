import type {
    ClaimDisplayInfoV1,
    ClaimFieldDefinition,
    ClaimMetadataV1,
    JsonSchema,
} from "./v2-types";

const JSON_SCHEMA_DRAFT_2020_12 =
    "https://json-schema.org/draft/2020-12/schema";

function segmentToKey(segment: string | number | null): string {
    if (segment === null) {
        return "*";
    }
    return String(segment);
}

function getOrCreateChild(
    target: Record<string, unknown>,
    key: string,
    nextIsArray: boolean,
): Record<string, unknown> | unknown[] {
    const current = target[key];
    if (current !== undefined) {
        if (Array.isArray(current)) {
            return current;
        }
        if (typeof current === "object" && current !== null) {
            return current as Record<string, unknown>;
        }
    }

    const created: Record<string, unknown> | unknown[] = nextIsArray ? [] : {};
    target[key] = created;
    return created;
}

function setValueAtPath(
    target: Record<string, unknown>,
    path: Array<string | number | null>,
    value: unknown,
): void {
    if (path.length === 0) {
        return;
    }

    let cursor: Record<string, unknown> | unknown[] = target;

    for (let index = 0; index < path.length; index += 1) {
        const segment = path[index];
        const isLast = index === path.length - 1;
        const next = path[index + 1];

        if (Array.isArray(cursor)) {
            const arrayIndex =
                typeof segment === "number"
                    ? segment
                    : Number(segmentToKey(segment));
            if (!Number.isFinite(arrayIndex) || arrayIndex < 0) {
                return;
            }

            if (isLast) {
                cursor[arrayIndex] = value;
                return;
            }

            const current = cursor[arrayIndex];
            if (typeof current !== "object" || current === null) {
                cursor[arrayIndex] = typeof next === "number" ? [] : {};
            }

            cursor = cursor[arrayIndex] as Record<string, unknown> | unknown[];
            continue;
        }

        const key = segmentToKey(segment);
        if (isLast) {
            cursor[key] = value;
            return;
        }

        cursor = getOrCreateChild(cursor, key, typeof next === "number");
    }
}

function getDisplayTitle(
    display: ClaimFieldDefinition["display"],
): string | undefined {
    if (!display || display.length === 0) {
        return undefined;
    }

    const en = display.find((entry) =>
        entry.lang.toLowerCase().startsWith("en"),
    );
    return en?.label ?? display[0]?.label;
}

function ensureSchemaNode(
    root: JsonSchema,
    path: Array<string | number | null>,
): JsonSchema {
    let cursor = root;

    for (const segment of path) {
        const key = segmentToKey(segment);
        if (!cursor.properties) {
            cursor.properties = {};
        }

        if (!cursor.properties[key]) {
            cursor.properties[key] = {
                type: "object",
                properties: {},
            };
        }

        cursor = cursor.properties[key] as JsonSchema;
    }

    return cursor;
}

function ensureFrameNode(
    root: Record<string, unknown>,
    path: Array<string | number | null>,
): Record<string, unknown> {
    let cursor = root;

    for (const segment of path) {
        const key = segmentToKey(segment);
        const current = cursor[key];
        if (!current || typeof current !== "object" || Array.isArray(current)) {
            cursor[key] = {};
        }

        cursor = cursor[key] as Record<string, unknown>;
    }

    return cursor;
}

function normalizeDisplayToV1(
    display: ClaimFieldDefinition["display"],
): ClaimDisplayInfoV1[] | undefined {
    if (!display || display.length === 0) {
        return undefined;
    }

    return display.map((entry) => ({
        name: entry.label,
        locale: entry.lang,
    }));
}

export function buildClaims(
    fields: ClaimFieldDefinition[],
): Record<string, unknown> {
    const claims: Record<string, unknown> = {};

    for (const field of fields) {
        if (!Object.prototype.hasOwnProperty.call(field, "defaultValue")) {
            continue;
        }

        setValueAtPath(claims, field.path, field.defaultValue);
    }

    return claims;
}

export function buildDisclosureFrame(
    fields: ClaimFieldDefinition[],
): Record<string, unknown> | undefined {
    const frame: Record<string, unknown> = {};
    let hasDisclosure = false;

    for (const field of fields) {
        if (!field.disclosable || field.path.length === 0) {
            continue;
        }

        const parentPath = field.path.slice(0, -1);
        const leaf = segmentToKey(field.path[field.path.length - 1] ?? "");

        const node = ensureFrameNode(frame, parentPath);
        const existing = Array.isArray(node._sd) ? node._sd : [];
        if (!existing.includes(leaf)) {
            existing.push(leaf);
            node._sd = existing;
        }

        hasDisclosure = true;
    }

    return hasDisclosure ? frame : undefined;
}

export function buildClaimsMetadata(
    fields: ClaimFieldDefinition[],
): ClaimMetadataV1[] {
    return fields
        .filter((field) => field.path.length > 0)
        .map((field) => {
            const metadata: ClaimMetadataV1 = {
                path: field.path.map((segment) => segmentToKey(segment)),
            };

            if (typeof field.mandatory === "boolean") {
                metadata.mandatory = field.mandatory;
            }

            const display = normalizeDisplayToV1(field.display);
            if (display) {
                metadata.display = display;
            }

            return metadata;
        });
}

export function buildJsonSchema(fields: ClaimFieldDefinition[]): JsonSchema {
    const root: JsonSchema = {
        $schema: JSON_SCHEMA_DRAFT_2020_12,
        type: "object",
        properties: {},
    };

    for (const field of fields) {
        if (field.path.length === 0) {
            continue;
        }

        const parent = ensureSchemaNode(root, field.path.slice(0, -1));
        const leafKey = segmentToKey(field.path[field.path.length - 1] ?? "");

        if (!parent.properties) {
            parent.properties = {};
        }

        const leafSchema: JsonSchema = {
            ...(field.constraints ?? {}),
            type: field.type === "date" ? "string" : field.type,
        };

        if (field.type === "date") {
            if (!leafSchema.format) {
                leafSchema.format = "date";
            }
        }

        const title = getDisplayTitle(field.display);
        if (title) {
            leafSchema.title = title;
        }

        parent.properties[leafKey] = leafSchema;

        if (field.mandatory) {
            if (!Array.isArray(parent.required)) {
                parent.required = [];
            }
            if (!parent.required.includes(leafKey)) {
                parent.required.push(leafKey);
            }
        }
    }

    return root;
}

export function buildClaimsByNamespace(
    fields: ClaimFieldDefinition[],
): Record<string, Record<string, unknown>> {
    const byNamespace: Record<string, Record<string, unknown>> = {};

    for (const field of fields) {
        if (
            !field.namespace ||
            !Object.prototype.hasOwnProperty.call(field, "defaultValue")
        ) {
            continue;
        }

        if (!byNamespace[field.namespace]) {
            byNamespace[field.namespace] = {};
        }

        const namespaceTarget = byNamespace[field.namespace];
        const normalizedPath =
            field.path.length > 0 &&
            segmentToKey(field.path[0] ?? "") === field.namespace
                ? field.path.slice(1)
                : field.path;

        setValueAtPath(namespaceTarget, normalizedPath, field.defaultValue);
    }

    return byNamespace;
}
