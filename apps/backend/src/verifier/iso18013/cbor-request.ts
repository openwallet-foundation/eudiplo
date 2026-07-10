/**
 * CBOR builders for ISO 18013-7 Annex C (org.iso.mdoc DC API flow).
 *
 * Builds DeviceRequest, encryptionInfo, and SessionTranscript CBORs
 * using @owf/mdoc primitives.
 */
import {
    cborEncode,
    DataItem,
    DeviceRequest,
    DocRequest,
    ItemsRequest,
} from "@owf/mdoc";

// COSE Key type / curve constants (RFC 8152)
const KTY_EC = 2;
const CRV_P256 = 1;
// Cipher suite 1 = HPKE-Base-P256-SHA256-AES128GCM (ISO 18013-7 Annex C §C.1.1)
const CIPHER_SUITE_ID = 1;

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
 * Build the CBOR-encoded encryptionInfo for ISO 18013-7 Annex C §C.1.3.
 *
 * Format (positional CBOR array):
 *   [cipherSuiteId, nonce, COSE_Key]
 *
 * ISO 18013-7 defines EncryptionInfo as a CBOR array, not a map.
 * COSE_Key (element 2) is still an integer-keyed CBOR map per RFC 8152.
 */
export function buildEncryptionInfo(
    xB64: string,
    yB64: string,
    nonce: Buffer,
): Buffer {
    const encInfo = [
        CIPHER_SUITE_ID,
        new Uint8Array(nonce),
        buildCoseKeyMap(xB64, yB64),
    ];
    return Buffer.from(cborEncode(encInfo));
}

/**
 * Build the CBOR DeviceRequest for ISO 18013-7 Annex C §C.1.2.
 *
 * @param docType   mDOC document type (e.g. "eu.europa.ec.av.1")
 * @param namespaces  Map of namespace → { claimName: intentToRetain }
 */
export function buildDeviceRequestCbor(
    docType: string,
    namespaces: Record<string, Record<string, boolean>>,
): Buffer {
    const dr = DeviceRequest.create({
        docRequests: [
            DocRequest.create({
                itemsRequest: ItemsRequest.create({ docType, namespaces }),
            }),
        ],
    });
    return Buffer.from(dr.encode());
}

/**
 * Return both HPKE-info bytes and verifyDeviceResponse bytes for the BrowserHandover.
 *
 * BrowserHandover SessionTranscript = [null, null, DataItem(["BrowserHandover", nonce, origin, COSE_Key])]
 *
 * - `hpkeInfo`    = cborEncode(sessionTranscriptArray)           — used as HPKE RFC 9180 info
 * - `verifyBytes` = tag24(cborEncode(sessionTranscriptArray))    — passed to Verifier.verifyDeviceResponse
 */
export function buildBrowserHandoverTranscript(
    nonce: Buffer,
    origin: string,
    xB64: string,
    yB64: string,
): { hpkeInfo: Buffer; verifyBytes: Uint8Array } {
    const coseKey = buildCoseKeyMap(xB64, yB64);
    const handoverArray = [
        "BrowserHandover",
        new Uint8Array(nonce),
        origin,
        coseKey,
    ];
    const sessionTranscriptArray = [null, null, DataItem.fromData(handoverArray)];

    return {
        // Plain CBOR encoding — what the wallet uses as HPKE info when encrypting.
        hpkeInfo: Buffer.from(cborEncode(sessionTranscriptArray)),
        // DataItem-wrapped CBOR — equivalent to SessionTranscript.encode({ asDataItem: true }).
        verifyBytes: cborEncode(DataItem.fromData(sessionTranscriptArray)),
    };
}
