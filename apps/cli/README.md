# EUDIPLO CLI

The EUDIPLO CLI provides deployment-neutral commands for inspecting an EUDIPLO
instance and deployment-driver commands for local Docker Compose demos.

## Quick Start

This package is the npm distribution of the **EUDIPLO CLI** and requires
Node.js 22+.

For users who do not want a local Node.js dependency, use the standalone CLI
installer instead: `curl -fsSL https://eudiplo.dev/install.sh | bash`

```bash
npx @eudiplo/cli demo
npx @eudiplo/cli instance add production --url https://eudiplo.example.com
npx @eudiplo/cli doctor --instance production
```

`demo` creates a local editable demo deployment, writes `.eudiplo.demo.env`,
copies canonical demo configuration into `.eudiplo/demo-config`, and starts the
`compose` driver.

- Backend image: `ghcr.io/openwallet-foundation/eudiplo:<tag>`
- Client image: `ghcr.io/openwallet-foundation/eudiplo-client:<tag>`

Tag selection defaults to the CLI version. For prerelease versions containing
`-main.`, the CLI uses the `main` tag for both images. Use `--image-tag` (or
`EUDIPLO_IMAGE_TAG`) to override.

The generated demo config remains editable after creation. Existing files are
preserved unless you pass `--force`.

The standalone CLI and this npm package are two distributions of the same
`eudiplo` command. The standalone CLI removes the Node.js requirement, but
Docker and Docker Compose are still required for the demo deployment.

## Package and Binary Names

The npm package is scoped as `@eudiplo/cli`, while the installed binary is
`eudiplo`. That means one-off usage should use `npx @eudiplo/cli`; after global
or project installation, run `eudiplo` directly.

```bash
npm install -g @eudiplo/cli
eudiplo status

pnpm add -D @eudiplo/cli
pnpm eudiplo status
```

## Commands

Deployment-neutral commands work with any registered EUDIPLO instance and do not
require Docker:

```bash
eudiplo instance add production --url https://eudiplo.example.com
eudiplo doctor --instance production
eudiplo status --instance production
eudiplo config validate
eudiplo config validate tenant ./assets/config/root
eudiplo config validate tenants ./assets/config
eudiplo config validate tenants ./assets/config --format json
eudiplo --version
eudiplo version
```

`--version` and `-v` print the installed CLI version without network access.
`version` also checks the npm registry and reports whether an update is
available.

`config validate tenant <path>` validates a single tenant's config-import
files, and `config validate tenants <path>` validates every tenant directory
under a configuration root. Both commands parse and validate every supported
resource file (tenant metadata, clients, key chains, credential configs,
issuance configs, presentation configs, status lists, trust lists, attribute
providers, webhook endpoints, registrar config, and tenant-specific KMS
config) against the same JSON Schemas the backend uses for config-import,
without starting EUDIPLO, connecting to a database, or writing anything.
Unresolved `${VAR}` placeholders without a default are reported without ever
printing resolved secret values. Add `--format json` for a machine-readable
report suitable for CI. The command exits non-zero when any selected tenant
fails validation.

`src/config-validate/registry.json` is the single source of truth mapping
each tenant config-import file/folder to its resource type and schema. `pnpm
run gen:api` regenerates the schemas, the CLI-bundled subset in
`templates/schemas/`, and the corresponding `json.schemas` editor
associations in the repository's `.vscode/settings.json` from this file, so
none of them can drift from one another.

Compose driver commands require a `compose` instance:

```bash
eudiplo init --target compose
eudiplo init --target compose --demo
eudiplo init --target compose --demo --image-tag main
eudiplo init --target compose --no-client
eudiplo up
eudiplo down
eudiplo logs
eudiplo demo --reset --force
```

`init --target compose` writes a local `.eudiplo.env` using Compose defaults.
`init --target compose --demo` writes demo-specific assets (`.eudiplo.demo.env`
and `.eudiplo/demo-config`) without starting Docker Compose. Add `--no-client`
to generate a small Compose override that skips the web client container.

`demo --reset --force` stops the managed demo stack, removes managed demo
volumes, and recreates only CLI-managed demo assets.

If a driver-specific command is used with an unsupported target, the CLI exits
with a clear error, for example:

```text
logs is not available for externally managed deployments
```

## Configuration

The CLI stores instance metadata outside the source tree. By default it writes to
`~/.eudiplo/config.json`. Override the location for tests or isolated runs with:

```bash
EUDIPLO_CLI_HOME=/tmp/eudiplo-cli eudiplo config validate
EUDIPLO_CLI_CONFIG=/tmp/eudiplo-cli/config.json eudiplo config validate
```

Do not store secrets in the CLI config. Commands that need authenticated API
access read credentials from environment variables such as `EUDIPLO_CLIENT_ID`
and `EUDIPLO_CLIENT_SECRET`.

## Local Development

From the repository root:

```bash
pnpm --filter @eudiplo/cli test
pnpm --filter @eudiplo/cli build
pnpm --filter @eudiplo/cli lint
```

The build synchronizes and validates bundled CLI assets from canonical sources:

- `deployment/docker-compose/docker-compose.yml`
- `assets/config/demo/**`
- `schemas/*.schema.json` referenced by `src/config-validate/registry.json`
  (regenerate with `pnpm run gen:api` after changing backend import schemas)

## Single Executable Application

To produce a standalone CLI binary with Node.js SEA support, run:

```bash
pnpm --filter @eudiplo/cli build:sea
```

This writes the executable to `apps/cli/dist-sea/eudiplo` on Linux/macOS and
`apps/cli/dist-sea/eudiplo.exe` on Windows, while bundling the Compose template
as a SEA asset.

### Supported standalone platforms

The versioned release publishes archive files for the currently supported native
platforms:

- Linux x64: `eudiplo-vVERSION-linux-x64.tar.gz`
- Linux arm64: `eudiplo-vVERSION-linux-arm64.tar.gz`
- macOS arm64: `eudiplo-vVERSION-macos-arm64.tar.gz`
- Windows x64: `eudiplo-vVERSION-windows-x64.zip`

### Install and verify a release archive

Extract the archive for the matching platform and run the executable directly:

```bash
# Linux / macOS
curl -LO https://github.com/openwallet-foundation/eudiplo/releases/download/vVERSION/eudiplo-vVERSION-linux-x64.tar.gz
mkdir -p ~/.local/bin
 tar -xzf eudiplo-vVERSION-linux-x64.tar.gz -C ~/.local/bin
 ~/.local/bin/eudiplo --help

# Windows PowerShell
Invoke-WebRequest -Uri "https://github.com/openwallet-foundation/eudiplo/releases/download/vVERSION/eudiplo-vVERSION-windows-x64.zip" -OutFile "eudiplo-vVERSION-windows-x64.zip"
Expand-Archive -Path .\eudiplo-vVERSION-windows-x64.zip -DestinationPath .
.\eudiplo.exe --help
```

The release also attaches `SHA256SUMS.txt`. Verify the downloaded archive before
running it:

```bash
sha256sum -c SHA256SUMS.txt
```

The standalone binary does not replace Docker or Docker Compose. You still need
Docker to run the local deployment stack, but you do not need a local Node.js
installation just to use the CLI itself.
