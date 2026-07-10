/**
 * HPKE Base Mode (RFC 9180) decryption using Node.js built-in crypto.
 * Suite: DHKEM(P-256, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM
 * This is used for ISO 18013-7 Annex C (org.iso.mdoc DC API flow).
 */
import { createDecipheriv, createECDH, createHmac } from "node:crypto";

// Suite constants
const KEM_ID = 0x0010; // DHKEM(P-256, HKDF-SHA256)
const KDF_ID = 0x0001; // HKDF-SHA256
const AEAD_ID = 0x0001; // AES-128-GCM
const Nsecret = 32; // KEM shared-secret size (bytes)
const Nk = 16; // AES-128-GCM key size
const Nn = 12; // AES-128-GCM nonce size
const SHA256_LEN = 32;

const enc = new TextEncoder();

function i2osp(n: number, len: number): Uint8Array {
    const b = new Uint8Array(len);
    for (let i = len - 1; i >= 0; i--) {
        b[i] = n & 0xff;
        n >>>= 8;
    }
    return b;
}

function concat(...parts: Uint8Array[]): Buffer {
    return Buffer.concat(parts.map((p) => Buffer.from(p)));
}

// suite_id as defined by RFC 9180 §7.2 (HPKE context)
const hpkeSuiteId = concat(
    enc.encode("HPKE"),
    i2osp(KEM_ID, 2),
    i2osp(KDF_ID, 2),
    i2osp(AEAD_ID, 2),
);
// suite_id as defined by RFC 9180 §4.1 (KEM context)
const kemSuiteId = concat(enc.encode("KEM"), i2osp(KEM_ID, 2));

// HKDF-Extract(salt, ikm) = HMAC-SHA256(salt, ikm)
function hkdfExtract(salt: Buffer | null, ikm: Buffer): Buffer {
    const realSalt =
        salt && salt.length > 0 ? salt : Buffer.alloc(SHA256_LEN, 0);
    return createHmac("sha256", realSalt).update(ikm).digest();
}

// HKDF-Expand(prk, info, len)
function hkdfExpand(prk: Buffer, info: Buffer, len: number): Buffer {
    const out = Buffer.alloc(len);
    let t = Buffer.alloc(0);
    let written = 0;
    for (let n = 1; written < len; n++) {
        const h = createHmac("sha256", prk);
        h.update(t);
        h.update(info);
        h.update(Buffer.from([n]));
        t = h.digest();
        const take = Math.min(t.length, len - written);
        t.copy(out, written, 0, take);
        written += take;
    }
    return out;
}

// RFC 9180 §4 LabeledExtract
function labeledExtract(
    suiteId: Buffer,
    salt: Buffer | null,
    label: string,
    ikm: Buffer,
): Buffer {
    const labeled = concat(
        enc.encode("HPKE-v1"),
        suiteId,
        enc.encode(label),
        ikm,
    );
    return hkdfExtract(salt, labeled);
}

// RFC 9180 §4 LabeledExpand
function labeledExpand(
    suiteId: Buffer,
    prk: Buffer,
    label: string,
    info: Buffer,
    len: number,
): Buffer {
    const labeledInfo = concat(
        i2osp(len, 2),
        enc.encode("HPKE-v1"),
        suiteId,
        enc.encode(label),
        info,
    );
    return hkdfExpand(prk, labeledInfo, len);
}

/**
 * DHKEM(P-256) Decap: derive shared secret using recipient's private key
 * and the sender's encapsulated public key (enc = 65-byte uncompressed P-256 point).
 * RFC 9180 §4.1
 */
function dhkemDecap(
    encKey: Buffer,
    recipientPrivateKeyJwk: { x: string; y: string; d: string },
): Buffer {
    // ECDH: dh = shared X-coordinate of ECDH(recipient_sk, sender_pk)
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(recipientPrivateKeyJwk.d, "base64url"));
    const dhOutput = ecdh.computeSecret(encKey); // 32-byte X coordinate

    // Serialize recipient public key (uncompressed, 65 bytes)
    const pk_r = Buffer.concat([
        Buffer.from([0x04]),
        Buffer.from(recipientPrivateKeyJwk.x, "base64url"),
        Buffer.from(recipientPrivateKeyJwk.y, "base64url"),
    ]);

    // kem_context = enc || pk_r
    const kemContext = Buffer.concat([encKey, pk_r]);

    // ExtractAndExpand: RFC 9180 §4.1
    //   eae_prk       = LabeledExtract("", "eae_prk", dh)
    //   shared_secret = LabeledExpand(eae_prk, "shared_secret", kem_context, Nsecret)
    const eaePrk = labeledExtract(kemSuiteId, null, "eae_prk", dhOutput);
    return labeledExpand(
        kemSuiteId,
        eaePrk,
        "shared_secret",
        kemContext,
        Nsecret,
    );
}

/**
 * HPKE KeyScheduleBase: derive AEAD key and nonce from the KEM shared secret.
 * RFC 9180 §5.1 (mode_base = 0x00, psk="" psk_id="")
 */
function keySchedule(
    sharedSecret: Buffer,
    info: Buffer,
): { key: Buffer; baseNonce: Buffer } {
    const mode = Buffer.from([0x00]); // base mode

    // psk_id_hash = LabeledExtract("", "psk_id_hash", "")
    const pskIdHash = labeledExtract(
        hpkeSuiteId,
        null,
        "psk_id_hash",
        Buffer.alloc(0),
    );
    // info_hash    = LabeledExtract("", "info_hash", info)
    const infoHash = labeledExtract(hpkeSuiteId, null, "info_hash", info);

    // ks_context = mode || psk_id_hash || info_hash
    const ksContext = Buffer.concat([mode, pskIdHash, infoHash]);

    // secret = LabeledExtract(shared_secret, "secret", "")
    const secret = labeledExtract(
        hpkeSuiteId,
        sharedSecret,
        "secret",
        Buffer.alloc(0),
    );

    // key       = LabeledExpand(secret, "key",        ks_context, Nk)
    const key = labeledExpand(hpkeSuiteId, secret, "key", ksContext, Nk);
    // base_nonce = LabeledExpand(secret, "base_nonce", ks_context, Nn)
    const baseNonce = labeledExpand(
        hpkeSuiteId,
        secret,
        "base_nonce",
        ksContext,
        Nn,
    );

    return { key, baseNonce };
}

/**
 * Decrypt an HPKE Base Mode ciphertext (RFC 9180 §6.1 OpenBase).
 *
 * @param encKey       65-byte uncompressed P-256 sender ephemeral public key
 * @param ciphertext   AEAD ciphertext (plaintext + 16-byte GCM auth tag)
 * @param recipientPriv Recipient private key as JWK
 * @param info         HPKE info parameter (may be empty)
 * @param aad          Additional authenticated data (may be empty)
 */
export function hpkeOpen(
    encKey: Buffer,
    ciphertext: Buffer,
    recipientPriv: { x: string; y: string; d: string },
    info: Buffer = Buffer.alloc(0),
    aad: Buffer = Buffer.alloc(0),
): Buffer {
    const sharedSecret = dhkemDecap(encKey, recipientPriv);
    const { key, baseNonce } = keySchedule(sharedSecret, info);

    // AES-128-GCM: auth tag is the last 16 bytes of the ciphertext
    const authTag = ciphertext.subarray(-16);
    const encrypted = ciphertext.subarray(0, -16);

    const decipher = createDecipheriv("aes-128-gcm", key, baseNonce);
    decipher.setAuthTag(authTag);
    if (aad.length > 0) decipher.setAAD(aad);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
