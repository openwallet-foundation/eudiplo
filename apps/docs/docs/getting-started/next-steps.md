---
title: Extend the Flow
sidebar_label: "4. Extend the flow"
---

You have completed the [membership cookbook](index.md): installation, issuer setup, issuance, and verification. Keep that working flow as your baseline and add one capability at a time.

## Choose your next outcome

| Outcome | Change to the recipe | Guide |
| --- | --- | --- |
| Accept only approved issuers | Add trusted authorities to `membership-check`; test both an accepted and an untrusted issuer | [DCQL](../presentation/dcql.md) and [Trust Lists](../trust/trust-lists.md) |
| Issue after login | Add an authorization server and use an authorization-code offer | [Authorization](../issuance/authorization.md) |
| Fetch real membership data | Replace the example defaults with an attribute provider | [Attribute Providers](../issuance/attribute-provider.md) |
| Receive results in your application | Configure a webhook and handle successful and failed sessions | [Handling Results](../presentation/handling-results.md) |
| Revoke credentials | Enable status management, issue a new credential, then test verification after revocation | [Status Management](../issuance/status-management.md) |
| Deploy beyond a local exercise | Replace test certificate trust, the tunnel, and learning defaults with deployment-specific configuration | [Production](../deployment/production.md) |

Changing a configuration does not change a credential already stored in a wallet. Reissue the credential when testing a change to its claims, type, signing key, or status settings.

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
