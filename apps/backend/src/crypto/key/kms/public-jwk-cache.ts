import type { JWK } from "jose";

/**
 * Tiny TTL cache for public JWKs returned by external KMS providers.
 *
 * Public keys are immutable for the lifetime of a given external key id,
 * but key rotation may rebind the same logical id to a new physical key
 * — so we cap entries to a short TTL (default 5 minutes) rather than
 * relying on explicit invalidation alone.
 */
export class PublicJwkCache {
    private readonly entries = new Map<
        string,
        { jwk: JWK; expiresAt: number }
    >();
    private readonly ttlMs: number;

    constructor(ttlMs = 5 * 60 * 1000) {
        this.ttlMs = ttlMs;
    }

    get(key: string): JWK | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt < Date.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry.jwk;
    }

    set(key: string, jwk: JWK): void {
        this.entries.set(key, { jwk, expiresAt: Date.now() + this.ttlMs });
    }

    invalidate(key: string): void {
        this.entries.delete(key);
    }

    clear(): void {
        this.entries.clear();
    }
}
