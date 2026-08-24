---
title: Presentation Configuration
---

This guide covers how to create, manage, and configure presentation requests in EUDIPLO. Presentation configurations define what credentials and claims should be requested from users.

For creating request payloads and runtime overrides, see [Presentation Requests](presentation-requests.md).

## Configuration Structure

**Example Presentation Configuration (PID):**

```json
{
    "id": "pid-presentation",
    "description": "Request PID for age verification",
    "dcql_query": {
        "credentials": [
            {
                "id": "pid-mso-mdoc",
                "format": "mso_mdoc",
                "meta": {
                    "doctype_value": "eu.europa.ec.eudi.pid.1"
                },
                "claims": [
                    {
                        "path": ["eu.europa.ec.eudi.pid.1", "age_over_18"]
                    }
                ],
                "trusted_authorities": [
                    {
                        "type": "etsi_tl",
                        "values": [
                            {
                                "trustListId": "local-pid-trust-list"
                            }
                        ]
                    }
                ]
            }
        ]
    },
    "registrationCert": {
        "body": {
            "purpose": [
                {
                    "lang": "en",
                    "value": "Verify age over 18 for account onboarding"
                }
            ]
        }
    }
}
```

## Configuration Fields

- `id`: **REQUIRED** — Unique identifier for the presentation configuration.
- `description`: **REQUIRED** — Human-readable description of the presentation. Will not be displayed to the end user.
- `dcql_query`: **REQUIRED** — DCQL query defining the requested credentials and claims following the [DCQL specification](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-digital-credentials-query-l). See [DCQL](dcql.md) for query authoring.
- `registrationCert`: **OPTIONAL** — Registration certificate settings used to create (or reuse) a verifier attestation for this specific presentation config. Keep presentation-specific values such as `purpose` here. See [Registration Certificate](#registration-certificate) below.
- `webhook`: **OPTIONAL** — Webhook configuration for receiving verified presentations asynchronously. See [Webhook Integration](../architecture/extension-points/webhooks.md#presentation-webhook) for details.
- `redirectUri`: **OPTIONAL** — URI to redirect the user to after completing the presentation. This is useful for web applications that need to return the user to a specific page after verification. You can use the `{sessionId}` placeholder in the URI, which will be replaced with the actual session ID (e.g., `https://example.com/callback?session={sessionId}`).
- `transaction_data`: **OPTIONAL** — Array of transaction data objects to include in the OID4VP authorization request. See [Transaction Data](transaction-data.md) for details.
- `skewSeconds`: **OPTIONAL** — Clock skew tolerance in seconds for credential JWT time validation. Defaults to `60` seconds.
- `statusCheckMode`: **OPTIONAL** — Controls how credential status list checks are handled during presentation verification. Supported values are `strict` (default), `best_effort`, and `disabled`.
- `readerAuth`: **OPTIONAL** — Enable reader authentication for the ISO 18013-7 Annex C (DC API) flow. When `true`, the `DeviceRequest` embeds a detached `readerAuth` COSE_Sign1 signed with the tenant's Access key chain, letting the wallet cryptographically authenticate the verifier. Defaults to disabled. See [Reader Authentication](#reader-authentication-iso-18013-7) below.

:::info
If no webhook is configured, the presentation result can be fetched by querying the `/session` endpoint with the `sessionId`.
:::

:::info[Request-time overrides]
When you create a presentation request (`/verifier/offer`), the request body can override configuration-level values:

- `webhook` in the request overrides `webhook` from the presentation configuration
- `redirectUri` in the request overrides `redirectUri` from the presentation configuration
- `transaction_data` in the request overrides `transaction_data` from the presentation configuration
- `skewSeconds` in the request overrides `skewSeconds` from the presentation configuration for that session

  :::

### statusCheckMode Behavior

`statusCheckMode` applies to credential status list checks during presentation verification for both `dc+sd-jwt` and `mso_mdoc` credentials (including ISO 18013-7 mdoc presentations).

- `strict` (default): Status checks are enabled and enforced fail-closed. If the status list cannot be fetched/validated, verification fails.
- `best_effort`: Status checks are attempted first. If status data is temporarily unavailable (for example due to timeout/network fetch issues), verification continues without the status result.
- `disabled`: Status checks are not performed.

Example:

```json
{
    "id": "pid-presentation",
    "description": "PID presentation with best-effort status checks",
    "statusCheckMode": "best_effort",
    "dcql_query": {
        "credentials": []
    }
}
```

## Registration Certificate

Use `registrationCert` per presentation configuration so each verifier request can declare its own intended use (`purpose`).

```json
{
    "registrationCert": {
        "body": {
            "purpose": [
                {
                    "lang": "en",
                    "value": "Verify age over 18 for account onboarding"
                }
            ]
        }
    }
}
```

Notes:

- `purpose` should be configured per presentation config.
- Shared defaults such as `privacy_policy` or `support_uri` can be configured once at tenant level in `registrar.json` via `registrationCertificateDefaults`.
- If you already have a registrar certificate JWT, you can set `registrationCert.jwt` to reuse it.

## Reader Authentication (ISO 18013-7)

`readerAuth` adds cryptographic **verifier** authentication to the ISO 18013-7 Annex C (Digital Credentials API) flow — the mDOC equivalent of the signed request object used in the OID4VP flow. It only affects `response_type: "iso-18013-7"` offers.

When `readerAuth: true`, EUDIPLO signs:

```text
ReaderAuthentication = ["ReaderAuthentication", SessionTranscript, ItemsRequestBytes]
```

as a **detached COSE_Sign1** using the tenant's Access key chain (selected by `accessKeyChainId`, or the tenant default), and embeds it as `readerAuth` in the `DocRequest`. The wallet validates the signature against the reader's certificate chain (carried in the `x5chain` header), authenticating the verifier before releasing any attributes.

The `SessionTranscript` bound by the signature is the same DCAPIHandover transcript the wallet derives from the `encryptionInfo` and the browser origin, so the signature is tied to this exact request and origin.

```json
{
    "id": "age-over-18-dc-api",
    "readerAuth": true,
    "dcql_query": { "credentials": [ ... ] }
}
```

:::note
Signing extracts the Access private key as a JWK, so KMS-backed non-extractable keys are not yet supported for reader authentication. When `readerAuth` is omitted or `false`, the `DeviceRequest` is sent unsigned (the previous behaviour).
:::

## DCQL Query

The `dcql_query` field defines what credentials and claims to request. For detailed authoring guidance, examples, and trust list configuration, see the dedicated [DCQL](dcql.md) page.

## Related Documentation

- [DCQL](dcql.md) — Digital Credentials Query Language for structured queries
- [Presentation Requests](presentation-requests.md) — Creating requests and runtime overrides
- [Transaction Data](transaction-data.md) — Contextual data for users
- [Trust Lists](../trust/trust-lists.md) — Trust list validation
- [Webhooks](../architecture/extension-points/webhooks.md) — Webhook integration patterns
