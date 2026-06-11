import { Type } from "class-transformer";
import {
    IsArray,
    IsEnum,
    IsObject,
    IsOptional,
    IsString,
} from "class-validator";
import { WebhookConfig } from "../../../shared/utils/webhook/webhook.dto";
import { TransactionData } from "../../presentations/entities/presentation-config.entity";
import { IsTransactionData } from "../../presentations/validators/transaction-data.validator";

/**
 * Enum for the type of response expected from the presentation request.
 */
export enum ResponseType {
    /**
     * Response type indicating a URI will be returned.
     */
    URI = "uri",
    /**
     * Response type indicating a DC API response will be used.
     */
    DC_API = "dc-api",
}

/**
 * DTO for the presentation request containing the response type and request ID.
 */
export class PresentationRequest {
    /**
     * The type of response expected from the presentation request.
     */
    @IsEnum(ResponseType)
    response_type!: ResponseType;

    /**
     * Identifier of the presentation configuration
     */
    @IsString()
    requestId!: string;

    /**
     * Webhook configuration to receive the response.
     * If not provided, the configured webhook from the configuration will be used.
     */
    @IsObject()
    @IsOptional()
    webhook?: WebhookConfig;

    /**
     * Optional redirect URI to which the user-agent should be redirected after the presentation is completed.
     * You can use the `{sessionId}` placeholder in the URI, which will be replaced with the actual session ID.
     * @example "https://example.com/callback?session={sessionId}"
     */
    @IsOptional()
    @IsString()
    redirectUri?: string;

    /**
     * Optional expected browser origin for DC API key-binding audience.
     * Example: "http://localhost:8080"
     */
    @IsOptional()
    @IsString()
    expected_origin?: string;

    /**
     * Optional transaction data to include in the OID4VP request.
     * If provided, this will override the transaction_data from the presentation configuration.
     */
    @IsOptional()
    @IsArray()
    @IsTransactionData()
    @Type(() => TransactionData)
    transaction_data?: TransactionData[];
}

export type PresentationRequestOptions = Pick<
    PresentationRequest,
    "webhook" | "redirectUri" | "expected_origin" | "transaction_data"
> & {
    session?: string;
};
