# Sessions Management

EUDIPLO manages sessions for credential issuance and verification, bound
to each tenant. When using the [Interactive Authorization Endpoint (IAE)](./iae.md),
the session tracks the multi-step authorization flow, including completed steps
and collected data. Sessions are stored in the database and can be
managed via the `/api/sessions` endpoint. You can retrieve a specific session via
`/api/sessions/{id}`.

## Session Cleanup

To tidy up old sessions, an interval is set to clean up older sessions. The
cleanup behavior can be configured both globally (via environment variables) and
per-tenant (via the Session Config API or the client UI).

Other elements like persisted status mapping (the binding between a session ID
and a status list reference) are not deleted with this process.

## OID4VP Security Fields

For OID4VP presentation sessions, EUDIPLO stores additional fields that
implement the security model defined in
[OID4VP §13.3](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-13.3):

| Field                              | Type               | Description                                                                                                                                                                           |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `walletNonce`                      | `string \| null`   | Wallet-facing identifier used as `state` in the authorization request. Separates the wallet's view of the session from the internal `session.id`, preventing cross-reference attacks. |
| `responseCode`                     | `string \| null`   | One-time code generated when the wallet submits its response. Appended to the `redirect_uri` for same-device flows to prevent session fixation on redirect.                           |
| `responseCodeHash`                 | `string \| null`   | SHA-256 hash used to validate RP result retrieval without persisting only plaintext response-code material.                                                                           |
| `responseCodeExpiresAt`            | `datetime \| null` | Expiration timestamp for the one-time response code.                                                                                                                                  |
| `responseCodeConsumedAt`           | `datetime \| null` | Set after a successful `/session/{id}/result?response_code=...` lookup to enforce single-use retrieval.                                                                               |
| `presentationFailureCode`          | `string \| null`   | Stable machine-readable failure code returned to RPs via `/session/{id}/result`.                                                                                                      |
| `presentationFailureProtocolError` | `string \| null`   | Optional allow-listed wallet protocol error (for example `access_denied`) for `wallet_error` outcomes.                                                                                |

These fields are populated automatically during OID4VP processing and are **not
exposed** through the ordinary session management API (`/api/session/{id}`). They
exist solely for wallet/RP protocol flow handling.

## OID4VP Failure Codes

When an OID4VP presentation fails, the RP-facing result endpoint returns a
stable machine-readable failure code. These codes are intentionally separate
from wallet protocol errors so the verifier can distinguish transport-level
wallet responses from presentation-level outcomes.

| Code                                      | Meaning                                                               |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `wallet_error`                            | The wallet returned an OID4VP protocol error such as `access_denied`. |
| `credential_status_invalid`               | A credential status check failed.                                     |
| `credential_expired`                      | A credential is expired.                                              |
| `credential_not_yet_valid`                | A credential is not yet valid.                                        |
| `issuer_not_trusted`                      | The issuer chain could not be trusted.                                |
| `holder_binding_failed`                   | Holder binding verification failed.                                   |
| `presentation_requirements_not_satisfied` | The presentation did not satisfy the configured requirements.         |
| `response_invalid`                        | The wallet response could not be parsed or validated.                 |
| `session_expired`                         | The presentation session expired before completion.                   |
| `replay_detected`                         | The response was already consumed or replayed.                        |
| `verification_failed`                     | Generic verification failure when no more specific code applies.      |
| `internal_error`                          | An unexpected internal error occurred.                                |

For `wallet_error`, the RP-facing result may also include an allow-listed
`protocolError` value such as `access_denied` or `temporarily_unavailable`.

For details on how these fields are used in practice, see
[Credential Presentation — Direct Post Security Model](../getting-started/presentation/index.md#direct-post-security-model-oid4vp-133).

## Single-Use Validation

All credential offers (OID4VCI) and presentation requests (OID4VP) are **enforced as single-use** to prevent replay attacks. Once an offer or request is consumed, it cannot be reused:

| Field        | Type               | Description                                         |
| ------------ | ------------------ | --------------------------------------------------- |
| `consumed`   | `boolean`          | Flag indicating if the offer/request has been used  |
| `consumedAt` | `datetime \| null` | Timestamp when the offer/request was first consumed |

### How It Works

**For OID4VCI (Credential Issuance):**

- Token replay with the same authorization or pre-authorized code is rejected with `invalid_grant`
- The session is marked as consumed when the credential endpoint successfully processes the request
- Refresh tokens are exempt and can be renewed

**For OID4VP (Credential Presentation):**

- When a wallet submits a presentation response, the session is marked as consumed
- Any subsequent presentation attempts with the same request are treated as replay attempts
- The wallet-facing response URI still returns HTTP `200` for protocol-level interoperability

### Audit Trail

The `consumedAt` timestamp provides an audit trail for compliance and security monitoring. This allows you to:

- Verify when an offer/request was actually used
- Detect and investigate suspicious patterns (e.g., multiple consumption attempts)
- Maintain security event logs

### Cleanup Modes

EUDIPLO supports two cleanup modes:

- **Full** (default): Deletes the entire session record from the database.
- **Anonymize**: Keeps session metadata (ID, **original status**, timestamps)
  but removes personal data including credentials, credential payloads, auth
  queries, offers, and request objects.

Anonymize mode is useful for audit and compliance scenarios where you need to
retain evidence that a session occurred without storing personal data. The
original session status is preserved, so historical statistics remain accurate.
For real-time monitoring, see the [Monitoring Guide](../getting-started/monitor.md).

## Per-Tenant Configuration

Each tenant can override the global session settings via the `/session-config`
endpoint or through the client UI under **Session Management > Session Config**.

For the full API specification, see the [Session Config API](../api/openapi.md).

### Configuration Options

| Field         | Type     | Description                                                       |
| ------------- | -------- | ----------------------------------------------------------------- |
| `ttlSeconds`  | `number` | Time-to-live in seconds (minimum 60). Omit to use global default. |
| `cleanupMode` | `string` | Either `full` or `anonymize`. Omit to use global default.         |

## Session Logs

Session flow events (e.g. flow start, credential issuance, token exchange,
errors) can optionally be persisted to the database per session. This is
controlled by the `LOG_SESSION_STORE` environment variable — see
[Logging Configuration](../development/logging-configuration.md#session-log-persistence)
for details.

When enabled, logs are available via `GET /api/session/{id}/logs` and are
visible in the Web Client under the **Logs** tab on the session detail page.
The tab only appears when log entries exist for the session.

These session logs are distinct from tenant activity audit logs
(`tenant_action_log`, exposed via `GET /api/admin/audit-logs`), which track
internal management/configuration changes instead of issuance/presentation flow
execution.

## Global Configuration

The global defaults are configured via environment variables:

--8<-- "docs/generated/config-session.md"
