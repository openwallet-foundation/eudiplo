---
title: Docker Compose
---

# Docker Compose Deployment

Deploy EUDIPLO using Docker Compose for local development, testing, and small-scale deployments.

## Quick Start

From the repository root:

```bash
# Create environment file
cp .env.example .env

# Start services
docker compose up -d

# Access the API
curl http://localhost:3000/health
```

Access points:

- **Backend API**: [http://localhost:3000/api](http://localhost:3000/api)
- **Client UI**: [http://localhost:4200](http://localhost:4200)

For the complete Docker Compose deployment guide including minimal, standard, and full presets, see the [Server Setup Cookbook](./server-setup-cookbook.md).

## Deployment Presets

EUDIPLO offers three Docker Compose deployment options:

| Preset      | Database   | Storage            | Key Management  | Production Ready |
| ----------- | ---------- | ------------------ | --------------- | ---------------- |
| **Minimal** | SQLite     | Local filesystem   | Database-backed | ⚠️ Limited       |
| **Standard** | PostgreSQL | S3 via local MinIO | Database-backed | ✅ Yes (small)   |
| **Full**    | PostgreSQL | S3 via local MinIO | Vault           | ✅ Yes           |

## Environment Variables

Essential configuration for all presets:

```env
# Public URL (for OAuth redirects)
PUBLIC_URL=http://localhost:3000

# Environment
NODE_ENV=production

# Application Secrets
MASTER_SECRET=your-secret-jwt-key-change-in-production
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-client-secret
```

:::danger[Security Warning]
**Never use default credentials in production!** Change all passwords, tokens, and secrets before deploying.
:::

## Full Deployment Configuration

For production deployments with PostgreSQL, MinIO, and optional Vault:

```env
# PostgreSQL Configuration
DB_TYPE=postgres
DB_HOST=database
DB_PORT=5432
DB_USERNAME=eudiplo_user
DB_PASSWORD=strong-secure-password-here
DB_DATABASE=eudiplo

# MinIO (S3-compatible storage)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin-secure-password
```

## Service Management

View running services:

```bash
docker compose ps
```

View logs:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f eudiplo
```

Restart a service:

```bash
docker compose restart eudiplo
```

Stop services:

```bash
docker compose down

# Remove all data (volumes)
docker compose down -v
```

## Related Topics

- [Server Setup Cookbook](./server-setup-cookbook.md) — Detailed setup instructions
- [CLI Tool](./cli.md) — Deploy with EUDIPLO CLI
- [Kubernetes Deployment](kubernetes) — Production deployment on K8s
- [TLS Configuration](tls) — Enable HTTPS
