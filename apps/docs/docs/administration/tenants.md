---
title: Tenants
---

# Tenant-Based Architecture

EUDIPLO uses a **tenant-based architecture** that enables you to manage configurations and data for multiple clients or environments within a single deployment. This model is designed for **multi-tenancy**: a single EUDIPLO instance can serve multiple **organizations** (e.g., relying parties, issuers, verifiers) or **environments** (e.g., staging, testing, production) while keeping their data and configurations separate.

You do not need to deploy separate applications for each tenant; instead, all tenants are centrally managed through one deployment.

## Tenant Isolation

Each tenant is logically isolated. Isolation is currently implemented via a `tenantId` column in all database entities, with the following guarantees:

- **Separate configurations**: Tenant-specific settings stored in the database
- **Isolated database records**: All queries scoped by `tenantId`
- **Independent key management**: Cryptographic keys are bound to a tenant context
- **Dedicated session management**: Sessions are created and validated per tenant
- **Individual credential configurations**: Issuance and presentation templates can differ per tenant

> For now, separation is **row-based** via `tenantId`. Future improvements may include **per-tenant databases** or **row-level security (RLS)** enforcement for stronger isolation.

All API calls are tenant-scoped. Access control and endpoint protection are covered in the [Authentication](authentication.md) documentation.

## Tenant Lifecycle

A tenant goes through several stages:

- **Provisioning (Create Tenant):** A tenant is initialized on first use. Default configurations (keys, session settings) are created when calling the `/client` endpoint.
- **Enable:** The tenant becomes active; sessions, keys, and credential templates can be used.
- **Suspend:** A tenant can be disabled (e.g., revoking OIDC client access). Data remains in place but is inaccessible.
- **Re-Enable:** Suspended tenants can be reactivated without data loss.
- **Delete:** A full removal workflow, including key destruction and data wiping.

## Tenant Management

When a protected endpoint is called, EUDIPLO enforces tenant isolation and role-based access control by extracting the tenant ID and user roles from the provided JWT access token. Each endpoint requires specific roles; see the [Protected Endpoints](authentication.md#protected-endpoints) section in the [Authentication](authentication.md) documentation for details.

### Client Management via Web Client

- Clients can be either managed by EUDIPLO by storing the client secrets (securely hashed with bcrypt) in the database or by using an external OIDC provider like Keycloak.
- The web client authenticates against the OIDC provider and interacts with EUDIPLO using the provided access token.

:::note[Client ID format]
Client IDs must be non-empty and may only contain letters, numbers, and the characters `.`, `_`, `:`, and `-`. Whitespace and other special characters are rejected.
:::

From the UI you can:

- Create and delete tenants
- Manage the tenants' clients
- Manage the issuance and presentation configs of the tenants

:::note[Client secrets are hashed]
Client secrets are securely hashed before storage and cannot be retrieved later. When creating a new tenant or client, save the displayed secret immediately—it won't be shown again. If lost, use the **Rotate Secret** button to generate a new one.
:::

> Even with tenant management privileges, users will **only see tenant-scoped data**. EUDIPLO enforces tenant context based on the access token.

### Client Management via the API

- `/tenant` endpoint allows programmatic management of tenants
- `/client` endpoint allows programmatic management of clients. Based on the access token the tenant context is extracted to perform actions on the specific tenant's clients

### Authentication Methods

Instead of client secrets, you may use any authentication method supported by your OIDC provider. EUDIPLO only validates the **access token**; it does not care how authentication was performed. When using EUDIPLO as the OIDC provider, only clientID + clientSecret is supported for now.

## Security Considerations

- **Access control:** All API calls are validated against tenant context and roles embedded in the access token

## Related Topics

- [Authentication](authentication.md) — OAuth2 and role-based access control
- [KMS Configuration](kms.md) — Key management per tenant
- [Database](database.md) — Data isolation and storage
