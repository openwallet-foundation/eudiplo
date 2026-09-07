import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../../shared/common/zod/editor-schema.js";
import {
    AttributeProviderAuthSchema,
    CreateAttributeProviderSchema,
    UpdateAttributeProviderSchema,
} from "./attribute-provider.schema.js";

export const attributeProviderEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "attribute-provider",
    schemas: [
        defineEditorSchema({
            name: "CreateAttributeProviderDto",
            schema: CreateAttributeProviderSchema,
        }),
        defineEditorSchema({
            name: "UpdateAttributeProviderDto",
            schema: UpdateAttributeProviderSchema,
        }),
        defineEditorSchema({
            name: "AttributeProviderAuth",
            schema: AttributeProviderAuthSchema,
        }),
    ],
});
