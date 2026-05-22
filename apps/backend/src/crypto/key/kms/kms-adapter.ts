import type { JWK } from "jose";
import type { KmsProviderType } from "../dto/kms-config.dto";

/**
 * Supported signing algorithms. New algorithms can be added here once
 * adapters declare support for them via {@link KmsAdapterCapabilities.supportedAlgs}.
 */
export type KmsSigningAlg = "ES256";

/**
 * Opaque reference to a key stored by a KMS provider.
 *
 * - For the `db` provider: `privateJwk` is populated (key material lives in
 *   the DB column, encrypted at rest).
 * - For external providers (`vault`, `aws-kms`): `externalKeyId` identifies
 *   the key inside the provider (e.g. Vault key name, AWS KMS key ID/ARN)
 *   and the private key never leaves the provider.
 *
 * A reference always carries the public JWK so JWKS / DID resolution and
 * SubjectPublicKeyInfo construction can happen without a round-trip.
 */
export interface KmsKeyRef {
    externalKeyId?: string;
    privateJwk?: JWK;
    publicJwk: JWK;
    alg: KmsSigningAlg;
}

/**
 * Result of generating or importing key material. Adapters MUST NOT
 * return private CryptoKey objects — cert signing is routed through
 * {@link KmsAdapter.sign} via a custom `@peculiar/x509` crypto provider.
 */
export interface KmsKeyMaterial {
    ref: KmsKeyRef;
}

/**
 * Static capabilities of a KMS adapter implementation.
 */
export interface KmsAdapterCapabilities {
    canCreate: boolean;
    canImport: boolean;
    canDelete: boolean;
    /** Algorithms the adapter can sign with. */
    supportedAlgs: KmsSigningAlg[];
    /** Default algorithm used when caller does not specify one. */
    defaultAlg: KmsSigningAlg;
}

/**
 * Provider-agnostic contract for key material operations.
 *
 * Implementations encapsulate the storage and signing backend (database,
 * HashiCorp Vault, AWS KMS, ...). For non-`db` providers the private key
 * material MUST stay inside the backend — adapters never return private
 * CryptoKey objects. Certificate construction routes its signing
 * operations through a custom `@peculiar/x509` crypto provider that
 * calls back into {@link KmsAdapter.sign}.
 */
export interface KmsAdapter {
    /** Configured provider id (matches `id` in `kms.json`). */
    readonly providerId: string;

    /** Adapter type (matches `type` in `kms.json`). */
    readonly type: KmsProviderType;

    /** Static capabilities of this adapter type. */
    readonly capabilities: KmsAdapterCapabilities;

    /**
     * Generate fresh key material in the provider's backing store.
     */
    generateKey(opts: {
        kid: string;
        alg?: KmsSigningAlg;
    }): Promise<KmsKeyMaterial>;

    /**
     * Import a pre-existing private JWK into the adapter's backing store.
     *
     * Adapters that cannot accept external key material (e.g. AWS KMS in
     * the default configuration) MUST throw.
     */
    importKey(opts: {
        kid: string;
        privateJwk: JWK;
        alg?: KmsSigningAlg;
    }): Promise<KmsKeyMaterial>;

    /**
     * Produce a raw ECDSA signature over `data` using the key identified
     * by `ref`. The returned value MUST be the raw `r || s` concatenation
     * expected by JOSE / COSE (64 bytes for P-256). For X.509 the caller
     * re-encodes to ECDSA-Sig-Value DER.
     */
    sign(
        ref: KmsKeyRef,
        data: Uint8Array,
        alg?: KmsSigningAlg,
    ): Promise<Uint8Array>;

    /**
     * Delete the key from the adapter's backing store. Adapters that
     * cannot delete (e.g. AWS KMS in default config) MUST throw or no-op.
     */
    deleteKey(ref: KmsKeyRef): Promise<void>;

    /**
     * Liveness/readiness probe for the underlying backend. The default
     * implementation (for `db`) always succeeds; external providers
     * should make a cheap remote call (e.g. Vault `/sys/health`, AWS KMS
     * `ListKeys` with limit 1) and return a non-throwing result.
     */
    health(): Promise<KmsHealthResult>;
}

export interface KmsHealthResult {
    ok: boolean;
    latencyMs?: number;
    error?: string;
}
