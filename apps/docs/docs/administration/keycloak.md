---
title: Keycloak Management SSO
---

# Keycloak Management SSO

This guide configures Keycloak for EUDIPLO management SSO, user management, and tenant service-client management. For Keycloak as the upstream authorization server in an OID4VCI issuance flow, see [Keycloak Chained AS](keycloak-chained-as.md).

## Set Up Management SSO

In external OIDC mode, EUDIPLO needs two Keycloak clients:

| Client          | Type         | Purpose                                                                                                              | EUDIPLO setting                           |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `eudiplo-admin` | Confidential | Lets the backend call the Keycloak Admin API to create realm roles, manage users, and create tenant service clients. | `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` |
| `eudiplo-ui`    | Public       | Lets people sign in to the Angular management UI with Authorization Code flow and PKCE.                              | `OIDC_UI_CLIENT_ID`                       |

Do not give a secret to the public UI client. Browser applications cannot protect client secrets.

### Prerequisites

- A running Keycloak instance (tested with Keycloak 22+)
- EUDIPLO and the web client deployed at their intended HTTPS URLs
- A Keycloak realm dedicated to, or approved for, EUDIPLO

### 1. Create the Realm

1. Log in to the Keycloak Admin Console.
2. Select **Create realm**.
3. Enter a realm name, such as `eudiplo`, then select **Create**.

### 2. Create the Backend Administration Client

1. Go to **Clients** and select **Create client**.
2. Create an OpenID Connect client with client ID `eudiplo-admin`.
3. Enable **Client authentication** and **Service account roles**. Disable the standard flow and direct access grants.
4. On the **Credentials** tab, copy the generated client secret.
5. On **Service account roles**, assign the `realm-management` client's `realm-admin` role.

`realm-admin` is required because EUDIPLO creates its realm roles and administers users and clients. For a least-privilege installation, replace it only after verifying that the service account has every permission required to manage realm roles, users, clients, client secrets, and service-account role mappings.

When using Keycloak's current client-credentials behavior, enable **Use refresh tokens for client credentials grant** for this client. EUDIPLO refreshes the Keycloak admin session while it is running.

### 3. Create the Public Web Client

1. Go to **Clients** and select **Create client**.
2. Create an OpenID Connect client with client ID `eudiplo-ui`.
3. Disable **Client authentication** so the client is public.
4. Enable **Standard flow** and leave **Direct access grants** disabled.
5. Set **Valid redirect URIs** to the exact client URL, for example `https://console.example.com/*`.
6. Set **Web origins** to the exact client origin, for example `https://console.example.com`.

EUDIPLO creates or updates this public client at startup. At present, that startup setup sets its redirect URIs and web origins to `*`, so do not rely on manual restrictive values persisting after a restart. Restrict those settings at the network boundary until EUDIPLO supports configuring them. The EUDIPLO login page discovers the realm issuer and this client ID from the management API, then starts Authorization Code flow with PKCE.

### 4. Configure EUDIPLO

Set these environment variables for the backend:

```env
OIDC=https://keycloak.example.com/realms/eudiplo
OIDC_INTERNAL_ISSUER_URL=https://keycloak.example.com/realms/eudiplo
OIDC_CLIENT_ID=eudiplo-admin
OIDC_CLIENT_SECRET=replace-with-the-eudiplo-admin-secret
OIDC_UI_CLIENT_ID=eudiplo-ui
PUBLIC_URL=https://api.example.com
```

Use `OIDC_INTERNAL_ISSUER_URL` when the backend reaches Keycloak through a private URL that differs from the public issuer. The public `OIDC` value must remain the issuer URL embedded in Keycloak tokens and accessible to web browsers.

Optionally set `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET` to have EUDIPLO create a confidential bootstrap client with tenant-management access. This is for machine-to-machine administration and is separate from both `eudiplo-admin` and `eudiplo-ui`.

### 5. Assign EUDIPLO Roles to People

On startup, EUDIPLO creates any missing realm roles. Assign those realm roles to people who sign in through `eudiplo-ui`; the access token must contain their roles and tenant context for EUDIPLO to authorize management API requests.

- Use `tenants:manage` for an administrator who creates and manages tenants.
- Assign the relevant issuance, presentation, key, registrar, or metrics roles for limited access.
- Create tenant-scoped service clients through EUDIPLO when applications, rather than people, need API access. EUDIPLO adds their `tenant_id` and `roles` access-token claims.

Users created through EUDIPLO's user-management API are stored in Keycloak with a `tenant_id` user attribute. They receive a temporary password and are limited to their owning tenant. Avoid removing or changing that attribute directly in Keycloak, because EUDIPLO uses it to enforce tenant ownership when listing, updating, or deleting users.

### Verify Management SSO

1. Start or restart EUDIPLO with the preceding configuration.
2. Open the web client and enter the management API URL.
3. The login page should report that SSO is available and redirect to Keycloak.
4. Sign in with a user that has EUDIPLO realm roles, then confirm that the dashboard loads and only authorized tenant data is visible.

## Related Topics

- [Authentication](authentication.md) — EUDIPLO authentication architecture
- [Tenants](tenants.md) — Multi-tenant configuration
- [Keycloak Chained AS](keycloak-chained-as.md) — Keycloak for OID4VCI issuance authorization
