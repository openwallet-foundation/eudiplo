# Configuration Portability and Versioning

EUDIPLO configuration is portable between instances and across application
versions. The portability model covers configuration created through the API or
web client as well as configuration provisioned from files.

## Resource envelope

Every portable resource has a stable envelope. The schema version is independent
from the EUDIPLO release and database migration version.

```json
{
    "apiVersion": "eudiplo.io/presentation-config/v2",
    "kind": "PresentationConfig",
    "metadata": {
        "id": "age-check",
        "generation": 3,
        "ownership": "unmanaged"
    },
    "spec": {}
}
```

- `apiVersion` selects the portable schema and migration chain.
- `kind` selects the resource registry entry and current validator.
- `metadata.id` is stable across instances.
- `metadata.generation` prevents an older file or bundle from silently
  overwriting a newer configuration.
- `spec` contains only desired configuration. Runtime state, caches, sessions,
  generated status-list data, and timestamps are excluded.

Bare legacy JSON remains accepted by startup provisioning. EUDIPLO detects its
version, wraps it in an envelope, and runs the same migrations used by bundles.

Startup folders use `CONFIG_IMPORT_MODE=disabled|create|upsert|replace`. They
are converted to a bundle and use the same planner and dependency-ordered apply
pipeline as API and CLI imports. The two legacy boolean import settings are
translated for one compatibility cycle and produce a deprecation warning.

## Bundle layout

A ZIP export has the following layout:

```text
manifest.json
info.json
kms.json
key-chains/<id>.json
clients/<id>.json
issuance/config.json
issuance/credentials/<id>.json
issuance/status-lists/<id>.json
presentation/<id>.json
attribute-providers/<id>.json
webhook-endpoints/<id>.json
trust-lists/<id>.json
images/<filename>
```

`manifest.json` records the bundle format, source application version, tenant,
resource schema versions, generations, ownership, SHA-256 checksums, warnings,
and required inputs. Binary assets are stored directly in the ZIP rather than
embedded in resource JSON.

## Secret and key policy

Export is safe by design. It never includes secret values or private key
material:

- retrievable passwords and tokens become `${ENV_NAME}` placeholders;
- client secrets are never exported because only their hash is stored;
- database-held private keys are not included and are reported as required
  input;
- non-exportable KMS keys are represented by provider ID, external key ID, and
  public JWK;
- runtime session and status data is never exported.

Review `manifest.requirements` before importing. Supply its placeholders and
missing key material from the target deployment's secret manager or KMS; do not
add those values to the exported bundle or commit them to source control.

For a client secret requirement, replace the placeholder with a new secret or
set the value to `!generate`. The latter creates a cryptographically random
secret during apply and returns it once in `generatedSecrets`. The UI offers an
immediate download and the CLI prints the import result. The secret value is
never written to the audit log; only the affected client IDs and count are
audited.

For a missing database-held private key, replace `keySource.type: required`
with `keySource.type: regenerate` only when issuing fresh key material and
certificates is acceptable. Optional `provider` and `keyChainType` values select
the KMS provider and either `standalone` or `internalChain`. Regeneration keeps
the resource ID but intentionally changes its cryptographic identity.

## Plan before apply

All imports use the same pipeline:

```text
decode -> verify checksums -> migrate -> validate -> preflight references
       -> produce plan -> apply in dependency order -> record ownership
```

Planning is read-only and reports each resource as `create`, `update`, `delete`,
or `blocked`. Required human decisions are not guessed by migrations. Examples
include selecting trust-list verifier material and replacing a legacy inline
webhook with a webhook endpoint reference.

Import modes are:

- `create`: fail if a resource already exists;
- `upsert`: create missing resources and update existing resources;
- `replace`: upsert the bundle and delete only resources previously managed by
  the same bundle source but now absent. It never prunes unrelated unmanaged
  resources and requires explicit confirmation.

External KMS references are preflighted by signing a challenge. When the bundle
also replaces KMS configuration, this check is deferred until the new provider
configuration has been applied.

## Ownership

Resources are either:

- `unmanaged`: API and web-client writes are allowed;
- `file-managed`: the provisioning file or imported bundle is authoritative and
  API/web-client mutations return a conflict.

Re-importing a managed resource is idempotent. API mutations advance the stored
generation. A managed resource must be explicitly detached before it can be
edited through the API or web client. Detach changes ownership only; it does not
delete or alter the resource.

This avoids silent last-writer-wins behavior when an operator edits a resource
in the UI while a deployment continues to provision an older file.

The web client shows a managed-resource notice with the provisioning source and
generation on configuration detail and edit screens. Mutation controls are
disabled there, while **Settings > Configuration Portability** provides the
complete ownership table and the explicit detach action.

## API

The management API exposes:

| Endpoint                                              | Purpose                                |
| ----------------------------------------------------- | -------------------------------------- |
| `GET /api/config-bundles/export?format=zip`           | Export a tenant archive                |
| `POST /api/config-bundles/plan/archive?mode=upsert`   | Validate and plan a ZIP import         |
| `POST /api/config-bundles/import/archive?mode=upsert` | Apply a planned ZIP import             |
| `POST /api/config-bundles/documents/upgrade`          | Upgrade one resource envelope          |
| `GET /api/config-bundles/resources`                   | List ownership and generations         |
| `POST /api/config-bundles/resources/:kind/:id/detach` | Detach a managed resource              |

JSON bundle variants are available at `export`, `plan`, and `import`. ZIP import
uses a multipart field named `bundle`. Replace requires
`confirmReplace=true`.

Exports, imports, and detach operations are recorded in the tenant audit log.
