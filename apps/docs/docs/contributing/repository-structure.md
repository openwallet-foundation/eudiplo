---
title: Repository Structure
---

# Workspace Structure

EUDIPLO is a pnpm monorepo. Applications live in `apps/`, reusable packages live in `packages/`, and operational resources are kept alongside the code they support.

```text
.
├── apps/
│   ├── backend/           # NestJS API server
│   ├── client/            # Angular management UI
│   ├── cli/               # Command-line client
│   ├── kms-reference/     # Reference KMS implementation
│   └── webhook/           # Webhook test application
├── packages/              # Reusable SDK packages
├── docs/                  # Legacy MkDocs documentation (being migrated)
├── apps/docs/             # New Docusaurus documentation site
├── deployment/            # Docker Compose and Kubernetes resources
├── monitor/               # Prometheus and Grafana setup
├── scripts/               # Repository-wide generation and maintenance scripts
├── package.json           # Root scripts and development dependencies
└── pnpm-workspace.yaml    # Workspace package definitions
```

## Applications

### Backend (`@eudiplo/backend`)

The backend is the NestJS API server and protocol implementation. It owns OID4VCI and OID4VP flows, authentication, configuration, persistence, trust, and key management. See [Backend Development](./backend.md) for module structure and dependency boundaries.

The development server listens on port 3000 by default.

### Client (`@eudiplo/client`)

The Angular management UI provides credential configuration, presentation management, monitoring, and administration. Its development server listens on port 4200 by default.

### CLI (`@eudiplo/cli`)

The CLI provides scriptable access to management operations. Package-specific instructions are in [CLI Development](./cli.md).

### Webhook (`@eudiplo/webhook`)

The webhook application is a test integration for presentation verification and webhook development.

### KMS Reference Application

The KMS reference application demonstrates the external key-management contract used by EUDIPLO.

## Packages and Supporting Directories

- `packages/` contains reusable TypeScript SDK code.
- `docs/` contains legacy hand-written and generated project documentation (being migrated to `apps/docs/`).
- `apps/docs/` contains the new Docusaurus documentation site.
- `deployment/` contains local and production deployment examples.
- `monitor/` contains the observability stack used in development.
- `scripts/` contains schema, API, and documentation generation utilities.

## Common Workspace Commands

Run commands from the repository root unless a guide says otherwise.

```bash
# Install dependencies
pnpm install

# Start workspace applications in development mode
pnpm run dev

# Build, lint, and test all packages
pnpm run build
pnpm run lint
pnpm run test

# Target one application
pnpm --filter @eudiplo/backend run dev
pnpm --filter @eudiplo/client run dev
```

Add an application-specific dependency through its workspace package instead of adding it to the repository root:

```bash
pnpm --filter @eudiplo/backend add dependency-name
pnpm --filter @eudiplo/client add dependency-name
```

Root dependencies should be limited to tooling used by multiple workspaces.
