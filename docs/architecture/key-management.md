# Key Management

The keys used for **signing operations** in EUDIPLO can be managed by one or
more KMS (Key Management System) providers running simultaneously. Providers are
configured in a single `kms.json` file inside the config folder.

> 💡 **Encryption operations** always use database-stored keys and are independent from the KMS providers configured for signing.

## Available Providers

| Provider                            | Type     | Description                            | Import Support |
| ----------------------------------- | -------- | -------------------------------------- | -------------- |
| [`db`](#database-key-management-db) | Built-in | Keys stored encrypted in the database  | ✅ Yes         |
| [`vault`](#vault-hashicorp-vault)   | Built-in | HashiCorp Vault Transit secrets engine | ❌ No          |
| [`aws-kms`](#aws-kms)               | Built-in | AWS Key Management Service             | ❌ No          |
| [`pkcs11`](#pkcs11-hsm)             | Built-in | PKCS#11 Hardware Security Module       | ❌ No          |
| [`http`](#http-remote-kms)          | Built-in | Remote KMS microservice (HTTP/HTTPS)   | ✅ Optional    |

## Configuration

KMS providers are configured in `<CONFIG_FOLDER>/kms.json`. If no file is found,
a single `db` provider is registered automatically.

```json
{
    "defaultProvider": "db",
    "providers": [
        { "id": "db", "type": "db", "description": "Default database provider" },
        {
            "id": "vault",
            "type": "vault",
            "description": "HashiCorp Vault",
            "vaultUrl": "http://localhost:8200",
            "vaultToken": "your-vault-token"
        },
        {
            "id": "aws",
            "type": "aws-kms",
            "description": "AWS KMS",
            "region": "eu-central-1"
        }
    ]
}
```

| Field             | Description                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| `defaultProvider` | ID of the provider used when no explicit `kmsProvider` is specified (default: `db`). |
| `providers`       | Array of provider configurations. Each entry must have a unique `id` and a `type`.   |

Each provider entry has:

| Field         | Description                                                              |
| ------------- | ------------------------------------------------------------------------ |
| `id`          | Unique identifier for the provider instance (used when generating keys). |
| `type`        | Adapter type: `db`, `vault`, `aws-kms`, or `pkcs11`.                     |
| `description` | Optional human-readable description.                                     |
| ...           | Additional type-specific configuration fields.                           |

Environment-variable placeholders (`${VAULT_URL}`, `${VAULT_TOKEN:default}`) are
resolved at startup, so secrets can still be injected through the environment.

When generating or importing a key through the API, include the `kmsProvider`
field to select a specific provider by its `id`. If omitted, the `defaultProvider` is used.

### Multiple Providers of the Same Type

You can configure multiple instances of the same provider type with different IDs:

```json
{
    "defaultProvider": "main-vault",
    "providers": [
        { "id": "db", "type": "db" },
        {
            "id": "main-vault",
            "type": "vault",
            "description": "Production Vault",
            "vaultUrl": "${VAULT_URL}",
            "vaultToken": "${VAULT_TOKEN}"
        },
        {
            "id": "backup-vault",
            "type": "vault",
            "description": "Backup Vault",
            "vaultUrl": "${BACKUP_VAULT_URL}",
            "vaultToken": "${BACKUP_VAULT_TOKEN}"
        }
    ]
}
```

---

## Database Key Management (`db`)

When the `db` provider is configured (the default), keys are stored encrypted in the
database. This mode is ideal for development or testing.

### Key Chain Support

Each tenant can manage multiple key chains simultaneously. Each key chain has a unique ID and is isolated via the `tenant_id` field.

Key chains are unified entities containing both keys and certificates, organized by usage type (`access`, `attestation`, `trustList`, `statusList`, `encrypt`).

---

## Vault (HashiCorp Vault)

To use [HashiCorp Vault](https://www.vaultproject.io/) for key management,
add a `vault` entry to the `providers` array in `kms.json`:

```json
{
    "defaultProvider": "vault",
    "providers": [
        { "id": "db", "type": "db" },
        {
            "id": "vault",
            "type": "vault",
            "description": "HashiCorp Vault",
            "vaultUrl": "http://localhost:8200",
            "vaultToken": "your-vault-token"
        }
    ]
}
```

| Field        | Description                                     |
| ------------ | ----------------------------------------------- |
| `vaultUrl`   | Base URL of the Vault server (without `/v1/…`). |
| `vaultToken` | Authentication token for Vault API access.      |

You can use environment-variable placeholders to avoid storing secrets in the
config file:

```json
{
    "id": "vault",
    "type": "vault",
    "vaultUrl": "${VAULT_URL}",
    "vaultToken": "${VAULT_TOKEN}"
}
```

### Transit Mount Auto-Creation

For each tenant, a **transit secret engine** mount is created automatically on
first use. If the mount already exists the creation step is silently skipped
(idempotent). If a Vault API call returns **404** (mount not found), the service
retries the operation once after creating the mount.

To issue credentials, you need to have a signed certificate for the public key
that is bound to your domain.

In this mode:

- All **signing operations** are delegated to Vault via its API.
- The **private key never leaves** the Vault server.
- A **stub key entity** is stored in the database for tracking purposes (no
  private key material).
- Access can be tightly controlled using Vault's policies and authentication
  mechanisms.

Vault is well-suited for production environments where secure, auditable key
usage is required.

---

## AWS KMS

To use [AWS Key Management Service](https://aws.amazon.com/kms/) for key management,
add an `aws-kms` entry to the `providers` array in `kms.json`:

```json
{
    "defaultProvider": "aws",
    "providers": [
        { "id": "db", "type": "db" },
        {
            "id": "aws",
            "type": "aws-kms",
            "description": "AWS KMS",
            "region": "eu-central-1"
        }
    ]
}
```

| Field             | Description                                                                   |
| ----------------- | ----------------------------------------------------------------------------- |
| `region`          | AWS region where KMS keys will be created (required).                         |
| `accessKeyId`     | AWS access key ID (optional — uses SDK credential chain if not provided).     |
| `secretAccessKey` | AWS secret access key (optional — uses SDK credential chain if not provided). |

You can use environment-variable placeholders to avoid storing secrets in the
config file:

```json
{
    "id": "aws",
    "type": "aws-kms",
    "region": "${AWS_REGION}",
    "accessKeyId": "${AWS_ACCESS_KEY_ID}",
    "secretAccessKey": "${AWS_SECRET_ACCESS_KEY}"
}
```

### Authentication

If `accessKeyId` and `secretAccessKey` are not provided, the adapter uses the
[AWS SDK default credential chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html),
which supports:

- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- Shared credentials file (`~/.aws/credentials`)
- IAM roles for EC2/ECS/Lambda
- Web identity tokens (EKS IRSA)

This is the recommended approach for production deployments.

### Key Creation

Keys are created as **asymmetric ECC_NIST_P256** keys with `SIGN_VERIFY` usage.
Each key is tagged with:

- `TenantId` — the tenant identifier
- `LocalKeyId` — the local key ID stored in the database
- `ManagedBy` — set to `eudiplo`

### Key Deletion

When deleting a key, AWS KMS schedules it for deletion with a **7-day pending
window** (the minimum allowed by AWS). The local database reference is removed
immediately.

In this mode:

- All **signing operations** are delegated to AWS KMS via its API.
- The **private key never leaves** AWS KMS.
- A **stub key entity** is stored in the database for tracking purposes (no
  private key material).
- Access can be controlled using AWS IAM policies and KMS key policies.

AWS KMS is well-suited for production environments on AWS where you need
HSM-backed keys, audit logging via CloudTrail, and fine-grained access control.

> ⚠️ **Note**: AWS KMS does not support importing EC keys. Use `create` to
> generate new keys directly in AWS KMS.

---

## PKCS#11 (HSM)

To use a **Hardware Security Module** (HSM) or any PKCS#11-compatible token
(YubiHSM 2, Thales Luna, AWS CloudHSM, SoftHSM2, Nitrokey HSM, …) for key
management, add a `pkcs11` entry to the `providers` array in `kms.json`:

```json
{
    "defaultProvider": "hsm",
    "providers": [
        { "id": "db", "type": "db" },
        {
            "id": "hsm",
            "type": "pkcs11",
            "description": "Production HSM",
            "library": "/usr/lib/softhsm/libsofthsm2.so",
            "slot": 0,
            "pin": "${HSM_PIN}",
            "readOnly": false
        }
    ]
}
```

| Field      | Description                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `library`  | Absolute path to the vendor-provided PKCS#11 shared library (`.so` on Linux, `.dylib` on macOS, `.dll` on Windows). **Required**.                               |
| `slot`     | Either the numeric slot index (e.g. `0`) **or** a token label string (e.g. `"eudiplo-token"`) — the adapter resolves labels via `C_GetTokenInfo`. **Required**. |
| `pin`      | User PIN used for `C_Login(CKU_USER, …)`. Use environment-variable placeholders to keep it out of the config file. **Required**.                                |
| `readOnly` | If `true`, the session is opened without `CKF_RW_SESSION`. Defaults to `false`. Set to `true` only when you do not need to create/delete keys.                  |

### Native Dependency

The adapter is built on top of [`pkcs11js`](https://www.npmjs.com/package/pkcs11js),
which is a native (N-API) Node.js binding. It is part of the regular backend
dependencies and is built automatically on `pnpm install` (the package is
listed under `allowBuilds` / `onlyBuiltDependencies` in `pnpm-workspace.yaml`).

You still need the **vendor's PKCS#11 library** (`.so` / `.dylib` / `.dll`)
installed on the host where the backend runs, and the path provided via the
`library` field must be readable by the backend process.

### Key Creation

Keys are generated **inside the HSM** using `C_GenerateKeyPair` with:

- Mechanism: `CKM_EC_KEY_PAIR_GEN`
- Curve: **P-256 / secp256r1** (only `ES256` is supported)
- Private key attributes: `CKA_SENSITIVE=true`, `CKA_EXTRACTABLE=false`,
  `CKA_PRIVATE=true`, `CKA_SIGN=true`
- Public key attributes: `CKA_VERIFY=true`, `CKA_TOKEN=true`
- `CKA_LABEL` is set to the EUDIPLO key ID (`kid`) on both objects so the
  adapter can look them up later.

The public key is read back from the HSM (`CKA_EC_POINT`), wrapped into a P-256
SPKI DER, and exported as a JWK that is cached in the database for fast access.

### Signing

For each signature the adapter:

1. Computes the SHA-256 digest of the payload in Node.
2. Looks up the private key object by `CKA_LABEL = kid` (`C_FindObjects`).
3. Calls `C_SignInit` + `C_Sign` with mechanism `CKM_ECDSA` and the digest.
4. Returns the raw `r || s` signature (64 bytes) directly to the JOSE layer.

The **private key never leaves the HSM**. EUDIPLO only stores a stub entity
(label + cached public JWK) in the database for tracking.

### Key Deletion

`deleteKey` calls `C_DestroyObject` on both the private and public key objects
matched by `CKA_LABEL`. Per-object errors are swallowed so a partial cleanup
still removes what it can.

### Import

Importing existing key material is **not supported**. HSM-backed keys must be
generated inside the HSM. Use `create` to provision new keys.

### Health

The `health()` endpoint opens (or reuses) the session and reports latency. A
failing PIN, missing library, or unavailable slot is surfaced as `{ ok: false,
error }`.

### Examples

**SoftHSM2** (local dev / CI):

```bash
softhsm2-util --init-token --slot 0 \
    --label eudiplo --pin 1234 --so-pin 1234
```

```json
{
    "id": "softhsm",
    "type": "pkcs11",
    "library": "/usr/lib/softhsm/libsofthsm2.so",
    "slot": "eudiplo",
    "pin": "${SOFTHSM_PIN}"
}
```

**YubiHSM 2** (via yubihsm-pkcs11):

```json
{
    "id": "yubihsm",
    "type": "pkcs11",
    "library": "/usr/local/lib/pkcs11/yubihsm_pkcs11.dylib",
    "slot": 0,
    "pin": "${YUBIHSM_PIN}"
}
```

**AWS CloudHSM** (via the CloudHSM PKCS#11 SDK):

```json
{
    "id": "cloudhsm",
    "type": "pkcs11",
    "library": "/opt/cloudhsm/lib/libcloudhsm_pkcs11.so",
    "slot": 0,
    "pin": "${CLOUDHSM_USER}:${CLOUDHSM_PASSWORD}"
}
```

In this mode:

- All **signing operations** are delegated to the HSM via PKCS#11.
- The **private key never leaves** the HSM.
- A **stub key entity** is stored in the database (label + cached public JWK).
- Access is controlled by the HSM itself (PIN, partitions, slot policies).

PKCS#11 is well-suited for regulated production environments where keys must
be protected by certified hardware (FIPS 140-2/3, Common Criteria).

> ⚠️ **Only ES256 is supported.** Other curves and RSA are not enabled — open
> an issue if you need additional algorithms.

---

## HTTP (Remote KMS)

The `http` provider delegates **all key operations** to a remote microservice
over HTTP/HTTPS. This is useful when:

- You already operate a centralised KMS service and want EUDIPLO to use it
  without duplicating key-management logic.
- You need to separate the signing service from the main application for
  compliance or deployment reasons (e.g. separate network zone).
- You want to implement a custom HSM or key-management backend without
  modifying EUDIPLO's source code.

### Configuration

Add an `http` entry to the `providers` array in `kms.json`:

```json
{
    "defaultProvider": "remote-kms",
    "providers": [
        { "id": "db", "type": "db" },
        {
            "id": "remote-kms",
            "type": "http",
            "description": "Central KMS microservice",
            "baseUrl": "${KMS_SERVICE_URL}",
            "apiKey": "${KMS_API_KEY}"
        }
    ]
}
```

| Field        | Description                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`    | Base URL of the remote service (no trailing slash). **Required**. Supports `${ENV_VAR}` placeholders.                  |
| `apiKey`     | Bearer token sent as `Authorization: Bearer <apiKey>`. Optional — omit for unauthenticated internal services.          |
| `keysPath`   | Path prefix for key endpoints. Defaults to `/keys`. Adjust if your service mounts the API elsewhere (e.g. `/v1/keys`). |
| `healthPath` | Path of the health check endpoint. Defaults to `/health`.                                                              |
| `canImport`  | Set to `true` to enable `POST {keysPath}/{kid}/import`. Defaults to `false`.                                           |

### Remote Service API Contract

The remote microservice must implement the following endpoints:

#### `POST {keysPath}` — generate a key

Request body:

```json
{ "kid": "my-key-id", "alg": "ES256" }
```

Response `200`:

```json
{ "publicJwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." } }
```

#### `POST {keysPath}/{kid}/sign` — produce a signature

Request body:

```json
{ "data": "<base64-encoded bytes>", "alg": "ES256" }
```

Response `200`:

```json
{ "signature": "<base64url-encoded raw r‖s (64 bytes for P-256)>" }
```

The signature must be the raw `r || s` concatenation (not DER-encoded)
so it is directly usable in JOSE / COSE.

#### `DELETE {keysPath}/{kid}` — delete a key

Response: `204 No Content`

#### `GET {healthPath}` — health check

Response `200`:

```json
{ "ok": true }
```

#### `POST {keysPath}/{kid}/import` — import a private JWK (optional)

Enabled only when `canImport: true` is set.

Request body:

```json
{ "privateJwk": { "kty": "EC", "crv": "P-256", "d": "...", ... }, "alg": "ES256" }
```

Response `200`:

```json
{ "publicJwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." } }
```

Return `404` or `405` if your service does not support import — EUDIPLO will
propagate the error.

### Authentication

If `apiKey` is set, every request carries `Authorization: Bearer <apiKey>`.
For mTLS or other auth mechanisms, place a sidecar proxy (e.g. Envoy, NGINX)
in front of the KMS service and leave `apiKey` unset.

### Example: minimal Express microservice

Below is a minimal Node.js/Express reference implementation that stores keys
in memory. **Do not use this in production** — it is provided as a starting
point for building a real service.

```js
import express from 'express';
import { generateKeyPair, exportJWK, importJWK } from 'jose';
import { createSign } from 'node:crypto';

const app = express();
app.use(express.json());

const keys = new Map(); // kid → { privateKey, publicJwk }

// Generate
app.post('/keys', async (req, res) => {
    const { kid, alg } = req.body;
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const publicJwk = await exportJWK(publicKey);
    keys.set(kid, { privateKey, publicJwk });
    res.json({ publicJwk });
});

// Sign
app.post('/keys/:kid/sign', async (req, res) => {
    const entry = keys.get(req.params.kid);
    if (!entry) return res.status(404).json({ error: 'key not found' });
    const data = Buffer.from(req.body.data, 'base64');
    // ... produce raw r||s using your preferred library
    res.json({ signature: '<base64url r||s>' });
});

// Delete
app.delete('/keys/:kid', (req, res) => {
    keys.delete(req.params.kid);
    res.status(204).send();
});

// Health
app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(3001);
```

In this mode:

- All **signing operations** are delegated to the remote service.
- EUDIPLO only stores a stub entity (kid + cached public JWK) locally.
- The remote service is fully responsible for protecting the private keys.

---

## Extensibility

The key management system is designed to be **extensible**. You can integrate
other key management backends such as:

- ✅ AWS KMS (built-in)
- 🔐 Azure Key Vault
- 🔐 Google Cloud KMS
- 🔐 Hardware Security Modules (HSMs)

To add a new backend:

1. Create a new class extending `KmsAdapter` (see `aws-kms-key.service.ts` or
   `vault-key.service.ts` for reference).
2. Register a factory function for the new type in `kms-adapter.factory.ts`.
3. Add a config DTO in `dto/kms-config.dto.ts` extending `BaseKmsProviderConfigDto`.
4. Add the provider entry to `kms.json`:

```json
{
    "providers": [
        {
            "id": "azure",
            "type": "azure-kv",
            "description": "Azure Key Vault",
            "vaultUrl": "https://my-vault.vault.azure.net",
            "tenantId": "...",
            "clientId": "..."
        }
    ]
}
```

If you need help integrating a new provider, feel free to open an issue or
contact the maintainers.

---

## Key Chains

EUDIPLO uses a unified **Key Chain** model that combines cryptographic keys and their certificates into a single managed entity. This eliminates orphaned keys and simplifies key lifecycle management.

### Key Chain Model

A Key Chain encapsulates:

- **Active signing key** with its certificate
- **Optional root CA key** (for internal certificate chains / rotation)
- **Previous key** (for grace period after rotation)
- **Rotation policy** (automatic certificate renewal)

```
┌─────────────────────────────────────────────┐
│               Key Chain                      │
├─────────────────────────────────────────────┤
│  Root CA Key (optional)                      │
│  Root CA Certificate (self-signed)           │
├─────────────────────────────────────────────┤
│  Active Signing Key                          │
│  Active Certificate (CA-signed or self)      │
├─────────────────────────────────────────────┤
│  Previous Key (optional, grace period)       │
│  Previous Certificate                        │
├─────────────────────────────────────────────┤
│  Rotation Policy                             │
│  - Interval Days                             │
│  - Certificate Validity Days                 │
└─────────────────────────────────────────────┘
```

### Usage Types

Each key chain is assigned a usage type that determines how it can be used:

| Usage Type    | Purpose                                            |
| ------------- | -------------------------------------------------- |
| `access`      | OAuth/OIDC access token signing and authentication |
| `attestation` | Credential/attestation signing (SD-JWT VC, mDOC)   |
| `trustList`   | Trust list signing                                 |
| `statusList`  | Status list (credential revocation) signing        |
| `encrypt`     | Encryption (JWE)                                   |

!!! note "Attestation fallback for status lists"

    If no `statusList` key chain is configured, the `attestation` key chain is
    used as a fallback for signing status list JWTs. This keeps status lists
    under the same trust anchor as the issued credentials. Create a dedicated
    `statusList` key chain only when a different signing key is required.

### Key Chain Types

**Standalone Key Chain**:

- Single key with self-signed certificate
- Suitable for development/testing
- No rotation support

**Internal CA Key Chain** (Rotation Enabled):

- Root CA key signs leaf certificates
- Active key is separate from root CA
- Supports automatic rotation
- Satisfies HAIP section 4.5.1 requirement (credentials MUST NOT be signed with self-signed certificates)

### Automatic Key Chain Generation

On startup, if no key chains are found for a tenant, the service automatically generates key chains for each required usage type:

- `access` - For OAuth/OIDC operations
- `attestation` - For credential signing

### Certificate Chain Support

When using internal CA key chains, the certificate includes a full chain:

1. **Leaf certificate** (signs credentials/tokens)
2. **Root CA certificate** (signs leaf certificates)

This chain is included in the `x5c` header of signed tokens.

### Certificate Format

Certificates must be in PEM format:

- Use `\n` escape sequences in JSON
- Include both `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` headers
- Base64-encoded DER content between headers

### Certificate Validation

Certificates are validated during import:

- PEM format verification
- Public key matching with associated key
- Certificate expiration checking
- X.509 standard compliance

When using the [Registrar](../getting-started/registrar.md), it will generate a certificate for the public key that can be used to secure the OID4VCI and OID4VP requests.

> Note: In the future the access certificate generation will follow the official standard that is under development right now.

---

## Multi-Tenant Key Management

### Automatic Key Chain Generation

**Tenant Initialization Process:**

1. Client registers with credentials (`client_id`, `client_secret`)
2. Key chains automatically generated for each required usage type
3. Keys and certificates stored in the unified key chain
4. Certificates linked to keys in the same entity

## Key Chain Import and Management

EUDIPLO supports importing key chains through multiple methods to accommodate
different deployment scenarios and security requirements.

### API-Based Key Chain Import

Import key chains through the REST API using authenticated requests:

**Endpoint**: `POST /key-chain`

**Request Body** (Standalone - self-signed certificate):

```json
{
    "id": "optional-uuid",
    "usageType": "attestation",
    "key": {
        "kty": "EC",
        "x": "pmn8SKQKZ0t2zFlrUXzJaJwwQ0WnQxcSYoS_D6ZSGho",
        "y": "rMd9JTAovcOI_OvOXWCWZ1yVZieVYK2UgvB2IPuSk2o",
        "crv": "P-256",
        "d": "rqv47L1jWkbFAGMCK8TORQ1FknBUYGY6OLU1dYHNDqU",
        "alg": "ES256"
    },
    "description": "Optional description"
}
```

**Request Body** (With Rotation - imported key becomes root CA):

```json
{
    "id": "optional-uuid",
    "usageType": "attestation",
    "key": {
        "kty": "EC",
        "x": "pmn8SKQKZ0t2zFlrUXzJaJwwQ0WnQxcSYoS_D6ZSGho",
        "y": "rMd9JTAovcOI_OvOXWCWZ1yVZieVYK2UgvB2IPuSk2o",
        "crv": "P-256",
        "d": "rqv47L1jWkbFAGMCK8TORQ1FknBUYGY6OLU1dYHNDqU",
        "alg": "ES256"
    },
    "description": "HAIP-compliant key chain with CA-signed leaf",
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
- This satisfies HAIP section 4.5.1 (credentials MUST NOT be signed with self-signed certificates)

**Response**:

```json
{
    "id": "039af178-3ca0-48f4-a2e4-7b1209f30376"
}
```

### Configuration-Based Key Chain Import

Import key chains automatically during application startup using the configuration
import system.

**Environment Variables**:

```bash
CONFIG_IMPORT=true
CONFIG_IMPORT_FORCE=false  # Set to true to overwrite existing key chains
```

**Directory Structure**:

```shell
assets/config/
├── tenant-1/
│   └── key-chains/
│       ├── attestation.json
│       ├── access.json
│       └── status-list.json
└── tenant-2/
    └── key-chains/
        └── attestation.json
```

**Key Chain File Format** (Standalone):

```json
{
    "id": "uuid-for-this-key-chain",
    "description": "Attestation signing key chain",
    "usageType": "attestation",
    "key": {
        "kty": "EC",
        "x": "...",
        "y": "...",
        "crv": "P-256",
        "d": "...",
        "alg": "ES256"
    }
}
```

**Key Chain File Format** (With Rotation / Internal CA):

```json
{
    "id": "uuid-for-this-key-chain",
    "description": "HAIP-compliant attestation key chain",
    "usageType": "attestation",
    "key": {
        "kty": "EC",
        "x": "...",
        "y": "...",
        "crv": "P-256",
        "d": "...",
        "alg": "ES256"
    },
    "rotationPolicy": {
        "enabled": true,
        "intervalDays": 90,
        "certValidityDays": 365
    }
}
```

**Key Chain File Format** (With Provided Certificate):

```json
{
    "id": "uuid-for-this-key-chain",
    "description": "Key chain with external certificate",
    "usageType": "attestation",
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

### Key Chain Management Operations

For detailed key chain management endpoints, parameters, and request/response schemas, see:

**API Reference**: [Key Chain API Endpoints](../api/openapi.md)

Available operations include listing key chains, importing key chains, rotating keys, and managing key chain metadata.

### Supported Key Formats

- **Algorithm Support**: ES256 (ECDSA P-256)
- **Key Format**: JSON Web Key (JWK) format
- **Certificate Support**: Optional X.509 certificates in PEM format (leaf first, then CA chain)
- **Key Generation**: Automatic generation if no key chains exist

---

## Cryptographic Invariants

The KMS abstraction enforces a small set of invariants across all providers:

- **Private keys never leave the backend** for external providers (`vault`,
  `aws-kms`). The `KeyChainEntity` only stores the **public** JWK for those
  providers; signing requests are dispatched through the adapter's `sign()`
  call. The `db` provider is the only adapter that materialises the private
  JWK, and it does so inside the encrypted `activeJwk` column.
- **Algorithm-aware signing**: every adapter advertises a `capabilities`
  descriptor (`{ supportedAlgs, defaultAlg, canCreate, canImport, canDelete }`).
  Callers may pass an explicit `alg` when signing; otherwise the adapter's
  `defaultAlg` is used. The current shipping default is **ES256** for all
  built-in adapters.
- **X.509 signing via `KmsCryptoProvider`**: `@peculiar/x509` is wired through
  a global crypto provider that delegates signature generation back to the
  resolved KMS adapter. This means certificate creation (self-signed CA,
  CA-signed leaves, rotation) works uniformly across `db`, `vault`, and
  `aws-kms` without ever exposing private key material to the Node process.
- **AWS DER → raw signature conversion**: AWS KMS returns ECDSA signatures in
  DER encoding. The adapter converts them to the JOSE raw `r || s` format
  (32-byte components for P-256) before returning to callers, so downstream
  JWS/COSE consumers see a uniform signature shape regardless of backend.
- **Vault transit auto-mount**: the Vault adapter creates the per-tenant
  transit mount on first use. Mount creation is idempotent — HTTP **400/409**
  responses (mount already exists) are treated as success, and a single retry
  is performed on **404** after mount creation.

## Public JWK Cache

External KMS adapters (`vault`, `aws-kms`) cache resolved public JWKs in
memory with a **5-minute TTL** (per-adapter `PublicJwkCache`). This avoids
repeated round-trips to fetch the public key for every signing operation:

- The cache key is the external key identifier (`externalKeyId` or
  `storedJwk.kid`).
- Entries are invalidated automatically when a key is deleted through the
  adapter.
- The cache is purely best-effort; cache misses fall back to the provider API.

The `db` adapter does not need the cache because the public JWK is derived
locally from the stored private JWK.

## Provider Health Endpoint

A read-only health probe is exposed for every registered KMS provider:

```http
GET /key-chain/providers/health
```

Response shape (per provider):

```json
[
    {
        "providerId": "db",
        "type": "db",
        "ok": true,
        "latencyMs": 0
    },
    {
        "providerId": "vault",
        "type": "vault",
        "ok": true,
        "latencyMs": 12
    },
    {
        "providerId": "aws",
        "type": "aws-kms",
        "ok": false,
        "error": "AccessDenied: User is not authorized to perform: kms:ListKeys"
    }
]
```

What each adapter checks:

| Adapter   | Probe                                              |
| --------- | -------------------------------------------------- |
| `db`      | Always `ok: true` with `latencyMs: 0` (in-process) |
| `vault`   | `GET ${vaultUrl}/v1/sys/health`                    |
| `aws-kms` | `ListKeys` with `Limit: 1`                         |

Probes run in parallel and a failure of one provider does not affect the
others. Use this endpoint as a readiness signal for orchestration and for
alerting on stale credentials.
