import { z } from "zod";

const ApiKeyAuthSchema = z
    .object({
        type: z.literal("apiKey").describe("Use API key authentication."),
        config: z
            .object({
                headerName: z
                    .string()
                    .min(1)
                    .describe("HTTP header name carrying the API key."),
                value: z.string().min(1).describe("API key value."),
            })
            .describe("API key authentication settings."),
    })
    .describe("API key authentication variant.");

const NoneAuthSchema = z
    .object({
        type: z
            .literal("none")
            .describe("Disable authentication for attribute provider calls."),
    })
    .describe("No authentication variant.");

export const AttributeProviderAuthSchema = z
    .discriminatedUnion("type", [NoneAuthSchema, ApiKeyAuthSchema])
    .describe("Authentication method used to call the attribute provider.");

export const CreateAttributeProviderSchema = z
    .object({
        id: z.string().min(1).describe("Unique attribute provider identifier."),
        name: z
            .string()
            .min(1)
            .describe("Display name of the attribute provider."),
        description: z
            .string()
            .min(1)
            .optional()
            .nullable()
            .describe("Optional attribute provider description."),
        url: z.url().describe("Base URL of the attribute provider endpoint."),
        auth: AttributeProviderAuthSchema.describe(
            "Authentication configuration for outbound provider requests.",
        ),
    })
    .describe("Payload for creating an attribute provider configuration.")
    .strict();

export const UpdateAttributeProviderSchema =
    CreateAttributeProviderSchema.partial()
        .describe(
            "Payload for partially updating an attribute provider configuration.",
        )
        .strict();

export type CreateAttributeProvider = z.infer<
    typeof CreateAttributeProviderSchema
>;
export type UpdateAttributeProvider = z.infer<
    typeof UpdateAttributeProviderSchema
>;
