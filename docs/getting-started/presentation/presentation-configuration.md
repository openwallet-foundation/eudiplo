# Presentation Configuration

This guide covers how to create, manage, and configure presentation requests in
EUDIPLO. Presentation configurations define what credentials and claims should
be requested from users.

For creating request payloads and runtime overrides, see
[Presentation Requests](presentation-requests.md).

---

## Configuration Structure

**Example Presentation Configuration (PID):**

```json
--8<-- "assets/config/demo/presentation/pid.json"
```

---

## Configuration Fields

- `id`: **REQUIRED** - Unique identifier for the presentation configuration.
- `description`: **REQUIRED** - Human-readable description of the presentation. Will not be displayed to the end user.
- `dcql_query`: **REQUIRED** - DCQL query defining the requested credentials and claims following the [DCQL specification](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-digital-credentials-query-l)
- `registrationCert`: **OPTIONAL** - Registration certificate settings used to create (or reuse) a verifier attestation for this specific presentation config. Keep presentation-specific values such as `purpose` here. See [Registration Certificate](../registrar.md#registration-certificate) for details.
- `webhook`: **OPTIONAL** - Webhook configuration for receiving verified presentations asynchronously. See [Webhook Integration](../../architecture/webhooks.md#presentation-webhook) for details.
- `redirectUri`: **OPTIONAL** - URI to redirect the user to after completing the presentation. This is useful for web applications that need to return the user to a specific page after verification. You can use the `{sessionId}` placeholder in the URI, which will be replaced with the actual session ID (e.g., `https://example.com/callback?session={sessionId}`).
- `transaction_data`: **OPTIONAL** - Array of transaction data objects to include in the OID4VP authorization request. See [Transaction Data](transaction-data.md) for details.
- `skewSeconds`: **OPTIONAL** - Clock skew tolerance in seconds for credential JWT time validation. Defaults to `60` seconds.
- `statusCheckMode`: **OPTIONAL** - Controls how credential status list checks are handled during presentation verification. Supported values are `strict` (default), `best_effort`, and `disabled`.

!!! Info

    If no webhook is configured, the presentation result can be fetched by querying the `/session` endpoint with the `sessionId`.

!!! info "Request-time overrides"

    When you create a presentation request (`/verifier/offer`), the request body can override configuration-level values:

    - `webhook` in the request overrides `webhook` from the presentation configuration
    - `redirectUri` in the request overrides `redirectUri` from the presentation configuration
    - `transaction_data` in the request overrides `transaction_data` from the presentation configuration
    - `skewSeconds` in the request overrides `skewSeconds` from the presentation configuration for that session

### statusCheckMode Behavior

`statusCheckMode` applies to credential status list checks during presentation verification
for both `dc+sd-jwt` and `mso_mdoc` credentials (including ISO 18013-7 mdoc
presentations).

- `strict` (default): Status checks are enabled and enforced fail-closed. If the
  status list cannot be fetched/validated, verification fails.
- `best_effort`: Status checks are attempted first. If status data is temporarily
  unavailable (for example due to timeout/network fetch issues), verification
  continues without the status result.
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

### registrationCert Structure

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

---

## Configuring Trust Lists for Verification

To validate that a credential was issued by a trusted entity, you can configure trust lists per credential inside the DCQL query using the `trusted_authorities` field on each credential query.

This follows the [OID4VP Trusted Authorities Query](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-trusted-authorities-query) specification.

### Structure

Each entry in `trusted_authorities` specifies:

- `type`: The trust framework type. Supported values:
    - `etsi_tl` — ETSI TS 119 602 List of Trusted Entities (LoTE)
    - `aki` — Authority Key Identifier
- `values`: Array of trust anchors. For `etsi_tl`, these are URLs pointing to signed LoTE JWTs.

### Example

```json
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
            "values": ["https://example.com/trust-list/pid-provider.jwt"]
        }
    ]
}
```

During verification, EUDIPLO will:

1. Fetch the LoTE JWT(s) from the provided URLs
2. Parse the trusted entities and their certificates
3. Validate that the credential's issuer certificate chains to one of the trusted entities
4. If status checks are enabled (`statusCheckMode` is `strict` or `best_effort`), ensure the status list (if present) is signed by the revocation certificate from the **same** trusted entity

!!! warning "Trust validation is opt-in per credential"

    If `trusted_authorities` is not specified on a credential query, trust list validation is **skipped** for that credential. To enforce trust validation, always include `trusted_authorities` in your DCQL credential queries.

!!! tip "Using your own trust lists"

    You can reference trust lists published by your own EUDIPLO instance at `/{tenantId}/trust-list/{trustListId}`. You can also use the `<TENANT_URL>` placeholder in trust list URLs, which will be replaced with the tenant's base URL at runtime. See [Trust Framework](../../architecture/trust-framework.md) for details on creating and managing trust lists.
