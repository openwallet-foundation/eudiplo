---
title: Claims Resolution
---

EUDIPLO provides multiple methods for supplying credential claims during issuance. Understanding how these sources interact is essential for building flexible issuance flows.

## Claims Sources

Credentials can receive claim values from three sources:

1. **Configuration-level static claims** — Default values defined in the credential configuration's `fields[]`
2. **Configuration-level Attribute Provider** — Dynamic claims fetched from an external endpoint via `attributeProviderId`
3. **Offer-level claims** — Claims provided at offer creation time via `credentialClaims`

## Priority Order

When multiple claim sources are available, EUDIPLO uses the following priority order (highest to lowest):

1. **Offer-level claims** — Inline claims, webhook, or attribute provider reference passed at offer time
2. **Configuration-level attribute provider** — The `attributeProviderId` on the credential configuration
3. **Configuration-level static claims** — The `defaultValue` fields in the credential configuration's `fields[]`

:::warning[Claims are not merged]
Higher priority sources **completely override** lower priority sources. If offer-level claims are provided, the configuration-level attribute provider will not be called, and static defaults will not be used.

This is an all-or-nothing replacement, not a merge operation.
:::

## When to Use Each Method

### Configuration-Level Static Claims

Use static defaults in the credential configuration's `fields[]` when:

- Claims are fixed metadata that never changes (e.g., issuing country, issuing authority)
- You want default values for all credentials of this type
- You're building test/demo credentials with fixed sample data

**Example:**

```json
{
    "fields": [
        {
            "path": ["issuing_country"],
            "type": "string",
            "defaultValue": "DE",
            "mandatory": true
        }
    ]
}
```

### Configuration-Level Attribute Provider

Use an Attribute Provider in the credential configuration when:

- Claims should be fetched from an external system or database
- Claims depend on the authenticated user's identity
- Claims are personalized based on the authorization context
- You want all credentials of this type to use the same data source

**Example:**

```json
{
    "id": "employee-badge",
    "attributeProviderId": "hr-claims-api",
    "fields": [/* field definitions */]
}
```

For details on creating and configuring Attribute Providers, see [Attribute Providers](attribute-provider.md).

### Offer-Level Claims

Use offer-level claims when:

- Claim values are already known at offer creation time
- You want to override the configuration-level behavior for a specific issuance
- You're testing with specific test data
- Different offers should use different data sources

**Example (inline claims):**

```json
{
    "flow": "pre_authorized_code",
    "credentialConfigurationIds": ["employee-badge"],
    "credentialClaims": {
        "employee-badge": {
            "type": "inline",
            "claims": {
                "employee_id": "EMP-99999",
                "department": "Test Department"
            }
        }
    }
}
```

**Example (webhook override):**

```json
{
    "flow": "pre_authorized_code",
    "credentialConfigurationIds": ["employee-badge"],
    "credentialClaims": {
        "employee-badge": {
            "type": "webhook",
            "webhook": {
                "url": "https://staging-api.example.com/claims",
                "auth": {
                    "type": "apiKey",
                    "config": {
                        "headerName": "x-api-key",
                        "value": "staging-key"
                    }
                }
            }
        }
    }
}
```

For complete offer request syntax, see [Credential Offers](credential-offers.md#passing-claims).

## Conflict Handling

Since claims sources completely override each other (no merging), conflicts between sources cannot occur. The highest-priority source wins.

**Example scenario:**

- Configuration defines `given_name: "Default"` in static fields
- Configuration also has `attributeProviderId: "hr-api"`
- Offer provides inline claims with `given_name: "Alice"`

**Result:** The credential receives `given_name: "Alice"`. The configuration-level Attribute Provider is never called, and the static default is ignored.

## Identity Context

When using Attribute Providers or offer-level webhooks, the endpoint receives identity context from the authorization flow. The contents depend on the flow type:

| Flow                  | Identity Source                                                         |
| --------------------- | ----------------------------------------------------------------------- |
| **External AS**       | Claims from the external authorization server's access token            |
| **Chained AS**        | Claims from the upstream OIDC provider (merged ID token + access token) |
| **Pre-authenticated** | Not available (no user authentication)                                  |
| **IAE**               | Identity from the IAE interaction (presentation or web redirect)        |

For request/response format details, see [Attribute Providers](attribute-provider.md#request-and-response).

## Best Practices

1. **Use static claims for fixed metadata** — Values like issuing country, schema version, or credential type that never change.

2. **Use configuration-level Attribute Providers as the default** — When all credentials of a type should fetch from the same source.

3. **Use offer-level overrides sparingly** — Only when you need per-offer customization or testing.

4. **Keep claim keys consistent** — Use the same claim names across all sources to avoid confusion.

5. **Document your claim sources** — Make it clear where each claim comes from in your integration documentation.

## Related Documentation

- [Attribute Providers](attribute-provider.md) — External claim sources
- [Credential Offers](credential-offers.md) — Offer-level claim overrides
- [Credential Configuration](credential-configuration.md) — Static field defaults
