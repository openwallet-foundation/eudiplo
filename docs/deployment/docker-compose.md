# Docker Compose Deployment

Deploy EUDIPLO using Docker Compose for local development, testing, and small-scale production environments. Docker Compose provides an easy way to run multi-container applications with minimal configuration.

## Overview

EUDIPLO offers three Docker Compose deployment options:

| Deployment      | Use Case             | Database         | Key Storage | Production Ready |
| --------------- | -------------------- | ---------------- | ----------- | ---------------- |
| **Quick Start** | Quick testing, demos | None (ephemeral) | Ephemeral   | ❌ No            |
| **Minimal**     | Development, testing | SQLite           | Filesystem  | ⚠️ Limited       |
| **Full**        | Production, staging  | PostgreSQL       | Vault       | ✅ Yes           |

## Prerequisites

Before you begin, ensure you have:

- **Docker** installed ([Get Docker](https://www.docker.com/get-started))
- **Docker Compose** V2 or later (included with Docker Desktop)
- Basic understanding of Docker concepts

Verify installation:

```bash
docker --version
docker compose version
```

## Quick Start (Root Directory)

The fastest way to get EUDIPLO running for quick testing.

### Setup

From the repository root, create an `.env` file with required credentials:

```bash
cp .env.example .env

# Generate required credentials
echo "MASTER_SECRET=$(openssl rand -base64 32)" >> .env
echo "AUTH_CLIENT_ID=demo" >> .env
echo "AUTH_CLIENT_SECRET=demo-secret" >> .env
```

### Start Services

```bash
docker compose up -d
```

This starts:

- **Backend API** on port 3000
- **Client UI** on port 4200

### Access Applications

- **Backend API:** [http://localhost:3000/api](http://localhost:3000/api)
- **Backend Health:** [http://localhost:3000/health](http://localhost:3000/health)
- **Client UI:** [http://localhost:4200](http://localhost:4200)

### Stop Services

```bash
docker compose down
```

!!! warning "Ephemeral Storage"

    This deployment uses default in-memory storage. **All data is lost when containers stop.** Use Minimal or Full deployment for persistent storage.

## Docker-only Demo Backend Image (Advanced)

If you specifically want a Docker-only demo flow without the CLI, use the demo
backend image. For most users, `npx @eudiplo/cli demo` is the recommended
onboarding path.

From `deployment/docker-compose` (pull from GHCR):

```bash
cp .env.minimal.example .env
echo "EUDIPLO_IMAGE=ghcr.io/openwallet-foundation/eudiplo-demo:latest" >> .env
docker compose up -d
```

Or build locally:

```bash
docker build --target eudiplo-demo -t eudiplo-demo:local ../..
cp .env.minimal.example .env
echo "EUDIPLO_IMAGE=eudiplo-demo:local" >> .env
docker compose up -d
```

Behavior:

- The demo image includes demo config files inside the container.
- On startup, it seeds demo config only when the config folder is empty.
- If you keep existing config/data in the volume, bootstrap is skipped.

## Minimal Deployment

Ideal for development and testing with persistent storage but without production dependencies.

### Features

- ✅ **Persistent Storage** - SQLite database
- ✅ **Filesystem Keys** - Keys stored on local filesystem
- ✅ **Simple Setup** - No external dependencies
- ✅ **Fast Startup** - Minimal overhead
- ⚠️ **Limited Scalability** - Not suitable for high-traffic production

### Setup

Navigate to minimal deployment:

```bash
cd deployment/minimal
```

Copy and configure environment:

```bash
cp example.env .env
```

Edit `.env`:

```bash
# Public URL (for OAuth redirects)
PUBLIC_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

### Deploy

Start services:

```bash
docker compose up -d
```

Watch logs:

```bash
docker compose logs -f
```

### Access Applications

- **Backend API:** [http://localhost:3000/api](http://localhost:3000/api)
- **Client UI:** [http://localhost:4200](http://localhost:4200)

### Data Persistence

Data is stored in Docker volumes:

```bash
# View volumes
docker volume ls | grep minimal

# Inspect volume
docker volume inspect minimal_eudiplo-config
```

### Stop and Cleanup

```bash
# Stop services
docker compose down

# Remove volumes (deletes all data)
docker compose down -v
```

## Full Deployment (Production)

Production-ready deployment with PostgreSQL, HashiCorp Vault, and MinIO object storage.

### Features

- ✅ **PostgreSQL Database** - Relational database for transactional data
- ✅ **HashiCorp Vault** - Secure key management
- ✅ **MinIO** - S3-compatible object storage
- ✅ **Health Checks** - Automatic restart on failure
- ✅ **Docker Networks** - Isolated networking
- ✅ **Persistent Volumes** - Data survives restarts

### Architecture

```
┌─────────────────┐
│  Client (4200)  │
└────────┬────────┘
         │
┌────────▼────────┐      ┌──────────────┐
│ Backend (3000)  │◄────►│ PostgreSQL   │
└────────┬────────┘      └──────────────┘
         │
         ├──────────────►┌──────────────┐
         │               │ Vault (8200) │
         │               └──────────────┘
         │
         └──────────────►┌──────────────┐
                         │ MinIO (9000) │
                         └──────────────┘
```

### Setup

Navigate to full deployment:

```bash
cd deployment/full
```

Copy and configure environment:

```bash
cp example.env .env
```

Edit `.env` with your configuration:

```bash
# Public URL (change for production)
PUBLIC_URL=https://your-domain.com

# Environment
NODE_ENV=production

# PostgreSQL Configuration
DB_TYPE=postgres
DB_HOST=database
DB_PORT=5432
DB_USERNAME=eudiplo_user
DB_PASSWORD=strong-secure-password-here
DB_DATABASE=eudiplo

# HashiCorp Vault
VAULT_TOKEN=your-vault-root-token
VAULT_ADDR=http://vault:8200

# MinIO (S3-compatible storage)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin-secure-password

# Application Secrets
MASTER_SECRET=your-secret-jwt-key-change-in-production
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-client-secret

# Telemetry (optional - enable for OpenTelemetry monitoring)
# OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
# OTEL_SDK_DISABLED=false

# Logging
LOG_LEVEL=info
```

!!! danger "Security Warning"

    **Never use default credentials in production!** Change all passwords, tokens, and secrets before deploying.

### Deploy

Start all services:

```bash
docker compose up -d
```

Watch startup logs:

```bash
docker compose logs -f
```

Wait for all services to be healthy:

```bash
docker compose ps
```

Expected output:

```
NAME                    STATUS              PORTS
full-database-1         Up (healthy)        5432/tcp
full-vault-1            Up                  0.0.0.0:8200->8200/tcp
full-minio-1            Up (healthy)        0.0.0.0:9000-9001->9000-9001/tcp
full-eudiplo-1          Up (healthy)        0.0.0.0:3000->3000/tcp
full-eudiplo-client-1   Up (healthy)        0.0.0.0:4200->80/tcp
```

### Access Applications

- **Backend API:** [http://localhost:3000/api](http://localhost:3000/api)
- **Backend Health:** [http://localhost:3000/health](http://localhost:3000/health)
- **Client UI:** [http://localhost:4200](http://localhost:4200)
- **Vault UI:** [http://localhost:8200](http://localhost:8200) (Token: from VAULT_TOKEN)
- **MinIO Console:** [http://localhost:9001](http://localhost:9001) (Login: MINIO_ROOT_USER/PASSWORD)

### Service Management

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
docker compose logs -f database
```

Restart a service:

```bash
docker compose restart eudiplo
```

Stop services:

```bash
docker compose down
```

Remove all data:

```bash
docker compose down -v
```

## Testing & Verification

### Health Checks

Verify backend health:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
    "status": "ok",
    "info": {
        "database": {
            "status": "up"
        }
    },
    "version": "main"
}
```

### Database Connection

Connect to PostgreSQL (full deployment):

```bash
docker compose exec database psql -U eudiplo_user -d eudiplo
```

Inside psql:

```sql
\dt           -- List tables
\l            -- List databases
\q            -- Quit
```

### Vault Access

Access Vault UI:

1. Navigate to [http://localhost:8200](http://localhost:8200)
2. Sign in with token from `.env` (VAULT_TOKEN)
3. Verify EUDIPLO secrets are stored

Via CLI:

```bash
docker compose exec vault vault status
```

### MinIO Verification

1. Navigate to [http://localhost:9001](http://localhost:9001)
2. Login with credentials from `.env`
3. Verify buckets are created

Via CLI:

```bash
docker compose exec minio mc ls
```

## Troubleshooting

### Services Not Starting

Check service status:

```bash
docker compose ps
```

View logs for failed service:

```bash
docker compose logs <service-name>
```

Common issues:

1. **Port already in use:**

    ```bash
    # Find process using port
    lsof -i :3000

    # Kill process or change port in docker-compose.yml
    ```

2. **Database not ready:**

    ```bash
    # Check database health
    docker compose exec database pg_isready -U eudiplo_user

    # Restart backend after database is ready
    docker compose restart eudiplo
    ```

3. **Permission errors:**

    ```bash
    # Fix volume permissions
    sudo chown -R $(id -u):$(id -g) ./config
    ```

### Connection Refused Errors

If backend can't connect to database:

```bash
# Verify database is running
docker compose ps database

# Check database logs
docker compose logs database

# Verify network connectivity
docker compose exec eudiplo ping database
```

### Data Persistence Issues

Verify volumes are created:

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect full_db_data
```

### Vault Unsealing

If Vault is sealed:

```bash
# Check status
docker compose exec vault vault status

# In dev mode, Vault auto-unseals
# For production, follow Vault unsealing procedures
```

## Configuration

### Environment Variables

Common environment variables:

| Variable                      | Description                          | Default                 |
| ----------------------------- | ------------------------------------ | ----------------------- |
| `PUBLIC_URL`                  | Public URL for OAuth redirects       | `http://localhost:3000` |
| `NODE_ENV`                    | Environment (development/production) | `development`           |
| `DB_TYPE`                     | Database type (postgres/sqlite)      | `postgres`              |
| `DB_HOST`                     | Database hostname                    | `database`              |
| `DB_PORT`                     | Database port                        | `5432`                  |
| `DB_USERNAME`                 | Database username                    | -                       |
| `DB_PASSWORD`                 | Database password                    | -                       |
| `DB_DATABASE`                 | Database name                        | `eudiplo`               |
| `VAULT_TOKEN`                 | Vault root token                     | -                       |
| `VAULT_ADDR`                  | Vault address                        | `http://vault:8200`     |
| `MASTER_SECRET`               | Master secret for JWT and encryption | - (required)            |
| `AUTH_CLIENT_ID`              | OAuth client ID                      | - (required)            |
| `AUTH_CLIENT_SECRET`          | OAuth client secret                  | - (required)            |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint              | `http://localhost:4318` |
| `OTEL_SDK_DISABLED`           | Disable OpenTelemetry SDK            | `false`                 |
| `LOG_LEVEL`                   | Logging level                        | `info`                  |

See [Configuration Documentation](../architecture/index.md) for complete list.

#### Client Environment Variables

The client container supports the following environment variables:

| Variable           | Description                                                                                                                                                                                                                                  | Default |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `CLIENT_BASE_HREF` | HTML base href (`<base href="..." />`). Useful for reverse proxy setups where the client is served from a subpath. For example, if the client is served from `https://example.com/eudiplo-client/`, set `CLIENT_BASE_HREF=/eudiplo-client/`. | `/`     |

!!! note "Base Href Normalization"

    The `CLIENT_BASE_HREF` value is automatically normalized to ensure it starts and ends with `/`. For example, `eudiplo-client` becomes `/eudiplo-client/`.

!!! tip "Reverse Proxy Setup Required"

    Setting `CLIENT_BASE_HREF` alone is not enough — the reverse proxy must also be configured to forward the subpath to the client container. See [Serving the Client from a Subpath](../deployment/tls.md#serving-the-client-from-a-subpath) for complete Nginx and Traefik examples.

```yaml
services:
    eudiplo:
        ports:
            - '8080:3000' # Change 3000 to 8080

    eudiplo-client:
        ports:
            - '8081:8080' # Change 4200 to 8081
```

### Resource Limits

Add resource limits to prevent resource exhaustion:

```yaml
services:
    eudiplo:
        deploy:
            resources:
                limits:
                    cpus: '1.0'
                    memory: 512M
                reservations:
                    cpus: '0.5'
                    memory: 256M
```

## Updating

### Update to Latest Images

Pull latest images:

```bash
docker compose pull
```

Restart services:

```bash
docker compose up -d
```

### Update to Specific Version

Edit `docker-compose.yml`:

```yaml
services:
    eudiplo:
        image: ghcr.io/openwallet-foundation/eudiplo:v1.2.3

    eudiplo-client:
        image: ghcr.io/openwallet-foundation/eudiplo-client:v1.2.3
```

Then:

```bash
docker compose up -d
```

## Backup & Restore

### Backup PostgreSQL Database

```bash
# Create backup
docker compose exec database pg_dump -U eudiplo_user eudiplo > backup.sql

# Or with Docker
docker compose exec -T database pg_dump -U eudiplo_user eudiplo > backup.sql
```

### Restore PostgreSQL Database

```bash
# Stop backend
docker compose stop eudiplo

# Restore
cat backup.sql | docker compose exec -T database psql -U eudiplo_user eudiplo

# Start backend
docker compose start eudiplo
```

### Backup Vault Data

```bash
# Create volume backup
docker run --rm \
  -v full_vault_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/vault-backup.tar.gz -C /data .
```

### Backup MinIO Data

```bash
# Create volume backup
docker run --rm \
  -v full_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup.tar.gz -C /data .
```

## Monitoring

### View Resource Usage

```bash
docker stats
```

### Check Logs

```bash
# Follow all logs
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100

# Specific time range
docker compose logs --since 2h
```

### Health Check Status

```bash
# Check all services health
docker compose ps

# Backend health endpoint
curl http://localhost:3000/health

# Database health
docker compose exec database pg_isready -U eudiplo_user
```

## Production Considerations

### Security

Before deploying to production:

1. **Change all default credentials** (database passwords, Vault token, JWT secret)
2. **Use HTTPS** with valid SSL certificates (not self-signed)
3. **Enable firewall** and restrict port access
4. **Use secrets management** instead of `.env` files
5. **Regular security updates** for all images
6. **Enable Docker Content Trust** for image verification
7. **Configure `ENCRYPTION_KEY_SOURCE=vault`** so the encryption key is only in RAM, not in environment variables (see [Encryption at Rest](../architecture/database.md#encryption-key-sources))

### Secret Management Strategies

EUDIPLO requires several secrets (database credentials, JWT secret, encryption key, etc.). While the quick-start uses `.env` files, production deployments should use proper secret management.

#### Credential Categories

| Secret                 | Risk Level | Dev/Test Approach | Production Approach                |
| ---------------------- | ---------- | ----------------- | ---------------------------------- |
| `DB_PASSWORD`          | High       | `.env` file       | Docker Secrets / Vault Agent       |
| `MASTER_SECRET`        | Critical   | `.env` file       | Docker Secrets / Vault Agent       |
| `AUTH_CLIENT_SECRET`   | Critical   | `.env` file       | Docker Secrets / Vault Agent       |
| `S3_SECRET_ACCESS_KEY` | High       | `.env` file       | Docker Secrets / IAM Role          |
| `ENCRYPTION_KEY`       | Critical   | `.env` file       | Application-level fetch (built-in) |

#### Option 1: Docker Secrets (Docker Swarm)

Docker Secrets provide encrypted secret storage for Swarm mode:

```bash
# Create secrets
echo "your-db-password" | docker secret create db_password -
echo "your-jwt-secret" | docker secret create master_secret -
echo "your-auth-client-secret" | docker secret create auth_client_secret -
```

Reference in `docker-compose.yml`:

```yaml
version: '3.8'
services:
    eudiplo:
        image: eudiplo/backend:latest
        secrets:
            - db_password
            - master_secret
            - auth_client_secret
        environment:
            DB_PASSWORD_FILE: /run/secrets/db_password
            MASTER_SECRET_FILE: /run/secrets/master_secret
            AUTH_CLIENT_SECRET_FILE: /run/secrets/auth_client_secret

secrets:
    db_password:
        external: true
    master_secret:
        external: true
    auth_client_secret:
        external: true
```

!!! note "File-based Secrets"

    Docker Secrets are mounted as files at `/run/secrets/<secret_name>`. The application reads secret values from these files at startup.

#### Option 2: Vault Agent Sidecar

Run HashiCorp Vault Agent alongside the application to inject secrets:

```yaml
services:
    vault-agent:
        image: hashicorp/vault:latest
        command: agent -config=/vault/config/agent.hcl
        volumes:
            - vault-secrets:/vault/secrets
            - ./vault-agent-config.hcl:/vault/config/agent.hcl:ro

    eudiplo:
        image: eudiplo/backend:latest
        depends_on:
            - vault-agent
        volumes:
            - vault-secrets:/vault/secrets:ro
        environment:
            DB_PASSWORD_FILE: /vault/secrets/db_password
            MASTER_SECRET_FILE: /vault/secrets/master_secret

volumes:
    vault-secrets:
```

Vault Agent config (`vault-agent-config.hcl`):

```hcl
vault {
  address = "https://vault.example.com:8200"
}

auto_auth {
  method "approle" {
    config = {
      role_id_file_path   = "/vault/config/role-id"
      secret_id_file_path = "/vault/config/secret-id"
    }
  }
}

template {
  source      = "/vault/config/secrets.ctmpl"
  destination = "/vault/secrets/env"
}
```

#### Option 3: Environment File Encryption

For simpler setups, encrypt the `.env` file at rest:

```bash
# Encrypt .env with age or sops
age -e -r age1... .env > .env.encrypted

# Decrypt at deployment time
age -d .env.encrypted > .env
docker compose up -d
rm .env  # Remove plaintext immediately
```

#### Why Encryption Key Is Different

The `ENCRYPTION_KEY` uses application-level fetching (via `ENCRYPTION_KEY_SOURCE`) because:

1. **TypeORM Transformer Singleton**: The encryption transformer must be initialized before any database operations
2. **Runtime-Only Access**: The key is fetched once at startup and kept only in memory
3. **Built-in Support**: Configure `ENCRYPTION_KEY_SOURCE=vault` in the Full deployment to fetch the key from Vault at runtime

For all other secrets, infrastructure-level injection (Docker Secrets, Vault Agent) is preferred.

### High Availability

Docker Compose is **not suitable for high-availability production** deployments because:

- ❌ Single host only (no multi-node support)
- ❌ No automatic failover
- ❌ Limited scaling capabilities
- ❌ Manual orchestration required

For production with HA requirements, use:

- ✅ **Kubernetes** (see [Kubernetes Deployment](kubernetes.md))
- ✅ **Docker Swarm** (basic orchestration)
- ✅ **Managed container services** (AWS ECS, Azure Container Instances)

### Vault Production Setup

!!! danger "Vault Dev Mode"

    The full deployment uses Vault in **dev mode**, which is **NOT production-safe**. Data is ephemeral and unsealing is automatic.

For production Vault:

1. Use **production mode** with persistent storage
2. Configure **auto-unsealing** (AWS KMS, Azure Key Vault, GCP KMS)
3. Enable **audit logging**
4. Set up **backup and disaster recovery**
5. Use **access control policies** (ACLs)

Resources:

- [Vault Production Hardening](https://developer.hashicorp.com/vault/tutorials/operations/production-hardening)
- [Docker Vault Setup](https://github.com/ahmetkaftan/docker-vault)
- [Vault Docker Example](https://gist.github.com/Mishco/b47b341f852c5934cf736870f0b5da81)

### Database Considerations

For production PostgreSQL:

- ✅ Enable **connection pooling** (PgBouncer)
- ✅ Configure **regular backups** (pg_dump, WAL archiving)
- ✅ Set up **replication** for high availability
- ✅ Monitor **performance metrics**
- ✅ Use **volume backups** or external storage

### Logging & Monitoring

Configure centralized logging:

```yaml
services:
    eudiplo:
        logging:
            driver: 'json-file'
            options:
                max-size: '10m'
                max-file: '3'
```

Or use external logging (Loki, ELK):

```yaml
logging:
    driver: 'loki'
    options:
        loki-url: 'http://loki:3100/loki/api/v1/push'
```

## When to Use Docker Compose vs Kubernetes

### Use Docker Compose When

✅ **Local development** and testing  
✅ **Single-server deployment** with moderate traffic  
✅ **Quick demos** and proof of concepts  
✅ **Internal tools** with low availability requirements  
✅ **Cost-effective** small-scale deployments

### Use Kubernetes When

✅ **Production environments** with high availability needs  
✅ **Multi-node clusters** for scalability  
✅ **Auto-scaling** based on load  
✅ **Zero-downtime deployments**  
✅ **Cloud-native** infrastructure  
✅ **Complex networking** and service mesh

See: [Kubernetes Deployment Guide](kubernetes.md)

## Advanced Configuration

### Using External Database

Instead of containerized PostgreSQL, use external database:

Edit `docker-compose.yml`:

```yaml
services:
    eudiplo:
        environment:
            - DB_HOST=your-database-host.com
            - DB_PORT=5432
            - DB_SSL=true # Enable SSL for external DB
        # Remove database service and dependency
```

Remove database service from `docker-compose.yml`.

### Custom Docker Network

Connect to existing Docker network:

```yaml
networks:
    eudiplo-network:
        external: true
        name: my-existing-network
```

### Build from Source

Instead of using pre-built images:

```yaml
services:
    eudiplo:
        build:
            context: ../..
            dockerfile: Dockerfile
            target: eudiplo
        # Remove 'image' line
```

Build and start:

```bash
docker compose build
docker compose up -d
```

## Cleanup

### Remove All Containers

```bash
docker compose down
```

### Remove Volumes (Data Loss)

```bash
docker compose down -v
```

### Remove Images

```bash
docker compose down --rmi all
```

### Complete Cleanup

```bash
# Remove everything including volumes
docker compose down -v --rmi all --remove-orphans

# Remove dangling images
docker image prune -a

# Remove unused volumes
docker volume prune
```

## Support & Resources

- **Documentation:** [https://openwallet-foundation.github.io/eudiplo/docs/](https://openwallet-foundation.github.io/eudiplo/docs/)
- **GitHub Issues:** [https://github.com/openwallet-foundation/eudiplo/issues](https://github.com/openwallet-foundation/eudiplo/issues)
- **Discord Community:** [https://discord.gg/58ys8XfXDu](https://discord.gg/58ys8XfXDu)
- **Docker Compose Docs:** [https://docs.docker.com/compose/](https://docs.docker.com/compose/)

## Next Steps

- 📖 Explore [Architecture](../architecture/index.md) to understand EUDIPLO design
- 🔐 Configure [Key Management](../architecture/key-management.md)
- 🔑 Set up [API Authentication](../api/authentication.md)
- ☸️ Deploy to [Kubernetes](kubernetes.md) for production
- 📊 Enable [Monitoring](../getting-started/monitor.md)
