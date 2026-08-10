import { z } from "zod";

const WebhookAuthNoneSchema = z
    .object({
        type: z.literal("none").describe("Disable webhook authentication."),
    })
    .describe("No webhook authentication variant.");

const WebhookAuthApiKeySchema = z
    .object({
        type: z
            .literal("apiKey")
            .describe("Use API key authentication for webhook requests."),
        config: z
            .object({
                headerName: z
                    .string()
                    .min(1)
                    .describe("HTTP header name for the API key."),
                value: z
                    .string()
                    .min(1)
                    .describe("API key value sent with webhook requests."),
            })
            .describe("API key webhook authentication settings."),
    })
    .describe("API key webhook authentication variant.");

const WebhookAuthSchema = z
    .discriminatedUnion("type", [
        WebhookAuthNoneSchema,
        WebhookAuthApiKeySchema,
    ])
    .describe("Authentication strategy for webhook delivery.");

export const CreateWebhookEndpointSchema = z
    .object({
        id: z.string().min(1).describe("Unique webhook endpoint identifier."),
        name: z
            .string()
            .min(1)
            .describe("Display name of the webhook endpoint."),
        description: z
            .string()
            .min(1)
            .optional()
            .nullable()
            .describe("Optional webhook endpoint description."),
        url: z.url().describe("Destination URL for webhook delivery."),
        auth: WebhookAuthSchema.describe(
            "Authentication configuration applied to outgoing webhook requests.",
        ),
    })
    .describe("Payload for creating a webhook endpoint configuration.")
    .strict();

export const UpdateWebhookEndpointSchema = CreateWebhookEndpointSchema.partial()
    .describe(
        "Payload for partially updating a webhook endpoint configuration.",
    )
    .strict();

export type CreateWebhookEndpoint = z.infer<typeof CreateWebhookEndpointSchema>;
export type UpdateWebhookEndpoint = z.infer<typeof UpdateWebhookEndpointSchema>;
