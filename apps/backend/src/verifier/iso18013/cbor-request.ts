/**
 * CBOR builders for ISO 18013-7 Annex C (org-iso-mdoc DC API flow).
 *
 * Builds DeviceRequest, EncryptionInfo, and the DCAPIHandover SessionTranscript
 * following ISO/IEC TS 18013-7:2025 Annex C:
 *
 *   EncryptionInfo      = ["dcapi", {"nonce": bstr, "recipientPublicKey": COSE_Key}]
 *   EncryptedResponse   = ["dcapi", {"enc": bstr, "cipherText": bstr}]
 *   SessionTranscript   = [null, null, ["dcapi", SHA-256(CBOR([encInfoB64u, origin]))]]
 */
import {
    cborDecode,
    cborEncode,
    DataItem,
    ProtectedHeaders,
    RegisteredCwtHeaderClaimKey,
    UnprotectedHeaders,
} from "@owf/cose";
import {
    CoseKey,
    DeviceRequest,
    DocRequest,
    ItemsRequest,
    ReaderAuth,
    SessionTranscript,
    SignatureAlgorithm,
} from "@owf/mdoc";
import { mdocContext } from "../presentations/mdoc-context.js";

// COSE Key type / curve constants (RFC 8152)
const KTY_EC = 2;
const CRV_P256 = 1;

/**
 * Build a COSE_Key map (integer-keyed) for a P-256 public key from JWK base64url components.
 */
function buildCoseKeyMap(xB64: string, yB64: string): Map<number, unknown> {
    return new Map<number, unknown>([
        [1, KTY_EC],
        [-1, CRV_P256],
        [-2, Buffer.from(xB64, "base64url")],
        [-3, Buffer.from(yB64, "base64url")],
    ]);
}

/**
 * Build the CBOR-encoded EncryptionInfo per ISO/IEC TS 18013-7:2025 Annex C:
 *
 *   EncryptionInfo = ["dcapi", EncryptionParameters]
 *   EncryptionParameters = {"nonce": bstr, "recipientPublicKey": COSE_Key}
 */
export function buildEncryptionInfo(
    xB64: string,
    yB64: string,
    nonce: Buffer,
): Buffer {
    const encryptionParameters = new Map<string, unknown>([
        ["nonce", new Uint8Array(nonce)],
        ["recipientPublicKey", buildCoseKeyMap(xB64, yB64)],
    ]);
    return Buffer.from(cborEncode(["dcapi", encryptionParameters]));
}

/**
 * Build the ItemsRequest for a single mDOC docType per ISO 18013-5 §8.3.2.1.2.1.
 *
 * The same ItemsRequest instance must be embedded in both the DocRequest and the
 * ReaderAuthentication structure so the wallet can recompute and verify the
 * reader signature — see {@link buildReaderAuth}.
 *
 * @param docType     mDOC document type (e.g. "org.iso.18013.5.1.mDL")
 * @param namespaces  Map of namespace → { claimName: intentToRetain }
 */
export function buildItemsRequest(
    docType: string,
    namespaces: Record<string, Record<string, boolean>>,
): ItemsRequest {
    return ItemsRequest.create({ docType, namespaces });
}

/**
 * Build the CBOR DeviceRequest per ISO 18013-5 §8.3.2.1.2.1.
 *
 * @param itemsRequest  the ItemsRequest from {@link buildItemsRequest}
 * @param readerAuth    optional detached ReaderAuth (COSE_Sign1) authenticating
 *                      the verifier — see {@link buildReaderAuth}. When present it
 *                      is embedded in the DocRequest so the wallet can verify it.
 */
export function buildDeviceRequestCbor(
    itemsRequest: ItemsRequest,
    readerAuth?: ReaderAuth,
): Buffer {
    const dr = DeviceRequest.create({
        docRequests: [DocRequest.create({ itemsRequest, readerAuth })],
    });
    return Buffer.from(dr.encode());
}

/**
 * Sign a detached ReaderAuth (COSE_Sign1) authenticating the verifier inside the
 * DeviceRequest, per ISO/IEC 18013-5 §9.1.4 / 18013-7 Annex C.
 *
 * The signed payload is the CBOR of
 *
 *   ReaderAuthentication = ["ReaderAuthentication", SessionTranscript, ItemsRequestBytes]
 *
 * carried as the COSE_Sign1 *detached* payload (`ReaderAuthenticationBytes`,
 * a Tag-24-wrapped bstr). The verifier's certificate chain is placed in the
 * unprotected `x5chain` header and ES256 in the protected header — the same
 * shape `@owf/mdoc` produces for IssuerAuth, and the exact bytes its
 * `ReaderAuth.verify()` recomputes.
 *
 * The DCAPIHandover SessionTranscript is available already at offer time (it is
 * a deterministic function of `encryptionInfo` + browser origin), so the reader
 * signature can be produced when the DeviceRequest is built.
 *
 * @param itemsRequest       the same ItemsRequest embedded in the DocRequest
 * @param sessionTranscript  DCAPIHandover transcript from {@link buildIsoMdocDcApiTranscript}
 * @param signingJwk         verifier Access private JWK (must include `d`)
 * @param certificateChain   leaf-first DER certificate chain for `x5chain`
 */
export async function buildReaderAuth(
    itemsRequest: ItemsRequest,
    sessionTranscript: SessionTranscript,
    signingJwk: Record<string, unknown>,
    certificateChain: Uint8Array[],
): Promise<ReaderAuth> {
    // ReaderAuthentication = ["ReaderAuthentication", SessionTranscript, ItemsRequestBytes].
    // `@owf/mdoc` declares but does not export the ReaderAuthentication model, so
    // reproduce its encoding exactly (see reader-authentication.ts in the lib):
    // the itemsRequest is embedded Tag-24 wrapped, and the whole structure is the
    // detached COSE_Sign1 payload as ReaderAuthenticationBytes = #6.24(bstr .cbor ...).
    // This is byte-identical to what ReaderAuth.verify() recomputes on the wallet.
    const readerAuthenticationStructure = [
        "ReaderAuthentication",
        sessionTranscript.encodedStructure,
        DataItem.fromData(itemsRequest.encodedStructure),
    ];
    const detachedPayload = cborEncode(
        DataItem.fromData(readerAuthenticationStructure),
    );

    const readerAuth = ReaderAuth.create({
        protectedHeaders: ProtectedHeaders.create({
            protectedHeaders: new Map([
                [
                    RegisteredCwtHeaderClaimKey.Algorithm,
                    SignatureAlgorithm.ES256,
                ],
            ]),
        }),
        unprotectedHeaders: UnprotectedHeaders.create({
            unprotectedHeaders: new Map([
                [RegisteredCwtHeaderClaimKey.X5Chain, certificateChain],
            ]),
        }),
        payload: null,
    });

    await readerAuth.sign(
        {
            signingKey: CoseKey.fromJwk(signingJwk),
            algorithm: SignatureAlgorithm.ES256,
            detachedPayload,
        },
        { sign: mdocContext.cose.sign1.sign },
    );

    return readerAuth;
}

/**
 * Build the DCAPIHandover SessionTranscript per ISO/IEC TS 18013-7:2025 Annex C:
 *
 *   SessionTranscript = [null, null, ["dcapi", SHA-256(CBOR([encInfoB64u, origin]))]]
 *
 * The transcript is used in two places:
 * - `hpkeInfo`: plain CBOR encoding — the HPKE RFC 9180 `info` parameter used by
 *   the wallet when encrypting and by the verifier when decrypting.
 * - `sessionTranscript`: the structure passed to Verifier.verifyDeviceResponse
 *   for DeviceAuth verification.
 *
 * @param encryptionInfoB64u base64url (no padding) encoding of the EncryptionInfo
 *                           CBOR exactly as sent in the DC API request
 * @param origin             browser origin, e.g. "https://example.com"
 */
export async function buildIsoMdocDcApiTranscript(
    encryptionInfoB64u: string,
    origin: string,
): Promise<{ hpkeInfo: Buffer; sessionTranscript: SessionTranscript }> {
    const sessionTranscript = await SessionTranscript.forIsoMdocDcApi(
        { encryptionInfoBase64Url: encryptionInfoB64u, origin },
        mdocContext,
    );
    return {
        hpkeInfo: Buffer.from(sessionTranscript.encode()),
        sessionTranscript,
    };
}

/**
 * Parse the wallet's EncryptedResponse per ISO/IEC TS 18013-7:2025 Annex C:
 *
 *   EncryptedResponse = ["dcapi", {"enc": bstr, "cipherText": bstr}]
 *
 * `enc` is the wallet's ephemeral P-256 public key (uncompressed, 65 bytes) and
 * `cipherText` the HPKE AES-128-GCM output (GCM tag in the last 16 bytes).
 */
export function parseEncryptedResponse(encryptedResponse: Buffer): {
    enc: Buffer;
    cipherText: Buffer;
} {
    let decoded: unknown;
    try {
        decoded = cborDecode(new Uint8Array(encryptedResponse));
    } catch {
        throw new Error("EncryptedResponse is not valid CBOR");
    }

    if (
        !Array.isArray(decoded) ||
        decoded.length !== 2 ||
        decoded[0] !== "dcapi"
    ) {
        throw new Error(
            'EncryptedResponse must be ["dcapi", EncryptedResponseData]',
        );
    }

    const data = decoded[1];
    const get = (key: string): unknown =>
        data instanceof Map ? data.get(key) : (data as any)?.[key];

    const enc = get("enc");
    const cipherText = get("cipherText");
    if (!(enc instanceof Uint8Array) || !(cipherText instanceof Uint8Array)) {
        throw new Error(
            "EncryptedResponseData must contain bstr enc and cipherText",
        );
    }

    return { enc: Buffer.from(enc), cipherText: Buffer.from(cipherText) };
}
