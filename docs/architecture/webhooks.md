# Webhooks

EUDIPLO supports **webhook endpoints** to push data to your external services during **issuance** and **presentation** flows.

!!! info "Webhooks vs. Attribute Providers"

    **Webhooks** are designed to **send data OUT** — notifying your backend when events occur (e.g., credential issued, presentation completed).

    **Attribute Providers** are designed to **fetch data IN** — retrieving claims from your backend to include in credentials.

    For fetching claims dynamically during issuance, see [Attribute Providers](./attribute-providers.md).

---

## Supported Webhook Scenarios

| Flow                     | Direction | Purpose                                                                  |
| ------------------------ | --------- | ------------------------------------------------------------------------ |
| **Notification Webhook** | Outbound  | Receives status updates (e.g., accepted or denied) about issuance flows. |
| **Presentation Webhook** | Outbound  | Receives verified claims from the wallet after presentation.             |

!!! tip "Interactive Authorization (IAE)"

    For user interactions during issuance (e.g., verifiable presentations, web-based verification), see [Interactive Authorization Endpoint](./iae.md).

!!! tip "Fetching Claims"

    To fetch claims dynamically during credential issuance, use **Attribute Providers** instead of webhooks. See [Attribute Providers](./attribute-providers.md).

---

## Example Webhook Service

A simple webhook simulator is available in the [test/webhook](https://github.com/openwallet-foundation/eudiplo/tree/main/test/webhook)  
directory. It can be run locally or deployed to a Cloudflare Worker, and is a good starting point for testing webhook functionality.

---

## Webhook Configuration

A webhook configuration object defines how EUDIPLO interacts with your service.

It must include:

- `url`: The endpoint URL. EUDIPLO sends an HTTP `POST` request with JSON data.
- `auth`: (Optional) Authentication configuration.
    - `type`: Authentication type. Currently supported:
        - `apiKey` – sends a key in a request header.

### Example

```json
{
    "url": "http://localhost:8787/consume",
    "auth": {
        "type": "apiKey",
        "config": {
            "headerName": "x-api-key",
            "value": "your-api-key"
        }
    }
}
```

---

## Fetching Claims (Attribute Providers)

To fetch claims dynamically during credential issuance, use **Attribute Providers**. Attribute Providers are tenant-level resources that define how EUDIPLO retrieves claims from your backend.

For complete documentation on Attribute Providers, including:

- Configuration and management
- Request/response formats
- Identity context and token claims
- Use with Interactive Authorization (IAE)

See [Attribute Providers](./attribute-providers.md).

---

## Notification Webhook Endpoint

The **notification webhook endpoint** is a standalone, reusable tenant resource
that receives the outcome of the issuance process (e.g., accepted or denied).
It is not embedded directly in the issuance request or credential configuration.

Instead, reference the endpoint by ID using `webhookEndpointId` on the
credential configuration or on an offer request.

Example endpoint resource:

```json
{
    "id": "notification",
    "name": "Notification Webhook",
    "description": "Receives credential issuance lifecycle events",
    "url": "http://localhost:8787",
    "auth": {
        "type": "none"
    }
}
```

If you use authentication for the endpoint, the `auth` object follows the same
webhook authentication model used by presentation webhooks.

If no notification webhook endpoint is configured, you can fetch the session
result by querying the `/session` endpoint with the `sessionId`.

---

## Presentation Webhook

The **presentation webhook** receives verified claims from the wallet after a presentation flow completes.

```json
{
    "webhook": {
        "url": "http://localhost:8787/notify",
        "auth": {
            "type": "apiKey",
            "config": {
                "headerName": "x-api-key",
                "value": "your-api-key"
            }
        },
        "includeRawTokensFor": ["pid"]
    }
}
```

!!! info "Raw Token Pass-Through"

    By default, EUDIPLO only forwards the extracted claims. If your use case requires the original cryptographic proof, you can use the optional `includeRawTokensFor` array to specify credential IDs. The raw `vp_token` will then be appended to those specific credentials.

### Webhook Request Format

EUDIPLO sends an HTTP `POST` request with the following structure:

- `credentials`: Array of credential objects. Each includes:
    - `id`: The ID of the DCQL query.
    - `values`: The claims presented by the wallet.
        - SD-JWT VC–specific fields (e.g., `cnf`, `status`) are removed for simplicity.
    - `error`: Present instead of `values` if verification failed.
    - `rawToken`: (Optional) The raw cryptographic proof (the `vp_token`), present only if explicitly requested via `includeRawTokensFor`.
- `session`: The session ID identifying the request.

```json
{
    "credentials": [
        {
            "id": "pid",
            "values": {
                "iss": "https://service.eudi-wallet.dev",
                "iat": 1751884150,
                "vct": "https://service.eudi-wallet.dev/credentials/vct/pid",
                "address": {
                    "locality": "KÖLN",
                    "postal_code": "51147",
                    "street_address": "HEIDESTRAẞE 17"
                }
            },
            "rawToken": "eyJ0eXAiOiJkYytzZC1qd3QiLCJhbGciOiJFUzI1NiJ9..."
        },
        {
            "id": "citizen",
            "error": "Credential verification failed: invalid signature"
        }
    ],
    "session": "a6318799-dff4-4b60-9d1d-58703611bd23"
}
```

!!! info

    Requests always use `Content-Type: application/json`. A retry mechanism is not yet implemented—if a webhook fails, the process halts. Retry support may be added in the future.

!!! tip "IAE Presentation Flows"

    For IAE flows where you need to transform presentation data into credential claims, use an **Attribute Provider** instead of a presentation webhook. The Attribute Provider receives the presented credentials and returns the claims to issue. See [Attribute Providers](./attribute-providers.md) for details.
