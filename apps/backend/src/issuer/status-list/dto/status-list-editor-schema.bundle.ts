import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema.js";
import {
    CreateStatusListSchema,
    StatusListImportSchema,
    UpdateStatusListConfigSchema,
    UpdateStatusListSchema,
} from "./status-list.schema.js";

export const statusListEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "status-list",
    schemas: [
        defineEditorSchema({
            name: "StatusListImportDto",
            schema: StatusListImportSchema,
        }),
        defineEditorSchema({
            name: "CreateStatusListDto",
            schema: CreateStatusListSchema,
        }),
        defineEditorSchema({
            name: "UpdateStatusListDto",
            schema: UpdateStatusListSchema,
        }),
        defineEditorSchema({
            name: "UpdateStatusListConfigDto",
            schema: UpdateStatusListConfigSchema,
        }),
    ],
});
