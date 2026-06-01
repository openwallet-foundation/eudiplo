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
| `response_type`    | Yes      | Response mode. Supported values: `uri`, `dc-api`.                     |
| `requestId`        | Yes      | ID of the presentation configuration to use.                          |
| `webhook`          | No       | Inline webhook override for this request.                             |
| `redirectUri`      | No       | Redirect target after completion. Supports `{sessionId}` placeholder. |
| `transaction_data` | No       | Transaction data override for this request.                           |

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
