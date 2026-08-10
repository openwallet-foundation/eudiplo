import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../../shared/common/zod/editor-schema";
import {
    CreateWebhookEndpointSchema,
    UpdateWebhookEndpointSchema,
} from "./webhook-endpoint.schema";

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
