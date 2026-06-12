type FieldType =
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "object"
    | "array";

type ClaimPathElement = string | number | null;

interface FieldDisplay {
    locale: string;
    name: string;
    description?: string;
}

export interface ClaimFieldDefinition {
    path: ClaimPathElement[];
    type: FieldType;
    defaultValue?: unknown;
    mandatory?: boolean;
    disclosable?: boolean;
    namespace?: string;
    display?: FieldDisplay[];
    constraints?: Record<string, unknown>;
}

/** @internal Used by derive functions to build runtime metadata for issuance. */
export interface ClaimDisplayInfo {
    name?: string;
    locale?: string;
}

/** @internal Used by derive functions to build runtime metadata for issuance. */
export interface ClaimMetadata {
    path: ClaimPathElement[];
    mandatory?: boolean;
    display?: ClaimDisplayInfo[];
}

export interface JsonSchema {
    $schema?: string;
    type?: string;
    title?: string;
    description?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    [key: string]: unknown;
}
