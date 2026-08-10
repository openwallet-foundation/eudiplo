import type { ZodTypeAny } from "zod";

export type EditorSchemaDefinition = {
    name: string;
    schema: ZodTypeAny;
    fileMatch?: string[];
};

export type EditorSchemaBundle = {
    domain: string;
    schemas: readonly EditorSchemaDefinition[];
};

export function defineEditorSchema(
    definition: EditorSchemaDefinition,
): EditorSchemaDefinition {
    return definition;
}

export function defineEditorSchemaBundle(
    bundle: EditorSchemaBundle,
): EditorSchemaBundle {
    return bundle;
}
