---
title: Trust Lists
---

# Trust Lists

EUDIPLO implements a trust framework for credential verification based on the ETSI TS 119 602 standard (List of Trusted Entities - LoTE). This ensures that credentials are only accepted from authorized issuers and that revocation information comes from the correct authority.

## Overview

When verifying a credential presentation, EUDIPLO needs to answer two critical questions:

1. **Was this credential issued by a trusted entity?**
2. **Is the revocation status provided by an authorized source?**

Trust lists solve this by maintaining a registry of:

- **Issuance Certificates**: Certificates authorized to sign credentials
- **Revocation Certificates**: Certificates authorized to sign status lists

:::important[Issuance and Revocation Certificate Pairing]
Each trusted entity defines **both** an issuance certificate and a revocation certificate. When verifying a credential, EUDIPLO ensures that the status list is signed by the revocation certificate **from the same entity** that issued the credential. This prevents an attacker from using a valid issuance certificate with a rogue status list.
:::

## Trust List Structure

A trust list in EUDIPLO follows the LoTE (List of Trusted Entities) format and contains:

### Metadata

- **ID**: Unique identifier for the trust list
- **Description**: Human-readable description
- **Signing Certificate**: Certificate used to sign the trust list itself
- **Version/Sequence Number**: Tracks trust list updates

### Trusted Entities

Each entity represents an authorized issuer with:

- **Issuance Certificate**: Used to verify credential signatures
- **Revocation Certificate**: Used to verify status list signatures
- **Entity Information**: Name, country, contact details

```mermaid
graph TD
    TL[Trust List] --> E1[Entity 1]
    TL --> E2[Entity 2]
    TL --> E3[Entity N...]

    E1 --> IC1[Issuance Cert]
    E1 --> RC1[Revocation Cert]
    E1 --> I1[Entity Info]

    E2 --> IC2[Issuance Cert]
    E2 --> RC2[Revocation Cert]
    E2 --> I2[Entity Info]
```

## How Trust Verification Works

### Credential Verification Flow

When a credential is presented for verification:

```mermaid
sequenceDiagram
    participant W as Wallet
    participant V as EUDIPLO Verifier
    participant TL as Trust List
    participant SL as Status List

    W->>V: Present credential (with x5c chain)
    V->>TL: Look up trusted entities
    V->>V: Find matching issuance cert
    Note over V: Credential chains to Entity X's<br/>issuance certificate
    V->>SL: Fetch status list
    V->>V: Verify status list signature
    Note over V: Status list must be signed by<br/>Entity X's revocation cert
    V->>W: Verification result
```

### Certificate Chain Matching

EUDIPLO supports two modes for matching certificates:

1. **CA Mode**: The trust list contains CA certificates. The credential's certificate chain must terminate at the trusted CA.

2. **Pinned Mode**: The trust list contains end-entity certificates. The credential's leaf certificate must exactly match the pinned certificate.

## Creating Trust Lists

### Via Configuration Import

Create a JSON file in `config/{tenant}/trust-lists/`:

```json
{
    "id": "my-trust-list",
    "description": "Production Trust List",
    "keyChainId": "trust-list-signing-key-chain-id",
    "entities": [
        {
            "type": "internal",
            "issuerKeyChainId": "uuid-of-issuance-cert",
            "revocationKeyChainId": "uuid-of-revocation-cert",
            "info": {
                "name": "Organization Name",
                "country": "DE"
            }
        }
    ]
}
```

### Via API

Use the Trust List API endpoints:

```bash
# Create a trust list
curl -X POST "${BASE_URL}/trust-list" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-trust-list",
    "description": "Production Trust List",
    "keyChainId": "trust-list-signing-key-chain-id",
    "entities": [...]
  }'
```

## Entity Types

### Internal Entities

Reference certificates already managed in EUDIPLO:

```json
{
    "type": "internal",
    "issuerKeyChainId": "uuid-of-issuance-cert",
    "revocationKeyChainId": "uuid-of-revocation-cert",
    "info": {
        "name": "Organization Name",
        "country": "DE"
    }
}
```

**Use Case**: You are an **issuer** and want to publish a trust list containing your own certificates that are already managed by EUDIPLO.

**Benefits**:

- Seamless integration with certificates managed in EUDIPLO
- Certificates are validated and linked automatically
- Easy to maintain as certificates are updated in the system

### External Entities

Include PEM certificates directly:

```json
{
    "type": "external",
    "issuerCertPem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "revocationCertPem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "info": {
        "name": "External Issuer",
        "country": "US"
    }
}
```

**Use Case**: You are a **verifier** and want to accept credentials from external issuers that are not managed by your EUDIPLO instance.

**Benefits**:

- Accept credentials from third-party issuers
- No need to import external certificates into EUDIPLO's key management
- Enable cross-organization and cross-border credential acceptance

## Public Trust List Endpoint

Trust lists are published as signed JWTs at:

```
GET /{tenantId}/trust-list/{trustListId}
```

This allows:

- **Other verifiers** to synchronize trust information
- **Auditors** to verify the trust chain

## Related Topics

- [Key Chains](key-chains.md) — Managing trust list signing keys
- [Certificates](certificates.md) — Certificate types and lifecycle
- [Status Management](../issuance/status-management.md) — Credential revocation and status lists
