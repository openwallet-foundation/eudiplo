# Presentation Requests

Presentation requests are created with the `/verifier/offer` endpoint. Each
request references a stored presentation configuration and can optionally
override selected runtime values.

Use this page for request payload shape and override behavior. For defining what
to request (DCQL, webhook defaults, registration certificate), see
[Presentation Configuration](presentation-configuration.md).

---

## Endpoint

- `POST /verifier/offer`

---

## Request Fields

| Field              | Required | Description                                                           |
| ------------------ | -------- | --------------------------------------------------------------------- |
| `response_type`    | Yes      | Response mode. Supported values: `uri`, `dc-api`, `iso-18013-7`.      |
| `requestId`        | Yes      | ID of the presentation configuration to use.                          |
| `webhook`          | No       | Inline webhook override for this request.                             |
| `redirectUri`      | No       | Redirect target after completion. Supports `{sessionId}` placeholder. |
| `transaction_data` | No       | Transaction data override for this request.                           |
| `skewSeconds`      | No       | Clock skew override in seconds for credential JWT time validation.    |
| `expected_origin`  | No       | Browser origin for DC API flows. Falls back to the `Origin` header.   |

---

## Basic Example

```json
{
    "response_type": "uri",
    "requestId": "pid-verification"
}
```

## Example with Runtime Overrides

```json
{
    "response_type": "uri",
    "requestId": "pid-verification",
    "webhook": {
        "url": "https://verifier.example.com/presentation-callback",
        "auth": {
            "type": "none"
        }
    },
    "redirectUri": "https://verifier.example.com/callback?session={sessionId}",
    "transaction_data": [
        {
            "type": "access_control",
            "credential_ids": ["pid"],
            "resource": "Building A"
        }
    ],
    "skewSeconds": 60
}
```

---

## Override Rules

When a request provides runtime fields, they override the corresponding values
from the presentation configuration for that session:

- `webhook` overrides configuration `webhook`
- `redirectUri` overrides configuration `redirectUri`
- `transaction_data` overrides configuration `transaction_data`
- `skewSeconds` overrides configuration `skewSeconds`

These values are not merged.

---

## ISO 18013-7 Requests

With `response_type: "iso-18013-7"` the offer targets the `org-iso-mdoc`
protocol of the Digital Credentials API (ISO/IEC TS 18013-7:2025 Annex C).
The referenced presentation configuration must contain an `mso_mdoc`
credential with `meta.doctype_value` set, and `expected_origin` must match
the origin of the page calling `navigator.credentials.get()`.

```json
{
    "response_type": "iso-18013-7",
    "requestId": "pid-verification",
    "expected_origin": "https://verifier.example.com"
}
```

The offer response contains the CBOR structures for the browser instead of a
`request_uri`:

```json
{
    "session": "<uuid>",
    "org_iso_mdoc": {
        "device_request": "<base64url CBOR DeviceRequest>",
        "encryption_info": "<base64url CBOR EncryptionInfo>"
    }
}
```

The browser forwards both values to the wallet via
`navigator.credentials.get()` and posts the encrypted wallet response as
`{ "data": "<base64url>" }` to `POST /presentations/{session}/iso-18013-7`.
Webhook delivery, `redirectUri`, and single-use semantics behave exactly as
in the other flows.

!!! tip "Reader authentication"

    Set [`readerAuth: true`](presentation-configuration.md#reader-authentication-iso-18013-7)
    on the presentation configuration to embed a signed `readerAuth` in the
    `device_request`, letting the wallet cryptographically authenticate the
    verifier. The request payload here is unchanged.

---

## Session and Result Retrieval

If no webhook is configured, retrieve the verifier-facing result via:

- `GET /api/session/{sessionId}/result` for cross-device polling (no redirect)
- `GET /api/session/{sessionId}/result?response_code=...` for same-device redirect flows

The wallet-facing OID4VP response endpoint always returns HTTP `200` with either
`{}` (no redirect) or `{ "redirect_uri": "...response_code=..." }`.
Verification failures are not encoded in the wallet redirect URL; the RP reads
the final status and structured failure code from the result endpoint.
See [OID4VP Failure Codes](../../architecture/sessions.md#oid4vp-failure-codes)
for the stable RP-facing failure-code list.

### Why HTTP 200 instead of 400?

The wallet callback response is treated as a protocol transport acknowledgment,
not as the verifier's business-result channel.

- OID4VP flows do not define a verifier-specific HTTP 4xx error body contract
  that wallets must parse for failed presentation verification outcomes.
- Returning custom `400` JSON would be implementation-specific and therefore
  not reliably interoperable across wallets.
- In practice, many wallets only need to know whether the callback endpoint was
  reached and do not consume custom verifier error payloads.
- The same principle applies to Digital Credentials API flows (`dc-api` and
  `iso-18013-7`): the wallet/browser path does not receive verifier-side
  structured result details for business outcome handling or wallet-side
  logging.

For this reason, EUDIPLO keeps the wallet-facing callback on HTTP `200` and
exposes machine-readable verification outcomes to the RP via
`GET /api/session/{sessionId}/result`.

---

## Related Docs

- [Credential Presentation Overview](index.md)
- [Presentation Configuration](presentation-configuration.md)
- [Transaction Data](transaction-data.md)
- [Webhooks](../../architecture/webhooks.md#presentation-webhook)
