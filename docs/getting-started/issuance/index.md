# Configuring Credential Issuance Flows

Issuance configuration is split into **three layers**:

1. **Credential Configurations** - Define the structure, format, and metadata of
   individual credentials
2. **Schema Metadata (TS11)** - Define schema-level metadata in a dedicated,
   reusable registrar-managed resource
3. **Issuance Configuration** - Define the issuance configuration that gets used to
   group multiple credentials and publish issuer metadata

---

## API Endpoints

Each layer has its own API endpoints:

### Credential Configurations

To manage individual credential configurations, use the
`/issuer/credentials` endpoint. This endpoint handles the definition
of credential types, their formats, claims, and display properties.

### Schema Metadata

Schema metadata is managed in a dedicated flow. See [Schema Metadata](schema-metadata.md) for setup and version management.

### Issuance Configuration

The endpoints to manage issuance configuration can be found in the [API documentation](../../api/openapi.md) section.

Based on your passed access token, endpoints will be scoped to the tenant ID of the
token. You also need the `issuance:manage` role to access these endpoints.
The configurations are internally stored in a database.

### Credential Offers

Creating a credential offer is the operational step that starts issuance. The
full request model, examples, replay behavior, and `credentialClaims` override
format are documented in [Credential Offers](credential-offers.md).

---

## Credential Issuance Flow

This flow shows how a backend service starts issuance. EUDIPLO creates the
OID4VCI request, runs the protocol with the wallet, and optionally calls
[webhooks](../../architecture/webhooks.md).

```mermaid
sequenceDiagram
    autonumber
    actor Wallet as EUDI Wallet
    participant EUDIPLO as Middleware
    participant Service as End Service (with Webhooks)

    Service->>EUDIPLO: Request OID4VCI issuance offer
    EUDIPLO-->>Service: Return credential offer link
    Service->>Wallet: Present offer link to user

    Wallet->>EUDIPLO: Authorization Request (auth / pre-auth)
    note over EUDIPLO: Validate request, locate credential config

    alt Claims webhook configured
        EUDIPLO->>Service: Fetch claims dynamically (claims webhook)
        alt Immediate issuance
            Service-->>EUDIPLO: Claims response (JSON)
            EUDIPLO->>EUDIPLO: Create credential with claims
            EUDIPLO-->>Wallet: Return issued credential
        else Deferred issuance
            Service-->>EUDIPLO: { "deferred": true, "interval": 5 }
            EUDIPLO-->>Wallet: HTTP 202 + transaction_id
            loop Wallet polls deferred endpoint
                Wallet->>EUDIPLO: GET /deferred_credential
                alt Not ready
                    EUDIPLO-->>Wallet: { "error": "issuance_pending" }
                else Ready
                    EUDIPLO-->>Wallet: Return issued credential
                end
            end
        end
    else No webhook
        note over EUDIPLO: Use claims from Offer or static configuration
        EUDIPLO->>EUDIPLO: Create credential with claims
        EUDIPLO-->>Wallet: Return issued credential
    end

    Wallet->>EUDIPLO: Sending notification

    opt Notification webhook configured
        EUDIPLO->>Service: Notify status (accepted / denied)
        Service-->>EUDIPLO: 2xx ACK
    end
```

The offer response also contains the session ID. EUDIPLO includes this ID in
optional webhook calls, and you can use it to query issuance status via the API.

---

## Supported Issuance Flows

EUDIPLO supports three authentication patterns for OID4VCI credential issuance. Each pattern serves different use cases depending on how users are identified and authenticated.

### Quick Reference

| Authentication Pattern               | User is Known | User Authentication                              | Initiator        | Claims Source                 |
| ------------------------------------ | ------------- | ------------------------------------------------ | ---------------- | ----------------------------- |
| **Pre-authorized code**              | Yes           | Already authenticated (before offer)             | Issuer only      | Offer or Attribute Provider   |
| **Authorization code + External AS** | No            | OIDC login at external IdP                       | Issuer or Wallet | Attribute Provider (required) |
| **Interactive Authorization (IAE)**  | No            | Credential presentation (OID4VP) or web redirect | Issuer or Wallet | Attribute Provider (required) |

### Understanding the Three Dimensions

#### 1. Authentication Pattern (How is the user identified?)

- **Pre-authorized code**: User was already authenticated _before_ the OID4VCI flow starts. You know who they are and can include their claims in the offer.
- **Authorization code + External AS**: User authenticates during the flow at an external Identity Provider (Keycloak, Azure AD, Okta) via OIDC.
- **Interactive Authorization (IAE)**: User proves their identity by presenting an existing credential (OID4VP) or completing a web-based flow.

#### 2. Initiator (Who starts the flow?)

- **Issuer-initiated**: The issuer creates an offer URI and presents it to the user (QR code, email link, push notification). Used when you want to proactively issue credentials.
- **Wallet-initiated**: The wallet discovers available credentials via issuer metadata and initiates the request. Used for self-service scenarios where users browse available credentials.

!!! info "Pre-authorized code is issuer-initiated only"
Since the user must be known before creating the offer, pre-authorized code flows are always issuer-initiated. The other patterns support both.

#### 3. Claims Source (Where do credential claims come from?)

- **In the offer**: Claims are embedded in the credential offer when it's created. Only possible when the user is known upfront (pre-authorized code flow).
- **Via webhook**: EUDIPLO calls your backend to fetch claims based on user identity information. Required when user identity is established during the flow.

---

### Flow Details

#### Pre-authorized Code Flow

**Use when:** You already know who the user is before starting the issuance flow.

```mermaid
sequenceDiagram
    participant Portal as Your Portal
    participant EUDIPLO
    participant Wallet

    Portal->>Portal: User authenticates
    Portal->>EUDIPLO: Create offer with claims
    EUDIPLO-->>Portal: Offer URI + QR code
    Portal->>Wallet: Display QR / Send link
    Wallet->>EUDIPLO: Redeem offer
    EUDIPLO->>Wallet: Credential
```

**Examples:**

- Employee onboarding portal creates badge credential after HR verification
- University issues diploma after graduation is confirmed
- Government portal issues ID after identity verification process

**Configuration:**

```json
{
    "claims": {
        "given_name": "Alice",
        "family_name": "Smith",
        "employee_id": "EMP-12345"
    }
}
```

Or use an Attribute Provider if you don't want to embed claims in the offer:

```json
{
    "attributeProviderId": "employee-claims-api"
}
```

---

#### Authorization Code Flow with External AS

**Use when:** You have an existing Identity Provider and want users to authenticate via OIDC.

```mermaid
sequenceDiagram
    participant Wallet
    participant EUDIPLO
    participant Keycloak as External AS (Keycloak)
    participant Backend as Your Backend

    alt Issuer-initiated
        EUDIPLO->>Wallet: Credential offer
    else Wallet-initiated
        Wallet->>EUDIPLO: Discover metadata
    end
    Wallet->>Keycloak: Authorization request
    Keycloak->>Keycloak: User login (OIDC)
    Keycloak-->>Wallet: Authorization code
    Wallet->>Keycloak: Token request
    Keycloak-->>Wallet: Access token
    Wallet->>EUDIPLO: Credential request + token
    EUDIPLO->>EUDIPLO: Verify token against AS
    EUDIPLO->>Backend: Webhook (iss, sub, token_claims)
    Backend-->>EUDIPLO: Claims for credential
    EUDIPLO-->>Wallet: Credential
```

**Examples:**

- Enterprise deployment where employees authenticate via corporate Keycloak
- Multi-tenant SaaS where each tenant uses their own IdP
- Wallet-initiated flows where users browse available credentials

**Configuration:**

- Configure external authorization servers in issuance config:

```json
{
    "authServers": ["https://keycloak.example.com/realms/myrealm"],
    "dPopRequired": true
}
```

- Configure an Attribute Provider on the credential configuration:

```json
{
    "attributeProviderId": "employee-claims-api"
}
```

Your Attribute Provider receives:

```json
{
    "session": "a6318799-dff4-4b60-9d1d-58703611bd23",
    "credential_configuration_id": "EmployeeBadge",
    "identity": {
        "iss": "https://keycloak.example.com/realms/myrealm",
        "sub": "user-uuid-from-keycloak",
        "token_claims": {
            "email": "user@example.com",
            "preferred_username": "jdoe"
        }
    }
}
```

See [Attribute Providers](attribute-provider.md) for setup details, request/response formats, and full payload documentation.

---

#### Interactive Authorization Endpoint (IAE)

**Use when:** You want users to prove their identity by presenting an existing credential or completing a web-based verification.

The IAE supports two interaction types:

| Interaction Type         | Description                                       | Use Case                                          |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------- |
| `openid4vp_presentation` | User presents an existing credential via OID4VP   | Issue derived credentials based on existing ones  |
| `redirect_to_web`        | User is redirected to a web page for verification | Custom verification flows, OIDC login, form entry |

##### OID4VP Presentation Flow

```mermaid
sequenceDiagram
    participant Wallet
    participant EUDIPLO
    participant Backend as Your Backend

    Wallet->>EUDIPLO: Interactive authorization request
    EUDIPLO-->>Wallet: Presentation request (OID4VP)
    Wallet->>Wallet: User selects credential
    Wallet->>EUDIPLO: Presentation response
    EUDIPLO->>EUDIPLO: Verify presentation
    EUDIPLO->>Backend: Webhook with presentation data
    Backend-->>EUDIPLO: Claims for new credential
    EUDIPLO-->>Wallet: Authorization code
    Wallet->>EUDIPLO: Token request
    EUDIPLO-->>Wallet: Access token
    Wallet->>EUDIPLO: Credential request
    EUDIPLO-->>Wallet: New credential
```

**Examples:**

- Issue a loyalty card credential based on a presented membership credential
- Issue a student discount credential based on a university ID credential
- Age verification: issue age attestation based on presented ID

**Configuration:**

Configure IAE action on the credential configuration:

```json
{
    "iaeAction": {
        "type": "openid4vp_presentation",
        "presentationDefinition": {
            "id": "verify-membership",
            "input_descriptors": [
                {
                    "id": "membership-credential",
                    "constraints": {
                        "fields": [
                            {
                                "path": ["$.vct"],
                                "filter": {
                                    "type": "string",
                                    "const": "MembershipCredential"
                                }
                            }
                        ]
                    }
                }
            ]
        }
    },
    "attributeProviderId": "iae-claims-provider"
}
```

##### Redirect to Web Flow

```mermaid
sequenceDiagram
    participant Wallet
    participant EUDIPLO
    participant WebApp as Your Web App

    Wallet->>EUDIPLO: Interactive authorization request
    EUDIPLO-->>Wallet: Redirect URL
    Wallet->>WebApp: Open browser
    WebApp->>WebApp: User completes verification
    WebApp->>EUDIPLO: Callback with result
    EUDIPLO-->>Wallet: Authorization code
    Wallet->>EUDIPLO: Token + Credential requests
    EUDIPLO-->>Wallet: Credential
```

**Examples:**

- Custom OIDC login flow with additional verification steps
- Payment verification before issuing premium credentials
- Terms acceptance or consent collection

**Configuration:**

```json
{
    "iaeAction": {
        "type": "redirect_to_web",
        "redirectUrl": "https://your-app.example.com/verify",
        "callbackUrl": "https://issuer.example.com/{tenantId}/authorize/interactive/callback"
    }
}
```

---

### Decision Flowchart

```mermaid
flowchart TD
    A[Starting credential issuance] --> B{Do you know the user<br/>before the flow starts?}

    B -->|Yes| C[Pre-authorized code flow]
    B -->|No| D{How should the user<br/>prove their identity?}

    D -->|Login at existing IdP| E[Authorization code + External AS]
    D -->|Present existing credential| F[IAE: openid4vp_presentation]
    D -->|Custom web verification| G[IAE: redirect_to_web]

    C --> H{Where are claims?}
    H -->|Known at offer creation| I[Include claims in offer]
    H -->|Need to fetch later| J[Use Attribute Provider]

    E --> K[Attribute Provider required]
    F --> L[Attribute Provider required]
    G --> M[Attribute Provider required]

    style C fill:#90EE90
    style E fill:#87CEEB
    style F fill:#DDA0DD
    style G fill:#DDA0DD
```

---

## Deferred Credential Issuance

EUDIPLO supports **deferred credential issuance** for scenarios where credentials cannot be issued immediately. This is useful when:

- **Background verification** is required (e.g., KYC, identity proofing)
- **Approval workflows** must be completed before issuance
- **External data sources** need time to respond
- **Asynchronous processing** is required

When your Attribute Provider returns `{ "deferred": true }`, EUDIPLO returns a `transaction_id` to the wallet. The wallet then polls the `/deferred_credential` endpoint until the credential is ready.

For detailed information on implementing deferred issuance, see the [Deferred Issuance](../../architecture/attribute-providers.md#deferred-issuance) section in the Attribute Providers documentation.

---

## Documentation Structure

This issuance documentation is organized into the following sections:

- **[Credential Offers](credential-offers.md)** - Create offers, pass inline or dynamic claims, and understand replay prevention behavior
- **[Credential Configuration](credential-configuration.md)** - Learn how to
  define individual credential types, their structure, claims, and display
  properties
- **[Schema Metadata](schema-metadata.md)** - Manage TS11 schema metadata as a
  dedicated, reusable registrar-backed resource
- **[Issuance Configuration](issuance-configuration.md)** - Understand how to
  create issuance configurations that group multiple credentials and define
  issuance parameters such as authorization, token behavior, and trust settings
- **[Attribute Providers](attribute-provider.md)** - Configure reusable webhook
  endpoints for fetching claims dynamically during credential issuance

---

## Quick Start

For a quick start, follow these steps:

1. **Create Attribute Providers** (optional) - If you need dynamic claims, create
   Attribute Providers using the [Attribute Providers](attribute-provider.md) guide
2. **Create a credential configuration** - Define your credential type using the
   [Credential Configuration](credential-configuration.md) guide
3. **Create schema metadata** (recommended) - Manage TS11 schema metadata using the
   [Schema Metadata](schema-metadata.md) guide
4. **Create an issuance configuration** - Define the issuance configuration using
   the [Issuance Configuration](issuance-configuration.md) guide
5. **Create a credential offer** - Start the issuance flow using the
   [Credential Offers](credential-offers.md) guide

---
