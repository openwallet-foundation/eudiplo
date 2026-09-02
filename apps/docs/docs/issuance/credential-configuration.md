---
title: Credential Configuration
---

Credential configurations define the structure and behavior of individual credentials. Each credential type has its own configuration.

## Basic Structure

Each credential configuration is a JSON object that defines how a specific credential type should be issued. The configuration includes metadata, display information, field definitions (`fields[]`), and optional features like key binding and status management.

For a complete configuration example, see the [Complete Configuration Example](#complete-configuration-example) section at the bottom of this page.

:::info
The data object for the import can be found in the [API Documentation](../reference/openapi.md)
:::

## Configuration Fields

### Required Fields

- `id`: **REQUIRED** - Unique identifier for the credential configuration that will be used to reference this credential in the issuance metadata or in the credential offer.
- `config`: **REQUIRED** - Entry for [credential_configuration_supported](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-credential-issuer-metadata:~:text=the%20logo%20image.-,credential_configurations_supported,-%3A%20REQUIRED.%20Object%20that).
    - `format`: **REQUIRED** - The format of the credential. Supported formats:
        - `dc+sd-jwt` - Selective Disclosure JWT Verifiable Credentials
        - `mso_mdoc` - Mobile Document (ISO 18013-5)
    - `display`: **REQUIRED** - Display configuration for the credential, including name, description, locale, colors, and images.
    - `docType`: **REQUIRED for mso_mdoc** - Document type identifier (e.g., `org.iso.18013.5.1.mDL`).
    - `namespace`: **OPTIONAL for mso_mdoc** - Default namespace for claims (e.g., `org.iso.18013.5.1`). If not provided, derived from docType.

### Optional Fields

- `description`: **OPTIONAL** - Human-readable description of the credential. Will not be displayed to the end user.
- `vct`: **OPTIONAL** - [VC Type Metadata](https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-09.html#name-sd-jwt-vc-type-metadata) provided via the `/{tenantId}/credentials-metadata/vct/{id}` endpoint. This link will be automatically added to the credential.
- `keyChainId`: **OPTIONAL** - Unique identifier for the key chain used to sign the credential. If not provided, the key chain with `attestation` usage type will be used. See [Signing Key Chain](#signing-key-chain) for details.
- `lifeTime`: **OPTIONAL** - Credential expiration time in seconds. If specified, credentials will include an `exp` claim calculated as `iat + lifeTime`. See [Credential Expiration](#credential-expiration) for details.
- `statusManagement`: **OPTIONAL** - Enable OAuth Token Status Lists for credential revocation. When `true`, credentials include a `status` claim with revocation information. See [Status Management](status-management.md) for details.
- `activeCredentials`: **OPTIONAL** - Enforce one active credential of this configuration per subject. Requires `statusManagement: true`; issuing a replacement revokes the subject's previous credential. See [Single Active Credential](#single-active-credential) for details.
- `keyBinding`: **OPTIONAL** - Enable cryptographic key binding. When `true`, credentials include a `cnf` claim with the holder's public key and require proof of possession. See [Cryptographic Key Binding](#cryptographic-key-binding) for details.
- `fields`: **REQUIRED** - Field definitions (`ClaimFieldDefinition[]`) that describe claim paths, data types, defaults, disclosure behavior, and optional display labels.
- `attributeProviderId`: **OPTIONAL** - Reference to an Attribute Provider that fetches claims dynamically. See [Attribute Providers](attribute-provider.md) for details.
- `webhookEndpointId`: **OPTIONAL** - Reference to a Webhook Endpoint for receiving notifications about the issuance process. See [Notifications](notifications.md) for details.
- `sdJwtTrustFormat`: **OPTIONAL (SD-JWT only)** - Controls trust signaling in issued SD-JWT credentials:
    - `x5c` (default): include the X.509 chain in the JWT header
    - `federation`: use federation issuer identity (`iss`) for trust resolution
- `credentialReusePolicy`: **OPTIONAL** - Publishes a PID/EAA reuse policy in the credential metadata. See [Credential Reuse Policy](#credential-reuse-policy) for details.
- `embeddedDisclosurePolicy`: **OPTIONAL** - Defines the embedded disclosure policy for the credential. See [Embedded Disclosure Policy](#embedded-disclosure-policy) for details.
- `iaeActions`: **OPTIONAL** - Sequence of Interactive Authorization actions required before credential issuance. See [Interactive Authorization Actions](#interactive-authorization-actions) for details.

:::info[Schema Metadata is managed separately]
Schema Metadata is managed in the dedicated Schema Metadata flow, not in the Credential Configuration editor. Use [Schema Metadata](schema-metadata.md) to create and version schema metadata entries.
:::

## Configuring Fields

In the current configuration model, claim content is configured through `fields[]`. Each entry can describe either:

- a leaf claim (for example `path: ["given_name"]`), or
- a container claim (`object`/`array`) with nested `children`.

Nested child paths can be defined in two ways:

- relative to the parent path (recommended), or
- as a full absolute path (also supported).

For arrays, use numeric child path segments such as `[0]` to describe item entries.

:::info[Claims Priority System]
EUDIPLO supports multiple ways to provide claims (configuration-level and offer-level), with a priority system that determines which claims are used. For a complete explanation of the claims priority order and when to use each method, see [Claims](claims.md).
:::

### Static Defaults via `fields[]`

You can define defaults directly in each field using `defaultValue`:

```json
{
    "fields": [
        {
            "path": ["given_name"],
            "type": "string",
            "defaultValue": "ERIKA",
            "mandatory": true,
            "disclosable": true,
            "display": [
                { "lang": "en-US", "label": "Given Name" },
                { "lang": "de-DE", "label": "Vorname" }
            ]
        },
        {
            "path": ["family_name"],
            "type": "string",
            "defaultValue": "MUSTERMANN",
            "mandatory": true,
            "disclosable": true
        },
        {
            "path": ["address"],
            "type": "object",
            "disclosable": true,
            "children": [
                {
                    "path": ["country"],
                    "type": "string",
                    "defaultValue": "DE",
                    "mandatory": true,
                    "disclosable": true
                },
                {
                    "path": ["postal_code"],
                    "type": "string",
                    "defaultValue": "51147",
                    "disclosable": true
                }
            ]
        },
        {
            "path": ["nationalities"],
            "type": "array",
            "defaultValue": ["DE"],
            "mandatory": true,
            "disclosable": true,
            "constraints": {
                "items": {
                    "type": "string",
                    "title": "Nationality"
                }
            },
            "children": [
                {
                    "path": [0],
                    "type": "string",
                    "defaultValue": "DE",
                    "disclosable": false
                }
            ]
        }
    ]
}
```

Static field defaults are useful for:

- Default values for all credentials of this type
- Fixed metadata (e.g., issuing country, issuing authority)
- Development and testing scenarios

### Nested Field Groups (`children`)

Use `children` when you want to model grouped structures like `address`, `age_equal_or_over`, or `place_of_birth`.

- Parent node: define `path` and `type` (`object` or `array`)
- Child nodes: define claim fields under `children[]`
- Child paths: prefer relative paths (for example `"path": ["street_address"]` under parent `"path": ["address"]`)

This structure improves readability in config files and enables grouped rendering in form-based UIs.

### Attribute Provider

For dynamic claim retrieval, configure an Attribute Provider that is called during issuance:

```json
{
    "attributeProviderId": "my-claims-provider"
}
```

The Attribute Provider endpoint receives issuance context and returns claim values.

Attribute Providers are useful when:

- Claims need to be fetched from an external system or database
- Claims should be personalized based on the authentication context
- Claims depend on real-time data

For detailed information about creating Attribute Providers, request/response formats, and implementation examples, see [Attribute Providers](attribute-provider.md).

## Notification Webhook Endpoint

You can configure a webhook endpoint to receive notifications about the issuance process. This allows you to track the status of credential issuance and take appropriate actions.

Reference a pre-configured webhook endpoint by its ID:

```json
{
    "webhookEndpointId": "my-notification-webhook"
}
```

The notification webhook endpoint will be called at various stages of the issuance process, such as:

- When a credential offer is accepted
- When a credential is successfully issued
- When a credential is rejected or an error occurs

For more details about the webhook implementation and payload structure, see [Notifications](notifications.md).

:::note
When a webhook endpoint is configured on credential config level, notifications are sent to this endpoint by default. It can be overridden per issuance by setting `webhookEndpointId` on the credential offer request.
:::

## Signing Key Chain

The `keyChainId` field specifies which key chain should be used to sign the credential. If not provided, EUDIPLO uses the key chain with `attestation` usage type.

## Credential Expiration

The `lifeTime` field determines when the credential expires. When set, EUDIPLO includes an `exp` claim in the credential calculated as:

```
exp = iat + lifeTime
```

Where:

- `iat` is the issuance timestamp
- `lifeTime` is the configured lifetime in seconds

## Cryptographic Key Binding

When `keyBinding` is enabled, EUDIPLO:

1. Requires the wallet to provide a proof of possession during the credential request
2. Includes a `cnf` (confirmation) claim in the credential with the wallet's public key
3. Enables verifiers to cryptographically verify that the credential presenter is the legitimate holder

## Credential Reuse Policy

The `credentialReusePolicy` field publishes policy information in the credential metadata about whether and how the credential can be reused.

## Single Active Credential

Use `activeCredentials` when a credential should behave as a replaceable current record rather than a collection of independently valid copies. Typical uses include a current employee badge, a credential reissued after changed claims, or a replacement for a lost or compromised credential.

The policy permits one active credential issuance per subject and credential configuration. When the same subject starts a new issuance, EUDIPLO creates the replacement first and then revokes every credential from the previously active issuance. Credentials under other configurations are unaffected.

All credential responses authorized by the same access token remain active together. This includes multiple proofs in one credential request and multiple credential-endpoint requests made by a wallet to collect a batch. For example, if a wallet retrieves 40 credentials in four requests of 10, EUDIPLO revokes neither the earlier requests nor individual credentials in that batch. Revocation occurs when a different access token for the same subject and credential configuration successfully issues its first credential.

```json
{
    "statusManagement": true,
    "activeCredentials": {
        "enabled": true,
        "tracking": "internal"
    }
}
```

### Requirements and Limitations

- The policy requires `statusManagement: true`; EUDIPLO rejects a configuration that enables the policy without it.
- The issuing authorization server must provide a durable, stable `iss` and `sub` for each person. The policy is not enforced when the flow has no durable external subject, such as a session-scoped subject from the built-in authorization server.
- The same person authenticating through a different authorization server, or with a changed subject identifier, is treated as a different subject and can receive another active credential.
- This is a one-active-credential policy. Configurations cannot set a higher active-credential limit.
- A refreshed, renewed, or otherwise replaced access token starts a new issuance set. The first credential issued with it revokes the credentials issued with the prior token for this configuration.
- The encryption root key must remain available and stable while active credentials exist. Replacing it changes the derived fingerprints and prevents EUDIPLO from locating previous active slots.

EUDIPLO stores a pseudonymous, configuration-scoped HMAC derived from the external subject instead of the raw subject identifier. This prevents the stored value from being reused to correlate the same person across credential configurations, but it still lets EUDIPLO recognize a returning subject for this policy.

### Fingerprints and Revocation Procedure

EUDIPLO derives two independent, opaque identifiers from the root key used for at-rest encryption. It derives separate 32-byte HMAC keys with HKDF-SHA-256 and distinct purpose strings, then stores only the hexadecimal HMAC digest. Neither the raw subject nor the raw access token is written to the database.

- **Subject key:** `HMAC-SHA-256(subject-key, tenantId + "|" + credentialConfigurationId + "|" + iss + "|" + sub)`. This identifies the same subject for one credential configuration without allowing correlation across configurations.
- **Issuance-set key:** `HMAC-SHA-256(issuance-set-key, accessToken)`. This identifies credential requests authorized by the same access token. It uses a different HKDF-derived key from the subject key.

For each credential request, EUDIPLO performs the following procedure:

1. It validates the access token and obtains the external authorization identity (`iss` and `sub`).
2. It derives the subject key and access-token issuance-set key in memory.
3. It allocates and records the new credential's status-list entry with the issuance-set key.
4. If no active slot exists for the subject key, EUDIPLO creates one pointing to this issuance set.
5. If the slot already points to the same issuance-set key, the request belongs to the existing batch and no revocation occurs.
6. If the slot points to a different issuance-set key, EUDIPLO moves the slot to the new set and revokes every status-list entry associated with the previous set.

The slot update is protected by a unique constraint and optimistic version check so concurrent first requests converge on one active issuance set. The new status entry is allocated before the prior set is revoked, so an allocation failure does not revoke the holder's currently active credential.

For deferred issuance, EUDIPLO persists only the opaque issuance-set key with the deferred transaction. When the credential is completed later, it uses that same key so deferred credentials remain part of the access token's original batch.

### Operational Considerations

Enable this policy only when invalidating the prior credential is the desired business outcome. A new access token that issues a credential immediately makes credentials issued with the previous token revoked, which can interrupt a holder who is still using them. An access token must remain bound to one holder; sharing a token causes the issuances it authorizes to be treated as one batch.

Revocation takes effect for relying parties that check the credential's OAuth Token Status List. A verifier operating offline, using cached status information, or not checking status at all can continue accepting a replaced credential until it refreshes the status list or changes its verification policy. See [Status Management](status-management.md) for cache and update behavior.

## Embedded Disclosure Policy

The `embeddedDisclosurePolicy` field defines rules for selective disclosure when the credential is presented.

## Interactive Authorization Actions

The `iaeActions` field defines a sequence of interactive authorization steps required before credential issuance. See the [Architecture documentation](../architecture/authorization.md) for details on the Interactive Authorization Endpoint (IAE).

## Complete Configuration Example

```json
{
    "id": "citizen-credential",
    "description": "Citizen credential with full features",
    "config": {
        "format": "dc+sd-jwt",
        "display": [
            {
                "name": "Citizen Credential",
                "locale": "en-US",
                "logo": {
                    "url": "/img/citizen-logo.png"
                },
                "background_color": "#12107c",
                "text_color": "#FFFFFF"
            }
        ]
    },
    "vct": "urn:citizen:credential:1",
    "keyChainId": "default-signing-key",
    "lifeTime": 31536000,
    "statusManagement": true,
    "keyBinding": true,
    "attributeProviderId": "citizen-claims-provider",
    "webhookEndpointId": "issuance-notifications",
    "fields": [
        {
            "path": ["given_name"],
            "type": "string",
            "mandatory": true,
            "disclosable": true,
            "display": [{ "lang": "en-US", "label": "Given Name" }]
        },
        {
            "path": ["family_name"],
            "type": "string",
            "mandatory": true,
            "disclosable": true
        },
        {
            "path": ["birthdate"],
            "type": "string",
            "mandatory": true,
            "disclosable": true
        }
    ]
}
```
