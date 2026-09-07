import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../../shared/common/zod/editor-schema.js";
import {
    CreateWebhookEndpointSchema,
    UpdateWebhookEndpointSchema,
} from "./webhook-endpoint.schema.js";

export const webhookEndpointEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "webhook-endpoint",
    schemas: [
        defineEditorSchema({
            name: "CreateWebhookEndpointDto",
            schema: CreateWebhookEndpointSchema,
        }),
        defineEditorSchema({
            name: "UpdateWebhookEndpointDto",
            schema: UpdateWebhookEndpointSchema,
        }),
    ],
});
