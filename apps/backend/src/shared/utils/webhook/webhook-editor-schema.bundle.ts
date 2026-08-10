import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../common/zod/editor-schema";
import { WebhookConfigSchema } from "./webhook.schema";

export const webhookEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "webhook",
    schemas: [
        defineEditorSchema({
            name: "WebhookConfig",
            schema: WebhookConfigSchema,
        }),
    ],
});
