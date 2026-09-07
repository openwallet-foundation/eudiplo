import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../../shared/common/zod/editor-schema.js";
import {
    CredentialConfigCreateSchema,
    EmbeddedDisclosurePolicySchema,
    VctSchema,
} from "./credential-config.schema.js";

export const credentialEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "credential",
    schemas: [
        defineEditorSchema({
            name: "EmbeddedDisclosurePolicy",
            schema: EmbeddedDisclosurePolicySchema,
        }),
        defineEditorSchema({
            name: "VCT",
            schema: VctSchema,
        }),
        defineEditorSchema({
            name: "CredentialConfigCreate",
            schema: CredentialConfigCreateSchema,
        }),
    ],
});
