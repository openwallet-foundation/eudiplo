import { Type } from "class-transformer";
import {
    IsArray,
    IsEnum,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Min,
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
     * Response type indicating a DC API response will be used (OID4VP via DC API).
     */
    DC_API = "dc-api",
    /**
     * Response type for ISO 18013-7 Annex C: org.iso.mdoc protocol via DC API.
     * Returns a CBOR DeviceRequest + encryptionInfo (HPKE recipient key).
     */
    ISO_18013_7 = "iso-18013-7",
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

    /**
     * Optional clock skew tolerance for this presentation offer, in seconds.
     * If provided, this overrides the presentation configuration for the created session.
     */
    @IsOptional()
    @IsNumber()
    @Min(0)
    skewSeconds?: number;
}

export type PresentationRequestOptions = Pick<
    PresentationRequest,
    | "webhook"
    | "redirectUri"
    | "expected_origin"
    | "transaction_data"
    | "skewSeconds"
> & {
    session?: string;
};
