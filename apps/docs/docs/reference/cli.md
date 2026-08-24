---
title: CLI Reference
---

# EUDIPLO CLI Reference

The **EUDIPLO CLI** is available in two distributions:

1. **Standalone CLI** — Native executable, no Node.js required
2. **npm package** — `@eudiplo/cli`, requires Node.js 22+

Both distributions use the command name `eudiplo`.

## Installation

### Standalone CLI (Linux/macOS)

```bash
curl -fsSL https://eudiplo.dev/install.sh | bash
eudiplo --version
```

The installer downloads a release archive and verifies it against `SHA256SUMS.txt` from the same GitHub release.

**Supported release artifacts:**

- Linux x64: `eudiplo-vVERSION-linux-x64.tar.gz`
- Linux arm64: `eudiplo-vVERSION-linux-arm64.tar.gz`
- macOS arm64: `eudiplo-vVERSION-macos-arm64.tar.gz`
- Windows x64: `eudiplo-vVERSION-windows-x64.zip`

:::note[Windows Installation]
`install.sh` is for Linux/macOS shells only. On Windows, use Node.js/npm or the Windows x64 release archive.
:::

Release assets and checksums:

- [GitHub Releases](https://github.com/openwallet-foundation/eudiplo/releases)
- [SHA256SUMS.txt (latest)](https://github.com/openwallet-foundation/eudiplo/releases/latest)

### npm Package

One-off execution:

```bash
npx @eudiplo/cli --version
```

Global install:

```bash
npm install -g @eudiplo/cli
eudiplo --version
```

## Uninstall

### Standalone CLI

```bash
rm "${EUDIPLO_INSTALL_DIR:-$HOME/.local/bin}/eudiplo"
```

### npm Package

Global:

```bash
npm uninstall -g @eudiplo/cli
```

Project dependency:

```bash
pnpm remove @eudiplo/cli
```

### Remove CLI metadata

The CLI stores instance metadata in `~/.eudiplo/config.json` by default. Remove this directory only if you want to delete local CLI instance registrations:

```bash
rm -rf ~/.eudiplo
```

## Commands

### Demo Deployment

Start a local demo deployment with SQLite, local file storage, database-backed key management, and web client:

```bash
eudiplo demo ./eudiplo-demo
```

With npm:

```bash
npx @eudiplo/cli demo ./eudiplo-demo
```

**What it does:**

- Copies bundled Docker Compose deployment template
- Creates local demo assets (`.eudiplo.demo.env`, `config/kms.json`, `config/demo`)
- Starts a minimal stack using Docker Compose

:::warning[Demo Credentials]
Generated demo credentials are for local onboarding only and **must not be used in production**.
:::

**Container Runtime:**

Docker is used by default. If Docker is not found, the CLI tries Podman. Force a specific runtime:

```bash
export EUDIPLO_CONTAINER_RUNTIME=docker
# or
export EUDIPLO_CONTAINER_RUNTIME=podman
```

### Instance Management

Register and manage existing deployments (Kubernetes, Helm, standalone containers):

```bash
# Register an instance
eudiplo instance add production --url https://eudiplo.example.com

# List all instances
eudiplo instance ls

# Show instance details
eudiplo instance show production

# Set default instance
eudiplo instance use production

# Remove an instance
eudiplo instance remove old-production
```

:::tip[Instance Metadata]
Instance metadata is stored in the user's EUDIPLO CLI config directory (`~/.eudiplo/config.json`), not in the source tree. Never put secrets in this config; commands that need client credentials read `EUDIPLO_CLIENT_ID` and `EUDIPLO_CLIENT_SECRET` from environment variables.
:::

### Deployment-Neutral Commands

These commands work with both `compose` and `external` instances without requiring Docker:

```bash
# Check instance health and connectivity
eudiplo doctor --instance production

# Check deployment status
eudiplo status --instance production

# Validate local configuration
eudiplo config validate

# Set up JSON schema validation for editors
eudiplo config editor setup

# Version information
eudiplo --version   # CLI version only
eudiplo version     # CLI version + update check
```

**What they do:**

- `doctor` — Checks public URL, API reachability, `/health`, optional client connectivity, and authentication env vars
- `config validate` — Parses local CLI config, validates instance targets and HTTP(S) URLs
- `config path` — Prints the resolved CLI config file path
- `config show` — Inspects validated config contents (use `--json` for scripts)
- `config editor setup` — Installs JSON Schemas and merges associations into `.vscode/settings.json` for completion and validation

### Shell Completion

Generate command, option, and enumerated-value completion:

```bash
# Bash
source <(eudiplo completion bash)

# Zsh
source <(eudiplo completion zsh)

# Fish
eudiplo completion fish | source

# PowerShell
eudiplo completion powershell | Out-String | Invoke-Expression
```

:::tip[Persist Completion]
Save the generated script in your shell's completion directory to load it automatically in future sessions.
:::

### Compose Driver Commands

These commands are **only available for `compose` instances**:

```bash
# Initialize new deployment
eudiplo init
eudiplo init ./eudiplo-minimal --preset minimal
eudiplo init ./eudiplo-standard --preset standard --start
eudiplo init --database postgres --storage local --kms vault
eudiplo init --preset standard --public-url https://eudiplo.example.com
eudiplo init --preset standard --demo-tenant

# Manage containers
eudiplo up       # Start services
eudiplo down     # Stop services
eudiplo logs     # View logs

# Reset demo
eudiplo demo --reset --force
```

**Interactive wizard:**

When run in an interactive terminal, `init` opens a wizard for:

- Project directory
- Deployment preset
- Database (SQLite/PostgreSQL)
- Storage (local/S3)
- Key management (DB/Vault)
- Public URL
- Authentication client
- Web client
- Auto-start option

**Deployment presets:**

| Preset      | Database   | Storage            | Key Management  |
| ----------- | ---------- | ------------------ | --------------- |
| `minimal`   | SQLite     | Local filesystem   | Database-backed |
| `standard`  | PostgreSQL | S3 via local MinIO | Database-backed |
| `full`      | PostgreSQL | S3 via local MinIO | Vault           |

Override preset choices with `--database`, `--storage`, and `--kms` flags.

**Non-interactive mode:**

Use `--yes` or `--no-interactive` to suppress the wizard. For automation:

```bash
eudiplo init --preset standard \
  --public-url https://eudiplo.example.com \
  --auth-client-id myapp \
  --auth-client-secret mysecret \
  --yes
```

:::warning[Secret Security]
Avoid exposing secrets in shared shell history when using `--auth-client-secret` in automation.
:::

### Tenant Configuration Commands

Scaffold and manage local config-import folders:

```bash
# List tenants
eudiplo config tenant list   # or: ls

# Create new tenant
eudiplo config tenant create acme --name "Acme GmbH"   # or: new

# Create from demo template
eudiplo config tenant create sample --template demo

# Remove tenant
eudiplo config tenant remove acme --force   # or: rm, delete
```

**What `create` does:**

- Generates `info.json`
- Creates supported resource subdirectories
- With `--template demo`, copies bundled demo resources

**Config root selection:**

- Default: Uses selected Compose instance's config root
- `--instance <name>` — Select another instance
- `--config-directory <path>` — Work with a config root directly

:::warning[Remove Behavior]
`remove` deletes only local files; it does **not** delete an already imported tenant from a running backend.
:::

## Full Command Reference

For a compact list of every nested command:

```bash
eudiplo commands
```

For the complete reference in Markdown format:

```bash
eudiplo commands --format markdown
```

This generates the same command documentation embedded above.

## Related Topics

- [CLI Deployment Guide](../deployment/cli.md) — Setup and usage guide
- [Docker Compose Deployment](../deployment/docker-compose.md) — Deploy with Docker Compose
- [Kubernetes Deployment](../deployment/kubernetes.md) — Deploy on K8s
