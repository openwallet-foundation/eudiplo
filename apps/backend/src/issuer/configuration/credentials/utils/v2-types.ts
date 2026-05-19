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

interface CredentialConfigV2Core {
    format: CredentialFormat;
    display: Array<Record<string, unknown>>;
    scope?: string;
    docType?: string;
    keyAttestationsRequired?: Record<string, unknown>;
}

export interface CredentialConfigV2 extends Record<string, unknown> {
    configVersion: 2;
    config: CredentialConfigV2Core;
    fields: ClaimFieldDefinition[];
}

export interface ClaimDisplayInfoV1 {
    name?: string;
    locale?: string;
}

export interface ClaimMetadataV1 {
    path: ClaimPathElement[];
    mandatory?: boolean;
    display?: ClaimDisplayInfoV1[];
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

export interface CredentialConfigV1 extends Record<string, unknown> {
    config: {
        format: CredentialFormat;
        display?: Array<Record<string, unknown>>;
        scope?: string;
        docType?: string;
        namespace?: string;
        claimsByNamespace?: Record<string, Record<string, unknown>>;
        claimsMetadata?: ClaimMetadataV1[];
        keyAttestationsRequired?: Record<string, unknown>;
        [key: string]: unknown;
    };
    claims?: Record<string, unknown>;
    disclosureFrame?: Record<string, unknown>;
    schema?: JsonSchema;
}
