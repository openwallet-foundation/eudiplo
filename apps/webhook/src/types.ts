/**
 * EUDIPLO Webhook Types
 *
 * Type definitions for webhook request/response payloads sent by the EUDIPLO backend.
 * Use these types to properly handle incoming webhook requests in your implementation.
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Webhook authentication configuration - no authentication.
 */
interface WebHookAuthConfigNone {
    type: "none";
}

/**
 * API key configuration for webhook authentication.
 */
interface ApiKeyConfig {
    headerName: string;
    value: string;
}

/**
 * Webhook authentication configuration - API key in header.
 */
interface WebHookAuthConfigHeader {
    type: "apiKey";
    config: ApiKeyConfig;
}

/**
 * Webhook configuration type union.
 */
type WebhookAuth = WebHookAuthConfigNone | WebHookAuthConfigHeader;

// ============================================================================
// Claims Webhook (Unified Payload)
// ============================================================================

/**
 * Disclosed claims from a presented credential.
 * The structure depends on the credential type and what was disclosed.
 */
interface DisclosedClaims {
    [claimName: string]: unknown;
}

/**
 * Presented credential information sent in claims webhook.
 */
interface PresentedCredential {
    /**
     * Credential configuration ID.
     */
    id: string;
    /**
     * Array of disclosed credential values (one per credential instance).
     */
    values: DisclosedClaims[];
}

/**
 * Identity context from authorization server (internal or external).
 * Present when using authorization code flow.
 */
interface AuthorizationIdentity {
    /**
     * Token issuer (authorization server URL).
     * For external AS: e.g., "https://keycloak.example.com/realms/myapp"
     * For internal AS: EUDIPLO's own authorization server URL
     */
    iss: string;
    /**
     * Subject identifier from the AS token.
     */
    sub: string;
    /**
     * All claims from the access token.
     * Use this for identity mapping and claims resolution.
     */
    token_claims: Record<string, unknown>;
}

/**
 * Unified request payload for claims webhook.
 *
 * This payload is the same regardless of whether the authorization server is
 * internal (EUDIPLO's built-in AS) or external (e.g., Keycloak, Auth0).
 *
 * The webhook implementation can use the available fields to resolve claims:
 * - `identity`: Present for authorization code flows, contains user identity from AS token
 * - `credentials`: Present for presentation flows, contains disclosed credential claims
 *
 * Endpoint: /claims (recommended)
 */
interface ClaimsWebhookRequest {
    /**
     * Session ID for the issuance flow.
     */
    session: string;
    /**
     * Credential configuration ID being requested.
     */
    credential_configuration_id: string;
    /**
     * Identity context from authorization server (present for auth code flows).
     * Use this for identity mapping when issuing credentials based on AS authentication.
     */
    identity?: AuthorizationIdentity;
    /**
     * Array of presented credentials with disclosed claims (present for presentation flows).
     * Use this when deriving new credential claims from presented credentials.
     */
    credentials?: PresentedCredential[];
}

// ============================================================================
// Notification Webhook
// ============================================================================

/**
 * Notification event types as defined by OID4VCI.
 */
type NotificationEvent =
    | "credential_accepted"
    | "credential_failure"
    | "credential_deleted";

/**
 * Notification information.
 */
interface Notification {
    /**
     * Unique identifier for the notification.
     */
    id: string;
    /**
     * The notification event type.
     */
    event?: NotificationEvent;
    /**
     * The credential configuration ID associated with this notification.
     */
    credentialConfigurationId: string;
}

/**
 * Request payload for notification webhook.
 * Sent when the wallet notifies about credential status changes.
 *
 * Endpoint: /notify
 */
interface NotificationWebhookRequest {
    /**
     * Notification details.
     */
    notification: Notification;
    /**
     * Session ID for the issuance flow.
     */
    session: string;
}

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
