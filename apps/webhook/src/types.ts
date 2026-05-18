// ============================================================================
// Webhook Response Types
// ============================================================================

/**
 * Claims data for a credential.
 * Keys are claim names, values are the claim data.
 */
export type CredentialClaims = Record<string, unknown>;

/**
 * Response from a claims webhook.
 * Return claims per credential configuration ID, or indicate deferred issuance.
 */
export interface ClaimsWebhookResponse {
    /**
     * When true, indicates that the credential issuance should be deferred.
     * The wallet will receive a transaction_id to poll later.
     */
    deferred?: boolean;
    /**
     * Recommended polling interval in seconds for deferred issuance.
     * Defaults to 5 seconds if not specified.
     */
    interval?: number;
    /**
     * Redirect URI for OAuth-style redirects.
     */
    redirectUri?: string;
    /**
     * Claims data keyed by credential configuration ID.
     * Index signature for dynamic credential configuration IDs.
     */
    [credentialConfigurationId: string]:
        | CredentialClaims
        | string
        | boolean
        | number
        | undefined;
}

/**
 * Simple acknowledgment response for notification webhooks.
 */
export interface NotificationWebhookResponse {
    status: "ok" | "error";
    message?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a claims response for a single credential configuration.
 */
export function createClaimsResponse(
    credentialConfigurationId: string,
    claims: CredentialClaims,
): ClaimsWebhookResponse {
    return {
        [credentialConfigurationId]: claims,
    };
}

/**
 * Creates a deferred issuance response.
 */
export function createDeferredResponse(
    intervalSeconds?: number,
): ClaimsWebhookResponse {
    return {
        deferred: true,
        ...(intervalSeconds !== undefined && { interval: intervalSeconds }),
    };
}

/**
 * Creates a success notification response.
 */
export function createNotificationSuccess(): NotificationWebhookResponse {
    return { status: "ok" };
}
