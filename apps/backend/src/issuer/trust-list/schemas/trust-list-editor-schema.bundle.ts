import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema.js";
import { TrustListCreateSchema } from "./trust-list.schema.js";

export const trustListEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "trust-list",
    schemas: [
        defineEditorSchema({
            name: "TrustListCreateDto",
            schema: TrustListCreateSchema,
        }),
    ],
});
