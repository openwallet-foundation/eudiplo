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
