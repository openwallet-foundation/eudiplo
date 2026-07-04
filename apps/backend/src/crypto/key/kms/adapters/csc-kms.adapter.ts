import { createHash, X509Certificate } from "node:crypto";
import { Logger, NotImplementedException } from "@nestjs/common";
import type { JWK } from "jose";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";
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

const DEFAULT_HASH_ALGORITHM_OID = "2.16.840.1.101.3.4.2.1"; // SHA-256
const DEFAULT_SIGN_ALGORITHM_OID = "1.2.840.10045.4.3.2"; // ecdsa-with-SHA256
const DEFAULT_API_PATH = "/csc/v2";

interface CscAuthorizeAuthData {
    id: string;
    value: string;
}

export interface CscKmsAdapterConfig {
    providerId: string;
    baseUrl: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
    credentialId?: string;
    userId?: string;
    hashAlgorithmOid?: string;
    signAlgorithmOid?: string;
    sad?: string;
    useAuthorizeEndpoint?: boolean;
    authorizeAuthData?: CscAuthorizeAuthData[];
    apiPath?: string;
}

/**
 * CSC (Cloud Signature Consortium) adapter.
 *
 * Integrates with CSC v2 APIs for remote signing:
 * - credentials/list
 * - credentials/info
 * - signatures/signHash
 *
 * Optional SAD acquisition via credentials/authorize is supported when
 * configured.
 */
export class CscKmsAdapter implements KmsAdapter {
    private readonly logger = new Logger(CscKmsAdapter.name);

    readonly providerId: string;
    readonly type: KmsProviderType = "csc";
    readonly capabilities: KmsAdapterCapabilities = {
        canCreate: true,
        canImport: false,
        canDelete: false,
        supportedAlgs: ["ES256"],
        defaultAlg: "ES256",
    };

    private readonly baseUrl: string;
    private readonly tokenUrl: string;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly scope?: string;
    private readonly configuredCredentialId?: string;
    private readonly userId?: string;
    private readonly hashAlgorithmOid: string;
    private readonly signAlgorithmOid: string;
    private readonly configuredSad?: string;
    private readonly useAuthorizeEndpoint: boolean;
    private readonly authorizeAuthData?: CscAuthorizeAuthData[];
    private readonly apiPath: string;
    private readonly jwkCache = new PublicJwkCache();

    private oauth2TokenCache: {
        accessToken: string;
        expiresAt: number;
    } | null = null;

    private resolvedCredentialId: string | null = null;

    constructor(
        config: CscKmsAdapterConfig,
        private readonly http: HttpService,
    ) {
        this.providerId = config.providerId;
        this.baseUrl = config.baseUrl.replace(/\/$/, "");
        this.tokenUrl = config.tokenUrl;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.scope = config.scope;
        this.configuredCredentialId = config.credentialId;
        this.userId = config.userId;
        this.hashAlgorithmOid =
            config.hashAlgorithmOid || DEFAULT_HASH_ALGORITHM_OID;
        this.signAlgorithmOid =
            config.signAlgorithmOid || DEFAULT_SIGN_ALGORITHM_OID;
        this.configuredSad = config.sad;
        this.useAuthorizeEndpoint = Boolean(config.useAuthorizeEndpoint);
        this.authorizeAuthData = config.authorizeAuthData;
        this.apiPath = config.apiPath ?? DEFAULT_API_PATH;
    }

    async generateKey(opts: {
        kid: string;
        alg?: KmsSigningAlg;
    }): Promise<KmsKeyMaterial> {
        const alg = opts.alg ?? this.capabilities.defaultAlg;
        this.assertSupported(alg);

        const credentialId = await this.resolveCredentialId();
        const publicJwk = await this.fetchPublicJwk(
            credentialId,
            alg,
            opts.kid,
        );

        return {
            ref: {
                externalKeyId: credentialId,
                publicJwk,
                alg,
            },
        };
    }

    importKey(_opts: {
        kid: string;
        privateJwk: JWK;
        alg?: KmsSigningAlg;
    }): Promise<KmsKeyMaterial> {
        throw new NotImplementedException(
            `CscKmsAdapter[${this.providerId}]: importKey is not supported by CSC provider`,
        );
    }

    async sign(
        ref: KmsKeyRef,
        data: Uint8Array,
        alg?: KmsSigningAlg,
    ): Promise<Uint8Array> {
        const signAlg = alg ?? ref.alg;
        this.assertSupported(signAlg);

        const credentialId =
            ref.externalKeyId ||
            this.configuredCredentialId ||
            (await this.resolveCredentialId());

        const digest = createHash("sha256").update(Buffer.from(data)).digest();
        const digestB64 = digest.toString("base64");
        const sad = await this.resolveSad(credentialId, digestB64);

        const body: Record<string, unknown> = {
            credentialID: credentialId,
            hashes: [digestB64],
            hashAlgorithmOID: this.hashAlgorithmOid,
            signAlgo: this.signAlgorithmOid,
        };
        if (sad) {
            body.SAD = sad;
        }

        const response = await firstValueFrom(
            this.http.post<{
                signatures?: string[];
                signature?: string;
            }>(
                this.endpoint("/signatures/signHash"),
                body,
                await this.requestConfig(),
            ),
        );

        const encoded =
            response.data?.signatures?.[0] ?? response.data?.signature;
        if (!encoded) {
            throw new Error(
                `CscKmsAdapter[${this.providerId}]: signatures/signHash returned no signature`,
            );
        }

        const signatureBytes = base64UrlOrBase64ToBytes(encoded);
        if (signatureBytes.length === 64) {
            return signatureBytes;
        }

        if (signatureBytes[0] === 0x30) {
            return derEcdsaToRaw(signatureBytes, 32);
        }

        throw new Error(
            `CscKmsAdapter[${this.providerId}]: unsupported signature format returned by CSC provider`,
        );
    }

    async deleteKey(_ref: KmsKeyRef): Promise<void> {
        // CSC credentials are managed externally.
    }

    async health(): Promise<KmsHealthResult> {
        const start = Date.now();
        try {
            await this.resolveCredentialId();
            return { ok: true, latencyMs: Date.now() - start };
        } catch (err) {
            return {
                ok: false,
                latencyMs: Date.now() - start,
                error: String(err),
            };
        }
    }

    private async resolveCredentialId(): Promise<string> {
        if (this.configuredCredentialId) {
            this.resolvedCredentialId = this.configuredCredentialId;
            return this.configuredCredentialId;
        }
        if (this.resolvedCredentialId) {
            return this.resolvedCredentialId;
        }

        const body: Record<string, unknown> = {
            certInfo: true,
            authInfo: true,
            credentialInfo: true,
            onlyValid: true,
        };
        if (this.userId) {
            body.userID = this.userId;
        }

        const response = await firstValueFrom(
            this.http.post<{
                credentialIDs?: string[];
                credentialIds?: string[];
            }>(
                this.endpoint("/credentials/list"),
                body,
                await this.requestConfig(),
            ),
        );

        const ids =
            response.data?.credentialIDs ?? response.data?.credentialIds;
        const credentialId = ids?.[0];
        if (!credentialId) {
            throw new Error(
                `CscKmsAdapter[${this.providerId}]: credentials/list returned no credential IDs and no credentialId is configured`,
            );
        }
        this.resolvedCredentialId = credentialId;
        return credentialId;
    }

    private async fetchPublicJwk(
        credentialId: string,
        alg: KmsSigningAlg,
        kid: string,
    ): Promise<JWK> {
        const cacheKey = `${credentialId}:${kid}`;
        const cached = this.jwkCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const response = await firstValueFrom(
            this.http.post<Record<string, unknown>>(
                this.endpoint("/credentials/info"),
                {
                    credentialID: credentialId,
                    certInfo: true,
                    authInfo: true,
                },
                await this.requestConfig(),
            ),
        );

        const certEntry = extractFirstCertificate(response.data);
        if (!certEntry) {
            throw new Error(
                `CscKmsAdapter[${this.providerId}]: credentials/info returned no certificate data for credential ${credentialId}`,
            );
        }

        const certPem = normalizeCertificateToPem(certEntry);
        const x509 = new X509Certificate(certPem);
        const jwk = x509.publicKey.export({ format: "jwk" }) as JWK;
        jwk.kid = kid;
        jwk.alg = alg;

        this.jwkCache.set(cacheKey, jwk);
        return jwk;
    }

    private async resolveSad(
        credentialId: string,
        digestB64: string,
    ): Promise<string | undefined> {
        if (this.configuredSad) {
            return this.configuredSad;
        }
        if (!this.useAuthorizeEndpoint) {
            return undefined;
        }

        const body: Record<string, unknown> = {
            credentialID: credentialId,
            numSignatures: 1,
            hashes: [digestB64],
            hashAlgorithmOID: this.hashAlgorithmOid,
        };
        if (this.authorizeAuthData?.length) {
            body.authData = this.authorizeAuthData;
        }

        const response = await firstValueFrom(
            this.http.post<{ SAD?: string; sad?: string }>(
                this.endpoint("/credentials/authorize"),
                body,
                await this.requestConfig(),
            ),
        );

        const sad = response.data?.SAD ?? response.data?.sad;
        if (!sad) {
            throw new Error(
                `CscKmsAdapter[${this.providerId}]: credentials/authorize returned no SAD`,
            );
        }
        return sad;
    }

    private endpoint(path: string): string {
        return `${this.baseUrl}${this.apiPath}${path}`;
    }

    private async requestConfig(): Promise<{
        headers: Record<string, string>;
    }> {
        const token = await this.getOAuth2Token();
        return {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        };
    }

    private async getOAuth2Token(): Promise<string> {
        const now = Date.now();
        if (this.oauth2TokenCache && this.oauth2TokenCache.expiresAt > now) {
            return this.oauth2TokenCache.accessToken;
        }

        const params = new URLSearchParams({
            grant_type: "client_credentials",
            client_id: this.clientId,
            client_secret: this.clientSecret,
        });
        if (this.scope) {
            params.set("scope", this.scope);
        }

        const response = await firstValueFrom(
            this.http.post<{ access_token: string; expires_in?: number }>(
                this.tokenUrl,
                params.toString(),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                },
            ),
        );

        const accessToken = response.data?.access_token;
        if (!accessToken) {
            throw new Error(
                `CscKmsAdapter[${this.providerId}]: token endpoint returned no access_token`,
            );
        }

        const expiresIn = response.data?.expires_in ?? 3600;
        this.oauth2TokenCache = {
            accessToken,
            expiresAt: now + Math.max(expiresIn - 30, 10) * 1000,
        };

        return accessToken;
    }

    private assertSupported(alg: KmsSigningAlg): void {
        if (!this.capabilities.supportedAlgs.includes(alg)) {
            throw new Error(
                `CscKmsAdapter[${this.providerId}]: unsupported alg '${alg}'`,
            );
        }
    }
}

function extractFirstCertificate(
    data: Record<string, unknown>,
): string | undefined {
    const certObject = (data.cert as Record<string, unknown> | undefined) || {};
    const certs =
        (certObject.certificates as unknown[] | undefined) ||
        (certObject.certificateChain as unknown[] | undefined) ||
        (data.certificates as unknown[] | undefined);

    const first = certs?.[0];
    if (typeof first === "string" && first.length > 0) {
        return first;
    }

    const single = data.certificate;
    if (typeof single === "string" && single.length > 0) {
        return single;
    }

    return undefined;
}

function normalizeCertificateToPem(value: string): string {
    const trimmed = value.trim();
    if (trimmed.includes("-----BEGIN CERTIFICATE-----")) {
        return trimmed;
    }

    const normalized = trimmed.replace(/\s+/g, "");
    const body =
        Buffer.from(normalized, "base64")
            .toString("base64")
            .match(/.{1,64}/g)
            ?.join("\n") || "";
    return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
}

function base64UrlOrBase64ToBytes(s: string): Uint8Array {
    const normalized = s.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return new Uint8Array(Buffer.from(padded, "base64"));
}

function derEcdsaToRaw(der: Uint8Array, coordLength: number): Uint8Array {
    let offset = 0;
    if (der[offset++] !== 0x30) {
        throw new Error("Invalid ECDSA signature: missing SEQUENCE tag");
    }

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
