---
title: Authentication
---

# API Authentication

EUDIPLO uses OAuth 2.0 Client Credentials flow for API authentication, designed for service-to-service communication without user interaction.

## Authentication Architecture

### Design Principles

- **Service-to-Service**: No user interaction required
- **Tenant Isolation**: JWTs are used to isolate tenant data
- **Pluggable Identity**: Support for both built-in and external OIDC providers
- **Stateless**: JWT tokens enable horizontal scaling

### Security Model

- All management endpoints require authentication
- Tenant data is isolated using JWT subject claims
- Tokens are signed and validated for integrity
- Support for token expiration and rotation
- Endpoints are role based protected

**Related Architecture:** For multi-tenant configuration and session management, see [Tenants](tenants.md).

## OAuth2 Client Credentials Authentication

This API exclusively uses the OAuth2 client credentials flow, which is designed for service-to-service authentication where no user interaction is required.

### Built-in OAuth2 Server (Recommended for Getting Started)

EUDIPLO includes a built-in OAuth2 server for simple deployments:

1. **Swagger UI Authentication:**
    - Navigate to the Swagger UI at `/api`
    - Click the "Authorize" button
    - Select "oauth2"
    - Enter client ID and secret (configured via environment variables)
    - Click "Authorize"

2. **Programmatic Access:**

    **Option 1: Credentials in Authorization Header (OAuth2 Standard):**

    ```bash
    curl -X POST http://localhost:3000/api/oauth2/token \
      -H "Content-Type: application/json" \
      -H "Authorization: Basic $(echo -n 'client_id:client_secret' | base64)" \
      -d '{
        "grant_type": "client_credentials"
      }'
    ```

    **Option 2: Credentials in Request Body:**

    ```bash
    curl -X POST http://localhost:3000/api/oauth2/token \
      -H "Content-Type: application/json" \
      -d '{
        "grant_type": "client_credentials",
        "client_id": "your-client-id",
        "client_secret": "your-client-secret"
      }'
    ```

### External OIDC Provider

For enterprise deployments with existing identity infrastructure, EUDIPLO can integrate with external OIDC providers like Keycloak, Auth0, or Azure AD.

**Configuration:**

```env
OIDC=https://your-keycloak.example.com/realms/your-realm
OIDC_CLIENT_ID=your-keycloak-admin-client
OIDC_CLIENT_SECRET=your-keycloak-admin-client-secret
PUBLIC_URL=https://your-api.example.com

# Optional bootstrap root client in OIDC mode
# If both are set, EUDIPLO creates/updates this Keycloak client on startup
AUTH_CLIENT_ID=root
AUTH_CLIENT_SECRET=root-secret
```

**Authentication Flow:**

1. Use your OIDC provider's token endpoint with client credentials flow
2. Include the access token in API requests: `Authorization: Bearer <token>`
3. If `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET` are set, use those credentials against Keycloak to get an initial root/admin token

## Configuration

### External OIDC Provider

```bash
# Enable external OIDC
OIDC=https://your-keycloak.example.com/realms/your-realm
OIDC_INTERNAL_ISSUER_URL=https://your-keycloak.example.com/realms/your-realm
OIDC_CLIENT_ID=your-keycloak-admin-client
OIDC_CLIENT_SECRET=your-keycloak-admin-client-secret
PUBLIC_URL=https://your-api.example.com

# Optional bootstrap root client (created in Keycloak by EUDIPLO startup)
AUTH_CLIENT_ID=root
AUTH_CLIENT_SECRET=root-secret
```

In external OIDC mode:

- EUDIPLO does not issue tokens from `/api/oauth2/token`
- `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` are used by EUDIPLO to manage roles/clients in Keycloak
- `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET` are optional; when both are set, EUDIPLO bootstraps a Keycloak client intended for initial/root login

:::note[Keycloak client_credentials behavior]
When using Keycloak with the current `@keycloak/keycloak-admin-client` startup flow, enable **Use refresh tokens for client credentials grant** on the client configured by `OIDC_CLIENT_ID`. Otherwise, startup may fail with `Cannot read properties of undefined (reading 'split')` during admin client authentication.
:::

### Integrated OAuth2 Server

```bash
# Leave OIDC undefined for integrated OAuth2 server
# All three values below are REQUIRED
PUBLIC_URL=https://your-api.example.com
MASTER_SECRET=your-secret-key-here-minimum-32-characters
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-client-secret
```

:::tip[Security: Secrets are hashed]
Client secrets are securely hashed (bcrypt) before storage. They cannot be retrieved after creation. Use the **Rotate Secret** API endpoint or Web Client button to generate a new secret if needed.
:::

## Protected Endpoints

All administrative endpoints require OAuth2 authentication and are protected by a role based access control approach.

The following roles are available:

```typescript
enum Role {
    // Tenant management
    TENANT_MANAGE = "tenant:manage",
    TENANT_READ = "tenant:read",
    TENANT_ADMIN = "tenant:admin",

    // Issuance operations
    ISSUANCE_OFFER = "issuance:offer",
    ISSUANCE_CONFIG = "issuance:config",

    // Presentation operations
    PRESENTATION_REQUEST = "presentation:request",
    PRESENTATION_CONFIG = "presentation:config",

    // Key management
    KEY_MANAGE = "key:manage",
    KEY_READ = "key:read",

    // Registrar integration
    REGISTRAR_MANAGE = "registrar:manage",

    // Metrics access
    METRICS_READ = "metrics:read",
}
```

Each client can have multiple roles assigned, but each client can only be assigned to one tenant at maximum. The client with the tenant manage must not be assigned to any tenant since it is managing the service in general.

### Resource-Level Access Control

In addition to role-based access control, clients can be restricted to specific presentation or issuance configurations. This allows for fine-grained control over which configurations a service account can use.

**Configuration Fields:**

- `allowedPresentationConfigs`: Array of presentation config IDs. If empty or null, the client can use any presentation config.
- `allowedIssuanceConfigs`: Array of issuance config IDs. If empty or null, the client can use any issuance config.

### Example: Creating a Restricted Client

```bash
curl -X POST http://localhost:3000/clients \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "partner-service",
    "roles": ["presentation:request", "issuance:offer"],
    "allowedPresentationConfigs": ["age-verification", "identity-check"],
    "allowedIssuanceConfigs": ["partner-credential"]
  }'
```

This client can only:

- Create presentation requests for `age-verification` and `identity-check` configs
- Create issuance offers for `partner-credential` config

If the client attempts to use a config not in their allowed list, a `403 Forbidden` error is returned.

## Related Topics

- [Tenants](tenants.md) — Multi-tenant architecture
- [Keycloak Integration](keycloak.md) — Setting up external OIDC
