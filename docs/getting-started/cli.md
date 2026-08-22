# EUDIPLO CLI

The **EUDIPLO CLI** has two distributions of the same command-line tool:

1. **Standalone CLI**: native executable, no Node.js required.
2. **npm package**: `@eudiplo/cli`, requires Node.js 22+.

The command name is `eudiplo` in both cases.

For focused guidance, see:

- [Server setup cookbook](cli/server-setup-cookbook.md)
- [Configuration validation](cli/configuration-validation.md)
- [Local development](cli/development.md)

## Installation

### Standalone CLI (Linux/macOS)

```bash
curl -fsSL https://eudiplo.dev/install.sh | bash
eudiplo --version
```

The installer downloads a release archive and verifies it against
`SHA256SUMS.txt` from the same GitHub release before extracting.

Supported standalone release artifacts:

- Linux x64: `eudiplo-vVERSION-linux-x64.tar.gz`
- Linux arm64: `eudiplo-vVERSION-linux-arm64.tar.gz`
- macOS arm64: `eudiplo-vVERSION-macos-arm64.tar.gz`
- Windows x64: `eudiplo-vVERSION-windows-x64.zip`

`install.sh` is for Linux/macOS shells only. On Windows, use Node.js/npm or the
Windows x64 release archive.

Release assets and checksums:

- [GitHub Releases](https://github.com/openwallet-foundation/eudiplo/releases)
- [SHA256SUMS.txt (latest release)](https://github.com/openwallet-foundation/eudiplo/releases/latest)

### npm package (`@eudiplo/cli`, Node.js 22+)

One-off execution:

```bash
npx @eudiplo/cli --version
```

Global install:

```bash
npm install -g @eudiplo/cli
eudiplo --version
```

### `@eudiplo/cli`, `npx`, and `eudiplo`

- `@eudiplo/cli` is the npm package name.
- `npx @eudiplo/cli ...` runs the package without a global install.
- `eudiplo ...` runs the installed command (standalone or npm-installed).

## Uninstall

Use the removal path that matches how the CLI was installed. A separate
`eudiplo uninstall` command is intentionally not provided because the executable
may be managed by npm, a release archive, or a local installation directory.

For the standalone Linux/macOS installer, remove the installed binary:

```bash
rm "${EUDIPLO_INSTALL_DIR:-$HOME/.local/bin}/eudiplo"
```

If you installed the npm package globally, remove it with npm:

```bash
npm uninstall -g @eudiplo/cli
```

If you added it to a project, remove the project dependency with your package
manager, for example:

```bash
pnpm remove @eudiplo/cli
```

The CLI stores instance metadata in `~/.eudiplo/config.json` by default. Remove
that directory only if you also want to delete local CLI instance registrations:

```bash
rm -rf ~/.eudiplo
```

## Run a Local Demo Deployment

```bash
eudiplo demo ./eudiplo-demo
```

or, with npm one-off execution:

```bash
npx @eudiplo/cli demo ./eudiplo-demo
```

The demo command copies EUDIPLO's bundled Docker Compose deployment template,
creates local demo assets, and starts a deliberately minimal stack using SQLite,
local file storage, database-backed key management, and the web client:

- `.eudiplo.demo.env`
- `config/kms.json` (global KMS configuration)
- `config/demo` (editable generated demo tenant configuration)

The standalone CLI removes the Node.js requirement only. Docker and Docker
Compose, or Podman and Podman Compose, are still required for `demo`.

Docker is preferred by default. If Docker is not found, the CLI tries Podman.
Set `EUDIPLO_CONTAINER_RUNTIME=docker` or `EUDIPLO_CONTAINER_RUNTIME=podman` to
force a specific Compose runtime.

Demo mode warning: generated demo credentials are for local onboarding only and
must not be used in production.

## Register an Existing Deployment

For Kubernetes, Helm, standalone containers, or any externally managed instance,
register the public API URL:

```bash
eudiplo instance add production --url https://eudiplo.example.com
eudiplo instance ls
eudiplo instance show production
eudiplo instance use production
eudiplo instance remove old-production
```

Instance metadata is stored in the user's EUDIPLO CLI config directory, not in
the source tree. Do not put secrets in this config; commands that need client
credentials read `EUDIPLO_CLIENT_ID` and `EUDIPLO_CLIENT_SECRET` from the
environment.

## Deployment-Neutral Commands

These commands work with both `compose` and `external` instances and do not
require Docker:

```bash
eudiplo doctor --instance production
eudiplo status --instance production
eudiplo config validate
eudiplo --version
eudiplo version
```

`--version` and `-v` print the installed CLI version without network access.
`version` also checks the npm registry and reports whether an update is
available.

`doctor` checks the configured public URL, API reachability, `/health`, optional
client connectivity, and whether authentication environment variables are
available.

`config validate` parses the local CLI config, validates instance targets and
HTTP(S) URLs, verifies the default instance points to a configured instance, and
prints the configured instances. It does not require Docker or contact the
deployment.

## Compose Driver Commands

These commands are available only for `compose` instances:

```bash
eudiplo init
eudiplo init ./eudiplo-minimal --preset minimal
eudiplo init ./eudiplo-standard --preset standard --start
eudiplo init --database postgres --storage local --kms vault
eudiplo init --preset standard --public-url https://eudiplo.example.com
eudiplo init --preset standard --demo-tenant
eudiplo up
eudiplo down
eudiplo logs
eudiplo demo --reset --force
```

When run in an interactive terminal, `init` opens a wizard for the project
directory, deployment preset, database, storage, key management, public URL,
authentication client, web client, and whether to start immediately. The
generated environment file is created with owner-only permissions. Leaving the
authentication secret empty generates a random secret.

The optional positional directory is the project root for generated Compose,
environment, override, and demo configuration files. It is created when needed.
When no directory is supplied, interactive `init` and `demo` commands prompt
with `./` as the default; non-interactive and `--yes` runs use `./`
automatically. `--directory <path>` is an equivalent flag form. The CLI stores
its absolute path with the instance, so later `up`, `down`, `logs`, and `doctor`
commands work from any directory.

Each project has one `config/` root mounted at `/app/config`. Global files such
as `kms.json` live directly in that root; tenant resources live under
`config/<tenant-id>/`. The initializer does not add a demo tenant unless
`--demo-tenant` is passed or selected in the wizard. Bundled demo private keys
explicitly use the DB provider, even when Vault is the default for new keys.

All wizard choices are also available as flags for repeatable setup:

| Preset     | Database   | Storage            | Key management  |
| ---------- | ---------- | ------------------ | --------------- |
| `minimal`  | SQLite     | Local filesystem   | Database-backed |
| `standard` | PostgreSQL | S3 via local MinIO | Database-backed |
| `full`     | PostgreSQL | S3 via local MinIO | Vault           |

Explicit `--database`, `--storage`, and `--kms` flags override the corresponding
preset choices. Use `--yes` or `--no-interactive` to suppress the wizard. Use
`--auth-client-id` and `--auth-client-secret` in automation; avoid exposing the
secret in shared shell history.

The older `init --demo` form remains available for compatibility and generates
demo assets without starting containers. New onboarding instructions should use
`demo` for evaluation and `init` for configurable deployments.

## Local Tenant Configuration Commands

The tenant commands scaffold and manage local config-import folders:

```bash
eudiplo config tenant list
eudiplo config tenant create acme --name "Acme GmbH"
eudiplo config tenant create sample --template demo
eudiplo config tenant remove acme --force
```

`create` generates `info.json` and the supported resource subdirectories.
`--template demo` copies the bundled demo resources instead. Aliases `ls`,
`new`, `rm`, and `delete` are available.

By default, the selected Compose instance determines the config root. Use
`--instance <name>` to select another instance or `--config-directory <path>`
to work with a config root directly. `remove` deletes only local files; it does
not delete an already imported tenant from a running backend.

`demo --reset --force` recreates only CLI-managed demo assets and managed demo
volumes.

If a compose-only command is used against an external instance, the CLI returns a
clear error such as `logs is not available for externally managed deployments`.
