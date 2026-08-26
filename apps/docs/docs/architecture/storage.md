---
title: Storage
---

# Storage

EUDIPLO requires persistent file storage for:

- Credential offer artifacts (QR codes, deep links)
- Uploaded trust list and certificate files
- Temporary session-related assets

Storage is abstracted through a pluggable provider interface, allowing deployments to use local filesystem storage during development and S3-compatible object storage in production.

## Configuration

import ConfigTable from "@site/src/components/ConfigTable";

<ConfigTable group="storage" />

## Local Storage

Uses the server's local filesystem. Files are stored under the configured root directory:

```
STORAGE_ROOT/
  tenants/
    <tenant-id>/
      offers/
        <offer-id>.png
      trust-lists/
        <trust-list-id>.xml
      certificates/
        <cert-id>.pem
```

**Environment Variables:**

```bash
STORAGE_PROVIDER=local
STORAGE_ROOT=/app/storage
```

**Use when:** Development, single-node deployments, or when network storage is unavailable.

**Limitations:**

- Not suitable for multi-instance deployments (no shared state)
- Manual backup required
- Limited scalability

## S3 Storage

Uses S3-compatible object storage (AWS S3, MinIO, Azure Blob Storage via S3 API, Google Cloud Storage with S3 interop).

**Environment Variables:**

```bash
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com
S3_BUCKET=eudiplo-storage
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=<your-access-key>
S3_SECRET_ACCESS_KEY=<your-secret-key>
S3_FORCE_PATH_STYLE=false  # Set to true for MinIO
```

**Use when:** Production deployments, multi-instance horizontally scaled setups, managed cloud infrastructure.

**Benefits:**

- Shared storage across all EUDIPLO instances
- Built-in durability and replication
- Managed backup and lifecycle policies
- No single point of failure

## Extensibility

To add a new storage provider (e.g., Azure Blob Storage native API, Google Cloud Storage), implement the `StorageProvider` interface:

```typescript
export interface StorageProvider {
    putObject(
        key: string,
        body: Buffer | Readable,
        contentType: string,
    ): Promise<void>;
    getObject(key: string): Promise<Buffer>;
    deleteObject(key: string): Promise<void>;
    objectExists(key: string): Promise<boolean>;
}
```

Then register it in `StorageModule`:

```typescript
providers: [
  {
    provide: 'STORAGE_PROVIDER',
    useFactory: (config: ConfigService) => {
      const provider = config.get('STORAGE_PROVIDER');
      if (provider === 'azure-blob') {
        return new AzureBlobStorageProvider(config);
      }
      // ... existing providers
    },
  },
],
```

## Accessibility

All stored objects are **tenant-scoped** via key prefixes:

- `tenants/{tenantId}/offers/{offerId}.png`
- `tenants/{tenantId}/trust-lists/{trustListId}.xml`

The storage provider ensures:

- Tenant isolation (one tenant cannot access another's files)
- Consistent key structure across providers
- Automatic content-type detection

## Multi-Tenant Storage

Each tenant's files are isolated by key prefix. Access control is enforced at the application layer before calling the storage provider:

```typescript
// Application layer validates tenantId before storage operation
const key = `tenants/${tenantId}/offers/${offerId}.png`;
await storageProvider.putObject(key, buffer, "image/png");
```

### Example: Storing a credential offer QR code

```typescript
const qrCodeBuffer = await QRCode.toBuffer(offerUrl);
const key = `tenants/${session.tenantId}/offers/${session.id}.png`;
await this.storageProvider.putObject(key, qrCodeBuffer, "image/png");
```
