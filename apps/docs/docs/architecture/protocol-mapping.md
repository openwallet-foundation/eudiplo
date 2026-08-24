---
title: Protocol Mapping
---

# Protocol Mapping

This page provides a reference table mapping EUDIPLO's internal concepts to their corresponding protocol elements in OID4VCI, OID4VP, and related standards. Use this as a quick lookup when translating between EUDIPLO configuration and protocol-level interactions.

---

## Core Entity Mapping

| EUDIPLO Concept | Protocol Concept | Protocol | Notes |
| ----------------- | ------------------ | ---------- | ------- |
| **Tenant** | (no direct equivalent) | — | Tenant isolation is an EUDIPLO abstraction for multi-tenancy; not visible in protocols |
| **Credential Configuration** | `credential_configurations_supported` | OID4VCI | Published in OID4VCI issuer metadata (`.well-known/openid-credential-issuer`) |
| **Credential Offer** | `CredentialOffer` object | OID4VCI | Contains `credential_issuer`, `credential_configuration_ids`, and `grants` |
| **Issuance Configuration** | Authorization server metadata | OID4VCI | Published in AS metadata (`.well-known/oauth-authorization-server`) |
| **Presentation Configuration** | Authorization Request (DCQL) | OID4VP | Contains `presentation_definition`, `nonce`, `response_uri`, and trust requirements |
| **Session** | `issuer_state` (issuance) / `nonce` (presentation) | OID4VCI / OID4VP | Used for session correlation; `walletNonce` for OID4VP |
| **Key Chain** | Signing/verification key material | All | JWK or X.509 certificate used for signing/verifying JWTs, CWTs, status lists, etc. |
| **Trust List** | `trusted_authorities` (ETSI TL / OpenID Federation) | OID4VP | Specifies which issuers are trusted when verifying credentials |
| **Status List** | OAuth Token Status List | OID4VCI / OID4VP | Revocation/suspension status encoded as JWT or CWT |
| **Attribute Provider** | (no direct equivalent) | — | EUDIPLO abstraction for external claim sources; not part of OID4VCI spec |
| **Webhook Endpoint** | (no direct equivalent) | — | EUDIPLO abstraction for notification delivery; not part of core protocols |

---

## Issuance Flow Mapping

| EUDIPLO Concept | Protocol Concept | Protocol Element | Notes |
| ----------------- | ------------------ | ------------------ | ------- |
| **Credential Offer Creation** | Credential offer generation | `POST /offers` (EUDIPLO API) | Returns `credential_offer_uri` or `credential_offer` JSON |
| **Authorization Request** | OAuth 2.0 authorization request | `GET /authorize` | Redirects wallet to AS for user authentication |
| **Authorization Code** | OAuth 2.0 authorization code | `code` parameter in callback | Exchanged for access token at `/token` |
| **Access Token** | OAuth 2.0 access token (JWT) | `access_token` | Contains `issuer_state`, `cnf.jkt` (DPoP), `client_id` |
| **DPoP Proof** | Demonstrating Proof-of-Possession | `DPoP` header | JWT signed by wallet's key proving possession |
| **Wallet Attestation** | OAuth Client Attestation | `OAuth-Client-Attestation` / `OAuth-Client-Attestation-PoP` headers | Proves wallet provider trustworthiness |
| **Credential Request** | Credential request | `POST /credential` | Wallet requests credential using access token and proof |
| **Credential Response** | Credential response | JSON response with `credential` field | Contains SD-JWT VC or mDOC credential |
| **Batch Issuance** | Batch credential request | `credential_requests` array | Multiple credentials in one request |
| **Deferred Credential** | Deferred credential issuance | `transaction_id` | Wallet polls `/deferred` for credential availability |
| **Notification** | Notification endpoint | `POST /notification` | Wallet notifies EUDIPLO of credential acceptance/rejection |

---

## Presentation Flow Mapping

| EUDIPLO Concept | Protocol Concept | Protocol Element | Notes |
| ----------------- | ------------------ | ------------------ | ------- |
| **Presentation Request Creation** | Authorization request generation | `POST /verifier/offer` (EUDIPLO API) | Returns `request_uri` for wallet to dereference |
| **Presentation Request** | OID4VP authorization request | `GET /request/{id}` | Contains DCQL query, trusted authorities, and security parameters |
| **DCQL Query** | Digital Credentials Query Language | `dcql_query` in `presentation_definition` | Specifies required credentials, formats, claims, and value constraints |
| **Trusted Authorities** | Trust anchors | `trusted_authorities` array | ETSI TL or OpenID Federation trust roots |
| **Wallet Response** | VP Token submission | `POST /direct_post.jwt` | Wallet posts encrypted VP Token |
| **VP Token** | Verifiable Presentation Token (JWT) | `vp` field in JWT | Contains presented credentials and wallet signature |
| **JWE Encryption** | JWE-encrypted response | `response` parameter (JWE) | VP Token encrypted to verifier's public key |
| **Response Code** | Same-device redirect code (§13.3) | `response_code` query parameter | One-time code to prevent session fixation |
| **Wallet Nonce** | Session identifier (§13.3) | `nonce` claim in authorization request | Wallet-facing identifier distinct from internal session ID |
| **Verification Result** | (no direct equivalent) | Webhook payload | EUDIPLO sends result to configured webhook endpoint |

---

## Credential Format Mapping

| EUDIPLO Concept | Protocol Concept | Format Identifier | Notes |
| ----------------- | ------------------ | ------------------- | ------- |
| **SD-JWT VC** | Selective Disclosure JWT Verifiable Credential | `dc+sd-jwt` | JWT with selective disclosure and key binding |
| **mDOC** | Mobile Document (ISO 18013-5) | `mso_mdoc` | CBOR-encoded document signed with CWT (COSE) |
| **VCT (SD-JWT VC)** | Verifiable Credential Type | `vct` claim in JWT | Type identifier (e.g., `urn:eu:diploma`) |
| **DocType (mDOC)** | Document Type | `doctype` claim in CBOR | Type identifier (e.g., `org.iso.18013.5.1.mDL`) |
| **Credential Fields** | Claim definitions | `claims` array in credential configuration | Path, type, display, selective disclosure policy |
| **Selective Disclosure** | SD-JWT disclosures | `_sd` claim and disclosure tilde-separated suffix | Hidden claims revealed via disclosures |
| **Key Binding** | Key binding JWT (SD-JWT VC) | Final segment after tildes | Proves wallet's possession of credential |

---

## Trust and Security Mapping

| EUDIPLO Concept | Protocol Concept | Protocol Element | Notes |
| ----------------- | ------------------ | ------------------ | ------- |
| **Trust List (ETSI TL)** | ETSI Trusted List | `type: "etsi_tl"` in `trusted_authorities` | JWT-encoded trust list of trusted issuers |
| **Trust List (OpenID Federation)** | OpenID Federation Entity Statement | `type: "openid_federation"` in `trusted_authorities` | Federation metadata and trust chains |
| **Trust List Key Chain** | Trust list signing key | JWK or X.509 in `verifierKey` / `verifierX509Der` | Used to verify trust list JWT signature |
| **Status List** | OAuth Token Status List | `status` claim in credential | References status list JWT and bit index |
| **Status List Index** | Bit index in status list | `status_list.idx` | Position in status list bit array |
| **Status List URI** | Status list JWT URL | `status_list.uri` | Where to fetch the status list JWT |
| **Revocation Status** | Status bit value | `0x01` | Credential is revoked (permanently) |
| **Suspension Status** | Status bit value | `0x02` | Credential is suspended (temporarily) |
| **Certificate Chain** | X.509 certificate chain | `x5c` header in JWT or COSE | Leaf certificate first, then intermediates/root |
| **DPoP Key Thumbprint** | DPoP confirmation claim | `cnf.jkt` in access token | SHA-256 thumbprint of DPoP public key |

---

## Authorization Server Mapping

| EUDIPLO Concept | Protocol Concept | Protocol Element | Notes |
| ----------------- | ------------------ | ------------------ | ------- |
| **Built-in AS** | Embedded OAuth AS | EUDIPLO-hosted AS endpoints | Minimal AS for development/testing |
| **External AS** | External OAuth AS | Custom AS with `issuer_state` support | Requires AS modifications |
| **Chained AS** | OAuth AS facade | EUDIPLO-hosted AS that delegates to upstream OIDC | No upstream AS modifications required |
| **OID4VP-Based AS** | Credential-to-credential authorization | OID4VP presentation as authentication | Prove existing credentials before issuance |
| **PAR Endpoint** | Pushed Authorization Request | `POST /par` | Wallet pushes authorization parameters before redirect |
| **Token Endpoint** | OAuth token endpoint | `POST /token` | Exchanges authorization code for access token |
| **Authorization Endpoint** | OAuth authorization endpoint | `GET /authorize` | User authentication and consent |

---

## Metadata Discovery Mapping

| EUDIPLO Concept | Protocol Concept | Discovery Endpoint | Notes |
| ----------------- | ------------------ | --------------------- | ------- |
| **Issuer Metadata** | OID4VCI issuer metadata | `.well-known/openid-credential-issuer` | Published credential configurations and endpoints |
| **AS Metadata (OID4VCI)** | OAuth AS metadata | `.well-known/oauth-authorization-server` | Published AS endpoints and capabilities |
| **AS Metadata (Chained)** | OAuth AS metadata | `/{tenant}/chained-as/.well-known/oauth-authorization-server` | Chained AS metadata |
| **Verifier Metadata** | OID4VP client metadata | Embedded in authorization request | Verifier capabilities (supported formats, algorithms) |
| **JWKS (Issuer)** | JSON Web Key Set | `.well-known/jwks.json` | Public keys for verifying issued credentials |
| **JWKS (AS)** | JSON Web Key Set | `/{tenant}/issuer/.well-known/jwks.json` | Public keys for verifying access tokens |

---

## Session and State Mapping

| EUDIPLO Concept | Protocol Concept | Protocol Element | Notes |
| ----------------- | ------------------ | ------------------ | ------- |
| **Session ID** | (internal identifier) | UUID | Never exposed in protocol; internal correlation only |
| **Issuer State** | Session correlation (issuance) | `issuer_state` in credential offer and access token | Correlates credential offer with session |
| **Wallet Nonce (OID4VP)** | Session correlation (presentation) | `nonce` in authorization request | Wallet-facing session identifier (§13.3) |
| **Response Code (OID4VP)** | Same-device redirect code | `response_code` in redirect URI | One-time code for same-device flows (§13.3) |
| **Session Status** | (internal state) | `active`, `fetched`, `completed`, `expired`, `failed` | Tracks session lifecycle |
| **Session Consumed** | Replay prevention flag | `consumed: true` | Prevents double-spending of sessions |
| **Session TTL** | Expiration policy | `expiresAt` timestamp | Sessions expire based on tenant config |

---

## API Mapping

| EUDIPLO Concept | Protocol Concept | EUDIPLO Endpoint | Notes |
| ----------------- | ------------------ | ------------------ | ------- |
| **Create Credential Offer** | Generate credential offer | `POST /api/issuer/offer` | Returns `credential_offer_uri` |
| **Create Presentation Request** | Generate authorization request | `POST /api/verifier/offer` | Returns `request_uri` |
| **Fetch Credential Offer** | Dereference credential offer | `GET /{tenant}/issuer/offers/{id}` | Returns `CredentialOffer` JSON |
| **Fetch Presentation Request** | Dereference authorization request | `GET /{tenant}/verifier/request/{id}` | Returns authorization request JSON |
| **Token Endpoint** | OAuth token exchange | `POST /{tenant}/issuer/token` | Exchanges code for access token |
| **Credential Endpoint** | Credential issuance | `POST /{tenant}/issuer/credential` | Issues credential |
| **Deferred Endpoint** | Deferred credential retrieval | `POST /{tenant}/issuer/deferred` | Retrieves deferred credential |
| **Notification Endpoint** | Wallet notification | `POST /{tenant}/issuer/notification` | Receives credential acceptance/rejection |
| **Direct Post Endpoint** | VP Token submission | `POST /{tenant}/verifier/direct_post.jwt` | Receives encrypted VP Token |

---

## Next Steps

- **Core Concepts**: [Entities and Relationships](./core-concepts.md)
- **Issuance Flow**: [Issuance Architecture](./issuance.md)
- **Presentation Flow**: [Presentation Architecture](./presentation.md)
- **Supported Protocols**: [Protocol Coverage](../reference/protocols.md)
- **Configuration Model**: [Configuration Import and Portability](./configuration-model.md)
