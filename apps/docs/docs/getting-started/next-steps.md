---
title: Next Steps
---

Congratulations! You've issued and verified your first credentials with EUDIPLO. Here's where to go next.

## Core Capabilities

| Topic                       | Description                                                          | Guide                                          |
| --------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| **Credential Issuance**     | Deep dive into credential configurations, formats, claims, and flows | [Issuance](../issuance/index.md)               |
| **Credential Presentation** | Advanced verification, DCQL queries, and presentation workflows      | [Presentation](../presentation/index.md)       |
| **Trust & Security**        | Trust lists, key management, certificates, and status management     | [Trust & Security](../trust/index.md)          |
| **Administration**          | Tenants, authentication, database, monitoring, and KMS backends      | [Administration](../administration/tenants.md) |

## Deployment & Production

| Topic                     | Description                                         | Guide                                                   |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| **Production Deployment** | Docker, Kubernetes, TLS, and scaling                | [Deployment](../deployment/index.md)                    |
| **Configuration**         | Environment variables, config files, and validation | [Configuration](../deployment/environment-variables.md) |

## Development & Contribution

| Topic             | Description                                          | Guide                                    |
| ----------------- | ---------------------------------------------------- | ---------------------------------------- |
| **Architecture**  | System design, protocols, and implementation details | [Architecture](../architecture/index.md) |
| **Contributing**  | Development setup, testing, and pull requests        | [Contributing](../contributing/index.md) |
| **API Reference** | OpenAPI spec and generated backend API documentation | [OpenAPI](../reference/openapi.md)       |

## Common Troubleshooting

### "Login failed" error

- Remove trailing `/` from the EUDIPLO instance URL
- Verify `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET` match your configuration
- Check that the backend is running at the specified URL

### Wallet connection issues

- Ensure your wallet is compatible (see [Wallet Compatibility](../reference/wallet-compatibility.md))
- For mobile wallets, EUDIPLO must be accessible via a public HTTPS URL
- Check DPoP settings match wallet capabilities

### Credential issuance fails

- Verify credential configuration includes all required fields
- Check that signing keys exist for the tenant
- Review issuance configuration for correct authorization server settings

For more troubleshooting guidance, see the specific sections in [Issuance](../issuance/index.md) and [Presentation](../presentation/index.md).
