---
title: Configuration Validation
---

# Configuration Validation

The CLI can validate local EUDIPLO configuration without starting EUDIPLO, connecting to a database, or writing anything.

## Validate one tenant

```bash
eudiplo config tenant validate <tenant-id>
```

When using a configured Compose instance, this validates the tenant from its local `config/` directory. Use `--config-directory` when validating a specific configuration root:

```bash
eudiplo config tenant validate root --config-directory ./config
```

The explicit path-based form remains available:

```bash
eudiplo config validate tenant ./assets/config/playground
```

## Validate multiple tenants

```bash
eudiplo config tenant validate --config-directory ./config
```

The explicit path-based form is also supported:

```bash
eudiplo config validate tenants ./assets/config
```

Use `--format json` for a machine-readable report suitable for CI:

```bash
eudiplo config validate tenants ./assets/config --format json
```

The validator checks every supported config-import resource against the same JSON Schemas used by the backend, including tenant metadata, clients, key chains, credential configs, issuance configs, presentation configs, status lists, trust lists, attribute providers, webhook endpoints, registrar config, and tenant-specific KMS config.

New config files declare their type and version using `$schema`, for example `https://eudiplo.dev/schemas/v1/PresentationConfigFile.schema.json`. VS Code can use that URL for validation, completion and property documentation without workspace setup. In v1, IDs belong only in `spec.id` (`spec.clientId` for clients). Optional metadata contains generation and ownership; singleton settings need no document ID. `config upgrade` moves legacy metadata IDs into the data and refuses conflicting IDs. The URL must match the document type; changing it alone does not migrate the data.

The backend and CLI use bundled, versioned schemas and never fetch a user-supplied URL. Offline upgrades validate the source shape, execute each registered migration, and validate the target before advancing its identifier. Format annotations and application-specific semantics are additionally checked by the existing domain validators and tenant validation command. Known folder importers may wrap bare root payloads into canonical `$schema` documents. See [Publishing configuration schemas](../contributing/configuration-schemas.md) for the Cloudflare Pages publication workflow.

## Enable VS Code schema support

Install the schemas bundled with the current CLI and add their file associations to the workspace's `.vscode/settings.json`:

```bash
# Run from a workspace whose tenant configuration root is ./config
eudiplo config editor setup

# Select a different workspace and config root
eudiplo config editor setup ./deployment --config-directory ./tenant-config
```

The command copies the complete schema set to `.vscode/eudiplo-schemas/`, including schemas referenced by other schemas. It then merges scoped `json.schemas` entries into `.vscode/settings.json`. Existing settings, JSON-with-comments (JSONC) comments, and schema associations not managed by EUDIPLO are preserved. Running the command again replaces the EUDIPLO-managed associations instead of duplicating them.

The copied schemas match the installed CLI version. Rerun the setup command after upgrading the CLI. The generated `.vscode` files may also be committed if all contributors should receive the same completion, documentation, and inline validation without running a bootstrap command.

The backend and CLI share placeholder resolution for `${VAR}` and `${VAR:default}`. Missing or empty environment values use the default, when supplied. Unresolved placeholders report the variable name and JSON pointer without printing resolved values. Substitution runs once: environment values are treated as data, even if they contain another placeholder. The command exits with a non-zero status when any selected tenant fails validation.

## Schema sources

`apps/cli/src/commands/config/validate/registry.json` maps each tenant config-import file or folder to its resource type and schema. Run the following from the repository root after changing backend import schemas:

```bash
pnpm run gen:api
```

This regenerates the API/DTO and compatibility file schemas and the repository's editor associations. Run `pnpm --filter @eudiplo/cli assets:sync` to synchronize CLI assets. Published versioned schemas are explicit snapshots; `gen:api` never overwrites them. This developer command updates the EUDIPLO source workspace; `eudiplo config editor setup` configures an arbitrary consumer workspace.

## Export and migrate instance configuration

Export the current tenant, including configuration created through the web client or API:

```bash
export EUDIPLO_TOKEN='<management-access-token>'
eudiplo config export --instance production --output production-config.zip
```

Export never includes secret values or private key material. It replaces retrievable credentials with placeholders, represents external KMS keys by reference, and records client secrets and database-held private keys as required inputs in `manifest.json`. Supply those values from the target deployment's secret manager or KMS before import.

Upgrade a local resource or bundle without connecting to an instance:

```bash
eudiplo config upgrade production-config.zip --dry-run
eudiplo config upgrade production-config.zip --output upgraded-config.zip
```

The upgrade command accepts a single envelope, a JSON bundle, a ZIP bundle, or a configuration folder. It reads both old and new identifiers and writes the canonical `$schema` form. It preserves metadata, writes a separate output by default, and leaves output untouched when validation fails or a migration needs input. `--dry-run` reports issues without writing. Migrations never invent missing security-sensitive configuration; required input must be supplied before continuing.

For a tenant folder or a root containing several tenants:

```bash
eudiplo config upgrade ./config --check --diff
eudiplo config upgrade ./config --output ./config-upgraded
eudiplo config validate tenants ./config-upgraded
```

`--check` writes nothing and exits with status 1 when an upgrade is needed or input is invalid; status 0 means every selected document is current. `--diff` prints field changes with credential fields redacted. Legacy bare files in known tenant paths are wrapped automatically. The folder command validates every selected document before staging output, preserves assets, excludes hidden entries, rejects symbolic links, and requires a separate, unused output directory. It publishes the staged directory only after all conversions succeed. Run tenant validation afterward to check references and deployment-specific values.

JSON and ZIP bundles use the same integrity checks in the backend and CLI: resource identities, paths, entry counts and SHA-256 checksums must agree with the manifest. Duplicate resources, unsafe paths and unlisted ZIP entries are rejected. ZIP input is limited to 50 MiB compressed, 100 MiB expanded and 10,000 entries.

Always inspect the server-side plan before apply:

```bash
eudiplo config plan upgraded-config.zip --instance staging --mode upsert --diff --output plan.json
eudiplo config import upgraded-config.zip --instance staging --mode upsert --plan plan.json
```

Plans distinguish `create`, `update`, `unchanged`, `skip`, `delete` and `blocked`. Updates include field-level changes with credentials redacted. Matching resources avoid resource writes; ownership is updated separately only when its source, generation or management status changes. Explicit key regeneration and client-secret generation still require applying. Comparing client secrets uses their stored password hash. Matching status-list definitions preserve their live status data.

Exports, file upgrades and KMS configuration saves replace files atomically using temporary files with owner-only permissions. Tenant settings and ownership changes share a database transaction. An entire bundle is **not** one transaction: file storage, external KMS operations and other resource services can have effects before a later step fails.

If apply fails, the API returns `CONFIG_APPLY_FAILED` with an ordered `operations` report. Each entry identifies its resource or asset, stage, and `running`, `completed`, `failed` or `pending` status. Completed operations remain applied, and the failed operation may have partial effects. Later operations, including deletions, do not run. Inspect the affected state, correct the cause, and run plan again before retrying. The response also retains any client secrets generated successfully before the failure; protect the response as you would a successful import response. Provider exception text is omitted from the report to avoid leaking credentials. Operation progress is also stored in the database before and after each step. The durable report contains identifiers and statuses, never input config, provider errors or generated secret values. If a secret response is lost, rotate that client secret; recovery does not replay secret generation automatically.

## Reviewed plans and recovery

The plan response includes a `planFingerprint`. API import requests must send it as the `planFingerprint` query parameter. The CLI accepts `--plan plan.json` or `--plan-fingerprint <value>`; the web client sends the displayed plan's fingerprint automatically. A changed bundle, import mode, ownership source, target configuration or relevant stored asset causes `CONFIG_PLAN_STALE` before resource writes. Review a fresh plan after a conflict. Create a separate plan with `--mode replace` before using replace mode.

A database constraint allows one configuration writer per tenant across server replicas. Imports, config API edits, ownership detaches and asset uploads participate in this lock. Credential issuance and live status updates continue; status-list binding updates use optimistic concurrency without writing the status values or allocation stack. Direct filesystem/database edits and external KMS administration remain outside this lock.

Existing status-list capacity and bit width cannot change through import. Create a new list ID for a different layout. Binding updates preserve revocations and allocated indexes. Private-key replacements prepare and validate the new material before saving over the existing row, using a distinct import key ID when replacing an external key. A failed external preparation can leave an unused key in the external provider; the recovery report does not claim provider-wide rollback.

Asset additions and replacements appear in the plan. Identical bytes and content type are skipped during apply; create mode preserves existing different assets. Asset hashes are computed from stored content.

Inspect durable progress after a failed request or lost connection:

```bash
eudiplo config operations --instance staging
eudiplo config operations <operation-id> --instance staging
```

The web client also displays recent operation history. A worker crash leaves the run marked `running` and retains its tenant lock. Stop the original worker and ensure it cannot resume (including on another replica), then acknowledge the interruption:

```bash
eudiplo config recover <operation-id> --instance staging --confirm-worker-stopped
```

The API equivalent is `POST /api/config-bundles/operations/<id>/acknowledge-interruption?confirmWorkerStopped=true`. Recovery releases the lock and marks the run `interrupted`; it does not replay or undo operations. A step left `running` has an uncertain outcome. Inspect that resource or asset, then create and review a new plan. Locks deliberately do not expire automatically during slow external calls.

The `AddConfigImportRun1781000000000` database migration creates the journal and lock constraint. The operations API lists the latest 50 tenant operations; full records remain in the database until an operator applies a retention policy.

Replace mode prunes only file-managed resources from the same bundle source and requires an explicit flag:

```bash
eudiplo config import upgraded-config.zip \
  --instance staging \
  --mode replace \
  --plan replace-plan.json \
  --confirm-replace
```

See [Configuration Model](../architecture/configuration-model.md) for the envelope, archive, secret, generation, and ownership model.
