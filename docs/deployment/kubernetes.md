# Kubernetes Deployment

Deploy EUDIPLO on Kubernetes with PostgreSQL and MinIO (S3-compatible storage), optimized for production use and **Docker Desktop** local testing.

## Architecture

The Kubernetes deployment includes:

- **EUDIPLO Backend** - Main application service (Node.js)
- **EUDIPLO Client** - Web UI served by nginx
- **PostgreSQL** - Relational database with persistent storage
- **MinIO** - S3-compatible object storage for file uploads
- **Ingress** - HTTP routing with domain-based access

All components include:

- ✅ Security contexts (non-root users)
- ✅ Health probes (readiness, liveness, startup)
- ✅ Resource limits (CPU/memory)
- ✅ Persistent storage (StatefulSets with PVCs)

## Prerequisites

### 1. Kubernetes Cluster

=== "Docker Desktop (Local)"

    Enable Kubernetes in Docker Desktop:

    1. Open Docker Desktop → Settings → Kubernetes
    2. Check "Enable Kubernetes"
    3. Click "Apply & Restart"
    4. Wait for Kubernetes to start (green indicator)

    Verify installation:
    ```bash
    kubectl version --client
    kubectl cluster-info
    ```

=== "Production Cluster"

    Ensure you have:

    - `kubectl` configured to access your cluster
    - Cluster admin permissions
    - Storage provisioner configured (for PVCs)
    - LoadBalancer or Ingress controller available

### 2. Install ingress-nginx Controller

!!! info "Docker Desktop Users"

    This step is required for accessing services via domain names.

```bash
# Install ingress-nginx
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.1/deploy/static/provider/cloud/deploy.yaml

# Wait for it to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### 3. Configure Environment Variables

Navigate to the Kubernetes manifests directory:

```bash
cd deployment/k8s
```

Copy the example configuration:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Public URL (for OAuth redirects and OIDC)
PUBLIC_URL=http://eudiplo.localtest.me

# PostgreSQL Configuration
DB_USERNAME=eudiplo
DB_PASSWORD=changeme123
DB_DATABASE=eudiplo

# MinIO Configuration
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET=uploads

# Application Secrets (ALL REQUIRED when not using external OIDC)
MASTER_SECRET=your-secret-jwt-key-change-in-production
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-client-secret

# Logging
LOG_LEVEL=info
```

!!! warning "Security Alert"

    The demo credentials will trigger security warnings in the application logs. **Always change these values for production deployments!**

## Deployment Steps

### 1. Create Namespace and Secret

```bash
# Create dedicated namespace
kubectl create namespace eudiplo

# Create Kubernetes secret from .env file
kubectl -n eudiplo create secret generic eudiplo-env --from-env-file=.env
```

### 2. Deploy All Resources

Using Kustomize (recommended):

```bash
kubectl apply -k .
```

Or apply individual manifests:

```bash
kubectl apply -f namespace.yaml
kubectl apply -f postgres-statefulset.yaml
kubectl apply -f postgres-service.yaml
kubectl apply -f minio-statefulset.yaml
kubectl apply -f minio-service.yaml
kubectl apply -f minio-bucket-job.yaml
kubectl apply -f eudiplo-deployment.yaml
kubectl apply -f eudiplo-service.yaml
kubectl apply -f eudiplo-client-deployment.yaml
kubectl apply -f eudiplo-client-service.yaml
kubectl apply -f ingress.yaml
```

### 3. Verify Deployment

Check all resources:

```bash
kubectl -n eudiplo get all
```

Watch pods until all are Running:

```bash
kubectl -n eudiplo get pods -w
```

Expected output (all Running/Completed):

```
NAME                                  READY   STATUS      RESTARTS   AGE
pod/eudiplo-xxxxxxxxxx-xxxxx          1/1     Running     0          2m
pod/eudiplo-client-xxxxxxxxxx-xxxxx   1/1     Running     0          2m
pod/postgres-0                        1/1     Running     0          3m
pod/minio-0                           1/1     Running     0          3m
pod/minio-mc-bootstrap-xxxxx          0/1     Completed   0          2m
```

Check logs if pods are not starting:

```bash
kubectl -n eudiplo logs -f deployment/eudiplo
kubectl -n eudiplo logs -f deployment/eudiplo-client
kubectl -n eudiplo logs -f statefulset/postgres
kubectl -n eudiplo logs -f statefulset/minio
kubectl -n eudiplo logs -f job/minio-mc-bootstrap
```

## Access the Application

### Option 1: Using Ingress (Recommended)

Access via domain names (works automatically with `localtest.me`):

- **Backend API:** [http://eudiplo.localtest.me/api](http://eudiplo.localtest.me/api)
- **Backend Health:** [http://eudiplo.localtest.me/health](http://eudiplo.localtest.me/health)
- **Client UI:** [http://eudiplo-client.localtest.me/](http://eudiplo-client.localtest.me/)
- **MinIO Console:** [http://minio-console.localtest.me/](http://minio-console.localtest.me/)

!!! tip "Why localtest.me?"

    The `localtest.me` domain automatically resolves to `127.0.0.1`, eliminating the need to edit `/etc/hosts`.

### Option 2: Port Forwarding

If ingress isn't working, use port-forward as fallback:

```bash
# Backend API (port 3000)
kubectl -n eudiplo port-forward svc/eudiplo 3000:3000 &

# Client UI (port 4200 → 8080)
kubectl -n eudiplo port-forward svc/eudiplo-client 4200:80 &

# MinIO Console (port 9001)
kubectl -n eudiplo port-forward svc/minio 9001:9001 &

# PostgreSQL (for debugging, port 5432)
kubectl -n eudiplo port-forward svc/postgres 5432:5432 &
```

Then access:

- Backend: [http://localhost:3000/api](http://localhost:3000/api)
- Client: [http://localhost:4200/](http://localhost:4200/)
- MinIO Console: [http://localhost:9001/](http://localhost:9001/)

Kill all port-forwards:

```bash
pkill -f "kubectl.*port-forward"
```

## Testing & Verification

### Health Checks

Verify the backend is healthy:

```bash
# Using ingress
curl http://eudiplo.localtest.me/health

# Using port-forward
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

### MinIO Console Access

1. Navigate to [http://minio-console.localtest.me/](http://minio-console.localtest.me/)
2. Login with credentials from `.env`:
    - Username: `minioadmin` (MINIO_ROOT_USER)
    - Password: `minioadmin123` (MINIO_ROOT_PASSWORD)
3. Verify the `uploads` bucket exists

Verify bucket creation via logs:

```bash
kubectl -n eudiplo logs job/minio-mc-bootstrap
```

### Database Connection

Connect to PostgreSQL:

```bash
kubectl -n eudiplo exec -it statefulset/postgres -- psql -U eudiplo -d eudiplo
```

Inside psql:

```sql
\dt           -- List tables
\l            -- List databases
\q            -- Quit
```

### Application Logs

Follow backend logs:

```bash
kubectl -n eudiplo logs -f deployment/eudiplo
```

Follow client logs:

```bash
kubectl -n eudiplo logs -f deployment/eudiplo-client
```

View all pod logs:

```bash
kubectl -n eudiplo logs -l app=eudiplo --tail=50
```

## Troubleshooting

### Pods Not Starting

Check pod status and events:

```bash
# Describe pod
kubectl -n eudiplo describe pod <pod-name>

# Check namespace events
kubectl -n eudiplo get events --sort-by='.lastTimestamp'

# Check init containers (if pod is in Init:X/Y state)
kubectl -n eudiplo logs <pod-name> -c wait-for-postgres
kubectl -n eudiplo logs <pod-name> -c wait-for-minio
```

### Ingress Not Working

Verify ingress-nginx controller:

```bash
# Check controller pods
kubectl -n ingress-nginx get pods

# Verify ingress resource
kubectl -n eudiplo describe ingress eudiplo-ingress

# Check ingress-nginx logs
kubectl -n ingress-nginx logs -l app.kubernetes.io/component=controller --tail=100
```

Fallback to port-forward (see Option 2 above).

### Database Connection Errors

Verify PostgreSQL is ready:

```bash
kubectl -n eudiplo exec statefulset/postgres -- pg_isready
```

Check database credentials:

```bash
kubectl -n eudiplo get secret eudiplo-env -o jsonpath='{.data.DB_USERNAME}' | base64 -d
kubectl -n eudiplo get secret eudiplo-env -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

Restart backend if credentials were updated:

```bash
kubectl -n eudiplo rollout restart deployment/eudiplo
```

### MinIO Connection Issues

Check MinIO health:

```bash
kubectl -n eudiplo exec statefulset/minio -- wget -qO- http://localhost:9000/minio/health/ready
```

Verify bucket creation job:

```bash
kubectl -n eudiplo logs job/minio-mc-bootstrap
```

Re-run bucket creation if needed:

```bash
kubectl -n eudiplo delete job minio-mc-bootstrap
kubectl apply -f minio-bucket-job.yaml
```

### Storage Issues

Check Persistent Volume Claims:

```bash
kubectl -n eudiplo get pvc
```

Describe PVC for issues:

```bash
kubectl -n eudiplo describe pvc postgres-data-postgres-0
kubectl -n eudiplo describe pvc minio-data-minio-0
```

Check available storage classes:

```bash
kubectl get storageclass
```

## Updating Configuration

### Update Environment Variables

Edit `.env` file, then update the secret:

```bash
# Delete old secret
kubectl -n eudiplo delete secret eudiplo-env

# Create new secret
kubectl -n eudiplo create secret generic eudiplo-env --from-env-file=.env

# Restart all deployments to pick up changes
kubectl -n eudiplo rollout restart deployment/eudiplo
kubectl -n eudiplo rollout restart deployment/eudiplo-client
kubectl -n eudiplo rollout restart statefulset/postgres
kubectl -n eudiplo rollout restart statefulset/minio
```

### Update Image Version

Update to a specific version:

```bash
kubectl -n eudiplo set image deployment/eudiplo \
  eudiplo=ghcr.io/openwallet-foundation/eudiplo:v1.2.3
```

Or edit deployment directly:

```bash
kubectl -n eudiplo edit deployment eudiplo
```

Watch rollout status:

```bash
kubectl -n eudiplo rollout status deployment/eudiplo
```

## Cleanup

### Remove All Resources

Delete everything in the namespace:

```bash
kubectl delete namespace eudiplo
```

Or selectively delete resources:

```bash
kubectl delete -k .
```

### Remove Persistent Data

!!! danger "Data Loss Warning"

    This permanently deletes all database and storage data!

```bash
# Delete Persistent Volume Claims
kubectl -n eudiplo delete pvc --all

# Verify deletion
kubectl -n eudiplo get pvc
```

## Production Considerations

Before deploying to production, address these critical areas:

### 1. Security

- **Change all default secrets** (MASTER_SECRET, database passwords, MinIO credentials)
- **Enable TLS/HTTPS** using cert-manager or LoadBalancer with TLS termination
- **Implement network policies** to restrict pod-to-pod communication
- **Apply Pod Security Standards** (restricted PSS to namespace)
- **Use external secret management** (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault)
- **Configure `ENCRYPTION_KEY_SOURCE`** to `vault`, `aws`, or `azure` so the encryption key is only in RAM (see [Encryption at Rest](../architecture/database.md#encryption-key-sources))

### Secret Management Strategies

EUDIPLO requires several secrets (database credentials, JWT secret, encryption key, etc.). The recommended approach is to use **infrastructure-level secret injection** rather than storing secrets in `.env` files or passing them directly as environment variables.

#### Credential Categories

| Secret                 | Risk Level | Recommended Approach                       |
| ---------------------- | ---------- | ------------------------------------------ |
| `DB_PASSWORD`          | High       | External Secrets Operator / Vault Agent    |
| `MASTER_SECRET`        | Critical   | External Secrets Operator / Vault Agent    |
| `AUTH_CLIENT_SECRET`   | Critical   | External Secrets Operator / Vault Agent    |
| `S3_SECRET_ACCESS_KEY` | High       | IRSA (AWS) / Workload Identity (Azure/GCP) |
| `ENCRYPTION_KEY`       | Critical   | Application-level fetch (built-in support) |

#### Option 1: External Secrets Operator (Recommended)

The [External Secrets Operator](https://external-secrets.io/) syncs secrets from external providers into Kubernetes Secrets.

```yaml
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
-n external-secrets --create-namespace
```

Example SecretStore for AWS Secrets Manager:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
    name: aws-secrets-manager
    namespace: eudiplo
spec:
    provider:
        aws:
            service: SecretsManager
            region: eu-central-1
            auth:
                jwt:
                    serviceAccountRef:
                        name: eudiplo-sa
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
    name: eudiplo-secrets
    namespace: eudiplo
spec:
    refreshInterval: 1h
    secretStoreRef:
        name: aws-secrets-manager
        kind: SecretStore
    target:
        name: eudiplo-env
        creationPolicy: Owner
    data:
        - secretKey: DB_PASSWORD
          remoteRef:
              key: eudiplo/production
              property: db_password
        - secretKey: MASTER_SECRET
          remoteRef:
              key: eudiplo/production
              property: master_secret
        - secretKey: AUTH_CLIENT_SECRET
          remoteRef:
              key: eudiplo/production
              property: auth_client_secret
```

Example SecretStore for HashiCorp Vault:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
    name: vault
    namespace: eudiplo
spec:
    provider:
        vault:
            server: 'https://vault.example.com'
            path: 'secret'
            version: 'v2'
            auth:
                kubernetes:
                    mountPath: 'kubernetes'
                    role: 'eudiplo'
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
    name: eudiplo-secrets
    namespace: eudiplo
spec:
    refreshInterval: 1h
    secretStoreRef:
        name: vault
        kind: SecretStore
    target:
        name: eudiplo-env
    data:
        - secretKey: DB_PASSWORD
          remoteRef:
              key: eudiplo/credentials
              property: db_password
        - secretKey: MASTER_SECRET
          remoteRef:
              key: eudiplo/credentials
              property: master_secret
```

#### Option 2: Vault Agent Sidecar

Use the [Vault Agent Injector](https://developer.hashicorp.com/vault/docs/platform/k8s/injector) to inject secrets directly into pods:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
    name: eudiplo
spec:
    template:
        metadata:
            annotations:
                vault.hashicorp.com/agent-inject: 'true'
                vault.hashicorp.com/role: 'eudiplo'
                vault.hashicorp.com/agent-inject-secret-config: 'secret/eudiplo/credentials'
                vault.hashicorp.com/agent-inject-template-config: |
                    {{- with secret "secret/eudiplo/credentials" -}}
                    export DB_PASSWORD="{{ .Data.data.db_password }}"
                    export MASTER_SECRET="{{ .Data.data.master_secret }}"
                    export AUTH_CLIENT_SECRET="{{ .Data.data.auth_client_secret }}"
                    {{- end -}}
```

#### Option 3: Cloud-Native IAM (for S3/Storage)

For S3 credentials, prefer IAM-based authentication:

=== "AWS (IRSA)"

    ```yaml
    apiVersion: v1
    kind: ServiceAccount
    metadata:
      name: eudiplo-sa
      annotations:
        eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/eudiplo-s3-role
    ```

    No `S3_ACCESS_KEY_ID` or `S3_SECRET_ACCESS_KEY` needed—the SDK uses IRSA automatically.

=== "Azure (Workload Identity)"

    ```yaml
    apiVersion: v1
    kind: ServiceAccount
    metadata:
      name: eudiplo-sa
      annotations:
        azure.workload.identity/client-id: "<managed-identity-client-id>"
    ```

=== "GCP (Workload Identity)"

    ```yaml
    apiVersion: v1
    kind: ServiceAccount
    metadata:
      name: eudiplo-sa
      annotations:
        iam.gke.io/gcp-service-account: eudiplo@project.iam.gserviceaccount.com
    ```

#### Why Encryption Key Is Different

The `ENCRYPTION_KEY` uses application-level fetching (via `ENCRYPTION_KEY_SOURCE`) because:

1. **TypeORM Transformer Singleton**: The encryption transformer must be initialized before any database operations, which happens during module bootstrap
2. **Runtime-Only Access**: The key is fetched once at startup and kept only in memory—never written to disk or environment
3. **Built-in Support**: EUDIPLO has native integrations for Vault, AWS Secrets Manager, and Azure Key Vault

For all other secrets, rely on infrastructure-level injection as described above.

### 2. High Availability

- **Increase replicas** for backend and client deployments
- **Deploy PostgreSQL HA solution** (Patroni, Zalando Postgres Operator)
- **Configure MinIO in distributed mode** or use managed S3 (AWS S3, Azure Blob)
- **Add Pod Disruption Budgets** to ensure availability during updates

### 3. Monitoring & Observability

- **Deploy Prometheus** for metrics collection
- **Deploy Grafana** for visualization
- **Configure alerting** for critical issues (disk full, pod restarts, high error rates)
- **Set up log aggregation** (ELK stack, Loki, CloudWatch)
- **Enable distributed tracing** (Jaeger, Tempo)

### 4. Backup & Disaster Recovery

- **Schedule PostgreSQL backups** (pg_dump, WAL archiving, managed backup solutions)
- **Configure MinIO replication** or use managed S3 with versioning
- **Test restore procedures** regularly
- **Document recovery time objectives (RTO)** and recovery point objectives (RPO)

### 5. Performance & Scaling

- **Review resource limits** based on actual load testing
- **Configure Horizontal Pod Autoscaler (HPA)** for backend/client
- **Use caching** (Redis) for session management
- **Optimize database queries** and add indexes
- **Consider CDN** for static assets

### 6. Storage

- **Use production-grade storage class** with replication (AWS EBS gp3, Azure Premium SSD)
- **Configure volume snapshots** for point-in-time recovery
- **Monitor disk usage** and set up alerts
- **Plan for storage growth**

## Advanced Configuration

### Enable Debug Logging

Update LOG_LEVEL in `.env`:

```bash
LOG_LEVEL=debug
```

Recreate secret and restart:

```bash
kubectl -n eudiplo delete secret eudiplo-env
kubectl -n eudiplo create secret generic eudiplo-env --from-env-file=.env
kubectl -n eudiplo rollout restart deployment/eudiplo
```

### Scale Deployments

Scale backend to 3 replicas:

```bash
kubectl -n eudiplo scale deployment/eudiplo --replicas=3
```

Scale client to 2 replicas:

```bash
kubectl -n eudiplo scale deployment/eudiplo-client --replicas=2
```

Verify scaling:

```bash
kubectl -n eudiplo get deployment
```

### Resource Monitoring

Check resource usage:

```bash
# Pod metrics (requires metrics-server)
kubectl -n eudiplo top pods

# Node metrics
kubectl -n eudiplo top nodes
```

View resource requests/limits:

```bash
kubectl -n eudiplo describe deployment eudiplo | grep -A5 "Limits\|Requests"
```

### Configure Horizontal Pod Autoscaler

Create HPA for backend (requires metrics-server):

```bash
kubectl -n eudiplo autoscale deployment eudiplo \
  --cpu-percent=70 \
  --min=2 \
  --max=10
```

Monitor HPA:

```bash
kubectl -n eudiplo get hpa -w
```

## Manifest Reference

The deployment includes the following Kubernetes resources:

| File                             | Type        | Purpose                                      |
| -------------------------------- | ----------- | -------------------------------------------- |
| `namespace.yaml`                 | Namespace   | Isolated namespace for all resources         |
| `postgres-statefulset.yaml`      | StatefulSet | PostgreSQL database with persistent storage  |
| `postgres-service.yaml`          | Service     | Internal DNS for database access             |
| `minio-statefulset.yaml`         | StatefulSet | MinIO object storage with persistent storage |
| `minio-service.yaml`             | Service     | Internal DNS for MinIO API and Console       |
| `minio-bucket-job.yaml`          | Job         | One-time bucket creation and configuration   |
| `eudiplo-deployment.yaml`        | Deployment  | EUDIPLO backend application                  |
| `eudiplo-service.yaml`           | Service     | Internal DNS for backend API                 |
| `eudiplo-client-deployment.yaml` | Deployment  | EUDIPLO web client (nginx)                   |
| `eudiplo-client-service.yaml`    | Service     | Internal DNS for web client                  |
| `ingress.yaml`                   | Ingress     | HTTP routing to services                     |
| `kustomization.yaml`             | Kustomize   | Manifest aggregation and management          |

## Technical Details

### Security Contexts

All pods run with security contexts:

- **Non-root users**: PostgreSQL (UID 999), MinIO (UID 1000), Backend (UID 1000), Client (UID 101)
- **Dropped capabilities**: All containers drop ALL Linux capabilities
- **No privilege escalation**: `allowPrivilegeEscalation: false`
- **Read-only root filesystem**: Where applicable (init containers)

### Health Probes

All services include comprehensive health probes:

- **Readiness Probe**: Determines when pod is ready to receive traffic
- **Liveness Probe**: Detects when pod needs to be restarted
- **Startup Probe**: Provides extra time for slow-starting applications

### Init Containers

Proper startup ordering via init containers:

1. **Backend waits for**: PostgreSQL ready + MinIO ready
2. **Client waits for**: Backend healthy
3. **Bucket job waits for**: MinIO ready

### Persistent Storage

StatefulSets use PersistentVolumeClaims:

- **PostgreSQL**: 10Gi for database files (`/var/lib/postgresql/data`)
- **MinIO**: 10Gi for object storage (`/data`)

PVCs use the cluster's default StorageClass (Docker Desktop includes one by default).

## Support & Resources

- **Documentation**: [https://openwallet-foundation.github.io/eudiplo/docs/](https://openwallet-foundation.github.io/eudiplo/docs/)
- **GitHub Issues**: [https://github.com/openwallet-foundation/eudiplo/issues](https://github.com/openwallet-foundation/eudiplo/issues)
- **Discord Community**: [https://discord.gg/58ys8XfXDu](https://discord.gg/58ys8XfXDu)
- **Source Code**: [https://github.com/openwallet-foundation/eudiplo](https://github.com/openwallet-foundation/eudiplo)

## Next Steps

- 📖 Learn about [EUDIPLO Architecture](../architecture/index.md)
- 🔐 Configure [Key Management](../architecture/key-management.md)
- 📊 Set up [Monitoring](../getting-started/monitor.md)
- 🔑 Explore [API Authentication](../api/authentication.md)
