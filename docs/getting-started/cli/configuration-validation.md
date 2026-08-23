# Configuration Validation

The CLI can validate local EUDIPLO configuration without starting EUDIPLO,
connecting to a database, or writing anything.

## Validate one tenant

```bash
eudiplo config tenant validate <tenant-id>
```

When using a configured Compose instance, this validates the tenant from its
local `config/` directory. Use `--config-directory` when validating a specific
configuration root:

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

The validator checks every supported config-import resource against the same
JSON Schemas used by the backend, including tenant metadata, clients, key
chains, credential configs, issuance configs, presentation configs, status
lists, trust lists, attribute providers, webhook endpoints, registrar config,
and tenant-specific KMS config.

Version-sensitive file resources use compatibility schemas such as
`PresentationConfigFile.schema.json`. These accept either the legacy root
payload or the current versioned envelope and validate the envelope's `spec`
against the unchanged API/DTO schema. The same file schemas are bundled with
the CLI and referenced by the repository's VS Code settings.

## Enable VS Code schema support

Install the schemas bundled with the current CLI and add their file associations
to the workspace's `.vscode/settings.json`:

```bash
# Run from a workspace whose tenant configuration root is ./config
eudiplo config editor setup

# Select a different workspace and config root
eudiplo config editor setup ./deployment --config-directory ./tenant-config
```

The command copies the complete schema set to
`.vscode/eudiplo-schemas/`, including schemas referenced by other schemas. It
then merges scoped `json.schemas` entries into `.vscode/settings.json`. Existing
settings, JSON-with-comments (JSONC) comments, and schema associations not
managed by EUDIPLO are preserved. Running the command again replaces the
EUDIPLO-managed associations instead of duplicating them.

The copied schemas match the installed CLI version. Rerun the setup command
after upgrading the CLI. The generated `.vscode` files may also be committed if
all contributors should receive the same completion, documentation, and inline
validation without running a bootstrap command.

Unresolved `${VAR}` placeholders without a default are reported by variable
name without printing resolved secret values. The command exits with a non-zero
status when any selected tenant fails validation.

## Schema sources

`apps/cli/src/commands/config/validate/registry.json` maps each tenant config-import
file or folder to its resource type and schema. Run the following from the
repository root after changing backend import schemas:

```bash
pnpm run gen:api
```

This regenerates the API/DTO schemas, synchronizes the CLI-bundled schema set in
`apps/cli/templates/schemas/`, and the repository's corresponding editor
associations. This developer command updates the EUDIPLO source workspace;
`eudiplo config editor setup` configures an arbitrary consumer workspace.

## Export and migrate instance configuration

Export the current tenant, including configuration created through the web
client or API:

```bash
export EUDIPLO_TOKEN='<management-access-token>'
eudiplo config export --instance production --output production-config.zip
```

Export never includes secret values or private key material. It replaces
retrievable credentials with placeholders, represents external KMS keys by
reference, and records client secrets and database-held private keys as required
inputs in `manifest.json`. Supply those values from the target deployment's
secret manager or KMS before import.

Upgrade a local resource or bundle without connecting to an instance:

```bash
eudiplo config upgrade production-config.zip --dry-run
eudiplo config upgrade production-config.zip --output upgraded-config.zip
```

Always inspect the server-side plan before apply:

```bash
eudiplo config plan upgraded-config.zip --instance staging --mode upsert
eudiplo config import upgraded-config.zip --instance staging --mode upsert
```

Replace mode prunes only file-managed resources from the same bundle source and
requires an explicit flag:

```bash
eudiplo config import upgraded-config.zip \
  --instance staging \
  --mode replace \
  --confirm-replace
```

See [Configuration Portability and Versioning](../../architecture/configuration-portability.md)
for the envelope, archive, secret, generation, and ownership model.
