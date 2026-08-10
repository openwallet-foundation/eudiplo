import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema";
import { KmsConfigSchema } from "./kms-config.schema";

export const kmsEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "kms",
    schemas: [
        defineEditorSchema({
            name: "KmsConfigDto",
            schema: KmsConfigSchema,
        }),
    ],
});
