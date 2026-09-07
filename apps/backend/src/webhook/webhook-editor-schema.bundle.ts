import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../shared/common/zod/editor-schema.js";
import { WebhookConfigSchema } from "./webhook.schema.js";

export const webhookEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "webhook",
    schemas: [
        defineEditorSchema({
            name: "WebhookConfig",
            schema: WebhookConfigSchema,
        }),
    ],
});
