---
title: Registrar
---

# Registrar

To interact with an EUDI Wallet, two types of certificates are required:

- **Access Certificate** — Grants access to the EUDI Wallet
- **Registration Certificate** — Authorizes data requests from the EUDI Wallet

You can still use EUDIPLO without these certificates, but it may result in warnings when making requests to the EUDI Wallet.

## Prerequisites

:::warning[Role Required]
To see the **Registrar** menu in the client, your tenant must have the `registrar:manage` role assigned. When creating a tenant, make sure to select this role (or select "All roles" for a full setup).
:::

## Step 1: Configure Registrar Credentials

Each tenant can configure their own registrar connection with OIDC credentials. This allows different tenants to connect to different registrar instances or use different credentials for the same registrar.

### Via the Web UI

1. Navigate to **Registrar** in the sidebar
2. Select a preset (e.g., "German Sandbox") or manually enter the registrar details:
    - **Registrar URL**: The base URL of the registrar API
    - **OIDC URL**: The OpenID Connect realm URL for authentication
    - **Client ID**: The OIDC client ID
    - **Client Secret**: Optional OIDC client secret
    - **Username**: Your registrar account username
    - **Password**: Your registrar account password
3. Click **Save Configuration**

:::info[Credential Validation]
When you save the configuration, EUDIPLO validates your credentials by attempting to authenticate with the registrar's OIDC endpoint. If authentication fails, you'll receive an error message and the configuration will not be saved.
:::

### Via Configuration File

You can also configure the registrar by placing a `registrar.json` file in the tenant's configuration folder:

```json title="config/{tenant-id}/registrar.json"
{
    "registrarUrl": "https://sandbox.eudi-wallet.org/api",
    "oidcUrl": "https://auth.sandbox.eudi-wallet.org/realms/sandbox-registrar",
    "clientId": "swagger",
    "username": "your-username",
    "password": "your-password",
    "registrationCertificateDefaults": {
        "privacy_policy": "https://verifier.example/privacy",
        "support_uri": "mailto:support@verifier.example"
    }
}
```

:::note[File Import Behavior]
When importing from a configuration file during startup, credentials are **not** validated (the registrar might not be reachable during initial setup). Make sure your credentials are correct before relying on the configuration.
:::

## Step 2: Create an Access Certificate

Once the registrar is configured, you can create access certificates via the Key Creation Wizard.

### Via the Key Creation Wizard

1. Navigate to **Keys** in the sidebar
2. Click **+ Create Key** to open the wizard
3. Select **Access Certificate** as the key usage
4. Select **Registrar Enrollment** as the access source
5. Enter a name for the key chain
6. Click **Create**

The wizard will:

- Create a new key chain
- Generate a signing key
- Request an access certificate from the registrar
- Store the certificate in the key chain

### Via the API

```bash
curl -X POST "https://your-eudiplo-instance/registrar/access-certificate" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"keyChainId": "your-key-chain-id"}'
```

The response includes:

- `id`: The registrar's certificate ID
- `keyChainId`: The local EUDIPLO key chain ID
- `crt`: The certificate content

## Next Steps

After obtaining access certificates, configure registration certificates for presentation requests. See [Registration Certificates](registration-certificates.md) for details.

## Related Topics

- [Registration Certificates](registration-certificates.md) — Authorization for credential requests
- [Key Chains](key-chains.md) — Managing certificates and keys
- [Certificates](certificates.md) — Certificate types and lifecycle
