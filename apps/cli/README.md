# EUDIPLO CLI

The EUDIPLO CLI provides deployment-neutral commands for inspecting an EUDIPLO
instance and deployment-driver commands for local Docker Compose demos.

## Quick Start

`npx` is provided by npm, which is installed with Node.js. It is not bundled with
operating systems by default, so install a current Node.js distribution first if
`npx` is missing.

```bash
npx @eudiplo/cli demo
npx @eudiplo/cli instance add production --url https://eudiplo.example.com
npx @eudiplo/cli doctor --instance production
```

`demo` creates a local `.eudiplo.env`, copies the bundled EUDIPLO Docker Compose
template, and starts the `compose` driver. The Compose template is bundled with
the npm package and checked during build against the canonical file in
`deployment/docker-compose/docker-compose.yml`.

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
eudiplo --version
eudiplo version
```

`--version` and `-v` print the installed CLI version without network access.
`version` also checks the npm registry and reports whether an update is
available.

Compose driver commands require a `compose` instance:

```bash
eudiplo init --target compose
eudiplo up
eudiplo down
eudiplo logs
```

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

The build runs `assets:check`, which fails if the bundled Compose template has
drifted from the canonical deployment Compose file.
