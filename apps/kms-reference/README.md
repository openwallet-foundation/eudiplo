# KMS Reference Implementation

A reference KMS microservice for integrating with and testing the EUDIPLO
backend's `HttpKmsAdapter`.

> ⚠️ **Development and testing only.**  
> Keys are held in memory and **lost on every restart**. Use a real KMS
> (HashiCorp Vault, AWS KMS, PKCS#11 HSM) in production environments.

This serves as both:

1. A **test server** for local development — start it alongside the backend and
   point `kms.json` at it.
2. A **reference implementation** showing the exact API contract the
   `HttpKmsAdapter` expects.

## API Specification

The API is documented in OpenAPI format: [`kms-api.yaml`](./kms-api.yaml)

You can view the interactive documentation using:

- [Swagger Editor](https://editor.swagger.io/) — paste the YAML content
- [OpenAPI Preview VS Code Extension](https://marketplace.visualstudio.com/items?itemName=zoellner.openapi-preview)

## Endpoints

| Method   | Path                | Description                      |
| -------- | ------------------- | -------------------------------- |
| `GET`    | `/health`           | Liveness check                   |
| `POST`   | `/keys`             | Generate an ECDSA P-256 key pair |
| `POST`   | `/keys/:kid/sign`   | Sign data with a stored key      |
| `POST`   | `/keys/:kid/import` | Import a private JWK             |
| `DELETE` | `/keys/:kid`        | Delete a key                     |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the dev server on http://localhost:8788
pnpm start
```

## Authentication

Set `API_KEY` in `wrangler.jsonc` (or create a `.dev.vars` file) to require
`x-api-key` authentication on every request:

```
# .dev.vars
API_KEY=my-secret-key
```

Leave `API_KEY` empty (the default) to disable authentication during local
development.

## Connecting to the EUDIPLO Backend

Add an `http` provider to your `kms.json`:

```json
{
  "providers": [
    {
      "id": "kms-reference",
      "type": "http",
      "baseUrl": "http://localhost:8788",
      "auth": { "type": "none" },
      "canImport": true
    }
  ],
  "defaultProvider": "kms-reference"
}
```

With API key auth enabled:

```json
{
  "providers": [
    {
      "id": "kms-reference",
      "type": "http",
      "baseUrl": "http://localhost:8788",
      "auth": {
        "type": "bearer",
        "token": "my-secret-key"
      },
      "canImport": true
    }
  ],
  "defaultProvider": "kms-reference"
}
```

> Note: the Worker validates `x-api-key`, while the backend adapter sends
> `Authorization: Bearer`. Use `"type": "none"` and handle auth at the network
> level (e.g. Docker network) for the simplest setup.

## TypeScript Types

The Worker is written in TypeScript. Key types used across the implementation:

```typescript
// src/key-store.ts — stored key entry
interface StoredKey {
  pair: CryptoKeyPair;
  alg: string;
}

// src/index.ts — Cloudflare Worker Env
interface Env {
  API_KEY?: string;
}
```

## Supported Algorithms

| Algorithm | Curve | Hash    |
| --------- | ----- | ------- |
| `ES256`   | P-256 | SHA-256 |

Only `ES256` is currently supported, matching the backend adapter's default.
