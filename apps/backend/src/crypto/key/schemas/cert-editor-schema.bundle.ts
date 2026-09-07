import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema.js";
import { CertImportSchema } from "./cert.schema.js";

export const certEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "cert",
    schemas: [
        defineEditorSchema({
            name: "CertImportDto",
            schema: CertImportSchema,
        }),
    ],
});
