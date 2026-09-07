import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema.js";
import {
    DCQLSchema,
    PresentationConfigCreateSchema,
    TransactionDataSchema,
} from "./presentation-config.schema.js";

export const presentationEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "presentation",
    schemas: [
        defineEditorSchema({
            name: "DCQL",
            schema: DCQLSchema,
        }),
        defineEditorSchema({
            name: "TransactionData",
            schema: TransactionDataSchema,
        }),
        defineEditorSchema({
            name: "PresentationConfigCreateDto",
            schema: PresentationConfigCreateSchema,
        }),
    ],
});
