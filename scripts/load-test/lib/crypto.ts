/**
 * WebCrypto utilities for OID4VCI proof JWT signing in k6.
 *
 * k6 v2.x exposes the WebCrypto API as a built-in global `crypto` object
 * (no import required). All exported functions are async because the
 * WebCrypto API is Promise-based.
 */

// `crypto` is a global in k6 v2.x — no import needed.
import encoding from 'k6/encoding';

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

/**
 * Encode a value as base64url (no padding).
 */
export function b64url(data: ArrayBuffer | Uint8Array | string): string {
    if (typeof data === 'string') {
        // Treat as UTF-8 string
        return encoding.b64encode(data, 'rawurl');
    }
    if (data instanceof ArrayBuffer) {
        return encoding.b64encode(new Uint8Array(data), 'rawurl');
    }
    // Uint8Array or similar typed array
    return encoding.b64encode(data, 'rawurl');
}

/**
 * JSON-encode an object then base64url-encode the result.
 */
export function b64urlJson(obj: unknown): string {
    return b64url(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Key management
// ---------------------------------------------------------------------------

/**
 * Generate a fresh ECDSA P-256 key pair.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true, // extractable
        ['sign', 'verify'],
    );
}

/**
 * Export a CryptoKeyPair to plain JWK objects.
 * The private JWK includes the 'd' component; the public JWK does not.
 */
export async function exportKeyPair(
    keyPair: CryptoKeyPair,
): Promise<{ privateJwk: JsonWebKey; publicJwk: JsonWebKey }> {
    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    // Build a public JWK without 'd' from the private JWK
    const { d: _d, ...publicJwk } = privateJwk;
    return { privateJwk, publicJwk };
}

/**
 * Import a private JWK back into a CryptoKey for signing.
 */
export async function importPrivateKey(privateJwk: JsonWebKey): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'jwk',
        privateJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, // not extractable once imported per-VU
        ['sign'],
    );
}

// ---------------------------------------------------------------------------
// Proof JWT
// ---------------------------------------------------------------------------

/**
 * Sign an OID4VCI key-binding proof JWT using ECDSA P-256 / SHA-256.
 *
 * The JWT follows the OpenID4VCI specification:
 *   - Header: { typ: "openid4vci-proof+jwt", alg: "ES256", jwk: <public key JWK> }
 *   - Payload: { aud: <credential issuer URL>, iat: <now (seconds)>, nonce: <c_nonce> }
 */
export async function signProofJwt(
    privateKey: CryptoKey,
    publicJwk: JsonWebKey,
    cNonce: string,
    audience: string,
): Promise<string> {
    const header = {
        typ: 'openid4vci-proof+jwt',
        alg: 'ES256',
        jwk: publicJwk,
    };

    const payload = {
        aud: audience,
        iat: Math.floor(Date.now() / 1000),
        nonce: cNonce,
    };

    const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;

    // WebCrypto sign() returns the signature in IEEE P1363 format (r || s),
    // which is the correct raw format for ES256 JWS signatures.
    const sigBytes = await crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        privateKey,
        new TextEncoder().encode(signingInput),
    );

    const sig = b64url(sigBytes);
    return `${signingInput}.${sig}`;
}
