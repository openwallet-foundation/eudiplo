import { HttpService } from "@nestjs/axios";
import {
    BadRequestException,
    Injectable,
    Logger,
    OnModuleInit,
} from "@nestjs/common";
import * as x509 from "@peculiar/x509";
import type { KmsProviderInfoDto } from "../dto/kms-provider-capabilities.dto";
import type { KmsProvidersResponseDto } from "../dto/kms-providers-response.dto";
import type {
    KmsProviderConfig,
    KmsProviderType,
} from "../schemas/kms-config.schema";
import { AwsKmsAdapter } from "./adapters/aws-kms.adapter";
import { CscKmsAdapter } from "./adapters/csc-kms.adapter";
import { DbKmsAdapter } from "./adapters/db-kms.adapter";
import { HttpKmsAdapter } from "./adapters/http-kms.adapter";
import { Pkcs11KmsAdapter } from "./adapters/pkcs11-kms.adapter";
import { VaultKmsAdapter } from "./adapters/vault-kms.adapter";
import type { KmsAdapter } from "./kms-adapter";
import { KmsConfigService } from "./kms-config.service";
import { KmsCryptoProvider } from "./kms-crypto-provider";

const DEFAULT_PROVIDER_ID = "db";

/**
 * Registry that loads `kms.json`, instantiates one {@link KmsAdapter}
 * per configured provider, and resolves them by id.
 *
 * If `kms.json` is missing, a single `db` adapter is registered under
 * the id `"db"` so existing deployments keep working.
 */
@Injectable()
export class KmsProviderRegistry implements OnModuleInit {
    private readonly logger = new Logger(KmsProviderRegistry.name);
    private globalBundle: {
        adapters: Map<string, KmsAdapter>;
        defaultProviderId: string;
    } = {
        adapters: new Map<string, KmsAdapter>(),
        defaultProviderId: DEFAULT_PROVIDER_ID,
    };
    private readonly tenantBundles = new Map<
        string,
        {
            adapters: Map<string, KmsAdapter>;
            defaultProviderId: string;
        }
    >();

    constructor(
        private readonly kmsConfig: KmsConfigService,
        private readonly httpService: HttpService,
    ) {}

    onModuleInit(): void {
        this.globalBundle = this.buildBundle();

        this.logger.log(
            `Registered global KMS providers: ${[...this.globalBundle.adapters.keys()].join(", ")} (default: ${this.globalBundle.defaultProviderId})`,
        );

        // Install our KMS-aware crypto provider so @peculiar/x509 routes
        // certificate signature generation back to the configured KMS
        // adapter — private key material never leaves the backend.
        x509.cryptoProvider.set(new KmsCryptoProvider());
    }

    /** Resolve an adapter by provider id. Throws if not registered. */
    resolve(providerId?: string, tenantId?: string): KmsAdapter {
        const bundle = this.getBundle(tenantId);
        const id = providerId || bundle.defaultProviderId;
        const adapter = bundle.adapters.get(id);
        if (!adapter) {
            throw new BadRequestException(
                `Unknown KMS provider '${id}'. Configured providers: ${[...bundle.adapters.keys()].join(", ")}`,
            );
        }
        return adapter;
    }

    getDefault(tenantId?: string): KmsAdapter {
        return this.resolve(undefined, tenantId);
    }

    /** Return the public view of registered providers (for the API). */
    list(tenantId?: string): KmsProvidersResponseDto {
        const bundle = this.getBundle(tenantId);
        const providers: KmsProviderInfoDto[] = [
            ...bundle.adapters.values(),
        ].map((a) => ({
            name: a.providerId,
            type: a.type,
            capabilities: a.capabilities,
        }));
        return { providers, default: bundle.defaultProviderId };
    }

    /**
     * Run the health probe for every registered adapter in parallel.
     */
    async health(tenantId?: string): Promise<
        Array<{
            providerId: string;
            type: string;
            ok: boolean;
            latencyMs?: number;
            error?: string;
        }>
    > {
        const bundle = this.getBundle(tenantId);
        const entries = [...bundle.adapters.values()];
        return Promise.all(
            entries.map(async (a) => {
                const result = await a.health();
                return {
                    providerId: a.providerId,
                    type: a.type,
                    ...result,
                };
            }),
        );
    }

    private getBundle(tenantId?: string): {
        adapters: Map<string, KmsAdapter>;
        defaultProviderId: string;
    } {
        if (!tenantId) {
            return this.globalBundle;
        }

        const cached = this.tenantBundles.get(tenantId);
        if (cached) {
            return cached;
        }

        const bundle = this.buildBundle(tenantId);
        this.tenantBundles.set(tenantId, bundle);
        return bundle;
    }

    private buildBundle(tenantId?: string): {
        adapters: Map<string, KmsAdapter>;
        defaultProviderId: string;
    } {
        const adapters = new Map<string, KmsAdapter>();
        const defaultProviderId =
            this.kmsConfig.getDefaultProviderId(tenantId) ||
            DEFAULT_PROVIDER_ID;

        for (const provider of this.kmsConfig.getProviders(tenantId)) {
            adapters.set(provider.id, this.instantiate(provider));
        }

        // Always ensure a default db adapter exists.
        if (!adapters.has(DEFAULT_PROVIDER_ID)) {
            adapters.set(
                DEFAULT_PROVIDER_ID,
                new DbKmsAdapter(DEFAULT_PROVIDER_ID),
            );
        }

        return {
            adapters,
            defaultProviderId,
        };
    }

    invalidateTenant(tenantId: string): void {
        this.tenantBundles.delete(tenantId);
    }

    private instantiate(provider: KmsProviderConfig): KmsAdapter {
        const type: KmsProviderType = provider.type;
        switch (type) {
            case "db":
                return new DbKmsAdapter(provider.id);
            case "vault": {
                const p = provider as Extract<
                    KmsProviderConfig,
                    { type: "vault" }
                >;
                return new VaultKmsAdapter(
                    {
                        providerId: provider.id,
                        vaultUrl: p.vaultUrl,
                        vaultToken: p.vaultToken,
                    },
                    this.httpService,
                );
            }
            case "aws-kms": {
                const p = provider as Extract<
                    KmsProviderConfig,
                    { type: "aws-kms" }
                >;
                return new AwsKmsAdapter({
                    providerId: provider.id,
                    region: p.region,
                    accessKeyId: p.accessKeyId,
                    secretAccessKey: p.secretAccessKey,
                });
            }
            case "pkcs11": {
                const p = provider as Extract<
                    KmsProviderConfig,
                    { type: "pkcs11" }
                >;
                const slot =
                    typeof p.slot === "string" && /^\d+$/.test(p.slot)
                        ? Number(p.slot)
                        : p.slot;
                return new Pkcs11KmsAdapter({
                    providerId: provider.id,
                    library: p.library,
                    slot,
                    pin: p.pin,
                    readOnly: p.readOnly,
                });
            }
            case "http": {
                const p = provider as Extract<
                    KmsProviderConfig,
                    { type: "http" }
                >;
                return new HttpKmsAdapter(
                    {
                        providerId: provider.id,
                        baseUrl: p.baseUrl,
                        auth: p.auth,
                        keysPath: p.keysPath,
                        healthPath: p.healthPath,
                        canImport: p.canImport,
                    },
                    this.httpService,
                );
            }
            case "csc": {
                const p = provider as Extract<
                    KmsProviderConfig,
                    { type: "csc" }
                >;
                return new CscKmsAdapter(
                    {
                        providerId: provider.id,
                        baseUrl: p.baseUrl,
                        tokenUrl: p.tokenUrl,
                        clientId: p.clientId,
                        clientSecret: p.clientSecret,
                        scope: p.scope,
                        credentialId: p.credentialId,
                        userId: p.userId,
                        apiPath: p.apiPath,
                        hashAlgorithmOid: p.hashAlgorithmOid,
                        signAlgorithmOid: p.signAlgorithmOid,
                        sad: p.sad,
                        useAuthorizeEndpoint: p.useAuthorizeEndpoint,
                        authorizeAuthData: p.authorizeAuthData,
                    },
                    this.httpService,
                );
            }
            default: {
                const _exhaustive: never = type;
                throw new Error(
                    `Unknown KMS provider type: ${String(_exhaustive)}`,
                );
            }
        }
    }
}
