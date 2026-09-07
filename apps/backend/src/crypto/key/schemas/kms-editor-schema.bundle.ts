import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema.js";
import { KmsConfigSchema } from "./kms-config.schema.js";

export const kmsEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "kms",
    schemas: [
        defineEditorSchema({
            name: "KmsConfigDto",
            schema: KmsConfigSchema,
        }),
    ],
});
