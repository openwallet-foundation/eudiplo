---
title: Keycloak Chained AS
---

# Keycloak Chained AS

This guide configures Keycloak as the upstream authorization server for OID4VCI issuance. EUDIPLO remains the authorization-server facade for the wallet while Keycloak authenticates the person receiving the credential.

This is independent of [Keycloak Management SSO](keycloak.md). The two flows can use the same realm, but the Chained AS client is a separate confidential client.

## Why Use Chained AS?

- Reuse existing Keycloak users and authentication flows.
- Keep wallet-session correlation simple: EUDIPLO includes `issuer_state` in its tokens.
- Pass Keycloak ID-token and access-token claims to a claims webhook.
- Validate wallet attestations against configured trust lists.
- Avoid custom Keycloak token mappers required by the External AS mode.

## Prerequisites

- A running Keycloak instance (tested with Keycloak 22+).
- EUDIPLO deployed and accessible at a public URL.
- A tenant configured in EUDIPLO.

## 1. Configure Keycloak

Create or select the realm that authenticates credential recipients, then create a confidential OpenID Connect client:

| Setting               | Value                                            |
| --------------------- | ------------------------------------------------ |
| Client ID             | `eudiplo-chained-as`                             |
| Client authentication | Enabled                                          |
| Valid redirect URIs   | `https://your-eudiplo-url/*/chained-as/callback` |

Copy the client secret from the **Credentials** tab.

:::tip[Redirect URI Pattern]
Use `*` for the tenant path or list exact tenants, such as `https://eudiplo.example.com/prod/chained-as/callback`.
:::

Ensure the client can request the standard `openid`, `profile`, and `email` scopes. To provide additional identity data, create a Keycloak client scope and mapper for the desired claims.

## 2. Configure Issuance

Add a Chained AS to the tenant's issuance configuration:

```json
{
    "display": [{ "name": "My Issuer", "locale": "en" }],
    "authorizationServers": [
        {
            "type": "chained",
            "id": "chained-auth",
            "enabled": true,
            "upstream": {
                "issuer": "https://keycloak.example.com/realms/eudiplo",
                "clientId": "eudiplo-chained-as",
                "clientSecret": "replace-with-the-client-secret",
                "scopes": ["openid", "profile", "email"]
            },
            "requireDPoP": false,
            "token": { "lifetimeSeconds": 3600 }
        }
    ]
}
```

| Field                   | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `upstream.issuer`       | Keycloak realm URL, ending with `/realms/{realm-name}`. |
| `upstream.clientId`     | The Chained AS client ID.                               |
| `upstream.clientSecret` | The Chained AS client secret.                           |
| `upstream.scopes`       | Scopes EUDIPLO requests from Keycloak.                  |

## 3. Use Identity Claims

To make authenticated Keycloak claims available while issuing, configure a claims webhook in the credential configuration:

```json
{
    "credentialConfigurationId": "EmployeeBadge",
    "claimsWebhook": {
        "url": "https://your-backend.example.com/claims",
        "auth": {
            "type": "apiKey",
            "config": {
                "headerName": "X-API-Key",
                "value": "your-secret-key"
            }
        }
    }
}
```

The webhook receives Keycloak claims in `identity.token_claims`, including values such as `email`, `preferred_username`, `given_name`, and `family_name`.

## 4. Create and Test an Offer

Create an authorization-code credential offer using the Chained AS:

```bash
curl -X POST https://eudiplo.example.com/api/offers \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: prod" \
  -d '{
    "credentialConfigurationId": "EmployeeBadge",
    "grant": "authorization_code",
    "authorization_server": "chained-auth"
  }'
```

When the wallet opens the offer, EUDIPLO redirects the person to Keycloak. Keycloak returns to EUDIPLO after sign-in, EUDIPLO issues a wallet access token, and the wallet requests the credential.

Check the generated authorization-server metadata and JWKS:

```bash
curl https://eudiplo.example.com/prod/chained-as/.well-known/oauth-authorization-server
curl https://eudiplo.example.com/prod/chained-as/.well-known/jwks.json
```

## Related Topics

- [Keycloak Management SSO](keycloak.md) — Keycloak for EUDIPLO administration
- [Issuance Configuration](../issuance/issuance-configuration.md) — Authorization server configuration
