# Issuance Configuration

Issuance configurations define runtime behavior for issuing credentials, such as
authorization, token behavior, and trust-related requirements.

---

## Basic Structure

**Example Issuance Configuration:**

```json
--8<-- "assets/config/demo/issuance/issuance.json"
```

!!! Info

    The auto generated schema reference can be found in the [API Documentation](../../api/openapi.md)

## Configuration Fields

- `authorizationServers` (array, optional): Managed authorization server definitions. Supports `external`, `oid4vp`, and `chained` types.
- `batchSize` (number, optional): Value to determine the amount of credentials that are issued in a batch. Default is 1.
- `dPopRequired` (boolean, optional): Indicates whether DPoP is required for the issuance process. Default value is true.
- `signingKeyId` (string, optional): Key ID used for signing access tokens. If omitted, the default signing key for the tenant is used.
- `preferredAuthServer` (string, optional): Preferred authorization server shown first in issuer metadata (`authorization_servers`). Supports `built-in`, `chained-as`, an explicit issuer URL, or a managed AS selection value in the form `authorization-server:<id>`.
- `refreshTokenEnabled` (boolean, optional): Controls whether the token endpoint returns a refresh token in OID4VCI token responses. Default is `true`.
- `refreshTokenExpiresInSeconds` (number, optional): Lifetime of issued refresh tokens in seconds. Default is `2592000` (30 days).
- `txCodeMaxAttempts` (number, optional): Maximum failed `tx_code` attempts before invalidating pre-authorized code flow.
- `walletAttestationRequired` (boolean, optional): Indicates whether wallet attestation is required for the token endpoint. Default value is false. See [Wallet Attestation](#wallet-attestation) below.
- `walletProviderTrustLists` (array of strings, optional): URLs of trust lists containing trusted wallet providers. Required when `walletAttestationRequired` is true.
- `credentialRequestEncryption` (boolean, optional): Advertise support for encrypted credential requests (`credential_request_encryption`).
- `credentialResponseEncryption` (boolean, optional): Advertise support for encrypted credential responses (`credential_response_encryption`).
- `federation` (object, optional): OpenID Federation trust configuration for auth-server/upstream trust evaluation. See [OpenID Federation](../../architecture/federation.md).
- `registrationCertificate` (object, optional): Controls whether a registration certificate is published in issuer metadata (`issuer_info`) and whether it is imported as JWT or generated from selected schema metadata.
- `display` (array of objects, required): The display information from the [OID4VCI spec](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-credential-issuer-metadata:~:text=2%20or%20greater.-,display,-%3A%20OPTIONAL.%20A%20non). To host images or logos, you can use the [storage](../../architecture/storage.md) system provided by EUDIPLO.

!!! warning "Migration Note"

        `authServers` and `chainedAs` are legacy fields. New configurations should use `authorizationServers` only. See [Migrating from 4.x to 5.0](../../migration/4.x-to-5.0.md) for the breaking-change mapping.

---

## Authorization Servers (`authorizationServers`)

Use `authorizationServers` to define wallet-facing AS behavior for OID4VCI auth-code flows.

### Example

```json
{
    "authorizationServers": [
        {
            "type": "external",
            "label": "Corporate IdP",
            "issuer": "https://auth.example.com"
        },
        {
            "type": "oid4vp",
            "id": "pid-auth",
            "label": "PID VP AS",
            "presentationConfigId": "pid-no-hook",
            "enabled": true,
            "immediateWalletRedirect": true,
            "requireDPoP": false,
            "token": {
                "lifetimeSeconds": 3600,
                "signingKeyId": "default"
            }
        },
        {
            "type": "chained",
            "enabled": true,
            "upstream": {
                "issuer": "https://keycloak.example.com/realms/eudiplo",
                "clientId": "eudiplo-chained-as",
                "clientSecret": "your-client-secret",
                "scopes": ["openid", "profile", "email"]
            },
            "requireDPoP": true,
            "token": {
                "lifetimeSeconds": 3600,
                "signingKeyId": "default"
            }
        }
    ],
    "preferredAuthServer": "authorization-server:pid-auth"
}
```

### Type Reference

| Type       | Purpose                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| `external` | Uses a remote OAuth/OIDC AS via issuer URL discovery.                                         |
| `oid4vp`   | Creates a tenant-local AS facade at `/issuers/{tenant}/authorization-servers/{id}`.           |
| `chained`  | Creates a tenant-local chained AS facade at `/issuers/{tenant}/chained-as` via upstream OIDC. |

### Common Fields

| Field                   | Type    | Required                | Description                                        |
| ----------------------- | ------- | ----------------------- | -------------------------------------------------- |
| `type`                  | string  | Yes                     | One of `external`, `oid4vp`, `chained`.            |
| `label`                 | string  | No                      | Optional UI label.                                 |
| `enabled`               | boolean | No                      | Enables/disables this entry. Default `true`.       |
| `requireDPoP`           | boolean | No (`oid4vp`/`chained`) | Require DPoP proofs on token requests for this AS. |
| `token.lifetimeSeconds` | number  | No (`oid4vp`/`chained`) | Access token lifetime for this AS.                 |
| `token.signingKeyId`    | string  | No (`oid4vp`/`chained`) | Key used to sign AS-issued tokens.                 |

### Type-Specific Fields

- `external`
    - `issuer` (required): External AS issuer URL.
- `oid4vp`
    - `id` (required): Stable identifier used in the AS URL path.
    - `presentationConfigId` (required): Presentation config used for the VP flow.
    - `immediateWalletRedirect` (optional): Redirect browser immediately to wallet request.
- `chained`
    - `upstream.issuer` (required): Upstream OIDC issuer URL.
    - `upstream.clientId` (required): Client ID at upstream provider.
    - `upstream.clientSecret` (optional): Client secret for confidential clients.
    - `upstream.scopes` (optional): Scopes requested upstream.

### Preferred Authorization Server

`preferredAuthServer` controls ordering in the published `authorization_servers` metadata array.

Supported values:

- `built-in`
- `chained-as`
- `authorization-server:<id>` (managed `oid4vp` AS)
- Explicit issuer URL

---

## Registration Certificate in Issuer Metadata

EUDIPLO can publish a registration certificate in the OID4VCI issuer metadata
under `issuer_info` using:

- `import` mode: use an existing JWT from configuration.
- `generate` mode: derive provided attestations from selected schema metadata and generate via registrar.

### Example Configuration

```json
{
    "registrationCertificate": {
        "enabled": true,
        "mode": "generate",
        "schemaMetadataIds": [
            "9a2f4033-f0ab-4f61-bd1d-6f4c321cb41b@1.0.0",
            "5c53fcd0-63b4-4f5c-8674-599dbe9be2f3@1.2.0"
        ],
        "privacyPolicy": "https://issuer.example/privacy",
        "supportUri": "mailto:support@issuer.example"
    }
}
```

### When `generate` Mode Runs

Generation is **lazy/on-demand**. It is triggered when issuer metadata is built,
for example when a wallet calls:

- `/.well-known/openid-credential-issuer/issuers/{tenant}`

Saving issuance configuration does not immediately generate a new registration certificate.

### Cache and Refresh Behavior

For `generate` mode, EUDIPLO caches the generated JWT in issuance configuration.

It reuses cache when:

- the effective registration certificate config fingerprint is unchanged, and
- the cached JWT is still active (not expired / not-before valid).

It regenerates when:

- `registrationCertificate` inputs change (mode, selected schema metadata, provided attestations-related values), or
- cached JWT is expired or not active.

### Mode-Specific Fields

- `import` mode:
    - `jwt` (required): existing registration certificate JWT.
- `generate` mode:
    - `schemaMetadataIds` (required): selected schema metadata entries (`<id>@<version>`).
    - `privacyPolicy` / `supportUri` (optional, can also be provided via registrar defaults).

### Notes

- If generation fails, issuer metadata is still returned, but `issuer_info` omits
  the registration certificate entry.
- Schema metadata management is documented in [Schema Metadata](schema-metadata.md).

---

## Refresh Tokens

EUDIPLO can issue refresh tokens from the OID4VCI token endpoint so wallets can obtain a new access token without re-running the authorization flow.

### Configuration

Use these issuance configuration fields:

```json
{
    "refreshTokenEnabled": true,
    "refreshTokenExpiresInSeconds": 2592000
}
```

### Field Reference

| Field                          | Type    | Required | Description                                                             |
| ------------------------------ | ------- | -------- | ----------------------------------------------------------------------- |
| `refreshTokenEnabled`          | boolean | No       | Enables refresh token issuance on the token endpoint. Default: `true`.  |
| `refreshTokenExpiresInSeconds` | number  | No       | Refresh token validity period in seconds. Default: `2592000` (30 days). |

### Behavior

When `refreshTokenEnabled` is `true`:

1. The token endpoint includes a `refresh_token` in the token response.
2. EUDIPLO stores the refresh token and its expiration time in the issuance session.
3. A wallet can later call the token endpoint with `grant_type=refresh_token` and the previously issued `refresh_token`.
4. EUDIPLO validates both the token value and the configured expiration before issuing a new access token.

When `refreshTokenEnabled` is `false`, no refresh token is returned.

### Web Client

The web client exposes both settings in the Issuance Configuration editor under Basic Information:

- `Issue Refresh Tokens`
- `Refresh Token Lifetime (seconds)`

---

## Wallet Attestation

Wallet attestation allows issuers to verify that credential requests come from trusted wallet applications. When enabled, wallets must provide OAuth Client Attestation headers at the token endpoint, as specified in [RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449) and the [OID4VCI specification](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html).

### How It Works

1. **Wallet Provider Signs Attestation**: The wallet provider (e.g., the wallet app vendor) signs a JWT attesting to the wallet instance's identity. This JWT includes an X.509 certificate chain in the `x5c` header.

2. **Wallet Sends Attestation**: When requesting an access token, the wallet includes two headers:
    - `OAuth-Client-Attestation`: The wallet attestation JWT signed by the wallet provider
    - `OAuth-Client-Attestation-PoP`: A proof-of-possession JWT signed by the wallet instance

3. **Issuer Validates**: EUDIPLO validates the attestation by:
    - Verifying the JWT signature using the X.509 certificate from the `x5c` header
    - Verifying the proof-of-possession (PoP) JWT
    - Checking that the wallet provider's certificate is trusted according to the configured trust lists

### Configuration

To enable wallet attestation, set `walletAttestationRequired` to `true` and provide at least one trust list URL:

```json
{
    "walletAttestationRequired": true,
    "walletProviderTrustLists": ["https://trust-list.example.eu/wallet-providers"]
}
```

### Trust Lists

Trust lists must be in the LoTE (List of Trusted Entities) format as defined by [ETSI TS 119 612](https://www.etsi.org/deliver/etsi_ts/119600_119699/119612/). The trust list should contain entries with the service type `http://uri.etsi.org/19602/SvcType/WalletProvider`.

Each trusted entity in the list includes X.509 certificates that identify authorized wallet providers. When a wallet presents an attestation, EUDIPLO verifies that the signing certificate chains to one of these trusted certificates.

### Status Claim

The wallet attestation JWT may optionally contain a `status` claim that provides a URI for checking the current validity or revocation status of the attestation. According to the [OAuth Attestation-Based Client Authentication](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-attestation-based-client-auth) specification, this claim is **optional**.

!!! note "Current Behavior"

    EUDIPLO currently does **not** check the `status` claim in wallet attestations. Attestations are validated based on:

    - JWT signature verification
    - Proof-of-possession verification
    - X.509 certificate chain validation against configured trust lists

    If your use case requires status checking (e.g., for revoked wallet instances), this would need to be implemented as an additional validation step.

!!! warning "Important"

    If `walletAttestationRequired` is set to `true` but no trust lists are configured, **all wallet requests will be rejected**. Always configure at least one trust list when enabling wallet attestation.

!!! info "EUDI Wallet Ecosystem"

    In the EUDI Wallet ecosystem, trust lists are typically published by EU member states or the European Commission, containing the certificates of approved wallet providers.

---

## Chained Authorization Server

Chained AS is now configured as an `authorizationServers` entry with `type: "chained"`.

Example:

```json
{
    "authorizationServers": [
        {
            "type": "chained",
            "enabled": true,
            "upstream": {
                "issuer": "https://keycloak.example.com/realms/eudiplo",
                "clientId": "eudiplo-chained-as",
                "clientSecret": "your-client-secret",
                "scopes": ["openid", "profile", "email"]
            },
            "token": {
                "lifetimeSeconds": 3600,
                "signingKeyId": "default"
            },
            "requireDPoP": true
        }
    ],
    "preferredAuthServer": "chained-as"
}
```

When enabled, EUDIPLO exposes the same chained endpoints as before under `/{tenant}/chained-as/*` and publishes this issuer in `authorization_servers` metadata.
