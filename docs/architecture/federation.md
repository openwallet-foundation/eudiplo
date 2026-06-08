# OpenID Federation Trust Evaluation Support

## Overview

EUDIPLO now supports **OpenID Federation** trust evaluation for credential verification and issuer authentication. This enables federation-based trust decisions alongside existing LoTE (List of Trusted Entities) mechanisms through a configurable hybrid trust strategy.

## Key Features

- **Federation Entity Configuration**: Fetch and validate entity configurations from federation endpoints
- **Authority Chain Validation**: Verify authority_hints chain to configured trust anchors
- **Multiple Trust Modes**: Support for federation-only, LoTE-only, and hybrid trust strategies
- **Caching**: Configurable TTL-based caching of federation trust decisions
- **Backward Compatible**: Existing non-federated tenants remain unaffected
- **Authorization Server Validation**: Evaluate upstream OIDC providers and chained AS configurations against federation policy
- **Presentation Verification**: Support federation-based trust in credential verification flows

## Trust Modes

### 1. Hybrid Mode (Default)

```json
{
  "mode": "hybrid",
  "trustAnchors": [...]
}
```

- **Policy**: Federation trust is authoritative; LoTE acts as fallback
- **Behavior**: If entity is trusted in federation, accepted; otherwise, check LoTE
- **Use Case**: Environments with both federation and LoTE requirements

### 2. Federation-Only Mode

```json
{
  "mode": "federation-only",
  "trustAnchors": [...]
}
```

- **Policy**: Only federation trust is checked
- **Behavior**: Entity must be trusted by federation or trust chain fails
- **Use Case**: Pure federation deployments

### 3. LoTE-Only Mode

```json
{
    "mode": "lote-only",
    "trustAnchors": []
}
```

- **Policy**: Only LoTE trust lists are checked
- **Behavior**: Federation validation is skipped (backwards compatible)
- **Use Case**: Existing LoTE-only deployments

## Configuration

### Issuance Configuration (API)

Enable federation for credential issuance:

```bash
POST /api/issuer/config
{
  "display": [...],
  "authServers": ["https://auth.example.org"],
  "federation": {
    "role": "leaf",
    "mode": "hybrid",
    "entityId": "https://issuer.example.org",
    "enforceSigningPolicy": true,
    "cacheTtlSeconds": 300,
    "trustAnchors": [
      {
        "entityId": "https://ta.example.org",
        "entityConfigurationUri": "https://ta.example.org/.well-known/openid-federation"
      },
      {
        "entityId": "https://ta2.example.org",
        "entityConfigurationUri": "https://ta2.example.org/.well-known/openid-federation"
      }
    ]
  }
}
```

### Client UI

1. Navigate to **Issuance → Configuration → Advanced Federation** tab
2. Enable "Enable OpenID Federation"
3. Configure:
    - **Entity Role**: leaf, intermediate, or trust_anchor
    - **Trust Decision Mode**: federation-only, lote-only, or hybrid
    - **Entity ID**: Your issuer's federation entity identifier (optional)
    - **Cache TTL**: How long to cache federation decisions (default: 300 seconds)
    - **Enforce Signing Policy**: Whether to enforce federation policy for signing
4. Add Trust Anchors with Entity ID and Entity Configuration URI
5. Save configuration

### Credential Configuration (SD-JWT Trust Signaling)

For SD-JWT credentials, trust signaling is configured per credential in the client at:

- `Issuance -> Credential Config -> Create/Edit -> SD-JWT Trust Format`

Available values:

- `x5c` (default): embeds certificate chain in SD-JWT header
- `federation`: uses issuer federation identity (`iss`) for trust resolution

Important behavior:

- Default is **X.509/x5c**
- Federation is used **only when explicitly selected** (`sdJwtTrustFormat = "federation"`)
- Signing key chain selection is still used in both modes; this setting controls trust signaling, not signing key selection

### Presentation Configuration (Verifier)

When verifying credentials, specify federation authorities in DCQL:

```bash
POST /api/verifier/config
{
  "dcql_query": {
    "credentials": [
      {
        "id": "pid",
        "format": "vc+sd-jwt",
        "meta": {
          "vct_values": [
            "<TENANT_URL>/credentials-metadata/vct/pid"
          ]
        },
        "claims": [
          {
            "path": ["address", "locality"]
          }
        ],
        "trusted_authorities": [
          {
            "type": "openid_federation",
            "values": ["https://ta.example.org"]
          },
          {
            "type": "etsi_tl",
            "values": ["https://eudi-wallet.org/trust-list"]
          }
        ]
      }
    ]
  }
}
```

## Architecture

### Federation Trust Service (`FederationTrustService`)

**Location**: `apps/backend/src/shared/trust/federation-trust.service.ts`

**Core Methods**:

- `getMode(source)`: Get configured trust mode
- `isEnabled(source)`: Check if federation is enabled
- `shouldUseFederation(source)`: Check if federation should be evaluated
- `shouldUseLote(source)`: Check if LoTE should be evaluated
- `evaluateEntityTrust(entityId, source)`: Main entity trust evaluation
- `evaluateAuthorizationServerTrust(issuer, source)`: Evaluate auth server/issuer trust
- `evaluateCertificateEntityTrust(x5c, source)`: Extract entity ID from certificate and evaluate

**Features**:

- Entity configuration fetching from `/.well-known/openid-federation`
- Authority hints chain validation
- TTL-based caching with configurable expiration
- Detailed trust decision reasons
- Support for both JWT and JSON entity configurations

### Credential Chain Validation

**Modified**: `CredentialChainValidationService`

**Integration Points**:

1. Parse federation mode from validation policy
2. Extract x5c certificate chain
3. Run federation evaluation (if enabled)
4. Fall back to LoTE if federation fails (hybrid mode)
5. Log detailed trust path for both federation and LoTE

**Supported Verification Types**:

- SD-JWT VC verification
- mDoc verification
- Presentation verification (DCQL-based)

### OID4VCI Authorization Server Validation

**Modified**: `Oid4vciService`

**Behavior**:

- `issuerMetadata()`: Validate each configured auth server against federation policy
- Only include auth servers that pass federation trust evaluation (federation-only mode)
- Filter auth servers when generating credential issuer metadata
- Provide detailed error messages when auth server validation fails

### Chained Authorization Server (Upstream Provider)

**Modified**: `ChainedAsService`

**Behavior**:

- `getUpstreamDiscovery()`: Validate upstream OIDC provider against federation policy
- Check upstream issuer before fetching discovery configuration
- Support tenant-specific federation configurations
- Cache discovery results after validation

**Validation Flow**:

1. Load issuance configuration with federation settings
2. Validate upstream issuer URL against federation anchors
3. If validation passes, proceed with `.well-known/openid-configuration` fetch
4. Cache discovery result

## Migration Guide

### For Existing Tenants (No Changes Required)

Tenants without federation configuration will automatically use existing LoTE trust behavior:

- `federation` field is `null` by default
- No API changes required
- Backward compatible with all existing flows

### For New Federation-Based Deployments

1. **Set up federation trust anchors** in your infrastructure
2. **Configure tenants** via API or client UI with federation settings
3. **Verify trust decisions** via audit logs and cache stats endpoint
4. **Monitor** federation trust evaluation performance

### Migration from LoTE-Only to Hybrid

1. Enable federation configuration on tenant
2. Set `mode: "hybrid"`
3. Configure trust anchors pointing to federation entities
4. Test with a subset of credentials
5. Monitor trust decision paths in logs
6. Gradually increase trust anchor scope

## API Endpoints

### Trust Management

**GET `/api/cache/stats`**

- View caching statistics including federation cache hits/misses
- Helps optimize cache TTL settings

**DELETE `/api/cache/trust-list`**

- Clear all trust-related caches (federation + LoTE)
- Useful for testing or after configuration changes

### Configuration

**GET/POST/PATCH `/api/issuer/config`**

- Manage issuance configuration including federation settings

**GET/POST/PATCH `/api/verifier/config`**

- Manage presentation configuration including federation authorities

## Error Handling

### Federation Trust Failures

When federation trust evaluation fails:

```json
{
    "statusCode": 400,
    "message": "Upstream issuer is not trusted by OpenID Federation policy: Authority hints do not point to configured trust anchors",
    "error": "Bad Request"
}
```

**Common reasons**:

- Entity configuration fetch failed (network error)
- Authority hints don't point to configured anchors
- Entity configuration expired (exp claim in the past)
- Invalid JW T in entity configuration

### Detailed Logging

Federation trust evaluation logs include:

- Entity ID being evaluated
- Trust mode being applied
- Authority hints chain validation result
- Cache hit/miss information
- Final trust decision with detailed reason

**Example**:

```
[FederationTrustService] Evaluating entity: https://issuer.example.org
[FederationTrustService] Mode: hybrid, Federation enabled: true, LoTE enabled: true
[FederationTrustService] Entity configuration fetch from: https://issuer.example.org/.well-known/openid-federation
[FederationTrustService] Authority hints validated: [https://ta.example.org] -> https://ta.example.org (trusted anchor)
[FederationTrustService] Trust result: TRUSTED (federation)
```

## Database Schema

### Issuance Configuration

New column added to `issuance_config` table:

```sql
federation JSON NULL
```

Migration: `1763000000000-AddFederationToIssuanceConfig`

**Schema**:

```typescript
{
  role?: "trust_anchor" | "intermediate" | "leaf",
  mode?: "federation-only" | "lote-only" | "hybrid",
  entityId?: string,
  enforceSigningPolicy?: boolean,
  cacheTtlSeconds?: number,
  trustAnchors: Array<{
    entityId: string,
    entityConfigurationUri: string
  }>
}
```

## Performance Considerations

### Caching

- **Default TTL**: 300 seconds (5 minutes)
- **Cache Key**: `{entityId}:{tenantId}:{mode}`
- **In-Memory Storage**: Map-based cache per service instance
- **No Persistence**: Cache lost on service restart

### Network

- Entity configuration fetches are synchronous during validation
- Fetch timeout: 10 seconds (configurable via environment)
- Retries: 1 attempt (no automatic retry)

### Optimization Tips

- Increase `cacheTtlSeconds` in stable environments (600+ seconds)
- Batch trust evaluations where possible
- Monitor cache hit rates via `/api/cache/stats`
- Use `mode: "lote-only"` in hybrid mode if federation validation becomes bottleneck

## Troubleshooting

### Entity Configuration Not Found

**Error**: "Entity configuration fetch failed"
**Cause**: `.well-known/openid-federation` endpoint not accessible
**Solution**:

- Verify entity configuration URI is correct and publicly accessible
- Check network connectivity and firewall rules
- Ensure endpoint returns valid JWT or JSON

### Authority Hints Validation Fails

**Error**: "Authority hints do not point to configured trust anchors"
**Cause**: Entity's authority_hints don't reference your trust anchors
**Solution**:

- Verify trust anchor entity IDs are correct
- Check if entity is intermediate (should have authority_hints)
- Verify entity configuration is up-to-date

### Cache Not Expiring

**Error**: "Entity still blocked after configuration update"
**Cause**: Trust decision is cached beyond expected TTL
**Solution**:

- Clear cache: `DELETE /api/cache/trust-list`
- Reduce `cacheTtlSeconds` for faster updates
- Restart service for persistent issues

## Testing

### E2E Coverage

Federation is covered by dedicated e2e tests:

- `apps/backend/test/issuance/issuance-federation.e2e-spec.ts`
    - trusted authorization server accepted
    - untrusted authorization server rejected
    - JWT-form federation entity configuration accepted
- `apps/backend/test/presentation/presentation-federation.e2e-spec.ts`
    - verifier flow processes SD-JWT presentation with OpenID Federation trusted authority configured

### Test Federation Configuration

```bash
# Verify federation is working
curl -X GET https://issuer.example.org/api/cache/stats

# Check trust decision for specific entity
# (Via logs or audit trail)

# Clear cache to force re-evaluation
curl -X DELETE https://issuer.example.org/api/cache/trust-list
```

### Test with SDK

```typescript
import { IssuanceDto } from '@eudiplo/sdk-core';

const config: IssuanceDto = {
    federation: {
        role: 'leaf',
        mode: 'hybrid',
        entityId: 'https://issuer.example.org',
        trustAnchors: [
            {
                entityId: 'https://ta.example.org',
                entityConfigurationUri: 'https://ta.example.org/.well-known/openid-federation',
            },
        ],
        cacheTtlSeconds: 300,
        enforceSigningPolicy: true,
    },
    // ... other config
};

await api.issuer.postIssuanceConfig(config);
```

## References

- [OpenID Federation 1.0](https://openid.net/specs/openid-federation-1_0.html)
- [RFC 8414 OAuth 2.0 Authorization Server Metadata](https://tools.ietf.org/html/rfc8414)
- EUDIPLO Architecture: [docs/architecture/](../index.md)
