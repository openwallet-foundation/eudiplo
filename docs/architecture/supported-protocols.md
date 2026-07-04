# Supported Protocols

EUDIPLO is **deliberately limited** to protocols that are part of the European
Digital Identity Wallet (EUDI Wallet) ecosystem. This focused scope reduces
implementation complexity, improves long-term maintainability, and ensures a
consistent trust model across services.

Rather than being a general-purpose verifiable credentials broker, EUDIPLO
aligns strictly with the specifications endorsed by the EU regulatory and
technical framework.

## Protocols Supported

| Protocol                                                                                                                         | Description                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [OpenID for Verifiable Credential Issuance (OID4VCI)](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html) | Enables issuers to deliver verifiable credentials to EUDI Wallets using OAuth-based flows. |
| [OpenID for Verifiable Presentations (OID4VP)](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)              | Allows services to request and verify credentials presented by EUDI Wallet holders.        |
| [Selective Disclosure JWT VC (SD-JWT VC)](https://www.ietf.org/archive/id/draft-ietf-oauth-selective-disclosure-jwt-08.html)     | Data model for credentials allowing selective disclosure of individual claims by the user. |
| [Mobile Driving License (mDOC/mDL)](https://www.iso.org/standard/69084.html)                                                     | ISO 18013-5 standard for mobile driving licenses and other mobile documents.               |
| [OAuth Token Status List](https://drafts.oauth.net/draft-ietf-oauth-status-list/draft-ietf-oauth-status-list.html)               | Mechanism for determining revocation or suspension status of issued credentials.           |

### OID4VCI Features

EUDIPLO implements the following OID4VCI features:

| Feature                                  | Status | Description                                                      |
| ---------------------------------------- | ------ | ---------------------------------------------------------------- |
| Pre-Authorized Code Flow                 | ✅     | Issue credentials without user authentication at the issuer      |
| Authorization Code Flow                  | ✅     | Issue credentials with user authentication                       |
| Batch Credential Issuance                | ✅     | Issue multiple credentials in a single request                   |
| **Deferred Credential Endpoint**         | ✅     | Support for credentials that cannot be issued immediately        |
| Notification Endpoint                    | ✅     | Receive wallet acknowledgment of credential acceptance/rejection |
| DPoP (Demonstrating Proof-of-Possession) | ✅     | Enhanced security with proof-of-possession tokens                |
| Wallet Attestation                       | ✅     | Verify wallet provider trustworthiness                           |

### OID4VP Features

EUDIPLO implements the following OID4VP features:

| Feature                                          | Status | Description                                                                               |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------- |
| `direct_post.jwt` Response Mode                  | ✅     | Wallet posts the VP Token directly to the verifier, encrypted as a JWE                    |
| DCQL (Digital Credentials Query Language)        | ✅     | Structured credential queries with selective disclosure                                   |
| Session Identifier Separation (§13.3)            | ✅     | Wallet-facing identifier (`walletNonce`) is distinct from the internal session ID         |
| Response Code for Same-Device Redirect (§13.3)   | ✅     | One-time `response_code` appended to `redirect_uri` prevents session fixation on redirect |
| JWE-Encrypted Authorization Responses            | ✅     | VP Tokens are encrypted to the verifier's key                                             |
| `x509_san_dns` / `x509_san_uri` Client ID Scheme | ✅     | Verifier identification via X.509 certificates                                            |
| Wallet Attestation Verification                  | ✅     | Validate wallet provider trustworthiness before accepting presentations                   |
| Digital Credentials API (DC API)                 | ✅     | Browser-native credential exchange without QR codes or redirects                          |

These standards are evolving in coordination with EU-level pilot projects and
working groups. EUDIPLO tracks these developments closely to provide early,
stable support as specifications mature.

## Why Not More?

By **limiting scope to official EUDI Wallet protocols**, EUDIPLO avoids:

- Incompatibilities with reference implementations
- Bloated code from supporting rarely used formats
- Uncertain trust assumptions from broader ecosystems

This makes EUDIPLO especially suitable for:

- Public sector services integrating with national wallet pilots
- Companies targeting pan-European credential workflows
- Developers seeking a reliable, minimal abstraction layer over complex specs

---

## OIDF Conformance

EUDIPLO has been tested against the **OpenID Foundation (OIDF) Conformance Suite** to ensure strict compliance with protocol specifications:

- ✅ **OID4VCI (OpenID for Verifiable Credential Issuance)** - Conformance tested
- ✅ **OID4VP (OpenID for Verifiable Presentations)** - Conformance tested

These conformance tests validate that EUDIPLO correctly implements the protocol flows, security requirements, and interoperability features specified by the OpenID Foundation.

### Running Conformance Tests

To run the OIDF conformance tests yourself:

1. Deploy EUDIPLO to a publicly accessible instance (required for the hosted OIDF test suite)
2. Run the conformance test suite:

```bash
cd apps/backend
pnpm run test:oidf
```

These tests execute against your running instance and communicate with the hosted OIDF conformance suite to validate protocol compliance.

For more details on testing, see the [Testing Guide](../development/testing.md#oidf-conformance-tests).
