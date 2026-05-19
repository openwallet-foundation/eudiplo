type CredentialFormat = "dc+sd-jwt" | "mso_mdoc";

export type FieldType =
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "object"
    | "array"
    | "date";

export type ClaimPathElement = string | number | null;

export interface FieldDisplay {
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

interface CredentialConfigCore {
    format: CredentialFormat;
    display: Array<Record<string, unknown>>;
    scope?: string;
    docType?: string;
    keyAttestationsRequired?: Record<string, unknown>;
}

export interface CredentialConfigData extends Record<string, unknown> {
    config: CredentialConfigCore;
    fields: ClaimFieldDefinition[];
}

