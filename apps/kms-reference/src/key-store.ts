/**
 * In-memory key store.
 *
 * Keys are stored in a module-level Map and persist for the lifetime of the
 * Worker isolate. During local development (`wrangler dev`) the same isolate
 * handles all requests, so keys survive across calls.
 *
 * ⚠️  NOT FOR PRODUCTION — keys are lost on every restart.
 */

interface StoredKey {
    pair: CryptoKeyPair;
    alg: string;
}

const keys = new Map<string, StoredKey>();

export function storeKey(kid: string, pair: CryptoKeyPair, alg: string): void {
    keys.set(kid, { pair, alg });
}

export function getKey(kid: string): StoredKey | undefined {
    return keys.get(kid);
}

export function deleteKey(kid: string): boolean {
    return keys.delete(kid);
}

export function keyCount(): number {
    return keys.size;
}
