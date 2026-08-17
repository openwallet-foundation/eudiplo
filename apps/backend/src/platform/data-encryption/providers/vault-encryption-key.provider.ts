import { createHash } from "node:crypto";
import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { EncryptionKeyProvider } from "./encryption-key-provider.interface";

/**
 * HashiCorp Vault encryption key provider.
 * Fetches the encryption key from Vault's KV secrets engine at startup.
 *
 * The key is stored at: secret/data/eudiplo/encryption-key
 *
 * Security benefits:
 * - Key is fetched at runtime, only exists in RAM
 * - Not exposed via environment variables
 * - Vault provides audit logging, access control, key versioning
 * - Automatic key rotation support via Vault policies
 *
 * Required environment variables:
 * - VAULT_ADDR: URL of the Vault server (e.g., https://vault.example.com:8200)
 * - VAULT_TOKEN: Authentication token for Vault
 * - VAULT_ENCRYPTION_KEY_PATH: (optional) Custom path, defaults to "secret/data/eudiplo/encryption-key"
 */
@Injectable()
export class VaultEncryptionKeyProvider implements EncryptionKeyProvider {
    readonly name = "vault";
    private readonly logger = new Logger(VaultEncryptionKeyProvider.name);
    private readonly vaultUrl: string;
    private readonly vaultToken: string;
    private readonly keyPath: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {
        this.vaultUrl = this.configService.get<string>("VAULT_ADDR") as string;
        this.vaultToken = this.configService.get<string>(
            "VAULT_TOKEN",
        ) as string;
        this.keyPath =
            this.configService.get<string>("VAULT_ENCRYPTION_KEY_PATH") ||
            "secret/data/eudiplo/encryption-key";
    }

    async getKey(): Promise<Buffer> {
        this.logger.log(
            `Fetching encryption key from Vault at ${this.vaultUrl}/${this.keyPath}`,
        );

        try {
            const response = await firstValueFrom(
                this.httpService.get<VaultKVResponse>(
                    `${this.vaultUrl}/v1/${this.keyPath}`,
                    {
                        headers: {
                            "X-Vault-Token": this.vaultToken,
                        },
                    },
                ),
            );

            const keyData = response.data.data?.data?.key;
            if (!keyData) {
                throw new Error(
                    `Encryption key not found at Vault path: ${this.keyPath}. ` +
                        `Expected format: { "data": { "key": "<base64-or-hex-encoded-32-byte-key>" } }`,
                );
            }

            // Support both base64 and hex encoding
            let keyBuffer: Buffer;
            if (keyData.length === 64) {
                // Hex-encoded 32 bytes = 64 characters
                keyBuffer = Buffer.from(keyData, "hex");
            } else {
                // Assume base64
                keyBuffer = Buffer.from(keyData, "base64");
            }

            if (keyBuffer.length !== 32) {
                throw new Error(
                    `Invalid encryption key length: expected 32 bytes, got ${keyBuffer.length}. ` +
                        `Provide a 256-bit key encoded as base64 (44 chars) or hex (64 chars).`,
                );
            }

            this.logger.log(
                `Encryption key loaded from Vault (fingerprint: ${this.fingerprint(keyBuffer)})`,
            );
            return keyBuffer;
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new Error(
                    `Encryption key not found in Vault at path: ${this.keyPath}. ` +
                        `Create it with: vault kv put secret/eudiplo/encryption-key key=$(openssl rand -base64 32)`,
                );
            }
            if (error.response?.status === 403) {
                throw new Error(
                    `Access denied to Vault path: ${this.keyPath}. ` +
                        `Ensure VAULT_TOKEN has read access to this secret.`,
                );
            }
            throw new Error(
                `Failed to fetch encryption key from Vault: ${error.message}`,
            );
        }
    }

    /**
     * Generate a safe fingerprint of the key for logging (first 8 chars of SHA-256 hash).
     */
    private fingerprint(key: Buffer): string {
        return createHash("sha256").update(key).digest("hex").substring(0, 8);
    }
}

interface VaultKVResponse {
    data?: {
        data?: {
            key?: string;
        };
    };
}
