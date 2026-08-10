import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema";
import {
    DCQLSchema,
    PresentationConfigCreateSchema,
    TransactionDataSchema,
} from "./presentation-config.schema";

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
