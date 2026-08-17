import { ApiExtraModels, ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import {
    WebhookConfig,
    WebhookConfigSchema,
} from "../../../webhook/webhook.dto";

/**
 * Values for the type of response expected from the presentation request.
 */
export const ResponseType = {
    URI: "uri",
    DC_API: "dc-api",
    ISO_18013_7: "iso-18013-7",
} as const;

export type ResponseTypeValue =
    (typeof ResponseType)[keyof typeof ResponseType];

/**
 * DTO for the presentation request containing the response type and request ID.
 */
const PresentationRequestSchema = z
    .object({
        response_type: z.union([
            z.literal(ResponseType.URI),
            z.literal(ResponseType.DC_API),
            z.literal(ResponseType.ISO_18013_7),
        ]),
        requestId: z.string(),
        webhook: WebhookConfigSchema.optional(),
        redirectUri: z.string().optional(),
        expected_origin: z.string().optional(),
        transaction_data: z.array(z.record(z.string(), z.unknown())).optional(),
        skewSeconds: z.number().min(0).optional(),
    })
    .strict();

type PresentationRequestConstructor = new () => PresentationRequestData;

const PresentationRequestBase: PresentationRequestConstructor = createZodDto(
    PresentationRequestSchema,
) as PresentationRequestConstructor;

interface PresentationRequestData {
    response_type: ResponseTypeValue;
    requestId: string;
    webhook?: WebhookConfig;
    redirectUri?: string;
    expected_origin?: string;
    transaction_data?: Record<string, unknown>[];
    skewSeconds?: number;
}

@ApiExtraModels(WebhookConfig)
export class PresentationRequest
    extends PresentationRequestBase
    implements PresentationRequestData
{
    /**
     * The type of response expected from the presentation request.
     */
    response_type!: ResponseTypeValue;

    /**
     * Identifier of the presentation configuration
     */
    requestId!: string;

    /**
     * Webhook configuration to receive the response.
     * If not provided, the configured webhook from the configuration will be used.
     */
    @ApiPropertyOptional({ type: () => WebhookConfig })
    webhook?: WebhookConfig;

    /**
     * Optional redirect URI to which the user-agent should be redirected after the presentation is completed.
     * You can use the `{sessionId}` placeholder in the URI, which will be replaced with the actual session ID.
     * @example "https://example.com/callback?session={sessionId}"
     */
    redirectUri?: string;

    /**
     * Optional expected browser origin for DC API key-binding audience.
     * Example: "http://localhost:8080"
     */
    expected_origin?: string;

    /**
     * Optional transaction data to include in the OID4VP request.
     * If provided, this will override the transaction_data from the presentation configuration.
     */
    transaction_data?: Record<string, unknown>[];

    /**
     * Optional clock skew tolerance for this presentation offer, in seconds.
     * If provided, this overrides the presentation configuration for the created session.
     */
    skewSeconds?: number;
}

export type PresentationRequestOptions = Pick<
    PresentationRequestData,
    | "webhook"
    | "redirectUri"
    | "expected_origin"
    | "transaction_data"
    | "skewSeconds"
> & {
    session?: string;
};
