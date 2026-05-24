import { exportJWK, generateKeyPair, importJWK, type JWK } from "jose";
import type { KmsProviderType } from "../../dto/kms-config.dto";
import type {
    KmsAdapter,
    KmsAdapterCapabilities,
    KmsHealthResult,
    KmsKeyMaterial,
    KmsKeyRef,
    KmsSigningAlg,
} from "../kms-adapter";

/**
 * Database-backed KMS adapter.
 *
 * Key material is generated locally via WebCrypto and the private JWK
 * is returned in {@link KmsKeyRef.privateJwk} so it can be persisted in
 * the encrypted `KeyChainEntity.activeJwk` column. Signing imports the
 * JWK on demand and calls `crypto.subtle.sign`.
 *
 * This adapter preserves the historical pre-abstraction behavior so
 * existing tenants are unaffected by the KMS refactor.
 */
export class DbKmsAdapter implements KmsAdapter {
    readonly type: KmsProviderType = "db";
    readonly capabilities: KmsAdapterCapabilities = {
        canCreate: true,
        canImport: true,
        canDelete: true,
        supportedAlgs: ["ES256"],
        defaultAlg: "ES256",
    };

    constructor(readonly providerId: string) {}

    async generateKey(opts: {
        kid: string;
        alg?: KmsSigningAlg;
    }): Promise<KmsKeyMaterial> {
        const alg = opts.alg ?? this.capabilities.defaultAlg;
        this.assertSupported(alg);
        const keyPair = await generateKeyPair(alg, { extractable: true });
        const privateJwk = await exportJWK(keyPair.privateKey);
        const publicJwk = await exportJWK(keyPair.publicKey);
        privateJwk.kid = opts.kid;
        privateJwk.alg = alg;
        publicJwk.kid = opts.kid;
        publicJwk.alg = alg;
        return { ref: { privateJwk, publicJwk, alg } };
    }

    async importKey(opts: {
        kid: string;
        privateJwk: JWK;
        alg?: KmsSigningAlg;
    }): Promise<KmsKeyMaterial> {
        const alg =
            opts.alg ??
            (opts.privateJwk.alg as KmsSigningAlg | undefined) ??
            this.capabilities.defaultAlg;
        this.assertSupported(alg);
        const privateJwk: JWK = { ...opts.privateJwk };
        privateJwk.kid = privateJwk.kid || opts.kid;
        privateJwk.alg = alg;
        const publicJwk = stripPrivateComponents(privateJwk);
        return { ref: { privateJwk, publicJwk, alg } };
    }

    async sign(
        ref: KmsKeyRef,
        data: Uint8Array,
        alg?: KmsSigningAlg,
    ): Promise<Uint8Array> {
        if (!ref.privateJwk) {
            throw new Error(
                `DbKmsAdapter[${this.providerId}]: missing privateJwk in key reference`,
            );
        }
        const signAlg = alg ?? ref.alg;
        this.assertSupported(signAlg);
        const privateKey = (await importJWK(
            ref.privateJwk,
            signAlg,
        )) as CryptoKey;
        const signature = await globalThis.crypto.subtle.sign(
            { name: "ECDSA", hash: "SHA-256" },
            privateKey,
            data as BufferSource,
        );
        return new Uint8Array(signature);
    }

    async deleteKey(_ref: KmsKeyRef): Promise<void> {
        // No-op: lifecycle is owned by the KeyChainEntity row.
    }

    async health(): Promise<KmsHealthResult> {
        return { ok: true, latencyMs: 0 };
    }

    private assertSupported(alg: KmsSigningAlg): void {
        if (!this.capabilities.supportedAlgs.includes(alg)) {
            throw new Error(
                `DbKmsAdapter[${this.providerId}]: unsupported alg '${alg}'`,
            );
        }
    }
}

function stripPrivateComponents(jwk: JWK): JWK {
    const { d, p, q, dp, dq, qi, k, ...publicJwk } = jwk as Record<
        string,
        unknown
    >;
    return publicJwk;
}
