import {
    CreateKeyCommand,
    type DescribeKeyCommandOutput,
    GetPublicKeyCommand,
    type KMSClient,
    ListKeysCommand,
    SignCommand,
    ScheduleKeyDeletionCommand,
} from "@aws-sdk/client-kms";
import { Logger, NotImplementedException } from "@nestjs/common";
import { exportJWK, type JWK } from "jose";
import type { KmsProviderType } from "../../dto/kms-config.dto";
import type {
    KmsAdapter,
    KmsAdapterCapabilities,
    KmsHealthResult,
    KmsKeyMaterial,
    KmsKeyRef,
    KmsSigningAlg,
} from "../kms-adapter";
import { PublicJwkCache } from "../public-jwk-cache";

export interface AwsKmsAdapterConfig {
    providerId: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

/**
 * AWS KMS adapter.
 *
 * Generates ECC_NIST_P256 SIGN_VERIFY keys directly inside AWS KMS;
 * private key material never leaves the HSM-backed service. Signing
 * goes through the KMS `Sign` API and the returned DER ECDSA-Sig-Value
 * is re-encoded as raw `r || s` so it is JWS-compatible. Import of
 * external key material is intentionally not supported.
 */
export class AwsKmsAdapter implements KmsAdapter {
    private readonly logger = new Logger(AwsKmsAdapter.name);
    private clientPromise?: Promise<KMSClient>;

    readonly providerId: string;
    readonly type: KmsProviderType = "aws-kms";
    readonly capabilities: KmsAdapterCapabilities = {
        canCreate: true,
        canImport: false,
        canDelete: true,
        supportedAlgs: ["ES256"],
        defaultAlg: "ES256",
    };

    private readonly region: string;
    private readonly accessKeyId?: string;
    private readonly secretAccessKey?: string;
    private readonly jwkCache = new PublicJwkCache();

    constructor(config: AwsKmsAdapterConfig) {
        this.providerId = config.providerId;
        this.region = config.region;
        this.accessKeyId = config.accessKeyId;
        this.secretAccessKey = config.secretAccessKey;
    }

    async generateKey(opts: {
        kid: string;
        alg?: KmsSigningAlg;
    }): Promise<KmsKeyMaterial> {
        const alg = opts.alg ?? this.capabilities.defaultAlg;
        this.assertSupported(alg);

        const client = await this.client();
        const created = await client.send(
            new CreateKeyCommand({
                KeyUsage: "SIGN_VERIFY",
                KeySpec: "ECC_NIST_P256",
                Description: `eudiplo:${opts.kid}`,
                Tags: [{ TagKey: "eudiplo-kid", TagValue: opts.kid }],
            }),
        );

        const keyId = created.KeyMetadata?.KeyId;
        if (!keyId) {
            throw new Error(
                `AwsKmsAdapter[${this.providerId}]: CreateKey returned no KeyId`,
            );
        }

        const publicJwk = await this.fetchPublicJwk(keyId, alg, opts.kid);
        return { ref: { externalKeyId: keyId, publicJwk, alg } };
    }

    importKey(_opts: {
        kid: string;
        privateJwk: JWK;
        alg?: KmsSigningAlg;
    }): Promise<KmsKeyMaterial> {
        throw new NotImplementedException(
            `AwsKmsAdapter[${this.providerId}]: importKey is not supported — generate keys inside AWS KMS instead`,
        );
    }

    async sign(
        ref: KmsKeyRef,
        data: Uint8Array,
        alg?: KmsSigningAlg,
    ): Promise<Uint8Array> {
        if (!ref.externalKeyId) {
            throw new Error(
                `AwsKmsAdapter[${this.providerId}]: missing externalKeyId`,
            );
        }
        const signAlg = alg ?? ref.alg;
        this.assertSupported(signAlg);

        const client = await this.client();
        const out = await client.send(
            new SignCommand({
                KeyId: ref.externalKeyId,
                Message: data,
                MessageType: "RAW",
                SigningAlgorithm: "ECDSA_SHA_256",
            }),
        );
        if (!out.Signature) {
            throw new Error(
                `AwsKmsAdapter[${this.providerId}]: Sign returned no signature`,
            );
        }
        return derEcdsaToRaw(out.Signature, 32);
    }

    async deleteKey(ref: KmsKeyRef): Promise<void> {
        if (!ref.externalKeyId) return;
        this.jwkCache.invalidate(ref.externalKeyId);
        const client = await this.client();
        try {
            await client.send(
                new ScheduleKeyDeletionCommand({
                    KeyId: ref.externalKeyId,
                    PendingWindowInDays: 7,
                }),
            );
        } catch (err) {
            this.logger.warn(
                `Failed to schedule deletion for AWS KMS key ${ref.externalKeyId}: ${String(err)}`,
            );
        }
    }

    async health(): Promise<KmsHealthResult> {
        const start = Date.now();
        try {
            const client = await this.client();
            await client.send(new ListKeysCommand({ Limit: 1 }));
            return { ok: true, latencyMs: Date.now() - start };
        } catch (err) {
            return {
                ok: false,
                latencyMs: Date.now() - start,
                error: String(err),
            };
        }
    }

    private async client(): Promise<KMSClient> {
        this.clientPromise ??= (async () => {
            const { KMSClient } = await import("@aws-sdk/client-kms");
            return new KMSClient({
                region: this.region,
                ...(this.accessKeyId && this.secretAccessKey
                    ? {
                          credentials: {
                              accessKeyId: this.accessKeyId,
                              secretAccessKey: this.secretAccessKey,
                          },
                      }
                    : {}),
            });
        })();
        return this.clientPromise;
    }

    private async fetchPublicJwk(
        keyId: string,
        alg: KmsSigningAlg,
        kid: string,
    ): Promise<JWK> {
        const cached = this.jwkCache.get(keyId);
        if (cached) return cached;
        const jwk = await this.fetchPublicJwkFromKms(keyId, alg, kid);
        this.jwkCache.set(keyId, jwk);
        return jwk;
    }

    private async fetchPublicJwkFromKms(
        keyId: string,
        alg: KmsSigningAlg,
        kid: string,
    ): Promise<JWK> {
        const client = await this.client();
        const res: DescribeKeyCommandOutput & { PublicKey?: Uint8Array } =
            await client.send(new GetPublicKeyCommand({ KeyId: keyId }));
        const spki = res.PublicKey;
        if (!spki) {
            throw new Error(
                `AwsKmsAdapter[${this.providerId}]: GetPublicKey returned no PublicKey`,
            );
        }

        const cryptoKey = await globalThis.crypto.subtle.importKey(
            "spki",
            spki.buffer.slice(
                spki.byteOffset,
                spki.byteOffset + spki.byteLength,
            ) as ArrayBuffer,
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["verify"],
        );
        const jwk = await exportJWK(cryptoKey);
        jwk.kid = kid;
        jwk.alg = alg;
        return jwk;
    }

    private assertSupported(alg: KmsSigningAlg): void {
        if (!this.capabilities.supportedAlgs.includes(alg)) {
            throw new Error(
                `AwsKmsAdapter[${this.providerId}]: unsupported alg '${alg}'`,
            );
        }
    }
}

/**
 * Convert an ASN.1 DER-encoded ECDSA-Sig-Value (`SEQUENCE { r, s }`)
 * to the raw `r || s` representation used by JOSE/COSE. `coordLength`
 * is the curve coordinate size in bytes (32 for P-256).
 */
function derEcdsaToRaw(der: Uint8Array, coordLength: number): Uint8Array {
    // Minimal DER parser for SEQUENCE { INTEGER r, INTEGER s }.
    let offset = 0;
    if (der[offset++] !== 0x30) {
        throw new Error("Invalid ECDSA signature: missing SEQUENCE tag");
    }
    // Length (short or long form).
    let seqLen = der[offset++];
    if (seqLen & 0x80) {
        const lenOfLen = seqLen & 0x7f;
        seqLen = 0;
        for (let i = 0; i < lenOfLen; i++) {
            seqLen = (seqLen << 8) | der[offset++];
        }
    }

    const readInt = (): Uint8Array => {
        if (der[offset++] !== 0x02) {
            throw new Error("Invalid ECDSA signature: missing INTEGER tag");
        }
        let len = der[offset++];
        if (len & 0x80) {
            const lenOfLen = len & 0x7f;
            len = 0;
            for (let i = 0; i < lenOfLen; i++) {
                len = (len << 8) | der[offset++];
            }
        }
        let value = der.subarray(offset, offset + len);
        offset += len;
        // Strip leading zero used to keep INTEGER positive.
        if (value.length > coordLength && value[0] === 0x00) {
            value = value.subarray(1);
        }
        return value;
    };

    const r = readInt();
    const s = readInt();
    const out = new Uint8Array(coordLength * 2);
    out.set(r, coordLength - r.length);
    out.set(s, coordLength * 2 - s.length);
    return out;
}
