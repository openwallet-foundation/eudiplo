# EUDIPLO CLI

The **EUDIPLO CLI** has two distributions of the same command-line tool:

1. **Standalone CLI**: native executable, no Node.js required.
2. **npm package**: `@eudiplo/cli`, requires Node.js 22+.

The command name is `eudiplo` in both cases.

For focused guidance, see:

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

## Run a Local Demo Deployment

```bash
eudiplo demo
```

or, with npm one-off execution:

```bash
npx @eudiplo/cli demo
```

The demo command copies EUDIPLO's bundled Docker Compose deployment template,
creates local demo assets, and starts the `compose` driver:

- `.eudiplo.demo.env`
- `.eudiplo/demo-config` (editable generated demo configuration)

The standalone CLI removes the Node.js requirement only. Docker and Docker
Compose are still required for `demo`.

Demo mode warning: generated demo credentials are for local onboarding only and
must not be used in production.

## Register an Existing Deployment

For Kubernetes, Helm, standalone containers, or any externally managed instance,
register the public API URL:

```bash
eudiplo instance add production --url https://eudiplo.example.com
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
eudiplo init --target compose
eudiplo init --target compose --demo
eudiplo init --target compose --demo --image-tag main
eudiplo init --target compose --no-client
eudiplo up
eudiplo down
eudiplo logs
eudiplo demo --reset --force
```

`init --target compose` creates local Compose assets without starting them.
`init --target compose --demo` generates the same editable demo deployment as
`demo`, but does not start containers.

`demo --reset --force` recreates only CLI-managed demo assets and managed demo
volumes.

If a compose-only command is used against an external instance, the CLI returns a
clear error such as `logs is not available for externally managed deployments`.
