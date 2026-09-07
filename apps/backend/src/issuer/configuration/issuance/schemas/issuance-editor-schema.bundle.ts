import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../../shared/common/zod/editor-schema.js";
import { IssuanceConfigSchema } from "./issuance.schema.js";

export const issuanceEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "issuance",
    schemas: [
        defineEditorSchema({
            name: "IssuanceConfig",
            schema: IssuanceConfigSchema,
        }),
    ],
});
