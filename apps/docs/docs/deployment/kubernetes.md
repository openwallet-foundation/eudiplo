---
title: Kubernetes
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Kubernetes Deployment

Deploy EUDIPLO on Kubernetes with Kustomize deployment profiles for local, staging, and production-oriented environments.

## Architecture

The Kubernetes deployment includes:

- **EUDIPLO Backend** — Main application service (Node.js)
- **EUDIPLO Client** — Web UI served by nginx
- **PostgreSQL** — Optional relational database with persistent storage
- **MinIO** — Optional S3-compatible object storage
- **Vault** — Optional development-only key and encryption-key store
- **Ingress** — nginx HTTP routing with domain-based access

All components include:

- ✅ Security contexts (non-root users)
- ✅ Health probes (readiness, liveness, startup)
- ✅ Resource limits (CPU/memory/ephemeral storage)
- ✅ Persistent storage (StatefulSets with PVCs)

## Deployment Profiles

| Profile    | Components                     | Intended use                        |
| ---------- | ------------------------------ | ----------------------------------- |
| `minimal`  | EUDIPLO, SQLite, local storage | Local development and quick testing |
| `standard` | EUDIPLO, PostgreSQL, MinIO     | Staging and small deployments       |
| `full`     | Standard profile plus Vault    | Local testing of Vault integration  |

Use an external managed database, object store, and Vault for production. The bundled PostgreSQL, MinIO, and Vault workloads are single-replica development deployments.

## Prerequisites

### Kubernetes Cluster

<Tabs>
<TabItem value="docker-desktop" label="Docker Desktop (Local)">

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

</TabItem>
<TabItem value="production" label="Production Cluster">

Ensure you have:

- `kubectl` configured to access your cluster
- Cluster admin permissions
- Storage provisioner configured (for PVCs)
- LoadBalancer or Ingress controller available

</TabItem>
</Tabs>

### Install ingress-nginx Controller

The manifests set `ingressClassName: nginx`; install ingress-nginx to access services through the configured domain names:

```bash
# Install ingress-nginx
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.1/deploy/static/provider/cloud/deploy.yaml

# Wait for it to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### Configure Environment

Choose a profile and copy its environment example. This example uses the standard profile:

```bash
cd deployment/k8s
cp overlays/standard/.env.example overlays/standard/.env
```

Edit `.env`:

```env
# Public URL (for OAuth redirects and OIDC)
PUBLIC_URL=http://eudiplo.localtest.me

# PostgreSQL Configuration
DB_TYPE=postgres
DB_USERNAME=eudiplo
DB_PASSWORD=changeme123
DB_DATABASE=eudiplo

# MinIO Configuration
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET=uploads
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin123
S3_BUCKET=uploads

# Application Secrets
MASTER_SECRET=your-secret-jwt-key-change-in-production
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-client-secret

# Logging
LOG_LEVEL=info
```

:::warning[Security Alert]
The demo credentials will trigger security warnings in the application logs. **Always change these values for production deployments!**
:::

## Deployment Steps

### 1. Create Namespace and Secret

```bash
# Create dedicated namespace
kubectl create namespace eudiplo

# Create Kubernetes secret from .env file
kubectl -n eudiplo create secret generic eudiplo-env --from-env-file=overlays/standard/.env
```

### 2. Deploy All Resources

Using Kustomize profiles (recommended):

```bash
# Standard profile: PostgreSQL and MinIO
kubectl apply -k overlays/standard
```

For a minimal local deployment:

```bash
cp overlays/minimal/.env.example overlays/minimal/.env
kubectl -n eudiplo create secret generic eudiplo-env \
    --from-env-file=overlays/minimal/.env \
    --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -k overlays/minimal
```

The full profile also requires `VAULT_TOKEN` from `overlays/full/.env.example` and creates a development Vault encryption key automatically:

```bash
kubectl apply -k overlays/full
```

Legacy flat manifests remain available for backwards compatibility:

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

## Access the Application

### Using Ingress (Recommended)

Access via domain names (works automatically with `localtest.me`):

- **Backend API**: [http://eudiplo.localtest.me/api](http://eudiplo.localtest.me/api)
- **Backend Health**: [http://eudiplo.localtest.me/health](http://eudiplo.localtest.me/health)
- **Client UI**: [http://eudiplo-client.localtest.me/](http://eudiplo-client.localtest.me/)
- **MinIO Console**: [http://minio-console.localtest.me/](http://minio-console.localtest.me/)

:::tip[Why localtest.me?]
The `localtest.me` domain automatically resolves to `127.0.0.1`, eliminating the need to edit `/etc/hosts`.
:::

### Port Forwarding (Alternative)

If ingress isn't working, use port-forward:

```bash
# Backend API (port 3000)
kubectl -n eudiplo port-forward svc/eudiplo 3000:3000 &

# Client UI (port 4200 → 80)
kubectl -n eudiplo port-forward svc/eudiplo-client 4200:80 &

# MinIO Console (port 9001)
kubectl -n eudiplo port-forward svc/minio 9001:9001 &
```

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

### Application Logs

Follow backend logs:

```bash
kubectl -n eudiplo logs -f deployment/eudiplo
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
```

### Ingress Not Working

Verify ingress-nginx controller:

```bash
# Check controller pods
kubectl -n ingress-nginx get pods

# Verify ingress resource
kubectl -n eudiplo describe ingress eudiplo-ingress
```

The bundled ingress requires the `nginx` ingress class. For a different controller, change `spec.ingressClassName` in the ingress manifest or apply an overlay patch.

Fallback to port-forward (see above).

### Database Connection Errors

Verify PostgreSQL is ready:

```bash
kubectl -n eudiplo exec statefulset/postgres -- pg_isready
```

Restart backend if credentials were updated:

```bash
kubectl -n eudiplo rollout restart deployment/eudiplo
```

### Docker Desktop Kubernetes Certificate Expired

If `kubectl` reports an expired certificate for `https://127.0.0.1:6443`, the Docker Desktop Kubernetes API server certificate has expired. This is local cluster state, not an EUDIPLO certificate. Reset or update Kubernetes from Docker Desktop settings, then verify it with:

```bash
kubectl cluster-info
```

## Related Topics

- [Docker Compose Deployment](docker-compose) — Local development
- [TLS Configuration](tls) — Enable HTTPS
- [Monitoring](../administration/monitoring) — Set up observability
