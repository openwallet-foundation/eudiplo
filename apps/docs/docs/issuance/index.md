---
title: Credential Issuance
---

Credential issuance in EUDIPLO is organized into **three layers**:

1. **[Credential Configurations](credential-configuration.md)** — Define the structure, format, and metadata of individual credentials
2. **[Issuance Configuration](issuance-configuration.md)** — Define runtime behavior such as authorization, token settings, and wallet attestation
3. **[Credential Offers](credential-offers.md)** — Create issuance offers that combine configuration with runtime claim values

## Additional Components

- **[Claims](claims.md)** — Understand claim resolution, priority, and sources (static, Attribute Provider, offer-time)
- **[Attribute Provider](attribute-provider.md)** — Dynamically fetch claims from external systems
- **[Authorization](authorization.md)** — Configure authorization servers (external, OID4VP, chained, built-in)
- **[Status Management](status-management.md)** — Enable credential revocation and suspension via OAuth Token Status Lists
- **[Notifications](notifications.md)** — Receive issuance status updates via webhooks
- **[Schema Metadata](schema-metadata.md)** — Manage TS11 schema metadata for attestation schemas

## Supported Credential Formats

EUDIPLO supports:

- **SD-JWT VC** (`dc+sd-jwt`) — Selective disclosure JWT credentials
- **mDOC** (`mso_mdoc`) — ISO 18013-5 mobile documents

## Supported Issuance Flows

| Flow | User Known | Authentication | Initiator | Claims Source |
| ---- | ---------- | -------------- | --------- | ------------- |
| **Pre-authorized code** | Yes | Already authenticated before offer | Issuer only | Offer or Attribute Provider |
| **Authorization code + External AS** | No | OIDC login at external IdP | Issuer or Wallet | Attribute Provider (required) |
| **Authorization code + Managed AS (OID4VP)** | No | OID4VP presentation inside issuer-hosted AS | Issuer or Wallet | Attribute Provider (required) |
| **Interactive Authorization (IAE)** | No | Credential presentation (OID4VP) or web redirect | Issuer or Wallet | Attribute Provider (required) |

For detailed flow diagrams and use cases, see the [Issuance Overview](index.md#supported-issuance-flows) in the source documentation.

## Quick Links

- **API Reference**: [OpenAPI Documentation](../reference/openapi.md)
- **Architecture**: [Webhooks](../architecture/extension-points/webhooks.md), [IAE](../architecture/extension-points/iae.md)
- **Trust & Security**: [Trust Lists](../trust/trust-lists.md), [Key Chains](../trust/key-chains.md)
