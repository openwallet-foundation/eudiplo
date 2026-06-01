import { client } from './api/client.gen';
import {
  credentialOfferControllerGetOffer,
  sessionControllerGetSession,
  verifierOfferControllerGetOffer,
} from './api/sdk.gen';
import type {
  OfferRequestDto,
  PresentationRequest,
  Session,
} from './api/types.gen';

// ============================================================================
// Digital Credentials API Types
// ============================================================================

/**
 * Digital Credential response from the browser API
 */
export interface DigitalCredentialResponse {
  data: {
    response?: string;
    error?: string;
    error_description?: string;
  };
}

/**
 * Result of a DC API presentation
 */
export interface DcApiPresentationResult {
  /** The verified credentials from the presentation */
  credentials?: Array<Record<string, unknown>>;
  /** The raw response from the verifier */
  response: unknown;
  /** Redirect URI if provided by the verifier */
  redirectUri?: string;
}

/**
 * Options for DC API presentation
 */
export interface DcApiPresentationOptions {
  /** Whether to return the full credential data in the response (default: true) */
  sendResponse?: boolean;
}

/**
 * Check if the Digital Credentials API is available in the current browser
 */
export function isDcApiAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'credentials' in navigator &&
    'get' in navigator.credentials &&
    typeof window !== 'undefined' &&
    'DigitalCredential' in window
  );
}

/**
 * Decode a JWT payload without verification (for extracting response_uri)
 */
function decodeJwtPayload<T = Record<string, unknown>>(jwt: string): T {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = parts[1];
  // Handle base64url encoding
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = atob(base64);
  return JSON.parse(jsonPayload) as T;
}

/**
 * Configuration options for the EudiploClient
 */
export interface EudiploClientConfig {
  /** Base URL of the EUDIPLO server (e.g., 'https://eudiplo.example.com') */
  baseUrl: string;
  /** OAuth2 client ID */
  clientId: string;
  /** OAuth2 client secret */
  clientSecret: string;
  /** Optional: Auto-refresh token before expiry (default: true) */
  autoRefresh?: boolean;
  /** Optional: Custom fetch implementation (useful for Cloudflare Workers) */
  fetch?: typeof fetch;
}

/**
 * Options for session polling
 */
export interface SessionPollingOptions {
  /** Polling interval in milliseconds (default: 1000) */
  interval?: number;
  /** Maximum time to wait in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Callback on each poll */
  onUpdate?: (session: Session) => void;
  /** AbortSignal to cancel polling */
  signal?: AbortSignal;
}

/**
 * Event payload received from SSE subscription
 */
export interface SessionStatusEvent {
  /** Session ID */
  id: string;
  /** Current session status */
  status: 'active' | 'fetched' | 'completed' | 'expired' | 'failed';
  /** Timestamp of the status update */
  updatedAt: string;
}

/**
 * Options for SSE session subscription
 */
export interface SessionSubscriptionOptions {
  /** Callback invoked when session status changes */
  onStatusChange?: (event: SessionStatusEvent) => void;
  /** Callback invoked when an error occurs */
  onError?: (error: Error) => void;
  /** Callback invoked when connection is established */
  onOpen?: () => void;
}

/**
 * Subscription handle returned by subscribeToSession.
 * Use to close the SSE connection.
 */
export interface SessionSubscription {
  /** Close the SSE connection */
  close: () => void;
}

/**
 * Simplified options for creating an issuance offer
 */
export interface IssuanceOfferOptions {
  /** Credential configuration IDs to issue */
  credentialConfigurationIds: string[];
  /** Claims to include in the credentials (keyed by config ID) */
  claims?: Record<string, Record<string, unknown>>;
  /** Response type: 'uri' returns the offer URI, 'dc-api' for Digital Credentials API */
  responseType?: 'uri' | 'dc-api';
  /** Transaction code for pre-authorized flow */
  txCode?: string;
  /** Flow type (default: 'pre_authorized_code') */
  flow?: 'authorization_code' | 'pre_authorized_code';
}

/**
 * Simplified options for creating a presentation request
 */
export interface PresentationRequestOptions {
  /** ID of the presentation configuration */
  configId: string;
  /** Response type: 'uri' returns the request URI, 'dc-api' for Digital Credentials API */
  responseType?: 'uri' | 'dc-api';
  /** Optional redirect URI after presentation completes */
  redirectUri?: string;
}

/**
 * Result of creating an offer or request
 */
export interface OfferResult {
  /**
   * URI for same-device flow.
   * Use when the wallet is on the same device as the browser.
   * For presentation requests: After presentation, the wallet will redirect the user back to the verifier.
   * For issuance offers: The wallet opens and receives the credential.
   */
  uri: string;
  /**
   * URI for cross-device flow (e.g., QR code scanned by another device).
   * Use when the wallet is on a different device than the browser.
   * No redirect happens after presentation - poll the session for status updates.
   *
   * Only available for presentation requests. For issuance, use `uri` for both flows.
   */
  crossDeviceUri?: string;
  /** Session ID for polling status updates */
  sessionId: string;
}

/**
 * Framework-agnostic EUDIPLO client for demos and integrations.
 *
 * @example
 * ```typescript
 * import { EudiploClient } from '@eudiplo/sdk-core';
 *
 * const client = new EudiploClient({
 *   baseUrl: 'https://eudiplo.example.com',
 *   clientId: 'my-demo',
 *   clientSecret: 'secret123'
 * });
 *
 * // Create a presentation request for age verification
 * const { uri, sessionId } = await client.createPresentationRequest({
 *   configId: 'age-over-18'
 * });
 *
 * // Display QR code with `uri`, then wait for completion
 * const session = await client.waitForSession(sessionId);
 * console.log('Verified:', session.credentials);
 * ```
 */
export class EudiploClient {
  private readonly config: EudiploClientConfig;
  private accessToken?: string;
  private tokenExpiresAt?: number;
  private refreshPromise?: Promise<void>;

  constructor(config: EudiploClientConfig) {
    this.config = {
      autoRefresh: true,
      ...config,
    };

    // Configure the underlying API client
    client.setConfig({
      baseUrl: config.baseUrl,
      fetch: config.fetch,
    });
  }

  /**
   * Authenticate and obtain an access token.
   * Called automatically by other methods, but can be called explicitly.
   */
  async authenticate(): Promise<void> {
    // Prevent concurrent authentication attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._doAuthenticate();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  private async _doAuthenticate(): Promise<void> {
    const fetchFn = this.config.fetch ?? globalThis.fetch;
    const res = await fetchFn(`${this.config.baseUrl}/api/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Authentication failed: ${res.status} ${error}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;    

    // Update client with auth header
    client.setConfig({
      baseUrl: this.config.baseUrl,
      fetch: this.config.fetch,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  /**
   * Ensure we have a valid access token, refreshing if necessary.
   */
  private async ensureAuthenticated(): Promise<void> {
    const bufferMs = 60000; // 1 minute buffer

    if (!this.accessToken || !this.tokenExpiresAt) {
      await this.authenticate();
      return;
    }

    if (this.config.autoRefresh && Date.now() > this.tokenExpiresAt - bufferMs) {
      await this.authenticate();
    }
  }

  /**
   * Create a credential issuance offer.
   *
   * @example
   * ```typescript
   * const { uri, sessionId } = await client.createIssuanceOffer({
   *   credentialConfigurationIds: ['PID'],
   *   claims: {
   *     PID: { given_name: 'John', family_name: 'Doe' }
   *   }
   * });
   * ```
   */
  async createIssuanceOffer(options: IssuanceOfferOptions): Promise<OfferResult> {
    await this.ensureAuthenticated();

    const body: OfferRequestDto = {
      response_type: options.responseType ?? 'uri',
      credentialConfigurationIds: options.credentialConfigurationIds,
      flow: options.flow ?? 'pre_authorized_code',
      tx_code: options.txCode,
    };

    // Build credential claims if provided
    if (options.claims) {
      const credentialClaims: NonNullable<OfferRequestDto['credentialClaims']> = {};
      // For simplicity, we use inline claims
      for (const [configId, claims] of Object.entries(options.claims)) {
        // The API expects a specific structure
        credentialClaims[configId] = {
          type: 'inline',
          claims,
        };
      }
      body.credentialClaims = credentialClaims;
    }

    const response = await credentialOfferControllerGetOffer({
      body,
    });

    if (!response.data) {
      throw new Error('Failed to create issuance offer');
    }

    return {
      uri: response.data.uri,
      sessionId: response.data.session,
    };
  }

  /**
   * Create a presentation request (for verification).
   *
   * Returns two URIs:
   * - `uri`: For same-device flow (wallet on same device, redirect after completion)
   * - `crossDeviceUri`: For cross-device flow (QR code, no redirect, poll for status)
   *
   * @example Same-device flow (wallet app on user's device)
   * ```typescript
   * const { uri, sessionId } = await client.createPresentationRequest({
   *   configId: 'age-over-18',
   *   redirectUri: 'https://example.com/callback'
   * });
   * // Redirect user to uri - wallet will redirect back after completion
   * window.location.href = uri;
   * ```
   *
   * @example Cross-device flow (QR code scanned by separate device)
   * ```typescript
   * const { crossDeviceUri, sessionId } = await client.createPresentationRequest({
   *   configId: 'age-over-18'
   * });
   * // Display crossDeviceUri as QR code, then poll for completion
   * const session = await client.waitForSession(sessionId);
   * ```
   */
  async createPresentationRequest(options: PresentationRequestOptions): Promise<OfferResult> {
    await this.ensureAuthenticated();

    const body: PresentationRequest = {
      response_type: options.responseType ?? 'uri',
      requestId: options.configId,
      redirectUri: options.redirectUri,
    };

    const response = await verifierOfferControllerGetOffer({
      body,
    });

    if (!response.data) {
      throw new Error('Failed to create presentation request');
    }

    return {
      uri: response.data.uri,
      crossDeviceUri: response.data.crossDeviceUri ?? response.data.uri,
      sessionId: response.data.session,
    };
  }

  /**
   * Get the current health of the EUDIPLO connector.
   * The status in the response is `ok`/`error`.
   * The health of the components is listed in the response under `info`/`error`/`details`.
   * If the EUDIPLO connector itself is unreachable, no components are listed.
   */
  async getHealth(): Promise<Record<string, unknown>> {
    const fetchFn = this.config.fetch ?? globalThis.fetch;
    const res = await fetchFn(`${this.config.baseUrl}/health`);

    if (!res.ok) {
      return { status: 'error' };
    }

    return res.json();
  }

  /**
   * Get the current status of a session.
   */
  async getSession(sessionId: string): Promise<Session> {
    await this.ensureAuthenticated();

    const response = await sessionControllerGetSession({
      path: { id: sessionId },
    });

    if (!response.data) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return response.data;
  }

  /**
   * Wait for a session to complete (polling).
   *
   * @example
   * ```typescript
   * const session = await client.waitForSession(sessionId, {
   *   interval: 1000,
   *   timeout: 60000,
   *   onUpdate: (s) => console.log('Status:', s.status)
   * });
   * ```
   */
  async waitForSession(
    sessionId: string,
    options: SessionPollingOptions = {}
  ): Promise<Session> {
    const {
      interval = 1000,
      timeout = 300000,
      onUpdate,
      signal,
    } = options;

    const startTime = Date.now();

    while (true) {
      // Check for abort
      if (signal?.aborted) {
        throw new Error('Session polling aborted');
      }

      // Check for timeout
      if (Date.now() - startTime > timeout) {
        throw new Error(`Session polling timed out after ${timeout}ms`);
      }

      const session = await this.getSession(sessionId);

      if (onUpdate) {
        onUpdate(session);
      }

      // Check terminal states
      if (session.status === 'completed') {
        return session;
      }

      if (session.status === 'expired' || session.status === 'failed') {
        throw new Error(`Session ${session.status}: ${sessionId}`);
      }

      // Wait before next poll
      await this.sleep(interval, signal);
    }
  }

  /**
   * Helper to sleep with abort support
   */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, ms);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Aborted'));
        }, { once: true });
      }
    });
  }

  /**
   * Subscribe to real-time session status updates via Server-Sent Events.
   *
   * This is more efficient than polling and provides instant updates.
   * The connection remains open until closed or the session reaches a terminal state.
   *
   * @example
   * ```typescript
   * const subscription = await client.subscribeToSession(sessionId, {
   *   onStatusChange: (event) => {
   *     console.log(`Status: ${event.status}`);
   *     if (['completed', 'expired', 'failed'].includes(event.status)) {
   *       subscription.close();
   *     }
   *   },
   *   onError: (error) => console.error('SSE error:', error)
   * });
   *
   * // Later, to close the connection:
   * subscription.close();
   * ```
   */
  async subscribeToSession(
    sessionId: string,
    options: SessionSubscriptionOptions = {}
  ): Promise<SessionSubscription> {
    await this.ensureAuthenticated();

    const token = this.accessToken;
    if (!token) {
      throw new Error('No access token available');
    }

    // Check if EventSource is available (browser environment)
    if (typeof EventSource === 'undefined') {
      throw new Error(
        'EventSource is not available in this environment. ' +
        'Use polling with waitForSession() instead, or provide a polyfill.'
      );
    }

    const url = `${this.config.baseUrl}/session/${sessionId}/events?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      options.onOpen?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SessionStatusEvent;
        options.onStatusChange?.(data);
      } catch (error) {
        options.onError?.(new Error(`Failed to parse SSE event: ${error}`));
      }
    };

    eventSource.onerror = () => {
      // EventSource automatically reconnects, but we report the error
      options.onError?.(new Error('SSE connection error'));
    };

    return {
      close: () => eventSource.close(),
    };
  }

  /**
   * Subscribe to session and wait for completion via SSE.
   *
   * Returns a Promise that resolves when the session completes,
   * or rejects if it fails/expires.
   *
   * @example
   * ```typescript
   * try {
   *   const finalStatus = await client.waitForSessionWithSse(sessionId);
   *   console.log('Session completed:', finalStatus);
   * } catch (error) {
   *   console.error('Session failed:', error);
   * }
   * ```
   */
  async waitForSessionWithSse(
    sessionId: string,
    options: Pick<SessionSubscriptionOptions, 'onStatusChange'> = {}
  ): Promise<SessionStatusEvent> {
    return new Promise(async (resolve, reject) => {
      try {
        const subscription = await this.subscribeToSession(sessionId, {
          onStatusChange: (event) => {
            options.onStatusChange?.(event);

            if (event.status === 'completed') {
              subscription.close();
              resolve(event);
            } else if (event.status === 'expired' || event.status === 'failed') {
              subscription.close();
              reject(new Error(`Session ${event.status}: ${sessionId}`));
            }
          },
          onError: (error) => {
            // Don't reject on SSE errors as EventSource reconnects automatically
            // Only log or pass to caller's handler
            console.warn('SSE connection error, reconnecting...', error);
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get the current access token (for advanced usage)
   */
  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  /**
   * Get the configured base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  // ==========================================================================
  // Digital Credentials API Methods
  // ==========================================================================

  /**
   * Create a presentation request configured for DC API usage.
   * Returns a session with the signed request object needed for DC API.
   *
   * @example
   * ```typescript
   * const session = await client.createDcApiPresentationRequest({
   *   configId: 'age-over-18'
   * });
   *
   * // Use the requestObject with the DC API
   * const result = await client.submitDcApiPresentation(session);
   * ```
   */
  async createDcApiPresentationRequest(
    options: Omit<PresentationRequestOptions, 'responseType'>
  ): Promise<Session> {
    await this.ensureAuthenticated();

    const body: PresentationRequest = {
      response_type: 'dc-api',
      requestId: options.configId,
      redirectUri: options.redirectUri,
    };

    const response = await verifierOfferControllerGetOffer({
      body,
    });

    if (!response.data) {
      throw new Error('Failed to create DC API presentation request');
    }

    // Fetch the full session to get the requestObject
    return this.getSession(response.data.session);
  }

  /**
   * Submit a presentation using the Digital Credentials API.
   * This method handles the browser DC API call and submits the response to the verifier.
   *
   * @example
   * ```typescript
   * // Check if DC API is available
   * if (!isDcApiAvailable()) {
   *   throw new Error('DC API not supported in this browser');
   * }
   *
   * const session = await client.createDcApiPresentationRequest({
   *   configId: 'age-over-18'
   * });
   *
   * const result = await client.submitDcApiPresentation(session);
   * console.log('Verified credentials:', result.credentials);
   * ```
   */
  async submitDcApiPresentation(
    session: Session,
    options: DcApiPresentationOptions = {}
  ): Promise<DcApiPresentationResult> {
    if (!isDcApiAvailable()) {
      throw new Error(
        'Digital Credentials API is not available in this browser. ' +
          'Please use a supported browser or fall back to QR code flow.'
      );
    }

    if (!session.requestObject) {
      throw new Error(
        'Session does not contain a requestObject. ' +
          'Make sure to create the session with response_type: "dc-api"'
      );
    }

    // Call the Digital Credentials API
    const dcResponse = (await navigator.credentials.get({
      mediation: 'required',
      digital: {
        requests: [
          {
            protocol: 'openid4vp-v1-signed',
            data: { request: session.requestObject },
          },
        ],
      },
    } as CredentialRequestOptions)) as DigitalCredentialResponse | null;

    if (!dcResponse) {
      throw new Error('No response from Digital Credentials API');
    }

    if (dcResponse.data?.error) {
      throw new Error(
        `Wallet error: ${dcResponse.data.error}${
          dcResponse.data.error_description
            ? ` - ${dcResponse.data.error_description}`
            : ''
        }`
      );
    }

    // Extract response_uri from the request object
    const requestPayload = decodeJwtPayload<{ response_uri?: string }>(
      session.requestObject
    );

    if (!requestPayload.response_uri) {
      throw new Error('No response_uri found in request object');
    }

    // Submit the response to the verifier
    const fetchImpl = this.config.fetch ?? fetch;
    const submitResponse = await fetchImpl(requestPayload.response_uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...dcResponse.data,
        sendResponse: options.sendResponse ?? true,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(
        `Failed to submit presentation: ${submitResponse.status} ${errorText}`
      );
    }

    const result = await submitResponse.json();

    return {
      credentials: result.credentials ?? result,
      response: result,
      redirectUri: result.redirect_uri,
    };
  }

  /**
   * Convenience method to create a presentation request and immediately
   * submit it using the Digital Credentials API.
   *
   * @example
   * ```typescript
   * const result = await client.verifyWithDcApi({
   *   configId: 'age-over-18'
   * });
   * console.log('Verified:', result.credentials);
   * ```
   */
  async verifyWithDcApi(
    options: Omit<PresentationRequestOptions, 'responseType'>,
    dcOptions: DcApiPresentationOptions = {}
  ): Promise<DcApiPresentationResult> {
    const session = await this.createDcApiPresentationRequest(options);
    return this.submitDcApiPresentation(session, dcOptions);
  }
}

// ============================================================================
// Simple Factory Functions - For the easiest possible integration
// ============================================================================

/**
 * Credentials for EUDIPLO authentication
 */
export interface EudiploCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Options for the verify function
 */
export interface VerifyOptions extends EudiploCredentials {
  /** Presentation configuration ID */
  configId: string;
  /** Optional redirect URI */
  redirectUri?: string;
  /** Polling options */
  polling?: SessionPollingOptions;
}

/**
 * Options for the issue function
 */
export interface IssueOptions extends EudiploCredentials {
  /** Credential configuration IDs */
  credentialConfigurationIds: string[];
  /** Claims per credential config */
  claims?: Record<string, Record<string, unknown>>;
  /** Transaction code (optional) */
  txCode?: string;
  /** Polling options */
  polling?: SessionPollingOptions;
}

/**
 * Result of a verification or issuance flow
 */
export interface FlowResult {
  /** URI for QR code */
  uri: string;
  /** Session ID */
  sessionId: string;
  /** Wait for the session to complete */
  waitForCompletion: (options?: SessionPollingOptions) => Promise<Session>;
  /** Get current session status */
  getStatus: () => Promise<Session>;
}

/**
 * Create a presentation request for verification.
 * Returns a URI for QR code and a function to wait for completion.
 *
 * @example
 * ```typescript
 * import { verify } from '@eudiplo/sdk-core';
 *
 * const { uri, waitForCompletion } = await verify({
 *   baseUrl: 'https://eudiplo.example.com',
 *   clientId: 'demo',
 *   clientSecret: 'secret',
 *   configId: 'age-over-18'
 * });
 *
 * console.log('Scan this:', uri);
 * const session = await waitForCompletion();
 * console.log('Verified!', session.credentials);
 * ```
 */
export async function verify(options: VerifyOptions): Promise<FlowResult> {
  const client = new EudiploClient({
    baseUrl: options.baseUrl,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
  });

  const { uri, sessionId } = await client.createPresentationRequest({
    configId: options.configId,
    redirectUri: options.redirectUri,
  });

  // same device uri
  const sameDeviceUri = uri;
  const crossDeviceUri = `${uri}`;

  return {
    uri,
    sessionId,
    waitForCompletion: (pollingOptions?: SessionPollingOptions) =>
      client.waitForSession(sessionId, { ...options.polling, ...pollingOptions }),
    getStatus: () => client.getSession(sessionId),
  };
}

/**
 * Create a credential issuance offer.
 * Returns a URI for QR code and a function to wait for completion.
 *
 * @example
 * ```typescript
 * import { issue } from '@eudiplo/sdk-core';
 *
 * const { uri, waitForCompletion } = await issue({
 *   baseUrl: 'https://eudiplo.example.com',
 *   clientId: 'demo',
 *   clientSecret: 'secret',
 *   credentialConfigurationIds: ['PID'],
 *   claims: {
 *     PID: { given_name: 'John', family_name: 'Doe' }
 *   }
 * });
 *
 * console.log('Scan this:', uri);
 * const session = await waitForCompletion();
 * ```
 */
export async function issue(options: IssueOptions): Promise<FlowResult> {
  const client = new EudiploClient({
    baseUrl: options.baseUrl,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
  });

  const { uri, sessionId } = await client.createIssuanceOffer({
    credentialConfigurationIds: options.credentialConfigurationIds,
    claims: options.claims,
    txCode: options.txCode,
  });

  return {
    uri,
    sessionId,
    waitForCompletion: (pollingOptions?: SessionPollingOptions) =>
      client.waitForSession(sessionId, { ...options.polling, ...pollingOptions }),
    getStatus: () => client.getSession(sessionId),
  };
}

/**
 * One-liner: Verify and wait for result in a single call.
 *
 * @example
 * ```typescript
 * import { verifyAndWait } from '@eudiplo/sdk-core';
 *
 * const session = await verifyAndWait({
 *   baseUrl: 'https://eudiplo.example.com',
 *   clientId: 'demo',
 *   clientSecret: 'secret',
 *   configId: 'age-over-18',
 *   onUri: (uri) => showQRCode(uri),
 *   onUpdate: (s) => console.log('Status:', s.status)
 * });
 * ```
 */
export async function verifyAndWait(
  options: VerifyOptions & {
    /** Called with the URI when available - use to display QR code */
    onUri: (uri: string) => void;
  }
): Promise<Session> {
  const { uri, waitForCompletion } = await verify(options);
  options.onUri(uri);
  return waitForCompletion(options.polling);
}

/**
 * One-liner: Issue credential and wait for completion in a single call.
 *
 * @example
 * ```typescript
 * import { issueAndWait } from '@eudiplo/sdk-core';
 *
 * const session = await issueAndWait({
 *   baseUrl: 'https://eudiplo.example.com',
 *   clientId: 'demo',
 *   clientSecret: 'secret',
 *   credentialConfigurationIds: ['PID'],
 *   claims: { PID: { given_name: 'John' } },
 *   onUri: (uri) => showQRCode(uri)
 * });
 * ```
 */
export async function issueAndWait(
  options: IssueOptions & {
    /** Called with the URI when available - use to display QR code */
    onUri: (uri: string) => void;
  }
): Promise<Session> {
  const { uri, waitForCompletion } = await issue(options);
  options.onUri(uri);
  return waitForCompletion(options.polling);
}

// ============================================================================
// Digital Credentials API Factory Functions
// ============================================================================

/**
 * Options for DC API verification
 */
export interface DcApiVerifyOptions extends EudiploCredentials {
  /** Presentation configuration ID */
  configId: string;
  /** Optional redirect URI */
  redirectUri?: string;
  /** Whether to return full credential data (default: true) */
  sendResponse?: boolean;
}

/**
 * Verify a credential using the Digital Credentials API (browser-native flow).
 * This is the simplest way to verify credentials when the DC API is available.
 *
 * @example
 * ```typescript
 * import { verifyWithDcApi, isDcApiAvailable } from '@eudiplo/sdk-core';
 *
 * if (isDcApiAvailable()) {
 *   const result = await verifyWithDcApi({
 *     baseUrl: 'https://eudiplo.example.com',
 *     clientId: 'demo',
 *     clientSecret: 'secret',
 *     configId: 'age-over-18'
 *   });
 *   console.log('Verified!', result.credentials);
 * } else {
 *   // Fall back to QR code flow
 *   const { uri } = await verify({ ... });
 * }
 * ```
 */
export async function verifyWithDcApi(
  options: DcApiVerifyOptions
): Promise<DcApiPresentationResult> {
  const eudiploClient = new EudiploClient({
    baseUrl: options.baseUrl,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
  });

  return eudiploClient.verifyWithDcApi(
    {
      configId: options.configId,
      redirectUri: options.redirectUri,
    },
    {
      sendResponse: options.sendResponse,
    }
  );
}

/**
 * Create a presentation request for DC API and get the session.
 * Use this when you need more control over the DC API flow.
 *
 * @example
 * ```typescript
 * import { createDcApiRequest, submitDcApiPresentation, isDcApiAvailable } from '@eudiplo/sdk-core';
 *
 * if (isDcApiAvailable()) {
 *   const { session, submit } = await createDcApiRequest({
 *     baseUrl: 'https://eudiplo.example.com',
 *     clientId: 'demo',
 *     clientSecret: 'secret',
 *     configId: 'age-over-18'
 *   });
 *
 *   // Show some UI, then submit when user is ready
 *   const result = await submit();
 *   console.log('Verified!', result.credentials);
 * }
 * ```
 */
export async function createDcApiRequest(
  options: DcApiVerifyOptions
): Promise<{
  session: Session;
  submit: (dcOptions?: DcApiPresentationOptions) => Promise<DcApiPresentationResult>;
}> {
  const eudiploClient = new EudiploClient({
    baseUrl: options.baseUrl,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
  });

  const session = await eudiploClient.createDcApiPresentationRequest({
    configId: options.configId,
    redirectUri: options.redirectUri,
  });

  return {
    session,
    submit: (dcOptions?: DcApiPresentationOptions) =>
      eudiploClient.submitDcApiPresentation(session, {
        sendResponse: options.sendResponse,
        ...dcOptions,
      }),
  };
}

// ============================================================================
// Server/Client Split Helper Functions
// ============================================================================
// These functions help when you need to keep credentials on your server
// but call the DC API from the browser.

/**
 * Data returned from server to browser for DC API flow
 */
export interface DcApiRequestData {
  /** The signed JWT request object to pass to the DC API */
  requestObject: string;
  /** Session ID for tracking */
  sessionId: string;
  /** The response_uri where wallet responses should be submitted */
  responseUri: string;
}

/**
 * Wallet response data from the DC API to send back to server
 */
export interface DcApiWalletResponse {
  /** The encrypted VP token response from the wallet */
  response?: string;
  /** Error code if the wallet returned an error */
  error?: string;
  /** Error description if available */
  error_description?: string;
}

/**
 * SERVER-SIDE: Create a DC API request and return the data needed by the browser.
 * Use this on your server where credentials are stored securely.
 *
 * @example
 * ```typescript
 * // On your server (e.g., Express/Next.js API route)
 * import { createDcApiRequestForBrowser } from '@eudiplo/sdk-core';
 *
 * app.post('/api/start-verification', async (req, res) => {
 *   const requestData = await createDcApiRequestForBrowser({
 *     baseUrl: 'https://eudiplo.example.com',
 *     clientId: process.env.EUDIPLO_CLIENT_ID,     // Safe on server
 *     clientSecret: process.env.EUDIPLO_SECRET,   // Safe on server
 *     configId: 'age-over-18',
 *   });
 *
 *   // Send only the safe data to the browser
 *   res.json(requestData);
 * });
 * ```
 */
export async function createDcApiRequestForBrowser(
  options: DcApiVerifyOptions
): Promise<DcApiRequestData> {
  const eudiploClient = new EudiploClient({
    baseUrl: options.baseUrl,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
  });

  const session = await eudiploClient.createDcApiPresentationRequest({
    configId: options.configId,
    redirectUri: options.redirectUri,
  });

  if (!session.requestObject) {
    throw new Error('Session does not contain a requestObject');
  }

  // Extract response_uri from the signed JWT
  const requestPayload = decodeJwtPayload<{ response_uri?: string }>(
    session.requestObject
  );

  if (!requestPayload.response_uri) {
    throw new Error('No response_uri found in request object');
  }

  return {
    requestObject: session.requestObject,
    sessionId: session.id,
    responseUri: requestPayload.response_uri,
  };
}

/**
 * BROWSER-SIDE: Call the Digital Credentials API with a request from your server.
 * This function runs in the browser and invokes the native DC API.
 *
 * @example
 * ```typescript
 * // In your browser code
 * import { callDcApi, isDcApiAvailable } from '@eudiplo/sdk-core';
 *
 * // Get request data from your server
 * const requestData = await fetch('/api/start-verification', { method: 'POST' })
 *   .then(r => r.json());
 *
 * if (isDcApiAvailable()) {
 *   // This calls the browser's native Digital Credentials API
 *   const walletResponse = await callDcApi(requestData.requestObject);
 *
 *   // Send the wallet response back to your server for verification
 *   const result = await fetch('/api/complete-verification', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       sessionId: requestData.sessionId,
 *       walletResponse,
 *     }),
 *   }).then(r => r.json());
 * }
 * ```
 */
export async function callDcApi(
  requestObject: string
): Promise<DcApiWalletResponse> {
  if (!isDcApiAvailable()) {
    throw new Error(
      'Digital Credentials API is not available in this browser. ' +
        'Please use a supported browser or fall back to QR code flow.'
    );
  }

  const dcResponse = (await navigator.credentials.get({
    mediation: 'required',
    digital: {
      requests: [
        {
          protocol: 'openid4vp-v1-signed',
          data: { request: requestObject },
        },
      ],
    },
  } as CredentialRequestOptions)) as DigitalCredentialResponse | null;

  if (!dcResponse) {
    throw new Error('No response from Digital Credentials API');
  }

  if (dcResponse.data?.error) {
    throw new Error(
      `Wallet error: ${dcResponse.data.error}${
        dcResponse.data.error_description
          ? ` - ${dcResponse.data.error_description}`
          : ''
      }`
    );
  }

  return dcResponse.data;
}

/**
 * SERVER-SIDE: Submit the wallet response to EUDIPLO and get verified credentials.
 * Use this on your server after receiving the wallet response from the browser.
 *
 * @example
 * ```typescript
 * // On your server
 * import { submitDcApiWalletResponse } from '@eudiplo/sdk-core';
 *
 * app.post('/api/complete-verification', async (req, res) => {
 *   const { sessionId, walletResponse } = req.body;
 *
 *   // You stored the responseUri when creating the request, or pass it from client
 *   const result = await submitDcApiWalletResponse({
 *     responseUri: storedResponseUri,  // or from request
 *     walletResponse,
 *     sendResponse: true,  // Get verified claims back
 *   });
 *
 *   // result.credentials contains the verified data
 *   res.json(result);
 * });
 * ```
 */
export async function submitDcApiWalletResponse(options: {
  /** The response_uri from the request (from DcApiRequestData.responseUri) */
  responseUri: string;
  /** The wallet response from callDcApi() */
  walletResponse: DcApiWalletResponse;
  /** Whether to return full credential data (default: true) */
  sendResponse?: boolean;
  /** Custom fetch implementation (optional) */
  fetch?: typeof fetch;
}): Promise<DcApiPresentationResult> {
  const fetchImpl = options.fetch ?? fetch;

  const submitResponse = await fetchImpl(options.responseUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...options.walletResponse,
      sendResponse: options.sendResponse ?? true,
    }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(
      `Failed to submit presentation: ${submitResponse.status} ${errorText}`
    );
  }

  const result = await submitResponse.json();

  return {
    credentials: result.credentials ?? result,
    response: result,
    redirectUri: result.redirect_uri,
  };
}