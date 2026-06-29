# Configuration Import

EUDIPLO supports importing configurations from JSON files on application
startup. This feature allows you to pre-configure credentials, issuance
workflows, and presentation verification rules without using the API.

## Overview

The configuration import system automatically loads and validates JSON
configuration files from the `config/` directory when the application
starts. This is particularly useful for:

- **Development environments** - Pre-load test configurations
- **Production deployments** - Bootstrap with standard configurations
- **CI/CD pipelines** - Automated environment setup
- **Multi-tenant scenarios** - Bulk import tenant-specific configurations

> When running locally with nodejs, the default directory is `assets/config/`.

## Configuration

--8<-- "docs/generated/config-config.md"

### Key Points

- **Tenant isolation**: Each tenant has its own folder (e.g., `tenant1`,
  `company-xyz`)
- **Configuration types**: types of configurations are supported
- **File naming**: Not relevant since the `id` is taken from the content of the file. For key chains, the id is specified in the JSON file's `id` field.
- **Nested structure**: Credentials and issuance configs are grouped under
  `issuance/`
- **Key chain management**: Unified key chains (keys + certificates) are stored in the `key-chains/` directory and
  will be imported automatically. After the import, the files can be removed from
  the import folder. Some KMS providers like HashiCorp Vault do not support the import feature.

## Configuration Types

### Key Chains

**Location**: `config/{tenant}/key-chains/*.json`

Import unified key chains that combine cryptographic keys and their certificates.

**Example Structure** (Standalone - self-signed):

```json
{
    "id": "039af178-3ca0-48f4-a2e4-7b1209f30376",
    "description": "Attestation signing key chain",
    "usageType": "attestation",
    "key": {
        "kty": "EC",
        "x": "pmn8SKQKZ0t2zFlrUXzJaJwwQ0WnQxcSYoS_D6ZSGho",
        "y": "rMd9JTAovcOI_OvOXWCWZ1yVZieVYK2UgvB2IPuSk2o",
        "crv": "P-256",
        "d": "rqv47L1jWkbFAGMCK8TORQ1FknBUYGY6OLU1dYHNDqU",
        "alg": "ES256"
    }
}
```

**Example Structure** (With Rotation - internal CA):

```json
{
    "id": "039af178-3ca0-48f4-a2e4-7b1209f30376",
    "description": "HAIP-compliant attestation key chain",
    "usageType": "attestation",
    "key": {
        "kty": "EC",
        "x": "pmn8SKQKZ0t2zFlrUXzJaJwwQ0WnQxcSYoS_D6ZSGho",
        "y": "rMd9JTAovcOI_OvOXWCWZ1yVZieVYK2UgvB2IPuSk2o",
        "crv": "P-256",
        "d": "rqv47L1jWkbFAGMCK8TORQ1FknBUYGY6OLU1dYHNDqU",
        "alg": "ES256"
    },
    "rotationPolicy": {
        "enabled": true,
        "intervalDays": 90,
        "certValidityDays": 365
    }
}
```

When `rotationPolicy.enabled` is `true`:

- The imported key becomes the **root CA key**
- A new **leaf signing key** is automatically generated
- The leaf certificate is signed by the imported CA key
- Supports automatic key rotation

**Example Structure** (With Provided Certificate):

```json
{
    "id": "039af178-3ca0-48f4-a2e4-7b1209f30376",
    "description": "Key chain with external certificate",
    "usageType": "access",
    "key": {
        "kty": "EC",
        "x": "...",
        "y": "...",
        "crv": "P-256",
        "d": "...",
        "alg": "ES256"
    },
    "crt": [
        "-----BEGIN CERTIFICATE-----\nLEAF_CERT...\n-----END CERTIFICATE-----",
        "-----BEGIN CERTIFICATE-----\nCA_CERT...\n-----END CERTIFICATE-----"
    ]
}
```

**Alternative Structure** (Base64 DER Without `\\n` Escapes):

```json
{
    "id": "039af178-3ca0-48f4-a2e4-7b1209f30376",
    "description": "Key chain with base64 certificates",
    "usageType": "access",
    "key": {
        "kty": "EC",
        "x": "...",
        "y": "...",
        "crv": "P-256",
        "d": "...",
        "alg": "ES256"
    },
    "crt": ["MIIBqjCCAU+gAwIBAgIBATAKBggqhkjOPQQDAjAq...", "MIIB..."]
}
```

**Key Features**:

- **Unified model**: Keys and certificates are managed together
- **Usage types**: `access`, `attestation`, `trustList`, `statusList`, `encrypt`
- **Rotation support**: Optional internal CA with automatic leaf key generation
- **Algorithm support**: ES256 (ECDSA P-256)
- **Certificate chain**: Optional certificates in `crt` (leaf first), each entry can be PEM or base64 DER
- **Validation**: Full schema validation during import

**Usage Types**:

| Usage Type    | Purpose                                            |
| ------------- | -------------------------------------------------- |
| `access`      | OAuth/OIDC access token signing and authentication |
| `attestation` | Credential/attestation signing (SD-JWT VC, mDOC)   |
| `trustList`   | Trust list signing                                 |
| `statusList`  | Status list (credential revocation) signing        |
| `encrypt`     | Encryption (JWE)                                   |

**PEM Format Notes**:

- Use `\n` escape sequences for line breaks in JSON
- Include both `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` headers
- The certificate content should be base64-encoded between the headers
- Order: leaf certificate first, then intermediate/root CA certificates
- You can provide each `crt` item either as PEM or as plain base64 DER

### Credential Configurations

**Location**: `config/{tenant}/issuance/credentials/*.json`

Define credential templates and schemas.

**Schema Reference**:
[Credential Config API](../api/openapi.md)

### Issuance Configurations

**Location**: `config/{tenant}/issuance/issuance/*.json`

Define issuance workflows and authentication requirements.

**Schema Reference**:
[Issuance Config API](../api/openapi.md)

### Presentation Configurations

**Location**: `config/{tenant}/presentation/*.json`

Define verification requirements for credential presentations.

**Schema Reference**:
[Presentation Config API](../api/openapi.md)

### Trust List Configurations

**Location**: `config/{tenant}/trust-lists/*.json`

Define trust lists for credential verification. Trust lists specify which issuers
and revocation services are trusted when verifying credentials during presentation flows.

**Schema Reference**:
[Trust List API](../api/openapi.md)

For detailed information on trust lists and their role in credential verification, see
[Trust Framework](./trust-framework.md).

### Status List Configurations

**Location**: `config/{tenant}/status-lists/*.json`

Pre-create status lists for credential revocation and suspension tracking. Status lists
are used to track the status of issued credentials without revealing which specific
credential is being checked.

**Schema Reference**:
[Status List API](../api/openapi.md)

For detailed information on status lists and their role in credential lifecycle management,
see [Status Management](./status-management.md).

### Client Configurations

**Location**: `config/{tenant}/clients/*.json`

Define client-specific configurations, including client IDs, secrets, and permissions.

**Schema Reference**:
[Client Config API](../api/openapi.md)

### Image Configuration

**Location**: `config/{tenant}/images/*`

Uploads the images to be used in in the issuer display information or for credential configs.
The reference to the image is done via the filename, e.g. `logo.png` instead of a full URL like:

```json
{
    "display": [
        {
            "name": "PID",
            "description": "PID Credential",
            "locale": "en-US",
            "background_color": "#FFFFFF",
            "text_color": "#000000",
            "background_image": {
                "uri": "identity-card.jpg"
            },
            "logo": {
                "uri": "logo.jpg"
            }
        }
    ]
}
```

When the image can not be found, the image reference is ignored.

## Import Process

### Startup Validation

During application startup, EUDIPLO:

- **Checks environment variables** - Only imports if `CONFIG_IMPORT=true`
- **Scans tenant directories** - Processes each tenant folder independently
- **Validates file structure** - Ensures required subdirectories exist
- **Reads JSON files** - Parses each configuration file

## Environment Variable Placeholders

Configuration files can contain dynamic placeholders that are replaced at import time before validation.

### Syntax

`"value": "${VAR_NAME}"` – replaced by the environment variable `VAR_NAME` if it is set and non-empty.

`"value": "${VAR_NAME:defaultValue}"` – uses `VAR_NAME` from the environment if present; otherwise falls back to `defaultValue`.

Placeholders are resolved recursively in all string fields of imported JSON objects (arrays, nested objects included). Binary buffers are ignored.

### Strict Mode Levels

`CONFIG_VARIABLE_STRICT` supports three levels to control behavior when a placeholder has no environment value and no default:

- `abort`: Throw immediately and abort the entire import process.
- `skip`: Throw for the current file (caught and logged as `ImportError`), skip that file and continue.
- `ignore`: Keep the placeholder as-is, log a warning (`ImportPlaceholder`), and continue processing.

Default behavior is `skip` in production recommendations.

### Examples

```jsonc
// Given process.env.CLIENT_ID_ROOT = "root-123"
{
    "clientId": "${CLIENT_ID_ROOT}", // => "root-123"
    "clientSecret": "${CLIENT_SECRET_ROOT:dev-secret}", // => "dev-secret" if CLIENT_SECRET_ROOT unset
}
```

Strict failure example (`CONFIG_VARIABLE_STRICT=abort`):

```jsonc
{ "apiKey": "${API_KEY}" } // throws if API_KEY not set
```

Non-strict warning example (`CONFIG_VARIABLE_STRICT=ignore` or absent / false):

```jsonc
{ "apiKey": "${API_KEY}" } // remains "${API_KEY}" and logs a warning
```

### Logging Events

| Event               | Condition                                                      |
| ------------------- | -------------------------------------------------------------- |
| `ImportPlaceholder` | Non-strict mode, missing env and no default                    |
| `ImportError`       | Strict mode, missing env and no default (file skipped)         |
| `ValidationError`   | Placeholder substituted but subsequent schema validation fails |

### Recommendations

- Prefer `${VAR:default}` for optional values to avoid noisy warnings.
- Use `CONFIG_VARIABLE_STRICT=true` in production to detect misconfiguration early.
- Keep secrets in environment variables; use defaults only for non-sensitive fallbacks.

> Note: Placeholder replacement occurs BEFORE class-validator schema validation so resolved values are validated, not the raw `${...}` tokens.

## Built-in Placeholders

In addition to environment variable placeholders, EUDIPLO provides built-in placeholders that are replaced at runtime when configurations are used.

### `<TENANT_URL>`

The `<TENANT_URL>` placeholder allows configurations to be instance-independent. When a configuration is used, this placeholder is automatically replaced with the full URL including the host and tenant ID.

**Use Case**: This is particularly useful for portable configurations that need to reference URLs within the same tenant but should work across different deployments (e.g., development, staging, production) without modification.

**Common Examples**:

- **Verifiable Credential Type (vct)**: Use `<TENANT_URL>/credentials/pid` as the `vct` value to create instance-independent credential type identifiers
- **Trust List references**: Point to trust lists hosted on the same instance, e.g., `<TENANT_URL>/trust-lists/eu-trust-list`

**Example**:

```json
{
    "vct": "<TENANT_URL>/credentials/pid",
    "trustList": "<TENANT_URL>/trust-lists/my-trust-list"
}
```

When used in a tenant with ID `company-xyz` on host `https://eudiplo.example.com`, the placeholder is replaced with:

```json
{
    "vct": "https://eudiplo.example.com/company-xyz/credentials/pid",
    "trustList": "https://eudiplo.example.com/company-xyz/trust-lists/my-trust-list"
}
```

This enables sharing configuration files between environments without hardcoding URLs.

### Validation and Processing

For each configuration file:

- **JSON parsing** - Validates file syntax
- **Schema validation** - Uses the same validators as the API endpoints
- **Dependency checking** - Verifies referenced configurations exist
- **Duplicate handling** - Respects `CONFIG_IMPORT_FORCE` setting

### Error Handling

Invalid configurations are handled gracefully:

- **Validation errors** are logged with detailed information
- **Invalid files are skipped** - Import continues with remaining files
- **Missing dependencies** are reported
- **Existing configurations** are preserved unless force mode is enabled

## Logging

Import activities are logged with structured information:

```json
{
    "event": "Import",
    "tenant": "company-xyz",
    "files": 5,
    "message": "5 credential configs imported for company-xyz"
}
```

**Key import logging**:

```json
{
    "event": "Import",
    "tenant": "company-xyz",
    "message": "3 keys imported for company-xyz"
}
```

**Error logging** includes detailed validation information:

```json
{
    "event": "ValidationError",
    "file": "invalid-config.json",
    "tenant": "company-xyz",
    "errors": [
        {
            "property": "credentialConfigs",
            "constraints": { "isArray": "credentialConfigs must be an array" },
            "value": "not-an-array"
        }
    ]
}
```

## Best Practices

### Configuration Management

- **Use descriptive filenames** that reflect the configuration purpose
- **Test configurations** in development before deploying
- **Document tenant-specific configurations**

### Production Deployment

- **Set `CONFIG_IMPORT=true`** only for initial deployment
- **Use `CONFIG_IMPORT_FORCE=false`** to prevent accidental overwrites
- **Monitor logs** for validation errors during startup
- **Manage configurations via API** after initial import

### Multi-Tenant Setup

```bash
# Organize by tenant/organization
assets/config/
├── acme-corp/
│   ├── keys/
│   ├── certs/
│   ├── issuance/
│   ├── presentation/
│   ├── trustlists/
│   └── status-lists/
├── university-x/
│   ├── keys/
│   ├── certs/
│   ├── issuance/
│   ├── presentation/
│   ├── trustlists/
│   └── status-lists/
└── government-agency/
    ├── keys/
    ├── certs/
    ├── issuance/
    ├── presentation/
    ├── trustlists/
    └── status-lists/
```

Even when you just have one tenant, use a folder structure to prepare for future
multi-tenancy.

## Troubleshooting

### Common Issues

**Import not running**: Check `CONFIG_IMPORT=true` is set

**Configurations not updating**: Set `CONFIG_IMPORT_FORCE=true` to overwrite
existing

**Validation errors**: Check logs for specific validation failures and schema
requirements

**Missing dependencies**: Ensure credential configs are imported before issuance
configs that reference them

**Key validation errors**: Check that imported keys use supported algorithms
(ES256) and have valid JWK format

**Certificate import issues**: Verify certificates are in PEM format and match
the imported private key

## Security Considerations

- **File permissions** - Ensure config files have appropriate read permissions
- **Tenant isolation** - Verify tenant boundaries are properly maintained

!!! warning

    Avoid storing sensitive information (e.g., private keys, secrets) in
    configuration files. Use [environment variables](#environment-variable-placeholders)
    for sensitive data and reference them using placeholders.
