# EUDIPLO CLI

The EUDIPLO CLI is designed around deployment targets. Generic commands inspect
an EUDIPLO API over HTTP, while lifecycle commands are provided by a deployment
driver.

## Run a Local Demo

!!! info

    `npx` is provided by npm, which is installed with [Node.js](https://nodejs.org/en/download/current). It is not an operating
    system tool, so install a current Node.js distribution first if `npx` is missing.

Use the scoped package name for one-off npm execution:

```bash
npx @eudiplo/cli demo
```

For repeated use, install the CLI globally and run the `eudiplo` command from
any directory:

```bash
npm install -g @eudiplo/cli
eudiplo doctor
```

The demo command copies EUDIPLO's bundled Docker Compose deployment template,
creates local demo assets, and starts the `compose` driver:

- `.eudiplo.demo.env`
- `.eudiplo/demo-config` (editable generated demo configuration)

This keeps the quick-start path usable without cloning the repository while
still using canonical assets maintained in this repository.

If you prefer a standalone binary (no local Node.js required), download the
SEA artifact from GitHub Releases and run `eudiplo demo` directly.

## Register an Existing Deployment

For Kubernetes, Helm, standalone containers, or any externally managed instance,
register the public API URL:

```bash
npx @eudiplo/cli instance add production \
  --url https://eudiplo.example.com
```

Instance metadata is stored in the user's EUDIPLO CLI config directory, not in
the source tree. Do not put secrets in this config; commands that need client
credentials read `EUDIPLO_CLIENT_ID` and `EUDIPLO_CLIENT_SECRET` from the
environment.

## Deployment-Neutral Commands

These commands work with both `compose` and `external` instances and do not
require Docker:

```bash
npx @eudiplo/cli doctor --instance production
npx @eudiplo/cli status --instance production
npx @eudiplo/cli config validate
npx @eudiplo/cli --version
npx @eudiplo/cli version
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
npx @eudiplo/cli init --target compose
npx @eudiplo/cli init --target compose --demo
npx @eudiplo/cli init --target compose --demo --image-tag main
npx @eudiplo/cli init --target compose --no-client
npx @eudiplo/cli up
npx @eudiplo/cli down
npx @eudiplo/cli logs
npx @eudiplo/cli demo --reset --force
```

`init --target compose` creates local Compose assets without starting them.
`init --target compose --demo` generates the same editable demo deployment as
`demo`, but does not start containers.

`demo --reset --force` recreates only CLI-managed demo assets and managed demo
volumes.

Demo mode warning: generated demo credentials are for local onboarding only and
must not be used in production.

If a compose-only command is used against an external instance, the CLI returns a
clear error such as `logs is not available for externally managed deployments`.

## Command Name Usability

The best publishable npm shape is `@eudiplo/cli` with a `eudiplo` binary. That
means `npx @eudiplo/cli` is the reliable one-off command, while `eudiplo` is what
users type after installation. A shorter `npx eudiplo` command would require a
separate unscoped npm package named `eudiplo` that depends on or aliases the
scoped CLI package.
