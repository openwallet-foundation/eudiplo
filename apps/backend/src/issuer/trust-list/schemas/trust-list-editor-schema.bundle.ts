import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema";
import { TrustListCreateSchema } from "./trust-list.schema";

export const trustListEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "trust-list",
    schemas: [
        defineEditorSchema({
            name: "TrustListCreateDto",
            schema: TrustListCreateSchema,
        }),
    ],
});
