# ISO 18013-7 Annex C — org.iso.mdoc DC API Support

## 1. Qué problema resuelve

EUDIPLO ya soportaba el flujo OID4VP mediante la Digital Credentials API del navegador
(`dc-api`, protocolo `openid4vp-v1-unsigned`). Lo que faltaba era el segundo protocolo
que define el piloto AV de la EUDI: **`org-iso-mdoc`**, especificado en ISO 18013-7 Annex C.

La diferencia entre los dos protocolos es fundamental:

| | OID4VP via DC API | ISO 18013-7 Annex C |
|---|---|---|
| Protocolo DC API | `openid4vp-v1-unsigned` | `org-iso-mdoc` |
| Formato de petición | JSON (OID4VP request object) | CBOR (`DeviceRequest`) |
| Cifrado de respuesta | JWE/JOSE (ECDH-ES) | HPKE (RFC 9180) |
| Transcript de sesión | `OID4VPDCAPIHandover` | `BrowserHandover` |
| Clave de cifrado | JWK en `client_metadata.jwks` | COSE_Key en `encryptionInfo` |

---

## 2. Flujo end-to-end

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
  |                          |                 7. Wallet verifica credencial
  |                          |                 8. Wallet cifra DeviceResponse
  |                          |                    con HPKE usando la clave
  |                          |                    del encryptionInfo
  |                          |                                  |
  |  <-- { protocol: "org-iso-mdoc", data: enc||ciphertext } --
  |                          |                                  |
  |  POST /api/demo/         |                                  |
  |    dc-response/:id       |                                  |
  |  { protocol: "org-iso-mdoc", data: base64url }             |
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

## 3. Estructura de los CBORs nuevos

### 3.1 `DeviceRequest` (ISO 18013-5 §8.3.2.1)

Estructura estándar de @owf/mdoc. Para el config `age-verification`:

```
DeviceRequest = {
  "version": "1.0",
  "docRequests": [{
    "itemsRequest": DataItem({
      "docType": "eu.europa.ec.av.1",
      "nameSpaces": {
        "eu.europa.ec.av.1": {
          "age_over_18": false   ← intentToRetain = false
        }
      }
    })
  }]
}
```

### 3.2 `encryptionInfo` (ISO 18013-7 Annex C §C.1.3)

CBOR map con claves enteras:

```
{
  1: 1,                          ← cipherSuiteId = HPKE-Base-P256-SHA256-AES128GCM
  2: <16 bytes aleatorios>,      ← nonce (para BrowserHandover)
  3: {                           ← COSE_Key (clave pública P-256 del verifier)
       1: 2,    ← kty = EC
      -1: 1,    ← crv = P-256
      -2: <32B>, ← x
      -3: <32B>  ← y
     }
}
```

### 3.3 `BrowserHandover` (SessionTranscript — ISO 18013-7 §C.2.3)

```
SessionTranscript = [
  null,             ← DeviceEngagementBytes (no aplica en DC API)
  null,             ← EReaderKeyBytes (no aplica en DC API)
  #6.24(           ← CBOR tag 24 (DataItem)
    bstr .cbor [
      "BrowserHandover",
      <nonce bytes>,     ← mismo nonce que en encryptionInfo
      <origin string>,   ← "https://example.com"
      <COSE_Key map>     ← misma clave que en encryptionInfo
    ]
  )
]
```

Este transcript se usa en dos momentos:
- Como parámetro `info` de HPKE al **cifrar** (wallet) y al **descifrar** (nosotros)
- Como `sessionTranscript` en `Verifier.verifyDeviceResponse()` para verificar DeviceAuth

---

## 4. HPKE (RFC 9180) — por qué implementación propia

### Suite utilizada
`HPKE-Base-P256-SHA256-AES128GCM`:
- KEM: DHKEM(P-256, HKDF-SHA256)
- KDF: HKDF-SHA256
- AEAD: AES-128-GCM

### Por qué no usamos @noble/hashes
La librería `@noble/hashes` v2 es **ESM-only**. EUDIPLO es un proyecto NestJS con CommonJS.
Importar ESM en CommonJS requiere dynamic `import()` asíncrono, lo cual rompe la firma
síncrona de `hpkeOpen`. Optamos por implementación directa sobre la API `node:crypto`
estándar, que soporta ECDH P-256, HMAC-SHA256 y AES-128-GCM.

### Formato de la respuesta cifrada
```
wallet_response = enc (65 bytes) || ciphertext+tag (N+16 bytes)
```
- `enc`: clave pública efímera P-256 del wallet (65 bytes sin comprimir: 0x04 || x || y)
- `ciphertext+tag`: respuesta cifrada con AES-128-GCM (tag en los últimos 16 bytes)

### Parámetros HPKE
```
hpkeOpen(encKey, ciphertext, recipientPrivJwk, info=SessionTranscript, aad=b"")
```

---

## 5. Fix de bug incluido: OID4VP DC API transcript incorrecto

Al analizar el código para implementar ISO 18013-7, se descubrió un bug en el flujo
**OID4VP via DC API existente**.

### El problema
`presentations.service.ts` siempre pasaba `protocol: "openid4vp"` a `mdocverifierService.verify()`,
que a su vez siempre llamaba a `SessionTranscript.forOid4Vp()`.

`forOid4Vp()` construye el transcript con `OpenID4VPHandover`:
```
["OpenID4VPHandover", SHA256(CBOR(clientId + responseUri + nonce))]
```

Pero para flujos DC API, el wallet construye el transcript con `OID4VPDCAPIHandover`:
```
["OpenID4VPDCAPIHandover", SHA256(CBOR([origin, nonce, jwkThumbprint?]))]
```

Si el DeviceAuthentication del wallet se firma sobre `OID4VPDCAPIHandover` pero nosotros
verificamos con `OpenID4VPHandover`, la verificación **falla silenciosamente** o lanza
un error de firma.

### La corrección
`presentations.service.ts` ahora pasa:
```typescript
session.useDcApi
  ? { protocol: "dc_api", nonce, origin: expected_origins[0], jwkThumbprint }
  : { protocol: "openid4vp", nonce, clientId, responseUri, responseMode, jwkThumbprint }
```

Y `mdocverifierService.verify()` usa `SessionTranscript.forOid4VpDcApi()` cuando
`protocol === "dc_api"`.

---

## 6. Nuevos campos en Session entity

```typescript
dcApiProtocol?: string  // "oid4vp" | "iso-18013-7"
browserOrigin?: string  // "https://example.com" — guardado en offer para reconstruir BrowserHandover
```

El campo `vp_nonce` (ya existente) almacena el nonce como hex string.

Estos campos permiten reconstruir el `BrowserHandover` en el momento de la respuesta sin
necesidad de almacenar los bytes CBOR completos del transcript.

---

## 7. Nuevo ResponseType: ISO_18013_7

```typescript
enum ResponseType {
  URI      = "uri",
  DC_API   = "dc-api",
  ISO_18013_7 = "iso-18013-7",   // nuevo
}
```

El endpoint `POST /api/verifier/offer` devuelve un formato diferente cuando
`response_type === "iso-18013-7"`:

```json
{
  "session": "uuid",
  "uri": "",
  "crossDeviceUri": "",
  "org_iso_mdoc": {
    "device_request": "base64url-cbor",
    "encryption_info": "base64url-cbor"
  }
}
```

---

## 8. Decisiones de diseño

### 8.1 Verificación en Iso18013Service, no en PresentationsService
`PresentationsService.parseResponse()` está diseñado para el flujo OID4VP donde el `vp_token`
llega como objeto JSON. Para ISO 18013-7 tenemos bytes CBOR brutos tras HPKE.

Optamos por que `Iso18013Service` llame directamente a `MdocverifierService.verify()`
pasando los bytes del DeviceResponse como base64url. Esto evita adaptar `parseResponse()`
a un formato que no es su dominio.

### 8.2 Transcript como bytes precomputados
`Verifier.verifyDeviceResponse()` acepta `SessionTranscript | Uint8Array`.
Para ISO 18013-7, pasamos `Uint8Array` (los bytes del transcript ya construido), evitando
crear una subclase de `Handover` para BrowserHandover (que no existe en @owf/mdoc v0.6).

Los bytes equivalen a `tag(24, cborEncode([null, null, DataItem(["BrowserHandover", ...])]))`,
que es lo mismo que `SessionTranscript.encode({ asDataItem: true })` produce para los otros handovers.

### 8.3 Clave de cifrado: reutilización del ECDH-ES existente
Cada tenant ya tiene una clave P-256 (ECDH-ES) usada para descifrar respuestas JWE en OID4VP.
La misma clave P-256 sirve como clave receptora HPKE en ISO 18013-7. No se necesita
generar ni rotar una clave separada.

Para ello se añadió `getEncryptionPrivateJwk()` a `EncryptionService`, que devuelve el JWK
completo (incluyendo `d`) para HPKE. Esta función nunca expone la clave externamente.

### 8.4 Nonce independiente por sesión
El nonce de 16 bytes se genera en `createOffer()` con `randomBytes(16)`, se almacena en
`session.vp_nonce` como hex, y se usa en:
1. `encryptionInfo` (para que el wallet construya el BrowserHandover)
2. Reconstrucción del transcript en `processResponse()`

Es **distinto** al `walletNonce` del flujo OID4VP. Para ISO 18013-7 no hay `request_uri`
ni separación nonce/sessionId, por lo que el portal usa el `session` UUID directamente
como ID de sesión en la URL del response endpoint.

---

## 9. Cambios en el portal (espuni platform)

### 9.1 `start/route.ts`
Acepta `dcApi: 'iso-18013-7'` como alternativa a `dcApi: true`:
- `dcApi: true` → OID4VP via DC API (igual que antes)
- `dcApi: 'iso-18013-7'` → ISO 18013-7 org.iso.mdoc via DC API

Cuando el offer devuelve `org_iso_mdoc`, lo incluye directamente en `presentationRequest.dc_api`.

### 9.2 `dc-response/[id]/route.ts`
Enruta según el protocolo devuelto por la DC API:
- `openid4vp-v1-unsigned` → `POST /presentations/:id/oid4vp` (sin cambios)
- `org-iso-mdoc` → `POST /presentations/:id/iso-18013-7` (nuevo)

### 9.3 `espuni-av.js`
Dos cambios críticos:

**Al construir la petición DC API:**
```javascript
// Antes: pasaba strings base64url directamente (incorrecto)
data: dc.org_iso_mdoc.device_request

// Ahora: convierte a Uint8Array (el DC API espera bytes)
data: fromBase64url(dc.org_iso_mdoc.device_request)
```

**Al recibir la respuesta DC API:**
```javascript
// Antes: pasaba result.data directamente (string para OID4VP, Uint8Array para org-iso-mdoc)
data: result.data

// Ahora: normaliza a base64url string antes de serializar a JSON
var data = (result.data instanceof Uint8Array) ? toBase64url(result.data) : result.data;
```

---

## 10. Cómo probarlo

### Requisito: wallet que soporte org-iso-mdoc

El flujo ISO 18013-7 requiere un wallet Android/iOS con soporte para:
- Digital Credentials API (Chrome M130+ en Android)
- Protocolo `org-iso-mdoc`
- Credencial `eu.europa.ec.av.1` con `age_over_18`

### Pasos

1. En la demo (`/demo`), el frontend debe llamar a `start` con `{ dcApi: 'iso-18013-7' }`.
2. El portal construye:
   ```javascript
   navigator.credentials.get({ digital: { requests: [{
     protocol: 'org-iso-mdoc',
     data: Uint8Array(DeviceRequest_CBOR),
     encryptionInfo: Uint8Array(EncryptionInfo_CBOR)
   }]}})
   ```
3. El wallet responde con los bytes HPKE cifrados.
4. El portal los envía a `POST /api/demo/dc-response/:session`.
5. El servidor enruta a `POST /presentations/:session/iso-18013-7` en EUDIPLO.
6. EUDIPLO descifra, verifica, y dispara el webhook.

### Verificación manual de HPKE (unit test)

```typescript
import { hpkeOpen } from './hpke';
import { buildBrowserHandoverTranscript, buildEncryptionInfo } from './cbor-request';

// 1. Generar clave receptora
const { privateKey, publicKey } = await generateKeyPair('ECDH-ES', { crv: 'P-256' });

// 2. Construir nonce y transcript
const nonce = Buffer.alloc(16, 0x42); // fijo para test
const origin = 'https://example.com';
const jwk = await exportJWK(publicKey);
const { hpkeInfo, verifyBytes } = buildBrowserHandoverTranscript(nonce, origin, jwk.x!, jwk.y!);

// 3. Cifrar con una librería HPKE de referencia (ej. @hpke/core)
// 4. Descifrar con hpkeOpen() y verificar que el plaintext coincide
```

---

## 11. Dependencias nuevas

**Ninguna.** Toda la implementación usa:
- `node:crypto` — ECDH P-256, HMAC-SHA256, AES-128-GCM
- `@owf/mdoc` — ya era dependencia de EUDIPLO (DeviceRequest, DataItem, cborEncode)

---

## 12. Limitaciones conocidas y trabajo futuro

| # | Limitación | Impacto | Trabajo futuro |
|---|---|---|---|
| 1 | `encryptionInfo` format no verificado con wallet real | Puede que el wallet espere claves CBOR distintas | Probar con Paradym u otro wallet AV Pilot |
| 2 | Trust list no configurada en verify (requireX5c=false) | No se valida la cadena de certificados del issuer | Pasar `VerifierOptions` igual que en `presentations.service.ts` |
| 3 | Solo primer credential `mso_mdoc` del DCQL query | Si el config tiene varios credentials, solo se procesa el primero | Extender a múltiples DocRequests |
| 4 | Sin soporte para redirect_uri tras ISO 18013-7 | La respuesta siempre es JSON vacío `{}` | Añadir lógica de redirect igual que en `oid4vp.service.ts` |
| 5 | Session audit logging no implementado | Sin trazabilidad en Loki/Tempo | Añadir AuditLogContext igual que en `oid4vp.service.ts` |
