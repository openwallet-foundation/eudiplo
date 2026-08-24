---
title: Handling Results
---

After creating a presentation request, you need to retrieve the verified claims and determine whether the presentation succeeded. EUDIPLO provides multiple methods for tracking session status and accessing results.

## Overview

EUDIPLO offers two primary methods for handling presentation results:

1. **Webhooks** — Receive asynchronous callbacks when presentations complete (recommended for production)
2. **Polling/SSE** — Query session status or subscribe to real-time updates

## Webhooks (Recommended)

Configure webhooks in your presentation configuration or override them at request time to receive verified claims automatically when the presentation completes.

```json
{
    "id": "pid-verification",
    "dcql_query": { ... },
    "webhook": {
        "url": "https://verifier.example.com/presentation-callback",
        "auth": {
            "type": "apiKey",
            "value": "your-api-key"
        }
    }
}
```

When the presentation completes, EUDIPLO sends a POST request to your webhook URL with the verified claims.

For details on webhook configuration, authentication types, and request format, see [Webhooks](../architecture/extension-points/webhooks.md#presentation-webhook).

## Session Status

Sessions track the presentation request lifecycle from creation through completion or expiration.

### Session States

| Status      | Description                                         |
| ----------- | --------------------------------------------------- |
| `active`    | Session created, waiting for wallet interaction     |
| `fetched`   | Presentation request fetched by wallet              |
| `completed` | Session successfully completed with verified claims |
| `expired`   | Session expired before completion                   |
| `failed`    | Session failed due to an error                      |

### Retrieving Session Status

Query the session status endpoint:

```http
GET /session/{sessionId}
Authorization: Bearer YOUR_JWT_TOKEN
```

Response:

```json
{
    "id": "session-uuid",
    "status": "completed",
    "type": "presentation",
    "createdAt": "2026-01-25T12:00:00.000Z",
    "updatedAt": "2026-01-25T12:01:00.000Z",
    "consumedAt": "2026-01-25T12:01:00.000Z",
    "verifiedClaims": {
        "pid-mso-mdoc": {
            "given_name": "Jane",
            "family_name": "Doe",
            "age_over_18": true
        }
    }
}
```

## Real-Time Updates (Server-Sent Events)

For real-time session status updates, subscribe to the SSE endpoint:

```
GET /session/{sessionId}/events?token=JWT_TOKEN
```

### Authentication

The SSE endpoint requires JWT authentication via a query parameter. This is because the browser's `EventSource` API does not support custom headers.

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| `id`      | string | Yes      | The session ID to subscribe to |
| `token`   | string | Yes      | Valid JWT access token         |

### Response Format

The endpoint returns a stream of Server-Sent Events. Each event contains:

```json
{
    "id": "session-uuid",
    "status": "active|fetched|completed|expired|failed",
    "updatedAt": "2024-01-15T12:00:00.000Z"
}
```

### JavaScript Example

```javascript
// Get a valid JWT token first
const token = await getAccessToken();

// Create EventSource with token as query parameter
const eventSource = new EventSource(
    `/session/${sessionId}/events?token=${token}`,
);

// Handle incoming status updates
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(`Session ${data.id} status: ${data.status}`);

    // Close connection when session reaches terminal state
    if (["completed", "expired", "failed"].includes(data.status)) {
        eventSource.close();

        // Fetch final result if completed
        if (data.status === "completed") {
            fetchSessionResult(data.id);
        }
    }
};

// Handle connection errors
eventSource.onerror = (error) => {
    console.error("SSE connection error:", error);
    eventSource.close();
};
```

### Connection Behavior

- **Initial Event**: Upon connection, the endpoint immediately sends the current session status.
- **Auto-reconnect**: Browsers automatically reconnect if the connection drops.
- **Keep-alive**: The server maintains the connection until the client disconnects or the session reaches a terminal state.

## Same-Device Redirect Flows

For same-device flows that use a `redirect_uri`, EUDIPLO generates a one-time `response_code` and appends it to the redirect URI after the wallet submits its response.

The verifier's frontend receives this code via the redirect and uses it to retrieve the session result. This ensures the browser that initiated the flow is the same one that receives the result.

:::warning[Same-device flows with redirect]
For same-device flows that use a `redirect_uri`, the `response_code` is the **only safe way** to retrieve the session result. The verifier must extract it from the redirect URL and use it to look up the completed session.
:::

Example redirect:

```
https://verifier.example.com/callback?response_code=abc123
```

The frontend extracts `response_code` and queries:

```http
GET /session/by-code/{response_code}
Authorization: Bearer YOUR_JWT_TOKEN
```

## Single-Use Enforcement

All presentation requests are **single-use and non-replayable**. Once a wallet submits a presentation response:

- The request is marked as consumed
- `consumedAt` timestamp records when the request was first used
- Any subsequent attempts to submit presentations for the same request are rejected with `400 Bad Request`

This prevents presentation request replay attacks where an attacker could reuse an intercepted request to submit fraudulent credentials.

## Session Cleanup

Sessions are automatically cleaned up based on tenant-specific retention policies. You can configure:

- **TTL (Time-to-Live)**: How long completed/expired sessions are retained
- **Cleanup Mode**:
    - `full` (default): Deletes the entire session record
    - `anonymize`: Keeps metadata (ID, status, timestamps) but removes personal data

For details on session cleanup configuration, see [Sessions](../architecture/sessions.md#session-cleanup).

## Security Considerations

### Direct Post Security Model (OID4VP §13.3)

EUDIPLO implements the `direct_post.jwt` response mode with the full security model defined in [OID4VP Section 13.3](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-13.3). This model separates identifiers across different actors to prevent session fixation and cross-reference attacks.

**Key security fields:**

| Identifier      | Purpose                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `session.id`    | Internal (backend / verifier) session identifier — never exposed to the wallet                           |
| `walletNonce`   | Wallet-facing identifier used as `state` in the authorization request — cannot be linked to `session.id` |
| `nonce`         | Binds the VP Token to this specific request — prevents replay attacks                                    |
| `response_code` | One-time code appended to `redirect_uri` during same-device redirect — prevents session fixation         |

### Best Practices

1. **Use webhooks for production** — More reliable than polling for asynchronous flows
2. **Validate session state** — Check `status: "completed"` before trusting verified claims
3. **Close SSE connections** — Always close `EventSource` when session reaches terminal state
4. **Handle timeouts** — Set appropriate timeout values and handle expired sessions gracefully
5. **Use response_code safely** — For same-device flows, only use `response_code` from the redirect
6. **Implement token refresh** — Ensure JWT tokens have sufficient lifetime for expected session duration

## Error Responses

### Session Endpoint Errors

| Status Code | Description                  |
| ----------- | ---------------------------- |
| 401         | Missing or invalid JWT token |
| 404         | Session not found            |

### SSE Endpoint Errors

| Status Code | Description                  |
| ----------- | ---------------------------- |
| 401         | Missing or invalid JWT token |
| 404         | Session not found            |

## Related Documentation

- [Webhooks](../architecture/extension-points/webhooks.md) — Webhook integration patterns
- [Sessions](../architecture/sessions.md) — Session lifecycle and cleanup
- [Presentation Configuration](presentation-configuration.md) — Configuring webhooks
- [Presentation Requests](presentation-requests.md) — Creating requests and redirect URIs
- [API Reference](../reference/openapi.md) — Session API endpoints
