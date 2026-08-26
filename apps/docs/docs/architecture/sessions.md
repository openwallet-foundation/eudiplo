---
title: Sessions
---

# Sessions

EUDIPLO tracks **issuance** and **verification** sessions to correlate multi-step protocol flows, enforce security policies, and maintain audit logs. Sessions are ephemeral state records that exist only while a credential flow is active.

## OID4VP Security Fields

Each verification session includes security fields defined by the OpenID4VP specification (§13.3):

| Field          | Purpose                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `walletNonce`  | Wallet-facing nonce, included in presentation requests                                               |
| `sessionId`    | Internal correlation ID, never exposed to the wallet                                                 |
| `nonce`        | Server-side replay prevention nonce (deprecated in favor of `walletNonce` for clarity)               |
| `state`        | Same-device state parameter (optional, for redirect-based flows)                                     |
| `responseCode` | One-time code for same-device redirect flow (appended to `redirect_uri` to prevent session fixation) |

**Security Rationale:**

- `walletNonce` is the ONLY nonce value sent to the wallet and included in VP tokens
- `sessionId` remains internal and is used only for backend correlation (e.g., mapping to `response_code`)
- This separation prevents session fixation attacks where an attacker could substitute their own session identifier

For technical background, see [OID4VP §13.3 (Security Considerations)](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-session-identifier-separati).

## Single-Use Validation

All sessions enforce **single-use** semantics:

- Once a credential is issued or a presentation is verified, the session is marked as completed
- Subsequent attempts using the same session identifier are rejected with `invalid_grant` or `invalid_request`
- This prevents replay attacks and credential duplication

## Session Cleanup

Sessions are automatically cleaned up after expiration or completion. EUDIPLO supports two cleanup modes:

### Full Deletion

Removes the session record entirely from the database:

```typescript
await this.sessionRepository.delete({ id: sessionId });
```

**Use when:** Ephemeral flows (e.g., one-time presentations) where no audit trail is required.

### Anonymization

Preserves the session record but removes PII and credential claims:

```typescript
await this.sessionRepository.update(sessionId, {
    anonymizedAt: new Date(),
    credentialClaims: null,
    presentedCredentials: null,
    // ... nullify all sensitive fields
});
```

**Use when:** Audit compliance requires retention of flow metadata (timestamps, protocol details) but not credential data.

## Per-Tenant Configuration

Session cleanup is configured per-tenant via the tenant configuration:

```json
{
    "sessionConfig": {
        "cleanupMode": "anonymize",
        "retentionDays": 90
    }
}
```

| Field           | Type                      | Default    | Description                                      |
| --------------- | ------------------------- | ---------- | ------------------------------------------------ |
| `cleanupMode`   | `"delete" \| "anonymize"` | `"delete"` | Whether to fully delete or anonymize sessions    |
| `retentionDays` | `number`                  | `30`       | Days to retain completed sessions before cleanup |

**Note:** The cleanup cron runs hourly and processes sessions older than `retentionDays` since completion.

## Session Logs

Session events (authorization, token exchange, credential issuance, presentation submission) are logged using the PinoLogger:

```typescript
this.logger.log(`Credential issued for session ${sessionId}`, {
    sessionId,
    credentialType,
    format,
});
```

Logs include correlation IDs and are exportable to SIEM systems via OpenTelemetry or log aggregators.

## Global Configuration

import ConfigTable from "@site/src/components/ConfigTable";

<ConfigTable group="session" />
