import type { JWK } from "jose";
import type { KmsAdapter, KmsKeyRef, KmsSigningAlg } from "./kms-adapter";

/**
 * Marker properties spliced onto a fake CryptoKey so that
 * {@link KmsCryptoProvider} can detect KMS-backed signing operations.
 */
interface KmsSigningKeyMarker {
    __kmsAdapter: KmsAdapter;
    __kmsRef: KmsKeyRef;
    __kmsAlg: KmsSigningAlg;
}

const ALG_TO_WEBCRYPTO: Record<KmsSigningAlg, KeyAlgorithm> = {
    ES256: {
        name: "ECDSA",
        // @ts-expect-error - WebCrypto KeyAlgorithm doesn't include namedCurve in its type
        namedCurve: "P-256",
    },
};

/**
 * Build an opaque CryptoKey-shaped value that routes WebCrypto `sign`
 * operations through a {@link KmsAdapter}.
 *
 * The returned object is NEVER usable for export, verify or any other
 * native subtle operation — only for signing, and only when the
 * {@link KmsCryptoProvider} is active (which is the default once the
 * `KmsProviderRegistry` boots).
 */
export function makeKmsSigningKey(
    adapter: KmsAdapter,
    ref: KmsKeyRef,
    alg: KmsSigningAlg = "ES256",
): CryptoKey {
    const marker: KmsSigningKeyMarker = {
        __kmsAdapter: adapter,
        __kmsRef: ref,
        __kmsAlg: alg,
    };
    const key: Partial<CryptoKey> & KmsSigningKeyMarker = {
        algorithm: ALG_TO_WEBCRYPTO[alg],
        extractable: false,
        type: "private",
        usages: ["sign"],
        ...marker,
    };
    return key as CryptoKey;
}

/**
 * `Crypto` implementation that delegates to the native WebCrypto for
 * everything *except* `subtle.sign(...)` invocations whose key was
 * produced by {@link makeKmsSigningKey}. Those are routed to the
 * appropriate KMS adapter.
 *
 * This is installed as the global `@peculiar/x509` crypto provider so
 * `X509CertificateGenerator.create({ signingKey })` can be called with
 * a fake KMS-backed key and the signature is produced inside the KMS
 * backend — the private key never leaves it.
 */
export class KmsCryptoProvider implements Crypto {
    private readonly native: Crypto = globalThis.crypto;
    readonly subtle: SubtleCrypto;

    constructor() {
        const nativeSubtle = this.native.subtle;
        const dispatchSign = this.signDispatch.bind(this);

        // Use a Proxy so we delegate all SubtleCrypto methods to the
        // native implementation without re-declaring their overloaded
        // signatures (which TypeScript cannot narrow inline). Only
        // `sign` and `exportKey` are intercepted to enforce KMS
        // semantics.
        this.subtle = new Proxy(nativeSubtle, {
            get(target, prop, receiver) {
                if (prop === "sign") {
                    return dispatchSign;
                }
                if (prop === "exportKey") {
                    return (format: KeyFormat, key: CryptoKey) => {
                        if (isKmsKey(key)) {
                            throw new Error(
                                "Refusing to exportKey: this key is held in an external KMS",
                            );
                        }
                        return (
                            target.exportKey as (
                                f: KeyFormat,
                                k: CryptoKey,
                            ) => Promise<ArrayBuffer | JsonWebKey>
                        ).call(target, format, key);
                    };
                }
                const value = Reflect.get(target, prop, receiver);
                return typeof value === "function" ? value.bind(target) : value;
            },
        });
    }

    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
        return this.native.getRandomValues(
            array as Parameters<Crypto["getRandomValues"]>[0],
        ) as T;
    }

    randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
        return this.native.randomUUID();
    }

    private async signDispatch(
        alg: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
        key: CryptoKey,
        data: BufferSource,
    ): Promise<ArrayBuffer> {
        if (isKmsKey(key)) {
            const bytes =
                data instanceof ArrayBuffer
                    ? new Uint8Array(data)
                    : new Uint8Array(
                          data.buffer,
                          data.byteOffset,
                          data.byteLength,
                      );
            const sig = await key.__kmsAdapter.sign(
                key.__kmsRef,
                bytes,
                key.__kmsAlg,
            );
            // Return a fresh ArrayBuffer so callers can transfer/slice.
            const out = new ArrayBuffer(sig.byteLength);
            new Uint8Array(out).set(sig);
            return out;
        }
        return this.native.subtle.sign(alg, key, data);
    }
}

function isKmsKey(key: CryptoKey): key is CryptoKey & KmsSigningKeyMarker {
    return Boolean((key as Partial<KmsSigningKeyMarker>).__kmsAdapter);
}

/**
 * Convenience: derive a real WebCrypto public CryptoKey from a public
 * JWK. Used by the cert builder to populate SubjectPublicKeyInfo /
 * compute Subject- and AuthorityKeyIdentifier extensions.
 */
export async function importPublicCryptoKey(
    publicJwk: JWK,
    alg: KmsSigningAlg = "ES256",
): Promise<CryptoKey> {
    if (alg !== "ES256") {
        throw new Error(`Unsupported alg ${alg}`);
    }
    return globalThis.crypto.subtle.importKey(
        "jwk",
        publicJwk as JsonWebKey,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"],
    );
}
