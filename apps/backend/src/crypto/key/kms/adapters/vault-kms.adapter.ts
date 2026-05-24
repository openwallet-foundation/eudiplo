import { HttpService } from "@nestjs/axios";
import { BadRequestException, Logger } from "@nestjs/common";
import { exportJWK, importJWK, type JWK } from "jose";
import { firstValueFrom } from "rxjs";
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

export interface VaultAdapterConfig {
    providerId: string;
    vaultUrl: string;
    vaultToken: string;
    /** Mount path of the Transit engine. Defaults to "transit". */
    transitMount?: string;
}

/**
 * HashiCorp Vault Transit KMS adapter.
 *
 * Keys are generated natively inside Vault and never leave the Transit
 * engine. The adapter retrieves the public key for SubjectPublicKeyInfo
 * / JWKS purposes and routes all signing operations through the
 * Transit `sign` endpoint.
 *
 * Import is supported via Transit BYOK but requires Vault to be set up
 * with a wrapping key (see Vault docs). Without that, callers should
 * generate new keys directly in Vault.
 */
export class VaultKmsAdapter implements KmsAdapter {
    private readonly logger = new Logger(VaultKmsAdapter.name);

    readonly providerId: string;
    readonly type: KmsProviderType = "vault";
    readonly capabilities: KmsAdapterCapabilities = {
        canCreate: true,
        canImport: true,
        canDelete: true,
        supportedAlgs: ["ES256"],
        defaultAlg: "ES256",
    };

    private readonly vaultUrl: string;
    private readonly vaultToken: string;
    private readonly transitMount: string;
    private mountEnsured = false;
    private readonly jwkCache = new PublicJwkCache();

    constructor(
        config: VaultAdapterConfig,
        private readonly http: HttpService,
    ) {
        this.providerId = config.providerId;
        this.vaultUrl = config.vaultUrl.replace(/\/$/, "");
        this.vaultToken = config.vaultToken;
        this.transitMount = config.transitMount || "transit";
    }

    async generateKey(opts: {
        kid: string;
        alg?: KmsSigningAlg;
    }): Promise<KmsKeyMaterial> {
        const alg = opts.alg ?? this.capabilities.defaultAlg;
        this.assertSupported(alg);
        await this.ensureMount();

        // Native Vault key generation — the private key NEVER leaves the engine.
        const url = `${this.vaultUrl}/v1/${this.transitMount}/keys/${encodeURIComponent(opts.kid)}`;
        await firstValueFrom(
            this.http.post(
                url,
                { type: vaultKeyType(alg), exportable: false },
                { headers: this.authHeaders() },
            ),
        );

        const publicJwk = await this.fetchPublicJwk(opts.kid, alg);
        return { ref: { externalKeyId: opts.kid, publicJwk, alg } };
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
        await this.ensureMount();

        // Vault BYOK: upload a wrapped key material. Caller's Vault must
        // have a configured wrapping key — see
        // https://developer.hashicorp.com/vault/docs/secrets/transit#bring-your-own-key-byok
        // for the full procedure. We submit the raw PKCS8 here; if the
        // backend is not configured for BYOK, this call will fail.
        const privateKey = (await importJWK(opts.privateJwk, alg)) as CryptoKey;
        const pkcs8 = await globalThis.crypto.subtle.exportKey(
            "pkcs8",
            privateKey,
        );
        const url = `${this.vaultUrl}/v1/${this.transitMount}/keys/${encodeURIComponent(opts.kid)}/import`;
        await firstValueFrom(
            this.http.post(
                url,
                {
                    type: vaultKeyType(alg),
                    ciphertext: Buffer.from(pkcs8).toString("base64"),
                    hash_function: "SHA256",
                },
                { headers: this.authHeaders() },
            ),
        );

        const publicJwk =
            stripPrivateComponents(opts.privateJwk) ??
            (await this.fetchPublicJwk(opts.kid, alg));
        publicJwk.kid = opts.kid;
        publicJwk.alg = alg;
        return { ref: { externalKeyId: opts.kid, publicJwk, alg } };
    }

    async sign(
        ref: KmsKeyRef,
        data: Uint8Array,
        alg?: KmsSigningAlg,
    ): Promise<Uint8Array> {
        if (!ref.externalKeyId) {
            throw new Error(
                `VaultKmsAdapter[${this.providerId}]: missing externalKeyId`,
            );
        }
        const signAlg = alg ?? ref.alg;
        this.assertSupported(signAlg);

        const url = `${this.vaultUrl}/v1/${this.transitMount}/sign/${encodeURIComponent(ref.externalKeyId)}/sha2-256`;
        const response = await firstValueFrom(
            this.http.post<{ data: { signature: string } }>(
                url,
                {
                    input: Buffer.from(data).toString("base64"),
                    marshaling_algorithm: "jws", // raw r||s, base64url-encoded
                    prehashed: false,
                },
                { headers: this.authHeaders() },
            ),
        );

        const sig = response.data?.data?.signature;
        if (!sig) {
            throw new Error(
                `VaultKmsAdapter[${this.providerId}]: empty signature in response`,
            );
        }
        const encoded = sig.split(":").pop() as string;
        return base64UrlOrBase64ToBytes(encoded);
    }

    async deleteKey(ref: KmsKeyRef): Promise<void> {
        if (!ref.externalKeyId) return;
        this.jwkCache.invalidate(ref.externalKeyId);
        const url = `${this.vaultUrl}/v1/${this.transitMount}/keys/${encodeURIComponent(ref.externalKeyId)}`;
        try {
            await firstValueFrom(
                this.http.post(
                    `${url}/config`,
                    { deletion_allowed: true },
                    { headers: this.authHeaders() },
                ),
            );
            await firstValueFrom(
                this.http.delete(url, { headers: this.authHeaders() }),
            );
        } catch (err) {
            this.logger.warn(
                `Failed to delete Vault key ${ref.externalKeyId}: ${String(err)}`,
            );
        }
    }

    async health(): Promise<KmsHealthResult> {
        const start = Date.now();
        try {
            await firstValueFrom(
                this.http.get(`${this.vaultUrl}/v1/sys/health`, {
                    headers: this.authHeaders(),
                }),
            );
            return { ok: true, latencyMs: Date.now() - start };
        } catch (err) {
            return {
                ok: false,
                latencyMs: Date.now() - start,
                error: String(err),
            };
        }
    }

    private async fetchPublicJwk(
        keyName: string,
        alg: KmsSigningAlg,
    ): Promise<JWK> {
        const cached = this.jwkCache.get(keyName);
        if (cached) return cached;
        const jwk = await this.fetchPublicJwkFromVault(keyName, alg);
        this.jwkCache.set(keyName, jwk);
        return jwk;
    }

    private async fetchPublicJwkFromVault(
        keyName: string,
        alg: KmsSigningAlg,
    ): Promise<JWK> {
        const url = `${this.vaultUrl}/v1/${this.transitMount}/keys/${encodeURIComponent(keyName)}`;
        const response = await firstValueFrom(
            this.http.get<{
                data: {
                    latest_version: number;
                    keys: Record<
                        string,
                        { public_key?: string; creation_time?: string }
                    >;
                };
            }>(url, { headers: this.authHeaders() }),
        );

        const data = response.data?.data;
        const latest = String(data?.latest_version ?? 1);
        const pem = data?.keys?.[latest]?.public_key;
        if (!pem) {
            throw new BadRequestException(
                `VaultKmsAdapter[${this.providerId}]: key '${keyName}' has no public_key`,
            );
        }

        const publicKey = await globalThis.crypto.subtle.importKey(
            "spki",
            pemToDer(pem),
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["verify"],
        );
        const jwk = await exportJWK(publicKey);
        jwk.kid = keyName;
        jwk.alg = alg;
        return jwk;
    }

    private authHeaders(): Record<string, string> {
        return { "X-Vault-Token": this.vaultToken };
    }

    /**
     * Ensure the configured transit mount exists. Idempotent. Subsequent
     * calls are cheap no-ops once the mount has been verified.
     */
    private async ensureMount(): Promise<void> {
        if (this.mountEnsured) return;
        const url = `${this.vaultUrl}/v1/sys/mounts/${this.transitMount}`;
        try {
            await firstValueFrom(
                this.http.post(
                    url,
                    { type: "transit" },
                    { headers: this.authHeaders() },
                ),
            );
            this.logger.log(`Created transit mount '${this.transitMount}'`);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response
                ?.status;
            if (status !== 400 && status !== 409) {
                throw err;
            }
            // 400 = "path is already in use" — mount exists, treat as success.
        }
        this.mountEnsured = true;
    }

    private assertSupported(alg: KmsSigningAlg): void {
        if (!this.capabilities.supportedAlgs.includes(alg)) {
            throw new Error(
                `VaultKmsAdapter[${this.providerId}]: unsupported alg '${alg}'`,
            );
        }
    }
}

function vaultKeyType(alg: KmsSigningAlg): string {
    if (alg === "ES256") {
        return "ecdsa-p256";
    }
    throw new Error(`Unsupported alg ${alg}`);
}

function stripPrivateComponents(jwk: JWK): JWK {
    const { d, p, q, dp, dq, qi, k, ...publicJwk } = jwk as Record<
        string,
        unknown
    >;
    return publicJwk;
}

function pemToDer(pem: string): ArrayBuffer {
    const b64 = pem
        .replace(/-----BEGIN [^-]+-----/g, "")
        .replace(/-----END [^-]+-----/g, "")
        .replace(/\s+/g, "");
    const bytes = Buffer.from(b64, "base64");
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
    );
}

function base64UrlOrBase64ToBytes(s: string): Uint8Array {
    const normalized = s.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return new Uint8Array(Buffer.from(padded, "base64"));
}
