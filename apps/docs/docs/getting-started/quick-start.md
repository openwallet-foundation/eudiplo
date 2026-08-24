---
title: Quick Start
---

Get EUDIPLO running in under 2 minutes! This guide gets you from zero to issuing your first credential.

:::tip[New to EUDIPLO?]
This is the fastest path to see EUDIPLO working. For production setup and advanced configuration, see the [Architecture](../architecture/index.md) and [Deployment](../deployment/index.md) sections.
:::

## What You'll Need

- The CLI is the easiest path, but it is optional. You can also run the stack without it using Docker Compose.
- CLI access via one of these options (optional convenience):
    - Option A (recommended on Linux/macOS): standalone CLI via installer
    - Option B: npm package `@eudiplo/cli` with [Node.js 22+](https://nodejs.org/)
    - Windows: `npx @eudiplo/cli demo` (Node.js 22+) or Windows x64 release archive
- [Docker](https://www.docker.com/get-started) installed
- 2 minutes of your time ⏱️

## Step 1: Start the Demo with the CLI (Recommended, but not required)

### Linux and macOS: Standalone CLI (recommended)

```bash
curl -fsSL https://eudiplo.dev/install.sh | bash
eudiplo demo
```

### Already using Node.js 22+?

```bash
npx @eudiplo/cli demo
```

### Windows

Use Node.js 22+:

```powershell
npx @eudiplo/cli demo
```

or download the Windows x64 standalone release archive and run:

```powershell
eudiplo demo
```

Both options run the same **EUDIPLO CLI**. The standalone CLI removes the Node.js requirement, but Docker and Docker Compose, or Podman and Podman Compose, are still required for `eudiplo demo`. Docker is preferred by default; set `EUDIPLO_CONTAINER_RUNTIME=podman` to force Podman.

If you prefer not to use the CLI, you can start the same demo stack manually with Docker Compose or the project deployment files described in the [Deployment](../deployment/index.md) docs. The CLI mainly simplifies setup and lifecycle commands; it is not a hard dependency.

The CLI asks for a project directory and suggests `./`. Accepting the default generates editable demo files in your current directory:

- `.eudiplo.demo.env`
- `config/kms.json`
- `config/demo/`

It then starts backend and client containers using compatible image tags.

:::warning[Demo mode only]
Demo mode uses predictable onboarding credentials and loopback-bound ports. It is not suitable for production.
:::

## Step 2: Verify It's Working

If you started the demo with the CLI, the easiest check is to ask the CLI itself to confirm the stack is healthy:

```bash
eudiplo status
# or
npx @eudiplo/cli status
```

If you did not use the CLI, the equivalent manual check is to query the health endpoint directly:

```bash
curl http://localhost:3000/health
```

**Expected response from EUDIPLO:**

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" }
  },
  "errors": {}
}
```

## Step 3: Continue with the CLI (Recommended)

The CLI is the primary workflow for local onboarding and lifecycle commands. Use the same mode you chose in Step 1:

```bash
# Stop demo stack
eudiplo down

# npm alternative
npx @eudiplo/cli down

# Reset demo data and regenerate demo config
eudiplo demo --reset --force

# npm alternative
npx @eudiplo/cli demo --reset --force
```

You can still use the Web Client or Swagger API at any time for interactive exploration.

For detailed CLI usage, see the [CLI Reference](../reference/cli.md).

## Success

EUDIPLO is now running and ready for credential issuance and verification.

### What's Next?

:::tip[New to EUDIPLO? Start here!]
Follow the [Issue Your First Credential](first-credential.md) guide for a complete walkthrough of creating credential configurations and issuing to a wallet.
:::
