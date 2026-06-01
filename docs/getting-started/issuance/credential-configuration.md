# Credential Configuration

Credential configurations define the structure and behavior of individual
credentials. Each credential type has its own configuration.

---

## Basic Structure

Each credential configuration is a JSON object that defines how a specific credential type should be issued. The configuration includes metadata, display information, field definitions (`fields[]`), and optional features like key binding and status management.

For a complete configuration example, see the [Complete Configuration Example](#complete-configuration-example) section at the bottom of this page.

!!! Info

    The data object for the import can be found in the [API Documentation](../../api/openapi.md)

---

## Configuration Fields

### Required Fields

- `id`: **REQUIRED** - Unique identifier for the credential configuration that will be used to reference this credential in the issuance metadata or in the credential offer.
- `config`: **REQUIRED** - Entry for
  [credential_configuration_supported](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-credential-issuer-metadata:~:text=the%20logo%20image.-,credential_configurations_supported,-%3A%20REQUIRED.%20Object%20that).
    - `format`: **REQUIRED** - The format of the credential. Supported formats:
        - `dc+sd-jwt` - Selective Disclosure JWT Verifiable Credentials
        - `mso_mdoc` - Mobile Document (ISO 18013-5)
    - `display`: **REQUIRED** - Display configuration for the credential,
      including name, description, locale, colors, and images.
    - `docType`: **REQUIRED for mso_mdoc** - Document type identifier (e.g., `org.iso.18013.5.1.mDL`).
    - `namespace`: **OPTIONAL for mso_mdoc** - Default namespace for claims (e.g., `org.iso.18013.5.1`). If not provided, derived from docType.

### Optional Fields

- `description`: **OPTIONAL** - Human-readable description of the credential. Will not be displayed to the end user.
- `configVersion`: **OPTIONAL** - Configuration format version. Use `2` for the field format.
- `vct`: **OPTIONAL** -
  [VC Type Metadata](https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-09.html#name-sd-jwt-vc-type-metadata)
  provided via the `/{tenantId}/credentials-metadata/vct/{id}` endpoint. This link will
  be automatically added to the credential.
- `keyChainId`: **OPTIONAL** - Unique identifier for the key chain used to sign the credential. If not provided, the key chain with `attestation` usage type will be used. See [Signing Key Chain](#signing-key-chain) for details.
- `lifeTime`: **OPTIONAL** - Credential expiration time in seconds. If
  specified, credentials will include an `exp` claim calculated as
  `iat + lifeTime`. See [Credential Expiration](#credential-expiration) for details.
- `statusManagement`: **OPTIONAL** - Enable OAuth Token Status Lists for
  credential revocation. When `true`, credentials include a `status` claim with
  revocation information. See [Status Management and Revocation](#status-management-and-revocation) for details.
- `keyBinding`: **OPTIONAL** - Enable cryptographic key binding. When `true`,
  credentials include a `cnf` claim with the holder's public key and require
  proof of possession. See [Cryptographic Key Binding](#cryptographic-key-binding) for details.
- `fields`: **REQUIRED for v2** - Field definitions (`ClaimFieldDefinition[]`) that describe claim paths, data types, defaults, disclosure behavior, and optional display labels.
- `attributeProviderId`: **OPTIONAL** - Reference to an Attribute Provider that fetches claims dynamically. See [Attribute Providers](attribute-provider.md) for details.
- `webhookEndpointId`: **OPTIONAL** - Reference to a Webhook Endpoint for receiving notifications about the issuance process. See [Notification Webhook Endpoint](#notification-webhook-endpoint) for details.
- `sdJwtTrustFormat`: **OPTIONAL (SD-JWT only)** - Controls trust signaling in issued SD-JWT credentials:
    - `x5c` (default): include the X.509 chain in the JWT header
    - `federation`: use federation issuer identity (`iss`) for trust resolution
- `embeddedDisclosurePolicy`: **OPTIONAL** - Defines the embedded disclosure policy for the credential. See [Embedded Disclosure Policy](#embedded-disclosure-policy) for details.
- `iaeActions`: **OPTIONAL** - Sequence of Interactive Authorization actions required before credential issuance. See [Interactive Authorization Actions](#interactive-authorization-actions) for details.

!!! info "Schema Metadata is managed separately"

    TS11 Schema Metadata is managed in the dedicated Schema Metadata flow, not in
    the Credential Configuration editor. Use [Schema Metadata](schema-metadata.md)
    to create and version schema metadata entries.

---

## Configuring Fields

In v2, claim content is configured through `fields[]`. Each entry describes a single claim path (or object/array node), with type information and optional defaults.

!!! info "Claims Priority System"

    EUDIPLO supports multiple ways to provide claims (configuration-level and offer-level), with a priority system that determines which claims are used. For a complete explanation of the claims priority order and when to use each method, see [Credential Offers](credential-offers.md#passing-claims).

### Static Defaults via `fields[]`

You can define defaults directly in each field using `defaultValue`:

```json
{
    "configVersion": 2,
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
            "path": ["address", "postal_code"],
            "type": "string",
            "defaultValue": "51147",
            "disclosable": true
        }
    ]
}
```

Static field defaults are useful for:

- Default values for all credentials of this type
- Fixed metadata (e.g., issuing country, issuing authority)
- Development and testing scenarios

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

---

## Notification Webhook Endpoint

You can configure a webhook endpoint to receive notifications about the issuance process. This allows you to track the status of credential issuance and take appropriate actions.

Reference a pre-configured webhook endpoint by its ID:

```json
{
    "webhookEndpointId": "my-notification-webhook"
}
```

The notification webhook endpoint will be called at various stages of the issuance process, such as:

- When a credential is successfully issued
- When an issuance request fails
- When a credential is accepted by the holder

For more details about the webhook implementation and payload structure, see [Notification Webhook Endpoint](../../architecture/webhooks.md#notification-webhook-endpoint).

!!! Info

    When a webhook endpoint is configured on credential config level, notifications are sent to this endpoint by default. It can be overridden per issuance by setting `webhookEndpointId` on the credential offer request.

---

## Selective Disclosure

In v2, selective disclosure for [SD-JWT](https://www.rfc-editor.org/rfc/rfc9901.html) is defined per field using `disclosable`.

```json
{
    "configVersion": 2,
    "fields": [
        {
            "path": ["given_name"],
            "type": "string",
            "disclosable": true
        },
        {
            "path": ["birthdate"],
            "type": "string",
            "disclosable": false
        }
    ]
}
```

This configuration allows:

- Individual disclosure control per field
- Mixing disclosable and non-disclosable fields in one credential
- Holders can choose which claims to reveal during presentation

---

## mDOC Credential Format

For issuing mobile documents following the ISO 18013-5 standard (such as Mobile Driving Licenses), use the `mso_mdoc` format.

### Basic mDOC Configuration

```json
{
    "id": "pid-mdoc",
    "description": "Personal ID as mDL",
    "config": {
        "format": "mso_mdoc",
        "docType": "org.iso.18013.5.1.mDL",
        "namespace": "org.iso.18013.5.1",
        "scope": "mdl",
        "display": [
            {
                "name": "Mobile Driving License",
                "description": "mDL Credential",
                "locale": "en-US"
            }
        ]
    },
    "configVersion": 2,
    "fields": [
        {
            "path": ["given_name"],
            "type": "string",
            "defaultValue": "ERIKA",
            "mandatory": true,
            "namespace": "org.iso.18013.5.1"
        },
        {
            "path": ["family_name"],
            "type": "string",
            "defaultValue": "MUSTERMANN",
            "mandatory": true,
            "namespace": "org.iso.18013.5.1"
        },
        {
            "path": ["issuing_country"],
            "type": "string",
            "defaultValue": "DE",
            "namespace": "org.iso.18013.5.1"
        }
    ],
    "keyBinding": true
}
```

### mDOC-Specific Fields

| Field                | Required | Description                                                                                                   |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `docType`            | Yes      | Document type identifier following ISO 18013-5 naming convention (e.g., `org.iso.18013.5.1.mDL`)              |
| `namespace`          | No       | Default namespace for fields. If not provided, derived from `docType`. For mDL, typically `org.iso.18013.5.1` |
| `fields[].namespace` | No       | Per-field namespace override. Use this when one credential includes claims from multiple namespaces.          |

### Multiple Namespaces

For credentials that require claims from multiple namespaces, set `namespace` per field:

```json
{
    "configVersion": 2,
    "config": {
        "format": "mso_mdoc",
        "docType": "org.iso.18013.5.1.mDL",
        "display": [{ "name": "mDL", "locale": "en-US" }]
    },
    "fields": [
        {
            "path": ["given_name"],
            "type": "string",
            "defaultValue": "ERIKA",
            "namespace": "org.iso.18013.5.1"
        },
        {
            "path": ["family_name"],
            "type": "string",
            "defaultValue": "MUSTERMANN",
            "namespace": "org.iso.18013.5.1"
        },
        {
            "path": ["DHS_compliance"],
            "type": "string",
            "defaultValue": "F",
            "namespace": "org.iso.18013.5.1.aamva"
        }
    ]
}
```

!!! note "Key Binding Required"

    For mDOC credentials, `keyBinding` should typically be set to `true` as the ISO 18013-5 standard requires device authentication.

!!! info "Selective Disclosure"

    Unlike SD-JWT, mDOC credentials have built-in selective disclosure at the namespace and claim level. The `fields[].disclosable` flag is ignored for mDOC format.

---

## Display Configuration

The display configuration defines how the credential appears in wallets as defined in the [OID4VCI spec](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-credential-issuer-metadata-p) for the credential metadata:

```json
{
    "display": [
        {
            "name": "Personal Identity Document",
            "description": "Official identity credential",
            "locale": "en-US",
            "background_color": "#FFFFFF",
            "text_color": "#000000",
            "logo": {
                "uri": "issuer.png"
            },
            "background_image": {
                "uri": "credential-bg.png"
            }
        }
    ]
}
```

### Display Fields

- `name`: Display name for the credential
- `description`: Brief description of the credential
- `locale`: Language/locale (BCP 47, e.g., `en-US`, `de-DE`)
- `background_color`: Background color (hex format)
- `text_color`: Text color (hex format)
- `logo`: Issuer logo configuration
- `background_image`: Background image for the credential

!!! Info

    When no uri is passed, EUDIPLO will resolve the image based the storage system, see the [image configuration](../../architecture/configuration-import.md#image-configuration). If the image cannot be found, the URI will be ignored.

---

## Signing Key Chain

The signing key chain is used to create the digital signature for the credential. It contains both the private key and its associated certificate.

For SD-JWT credentials, whether `x5c` is included is controlled by `sdJwtTrustFormat`:

- `x5c` (default): certificate chain is embedded in the SD-JWT header
- `federation`: trust signaling uses issuer federation identity (`iss`) instead of embedding `x5c`

In both modes, the selected signing key chain is still used for signing.

If no key chain is specified, the default key chain with `attestation` usage type will be used.

### Configuration

```json
{
    "keyChainId": "attestation-key-chain-1"
}
```

You can either generate key chains via the API or import them during startup. Key chains support:

- **Standalone mode**: Self-signed certificate (suitable for development/testing)
- **Internal CA mode**: CA-signed leaf certificate (satisfies HAIP section 4.5.1)

!!! note

    Key chains can be managed through the `/key-chain` API endpoint. See [Key Management](../../architecture/key-management.md) for details.

---

## Cryptographic Key Binding

Cryptographic key binding ensures that a credential can only be used by the
holder who possesses the corresponding private key. This is enabled through the
`keyBinding` configuration option.

### Configuration

```json
{
    "keyBinding": true
}
```

### How It Works

When `keyBinding` is enabled:

- The credential includes a `cnf` (confirmation claim) containing the holder's
  public key
- During credential request, the holder must provide a proof of possession of
  their private key
- The resulting credential can only be presented by the holder who has the
  private key

### Use Cases

- High-value credentials (identity documents, diplomas, licenses)
- Credentials requiring strong authentication
- Preventing credential theft or unauthorized use

---

## Status Management and Revocation

Status management allows credentials to be revoked or suspended using [OAuth
Token Status List](https://datatracker.ietf.org/doc/draft-ietf-oauth-status-list/). This is controlled by the `statusManagement` configuration
option.

### Configuration

```json
{
    "statusManagement": true
}
```

### How It Works

When `statusManagement` is enabled:

- Each issued credential includes a `status` claim with a reference to a status
  list
- The status list tracks the revocation state of individual credentials
- The status list is provided by the service and can be fetched by verifiers
- Credentials can be revoked using the `/session/revoke` endpoint
- The status list is updated immediately upon revocation

!!! info

    When a session is deleted, the relationship between the sessionId and the issued credentials is still stored to be able to revoke the credentials. Only the sessionId and the index is stored, no other personal data.

### Benefits

- Real-time revocation capability
- Standards-compliant status tracking
- Verifiers can check credential validity
- Granular control over credential lifecycle

### Status Configuration

By default EUDIPLO will create a status list where each credential is managed with one bit. This means only Valid and Revoked status is possible. To support suspension or other states like defined [specification](https://www.ietf.org/archive/id/draft-ietf-oauth-status-list-13.html#name-status-types-values), you need to update the configuration options by setting the `STATUS_BITS` options at least to `2`.

!!! warning "TODO"

    Move status configuration to the issuance config: <https://github.com/openwallet-foundation/eudiplo/issues/276>

--8<-- "docs/generated/config-status.md"

!!! info

    More granular configuration is planned for the future. When a tenant is created, it will use the same status list for all credentials. Automatic creation of new lists or dedicated lists per credential configuration is planned for the future.

---

## Credential Expiration

Credential expiration allows setting a specific lifetime for credentials using
the `lifeTime` configuration option (specified in seconds).

### Configuration

```json
{
    "config": {
        "format": "dc+sd-jwt",
        "display": [
            {
                "name": "Temporary Credential",
                "description": "Time-limited credential"
            }
        ]
    },
    "lifeTime": 3600,
    "configVersion": 2,
    "fields": [
        {
            "path": ["given_name"],
            "type": "string",
            "defaultValue": "ERIKA"
        },
        {
            "path": ["family_name"],
            "type": "string",
            "defaultValue": "MUSTERMANN"
        }
    ]
}
```

### How It Works

When `lifeTime` is specified:

- The credential includes an `exp` (expiration) claim
- The expiration time is calculated as: `iat` (issued at) + `lifeTime`
- Example: `"lifeTime": 3600` creates credentials valid for 1 hour
- Example: `"lifeTime": 86400` creates credentials valid for 24 hours

### Common Lifetime Values

| Duration | Seconds  | Use Case                    |
| -------- | -------- | --------------------------- |
| 1 hour   | 3600     | Short-term access tokens    |
| 1 day    | 86400    | Daily passes, temporary IDs |
| 1 week   | 604800   | Weekly permits              |
| 1 month  | 2592000  | Monthly subscriptions       |
| 1 year   | 31536000 | Annual licenses             |

---

## Embedded Disclosure Policy

The embedded disclosure policy defines rule to which the credential can be disclosed.

There are four supported policy mechanisms:

### None

when policy is set to `none`, then there is no restriction on disclosure and claims can be revealed without any constraints.

```json
{
    "policy": "none"
}
```

### Allow List

When policy is set to `allow`, only relying parties explicitly listed in the credential can access the claims.

```json
{
    "policy": "allowList",
    "values": ["https://relying-party-1.com", "https://relying-party-2.com"]
}
```

### Root of Trust

When policy is set to `rootOfTrust`, only relying parties that have a valid trustchain to the explicitly listed root of trust can access the claims.

```json
{
    "policy": "rootOfTrust",
    "values": ["https://root-of-trust.com"]
}
```

### Attestation Based

When policy is set to `attestationBased`, only relying parties that can present a valid attestation can access the claims.

```json
{
    "policy": "attestationBased",
    "values": [
        {
            "claims": [
                {
                    "id": "card",
                    "path": ["given_name"]
                }
            ],
            "credentials": [
                {
                    "id": "card",
                    "format": "sd-jwt-dc",
                    "meta": {
                        "vct_values": "https://example.com/member-card"
                    },
                    "trusted_authorities": [
                        {
                            "type": "aki",
                            "values": ["s9tIpPmhxdiuNkHMEWNpYim8S8Y"]
                        }
                    ]
                }
            ],
            "credential_sets": [
                {
                    "options": [["card"]]
                }
            ]
        }
    ]
}
```

---

## Interactive Authorization Actions

The `iaeActions` field allows you to define a sequence of authorization steps that must be completed before credential issuance. This is useful for:

- **Identity verification** – Request a verifiable presentation from the wallet
- **Web-based verification** – Redirect users to complete forms, payments, or external KYC
- **Multi-step workflows** – Combine multiple actions in sequence

For a complete overview of the Interactive Authorization Endpoint, see [IAE Architecture](../../architecture/iae.md).

### Configuration

```json
{
    "iaeActions": [
        {
            "type": "openid4vp_presentation",
            "label": "Identity Verification",
            "presentationConfigId": "pid-presentation-config"
        },
        {
            "type": "redirect_to_web",
            "label": "Complete Registration",
            "url": "https://example.com/register?session={auth_session}",
            "description": "Please complete the registration form"
        }
    ]
}
```

### Supported Action Types

| Action Type              | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `openid4vp_presentation` | Request a verifiable presentation from the wallet using OpenID4VP |
| `redirect_to_web`        | Redirect user to a web page for additional interaction            |

### OpenID4VP Presentation Action

| Field                  | Required | Description                                 |
| ---------------------- | -------- | ------------------------------------------- |
| `type`                 | Yes      | Must be `"openid4vp_presentation"`          |
| `label`                | No       | Display label for this step                 |
| `presentationConfigId` | Yes      | ID of the presentation configuration to use |

### Redirect to Web Action

| Field         | Required | Description                                                |
| ------------- | -------- | ---------------------------------------------------------- |
| `type`        | Yes      | Must be `"redirect_to_web"`                                |
| `label`       | No       | Display label for this step                                |
| `url`         | Yes      | URL to redirect to (supports `{auth_session}` placeholder) |
| `callbackUrl` | No       | URL for the external service to redirect back to           |
| `description` | No       | Instructions for the user (displayed in wallet)            |

!!! tip "Fallback Behavior"

    If no `iaeActions` are configured, EUDIPLO falls back to the wallet's `interaction_types_supported` preference when using the authorization code flow.

---

## Complete Configuration Example

Here's a complete example of a credential configuration (PID - Personal Identity Document) that demonstrates many of the available features:

```json
--8<-- "assets/config/demo/issuance/credentials/pid.json"
```

This example includes:

- **Required fields**: `id`, `config` with format and display information
- **Optional fields**: `description`, `vct`, `keyChainId`, `lifeTime`, `statusManagement`, `keyBinding`
- **Fields**: `configVersion: 2` and `fields[]` with typed claim definitions
- **Selective disclosure**: Per-field `disclosable` flags for SD-JWT credentials
- **Display configuration**: How the credential appears in wallets, including colors, logos, and images

You can use it as a template or use the generated [JSON Schema](https://github.com/openwallet-foundation/eudiplo/blob/main/schemas/CredentialConfigCreate.schema.json) to create your own credential configurations by modifying the fields according to your requirements.
