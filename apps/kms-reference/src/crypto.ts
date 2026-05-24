/**
 * Cryptographic helpers backed by the WebCrypto API.
 *
 * All operations use ECDSA P-256 (ES256). The WebCrypto API is natively
 * available in Cloudflare Workers — no external libraries are needed.
 */

const EC_ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;

/**
 * Generates a new ECDSA P-256 key pair.
 */
export async function generateEcKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(EC_ALGORITHM, true, [
        "sign",
        "verify",
    ]) as Promise<CryptoKeyPair>;
}

/** JWK with the additional `kid` and `alg` fields used by the KMS contract. */
export type PublicJwk = JsonWebKey & { kid?: string; alg?: string };

/**
 * Exports the public key as a JWK object.
 */
export async function exportPublicJwk(key: CryptoKey): Promise<PublicJwk> {
    return crypto.subtle.exportKey("jwk", key) as Promise<PublicJwk>;
}

/**
 * Signs `data` with `privateKey` using ECDSA P-256 / SHA-256.
 *
 * Returns the raw IEEE P1363 signature (64 bytes: r‖s) as required by the
 * HTTP KMS adapter.
 */
export async function signData(
    privateKey: CryptoKey,
    data: Uint8Array,
): Promise<Uint8Array> {
    const sig = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKey,
        data as Uint8Array<ArrayBuffer>,
    );
    return new Uint8Array(sig);
}

/**
 * Imports a private JWK and derives the corresponding public key.
 *
 * Returns a `CryptoKeyPair` so the public key can be exported for the
 * response without re-deriving it later.
 */
export async function importPrivateKey(
    privateJwk: JsonWebKey,
): Promise<CryptoKeyPair> {
    const privateKey = await crypto.subtle.importKey(
        "jwk",
        privateJwk,
        EC_ALGORITHM,
        true,
        ["sign"],
    );

    // Derive the public JWK by stripping the private scalar 'd'.
    const publicJwk: JsonWebKey = { ...privateJwk };
    delete publicJwk.d;
    publicJwk.key_ops = ["verify"];

    const publicKey = await crypto.subtle.importKey(
        "jwk",
        publicJwk,
        EC_ALGORITHM,
        true,
        ["verify"],
    );

    return { privateKey, publicKey };
}

/**
 * Decodes a standard Base64 string (as sent by the backend adapter) into bytes.
 */
export function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Encodes bytes as Base64URL (no padding) as expected by the backend adapter.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}
