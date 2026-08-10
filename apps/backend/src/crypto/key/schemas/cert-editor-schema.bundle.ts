import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema";
import { CertImportSchema } from "./cert.schema";

export const certEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "cert",
    schemas: [
        defineEditorSchema({
            name: "CertImportDto",
            schema: CertImportSchema,
        }),
    ],
});
