# ISO 18013-7 Annex C — `org.iso.mdoc` DC API Support

## 1. Problem

EUDIPLO already supports the OID4VP flow over the browser Digital Credentials API
(`dc-api`, protocol `openid4vp-v1-unsigned`). However, the W3C DC API specification
is multi-protocol, and Safari on iOS and macOS exclusively implements `org-iso-mdoc`
as specified in ISO 18013-7 Annex C. Without this protocol, EUDIPLO-based verifiers
cannot serve users on Apple devices.

The two protocols differ fundamentally:

|  | OID4VP via DC API | ISO 18013-7 Annex C |
|---|---|---|
| DC API protocol | `openid4vp-v1-unsigned` | `org-iso-mdoc` |
| Request format | JSON (OID4VP request object) | CBOR (`DeviceRequest`) |
| Response encryption | JWE/JOSE (ECDH-ES) | HPKE (RFC 9180) |
| Session transcript | `OID4VPDCAPIHandover` | `BrowserHandover` |
| Encryption key | JWK in `client_metadata.jwks` | COSE_Key in `encryptionInfo` |

---

## 2. End-to-end flow

```
Portal                    EUDIPLO                         Wallet (browser)
  |                          |                                  |
  |  POST /verifier/offer    |                                  |
  |  { response_type:        |                                  |
  |    "iso-18013-7" }  ---> |                                  |
  |                          | 1. getPresentationConfig()       |
  |                          | 2. getEncryptionPublicKey()      |
  |                          | 3. randomBytes(16) → nonce       |
  |                          | 4. buildDeviceRequestCbor()      |
  |                          | 5. buildEncryptionInfo()         |
  |                          | 6. sessionService.create()       |
  |  <--- { session,         |                                  |
  |   org_iso_mdoc: {        |                                  |
  |     device_request,      |                                  |
  |     encryption_info } }  |                                  |
  |                          |                                  |
  |  navigator.credentials.get({ digital: {                    |
  |    requests: [{                                             |
  |      protocol: "org-iso-mdoc",                             |
  |      data: Uint8Array(DeviceRequest),                      |
  |      encryptionInfo: Uint8Array(EncryptionInfo)            |
  |    }]                                                       |
  |  }})  ------------------------------------------>         |
  |                          |                                  |
  |                          |                 7. Wallet verifies credential
  |                          |                 8. Wallet encrypts DeviceResponse
  |                          |                    with HPKE using the key
  |                          |                    from encryptionInfo
  |                          |                                  |
  |  <-- { protocol: "org-iso-mdoc", data: enc||ciphertext } --
  |                          |                                  |
  |  POST /presentations/    |                                  |
  |    :id/iso-18013-7  ---> |                                  |
  |  { data: base64url }     | 9.  getEncryptionPrivateJwk()   |
  |                          | 10. buildBrowserHandoverTranscript()
  |                          | 11. hpkeOpen()                  |
  |                          | 12. mdocverifier.verify()       |
  |                          | 13. sessionService.add(Completed)|
  |                          | 14. webhookService.sendWebhook() |
  |  <--- { ok: true }       |                                  |
```

---

## 3. CBOR structures

### 3.1 `DeviceRequest` (ISO 18013-5 §8.3.2.1)

Built by `@owf/mdoc`. The `docType` and `nameSpaces` are derived from the
presentation configuration. Example using an mDL credential:

```
DeviceRequest = {
  "version": "1.0",
  "docRequests": [{
    "itemsRequest": DataItem({
      "docType": "org.iso.18013.5.1",
      "nameSpaces": {
        "org.iso.18013.5.1": {
          "family_name": false,   ← intentToRetain = false
          "birth_date":  false
        }
      }
    })
  }]
}
```

The current implementation processes the first `mso_mdoc` credential from the DCQL
query in the presentation configuration. Support for multiple `DocRequest` entries
is listed as future work (see §12).

### 3.2 `encryptionInfo` (ISO 18013-7 Annex C §C.1.3)

Positional CBOR array (not a map — wallets reject map encoding):

```
[
  1,                          ← cipherSuiteId = HPKE-Base-P256-SHA256-AES128GCM
  <16 random bytes>,          ← nonce (used to reconstruct BrowserHandover)
  {                           ← COSE_Key (verifier P-256 public key)
     1: 2,    ← kty = EC
    -1: 1,    ← crv = P-256
    -2: <32B>, ← x
    -3: <32B>  ← y
  }
]
```

### 3.3 `BrowserHandover` (SessionTranscript — ISO 18013-7 §C.2.3)

```
SessionTranscript = [
  null,             ← DeviceEngagementBytes (not used in DC API)
  null,             ← EReaderKeyBytes (not used in DC API)
  #6.24(            ← CBOR tag 24 (DataItem)
    bstr .cbor [
      "BrowserHandover",
      <nonce bytes>,     ← same nonce as in encryptionInfo
      <origin string>,   ← "https://example.com"
      <COSE_Key map>     ← same key as in encryptionInfo
    ]
  )
]
```

This transcript is used in two places:
- As the `info` parameter for HPKE when **encrypting** (wallet) and **decrypting** (verifier)
- As `sessionTranscript` in `Verifier.verifyDeviceResponse()` for DeviceAuth verification

---

## 4. HPKE (RFC 9180) — rationale for a custom implementation

### Suite

`HPKE-Base-P256-SHA256-AES128GCM`:
- KEM: DHKEM(P-256, HKDF-SHA256)
- KDF: HKDF-SHA256
- AEAD: AES-128-GCM

### Why not use an HPKE library

`@noble/hashes` v2 and most HPKE packages are **ESM-only**. EUDIPLO is a NestJS
project running under CommonJS. Importing ESM from CommonJS requires asynchronous
`dynamic import()`, which is incompatible with `hpkeOpen`'s synchronous call sites.

The implementation uses only the Node.js built-in `node:crypto` module, which
provides ECDH P-256, HMAC-SHA256, and AES-128-GCM — all that HPKE requires at
this cipher suite. No new dependencies are added to the project.

### Encrypted response format

```
wallet_response = enc (65 bytes) || ciphertext+tag (N+16 bytes)
```
- `enc`: wallet's ephemeral P-256 public key, uncompressed (0x04 || x || y)
- `ciphertext+tag`: AES-128-GCM output (GCM tag in the last 16 bytes)

### HPKE call signature

```
hpkeOpen(encKey, ciphertext, recipientPrivJwk, info=SessionTranscript, aad=b"")
```

---

## 5. Bug fix included: incorrect OID4VP DC API transcript

While implementing ISO 18013-7, a bug was found in the **existing OID4VP via DC API
flow**.

### The problem

`presentations.service.ts` always passed `protocol: "openid4vp"` to
`mdocverifierService.verify()`, which always called `SessionTranscript.forOid4Vp()`.

`forOid4Vp()` builds the transcript with `OpenID4VPHandover`:
```
["OpenID4VPHandover", SHA256(CBOR(clientId + responseUri + nonce))]
```

But for DC API flows, the wallet builds the transcript with `OID4VPDCAPIHandover`:
```
["OID4VPDCAPIHandover", SHA256(CBOR([origin, nonce, jwkThumbprint?]))]
```

If the wallet signs DeviceAuthentication over `OID4VPDCAPIHandover` but the verifier
checks against `OpenID4VPHandover`, verification **fails silently or throws a
signature error**.

### The fix

`presentations.service.ts` now passes:
```typescript
session.useDcApi
  ? { protocol: "dc_api", nonce, origin: expected_origins[0], jwkThumbprint }
  : { protocol: "openid4vp", nonce, clientId, responseUri, responseMode, jwkThumbprint }
```

And `mdocverifierService.verify()` uses `SessionTranscript.forOid4VpDcApi()` when
`protocol === "dc_api"`.

---

## 6. New Session entity fields

```typescript
dcApiProtocol?: string  // "oid4vp" | "iso-18013-7"
browserOrigin?: string  // stored at offer time to reconstruct BrowserHandover on response
```

The existing `vp_nonce` field stores the 16-byte nonce as a hex string.

These fields allow the `BrowserHandover` transcript to be reconstructed at response
time without storing the full CBOR bytes in the session.

---

## 7. New ResponseType: `ISO_18013_7`

```typescript
enum ResponseType {
  URI         = "uri",
  DC_API      = "dc-api",
  ISO_18013_7 = "iso-18013-7",   // new
}
```

`POST /api/verifier/offer` returns a different shape when
`response_type === "iso-18013-7"`:

```json
{
  "session": "uuid",
  "uri": "",
  "crossDeviceUri": "",
  "org_iso_mdoc": {
    "device_request": "<base64url-encoded CBOR DeviceRequest>",
    "encryption_info": "<base64url-encoded CBOR EncryptionInfo>"
  }
}
```

---

## 8. Design decisions

### 8.1 Verification in `Iso18013Service`, not `PresentationsService`

`PresentationsService.parseResponse()` is designed for OID4VP where the `vp_token`
arrives as a JSON object. For ISO 18013-7 the input is raw CBOR bytes after HPKE
decryption.

`Iso18013Service` calls `MdocverifierService.verify()` directly, passing the
DeviceResponse bytes as base64url. This avoids bending `parseResponse()` to a
format outside its domain.

### 8.2 Transcript passed as pre-built bytes

`Verifier.verifyDeviceResponse()` accepts `SessionTranscript | Uint8Array`.
For ISO 18013-7, we pass a `Uint8Array` of the already-built transcript, avoiding
the need to create a `BrowserHandover` subclass that does not exist in
`@owf/mdoc` v0.6.

The bytes are equivalent to
`tag(24, cborEncode([null, null, DataItem(["BrowserHandover", ...])]))`,
which is the same encoding that `SessionTranscript.encode({ asDataItem: true })`
produces for the other handover types.

### 8.3 Encryption key: reuse of the existing ECDH-ES key

Each tenant already has a P-256 key used for JWE decryption in OID4VP. The same
P-256 key serves as the HPKE recipient key for ISO 18013-7. No separate key
generation or rotation is needed.

`getEncryptionPrivateJwk()` was added to `EncryptionService` to expose the full
JWK (including `d`) internally for HPKE. This method is never called from outside
the backend.

### 8.4 Per-session nonce

The 16-byte nonce is generated in `createOffer()` via `randomBytes(16)`, stored in
`session.vp_nonce` as a hex string, and consumed in two places:
1. `encryptionInfo` — the wallet reads it to build the BrowserHandover before encrypting
2. `buildBrowserHandoverTranscript()` — reconstructed on the server at response time

This nonce is **distinct** from the `walletNonce` used in the OID4VP flow. ISO 18013-7
has no `request_uri` or nonce/sessionId split, so the portal uses the session UUID
directly as the response endpoint identifier.

---

## 9. Frontend integration guide

Portals integrating this endpoint need to handle two differences from the existing
OID4VP DC API flow.

### 9.1 Offer routing

When `POST /api/verifier/offer` is called with `response_type: "iso-18013-7"`, the
offer body contains an `org_iso_mdoc` object instead of a `request_uri`:

```javascript
const offer = await fetch('/api/verifier/offer', {
  method: 'POST',
  body: JSON.stringify({ ..., response_type: 'iso-18013-7' }),
}).then(r => r.json());

// offer.org_iso_mdoc = { device_request: '<base64url>', encryption_info: '<base64url>' }
```

### 9.2 DC API request

The DC API expects raw bytes, not base64url strings. Both fields must be decoded
before passing them to `navigator.credentials.get()`:

```javascript
function fromBase64url(s) {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

const result = await navigator.credentials.get({
  digital: {
    requests: [{
      protocol: 'org-iso-mdoc',
      data: fromBase64url(offer.org_iso_mdoc.device_request),
      encryptionInfo: fromBase64url(offer.org_iso_mdoc.encryption_info),
    }]
  }
});
```

### 9.3 Response forwarding

The DC API returns a `Uint8Array` for `org-iso-mdoc` (versus a string for
`openid4vp-v1-unsigned`). Normalize to base64url before sending to EUDIPLO and
route to the correct endpoint based on the returned protocol:

```javascript
function toBase64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const protocol = result.protocol;   // "org-iso-mdoc" | "openid4vp-v1-unsigned"
const data = result.data instanceof Uint8Array ? toBase64url(result.data) : result.data;

if (protocol === 'org-iso-mdoc') {
  await fetch(`/presentations/${offer.session}/iso-18013-7`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
} else {
  // existing OID4VP DC API path
}
```

---

## 10. Testing

### Requirements

Any wallet that supports the `org-iso-mdoc` DC API protocol can be used for
end-to-end testing. Browser requirements:
- Chrome M130+ on Android (DC API enabled by default)
- Safari 18+ on iOS/macOS

### Manual E2E steps

1. Configure a presentation with a `response_type` of `iso-18013-7`.
2. Call `POST /api/verifier/offer` with that configuration.
3. Pass the returned `org_iso_mdoc` fields to `navigator.credentials.get()` as
   described in §9.
4. Forward the encrypted response to `POST /presentations/:session/iso-18013-7`.
5. Verify that the session transitions to `Completed` and the webhook fires.

### HPKE unit test (manual)

```typescript
import { hpkeOpen } from './hpke';
import { buildBrowserHandoverTranscript, buildEncryptionInfo } from './cbor-request';

// 1. Generate recipient key pair
const { privateKey, publicKey } = await generateKeyPair('ECDH-ES', { crv: 'P-256' });

// 2. Build nonce and transcript
const nonce = Buffer.alloc(16, 0x42); // fixed for deterministic test
const origin = 'https://example.com';
const jwk = await exportJWK(publicKey);
const { hpkeInfo } = buildBrowserHandoverTranscript(nonce, origin, jwk.x!, jwk.y!);

// 3. Encrypt with a reference HPKE library (e.g. @hpke/core)
// 4. Decrypt with hpkeOpen() and assert plaintext matches
```

---

## 11. New dependencies

**None.** The entire implementation uses only:
- `node:crypto` — ECDH P-256, HMAC-SHA256, AES-128-GCM
- `@owf/mdoc` — already a project dependency (DeviceRequest, DataItem, cborEncode)

---

## 12. Known limitations and future work

| # | Limitation | Impact | Future work |
|---|---|---|---|
| 1 | `encryptionInfo` format not yet validated against a real wallet | Wallet may reject unexpected CBOR key encoding | Test with a wallet that supports `org-iso-mdoc` (e.g. Paradym, OpenWallet) |
| 2 | Trust list not applied during verification (`requireX5c=false`) | Issuer certificate chain is not validated | Pass `VerifierOptions` the same way `presentations.service.ts` does |
| 3 | Only the first `mso_mdoc` credential from the DCQL query is processed | Configs with multiple credentials generate only one `DocRequest` | Extend to iterate all `mso_mdoc` credentials and build multiple `DocRequest` entries |
| 4 | `redirect_uri` not supported after ISO 18013-7 verification | Response is always an empty JSON `{}` | Add redirect logic mirroring `oid4vp.service.ts` |
| 5 | Session audit logging not implemented | No traceability in Loki/Tempo | Add `AuditLogContext` the same way `oid4vp.service.ts` does |
