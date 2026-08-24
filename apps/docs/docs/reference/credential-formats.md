---
title: Credential Formats
---

# Credential Formats

EUDIPLO supports the credential formats specified in the European Digital Identity Wallet (EUDI Wallet) ecosystem. This page documents the supported formats and their specific features.

## Supported Formats

EUDIPLO supports two primary credential formats:

| Format                 | Description                                                                     | Specification                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **SD-JWT VC**          | Selective Disclosure JWT Verifiable Credential                                  | [IETF OAuth SD-JWT](https://www.ietf.org/archive/id/draft-ietf-oauth-selective-disclosure-jwt-08.html)                               |
| **mDOC / mDL**         | ISO mobile driving license and mobile documents                                 | [ISO 18013-5](https://www.iso.org/standard/69084.html)                                                                               |

Both formats support selective disclosure, allowing users to reveal only the specific claims requested by a verifier rather than the entire credential.

## SD-JWT VC (Selective Disclosure JWT Verifiable Credential)

### Overview

SD-JWT VC combines JSON Web Tokens (JWT) with selective disclosure capabilities, enabling fine-grained control over which claims are revealed during presentation.

### Key Features

- **Selective Disclosure**: Users can reveal only specific claims from the credential
- **JSON-based**: Familiar JSON structure for claims and metadata
- **JWT Security**: Standard JWT signing and verification mechanisms
- **Compact**: Efficient encoding for mobile and web use cases

### Trust Signaling

SD-JWT credentials support two trust signaling modes:

| Mode          | Description                                                     | Use Case                                    |
| ------------- | --------------------------------------------------------------- | ------------------------------------------- |
| `x5c`         | Embeds X.509 certificate chain in JWT header                   | Traditional PKI-based trust (default)       |
| `federation`  | Uses OpenID Federation for trust resolution via issuer (`iss`) | Federation-based trust evaluation           |

Configure the trust format per credential in the issuance configuration:

```json
{
  "credentialConfigId": "pid",
  "sdJwtTrustFormat": "federation"
}
```

See [OpenID Federation](../architecture/extension-points/federation.md) for federation configuration details.

### Verification

EUDIPLO verifies SD-JWT VCs by:

1. Validating the JWT signature against trusted issuer keys
2. Checking certificate chains (when using `x5c` mode)
3. Evaluating federation trust (when using `federation` mode and `openid_federation` is specified in DCQL `trusted_authorities`)
4. Verifying selective disclosure proofs for requested claims
5. Checking revocation status via OAuth Status Lists

## mDOC / mDL (Mobile Documents / Mobile Driving License)

### Overview

mDOC is the ISO 18013-5 standard for mobile documents, originally designed for mobile driving licenses (mDL) but extensible to other document types.

### Key Features

- **Selective Disclosure**: Attribute-level selective disclosure using CBOR
- **Offline Verification**: Supports offline presentation with device binding
- **ISO Standard**: Internationally recognized standard for mobile documents
- **CBOR Encoding**: Compact binary encoding optimized for mobile devices

### Trust Mechanisms

mDOC credentials use X.509 certificate chains embedded in the credential for trust validation. EUDIPLO verifies:

1. Certificate chain validity and trust anchor
2. Document signer certificate (DS certificate)
3. Mobile Security Object (MSO) signature
4. Issuer-signed attributes and selective disclosure

### Verification

EUDIPLO verifies mDOC credentials by:

1. Validating the certificate chain against configured trust anchors
2. Verifying the MSO signature
3. Checking selective disclosure proofs for requested attributes
4. Validating device authentication (for device-bound credentials)
5. Checking revocation status via OAuth Status Lists (CWT format)

See [mDOC verification details](../presentation/presentation-configuration.md) for detailed verification flows.

## Status Management

Both credential formats support revocation and suspension through the **OAuth Token Status List** mechanism:

- **Status List Format**: JWT (for SD-JWT VC) or CWT (for mDOC)
- **Status Types**: Revocation and suspension
- **Efficient Encoding**: Bit-packed status lists for scalability
- **Privacy-Preserving**: No correlation between status checks

See [Status Management](../issuance/status-management.md) for configuration details.

## Format Selection

Choose the credential format based on your use case:

### Use SD-JWT VC when

- You need JSON-based claim structures
- Your system already uses JWT/JWS infrastructure
- You want federation-based trust evaluation
- Web-based verification is primary

### Use mDOC when

- You're implementing mobile driving licenses or similar documents
- Offline verification is required
- Compact binary encoding is preferred
- ISO standardization is important

---

## References

- [Supported Protocols](./protocols.md) — Full protocol support matrix
- [Issuance Configuration](../issuance/issuance-configuration.md) — Configure credential issuance
- [Presentation Configuration](../presentation/presentation-configuration.md) — Configure credential verification
