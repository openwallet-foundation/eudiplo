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

This regenerates the schemas, the CLI-bundled subset in
`apps/cli/templates/schemas/`, and the corresponding editor associations.
