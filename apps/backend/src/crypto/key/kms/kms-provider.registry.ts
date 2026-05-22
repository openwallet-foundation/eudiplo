import { HttpService } from "@nestjs/axios";
import {
    BadRequestException,
    Injectable,
    Logger,
    OnModuleInit,
} from "@nestjs/common";
import * as x509 from "@peculiar/x509";
import type {
    KmsProviderConfigDto,
    KmsProviderType,
} from "../dto/kms-config.dto";
import { KmsConfigService } from "./kms-config.service";
import { KmsCryptoProvider } from "./kms-crypto-provider";
import type { KmsProviderInfoDto } from "../dto/kms-provider-capabilities.dto";
import type { KmsProvidersResponseDto } from "../dto/kms-providers-response.dto";
import { AwsKmsAdapter } from "./adapters/aws-kms.adapter";
import { DbKmsAdapter } from "./adapters/db-kms.adapter";
import { HttpKmsAdapter } from "./adapters/http-kms.adapter";
import { Pkcs11KmsAdapter } from "./adapters/pkcs11-kms.adapter";
import { VaultKmsAdapter } from "./adapters/vault-kms.adapter";
import type { KmsAdapter } from "./kms-adapter";

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
    private readonly adapters = new Map<string, KmsAdapter>();
    private defaultProviderId: string = DEFAULT_PROVIDER_ID;

    constructor(
        private readonly kmsConfig: KmsConfigService,
        private readonly httpService: HttpService,
    ) {}

    onModuleInit(): void {
        this.defaultProviderId =
            this.kmsConfig.getDefaultProviderId() || DEFAULT_PROVIDER_ID;

        for (const provider of this.kmsConfig.getProviders()) {
            this.adapters.set(provider.id, this.instantiate(provider));
        }

        // Always ensure a default db adapter exists.
        if (!this.adapters.has(DEFAULT_PROVIDER_ID)) {
            this.adapters.set(
                DEFAULT_PROVIDER_ID,
                new DbKmsAdapter(DEFAULT_PROVIDER_ID),
            );
        }

        this.logger.log(
            `Registered KMS providers: ${[...this.adapters.keys()].join(", ")} (default: ${this.defaultProviderId})`,
        );

        // Install our KMS-aware crypto provider so @peculiar/x509 routes
        // certificate signature generation back to the configured KMS
        // adapter — private key material never leaves the backend.
        x509.cryptoProvider.set(new KmsCryptoProvider());
    }

    /** Resolve an adapter by provider id. Throws if not registered. */
    resolve(providerId?: string): KmsAdapter {
        const id = providerId || this.defaultProviderId;
        const adapter = this.adapters.get(id);
        if (!adapter) {
            throw new BadRequestException(
                `Unknown KMS provider '${id}'. Configured providers: ${[...this.adapters.keys()].join(", ")}`,
            );
        }
        return adapter;
    }

    getDefault(): KmsAdapter {
        return this.resolve(this.defaultProviderId);
    }

    /** Return the public view of registered providers (for the API). */
    list(): KmsProvidersResponseDto {
        const providers: KmsProviderInfoDto[] = [...this.adapters.values()].map(
            (a) => ({
                name: a.providerId,
                type: a.type,
                capabilities: a.capabilities,
            }),
        );
        return { providers, default: this.defaultProviderId };
    }

    /**
     * Run the health probe for every registered adapter in parallel.
     */
    async health(): Promise<
        Array<{
            providerId: string;
            type: string;
            ok: boolean;
            latencyMs?: number;
            error?: string;
        }>
    > {
        const entries = [...this.adapters.values()];
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

    private instantiate(provider: KmsProviderConfigDto): KmsAdapter {
        const type: KmsProviderType = provider.type;
        switch (type) {
            case "db":
                return new DbKmsAdapter(provider.id);
            case "vault": {
                const p = provider as Extract<
                    KmsProviderConfigDto,
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
                    KmsProviderConfigDto,
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
                    KmsProviderConfigDto,
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
                    KmsProviderConfigDto,
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
            default: {
                const _exhaustive: never = type;
                throw new Error(
                    `Unknown KMS provider type: ${String(_exhaustive)}`,
                );
            }
        }
    }
}
