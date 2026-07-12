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
| `response_type`    | Yes      | Response mode. Supported values: `uri`, `dc-api`, `iso-18013-7`.       |
| `requestId`        | Yes      | ID of the presentation configuration to use.                          |
| `webhook`          | No       | Inline webhook override for this request.                             |
| `redirectUri`      | No       | Redirect target after completion. Supports `{sessionId}` placeholder. |
| `transaction_data` | No       | Transaction data override for this request.                           |
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
    ]
}
```

---

## Override Rules

When a request provides runtime fields, they override the corresponding values
from the presentation configuration for that session:

- `webhook` overrides configuration `webhook`
- `redirectUri` overrides configuration `redirectUri`
- `transaction_data` overrides configuration `transaction_data`

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

---

## Session and Result Retrieval

If no webhook is configured, retrieve the result via the `/session` endpoint
using the returned session identifier.

For same-device redirect flows, use the `response_code` from the redirect URL to
look up the completed session.

---

## Related Docs

- [Credential Presentation Overview](index.md)
- [Presentation Configuration](presentation-configuration.md)
- [Transaction Data](transaction-data.md)
- [Webhooks](../../architecture/webhooks.md#presentation-webhook)
