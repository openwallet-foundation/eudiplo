# Bug Report: EU AV Reference IACA/DS Certificates Carry a Malformed `issuerAltName` — Breaks @peculiar/x509 Verifiers

**Affected certificates:** "Age Verification Issuer CA 01" / "Age Verification DS - 001" (Age Verification Reference Implementation, `eu-digital-identity-wallet/av-srv-web-issuing-avw-py`)
**Affected verifiers:** any stack using `@peculiar/x509` (EUDIPLO's mdoc verification, X509ChainBuilder, `cert.getExtension()`)
**Severity:** High for AV-pilot interop — credentials issued under this IACA cannot be verified without a workaround

---

## The defect

The `issuerAltName` (OID 2.5.29.18) extension value does not contain
`GeneralNames` directly, as required by RFC 5280 §4.2.1.7. Instead it wraps a
**full nested `Extension` structure** around them:

```
X509v3 Issuer Alternative Name:
  OCTET STRING:
    30 30                     SEQUENCE                     ← spurious Extension wrapper
      06 03 55 1D 12          OID 2.5.29.18 (issuerAltName, again)
      04 29                   OCTET STRING
        30 27                 SEQUENCE (GeneralNames)      ← this is where the value should start
          82 25 68747470...   [2] dNSName = "https://commission.europa.eu/index_en"
```

(`openssl x509 -text` also fails to pretty-print it, showing raw bytes.)

Secondary defect: the URL is encoded under the `dNSName` choice (`[2]`) instead
of `uniformResourceIdentifier` (`[6]`).

## Impact

`@peculiar/x509`'s typed `IssuerAlternativeNameExtension` throws
`Data does not match to GeneralName ASN1 schema. Wrong values for Choice type`
while parsing the extension. Because `X509Certificate.extensions` parses every
extension, this breaks:

- `X509ChainBuilder.build()` — certificate chain construction fails
- `cert.getExtension(...)` — any typed extension lookup fails

In EUDIPLO this surfaced as a 400 during ISO 18013-7 DC API verification of a
wallet-presented AV credential:

```
MdlError: Data does not match to GeneralName ASN1 schema. Wrong values for Choice type
    at IssuerAuth.verify (@owf/mdoc) → ctx.x509.verifyCertificateChain (mdoc-context)
```

## Workaround applied in EUDIPLO

`registerTolerantX509Extensions()` (called at bootstrap) re-registers the
`2.5.29.18` parser in @peculiar's `ExtensionFactory` with a tolerant subclass
that unwraps the nested-Extension variant on a best-effort basis and falls back
to the raw extension bytes instead of throwing. See
`apps/backend/src/shared/utils/x509-tolerant-extensions.ts` and its spec, which
uses the official published IACA certificate as fixture.

## Reproduction

```bash
curl -O https://raw.githubusercontent.com/eu-digital-identity-wallet/av-srv-web-issuing-avw-py/main/api_docs/test_tokens/IACA-token/AgeVerificationIssuer.IACA.01.EU.pem
node -e "
  require('reflect-metadata');
  const x509 = require('@peculiar/x509');
  const cert = new x509.X509Certificate(require('fs').readFileSync('AgeVerificationIssuer.IACA.01.EU.pem','utf8'));
  cert.extensions; // throws: Data does not match to GeneralName ASN1 schema
"
```

## Recommended upstream actions

1. **eu-digital-identity-wallet/av-srv-web-issuing-avw-py**: fix the certificate
   generation so `issuerAltName` contains `GeneralNames` directly (and use the
   `uniformResourceIdentifier` choice for URLs); re-issue the reference IACA/DS.
2. **openwallet-foundation/eudiplo**: keep the tolerant parser — real-world PKI
   contains such certificates and a verifier should degrade gracefully instead
   of failing the whole presentation.
