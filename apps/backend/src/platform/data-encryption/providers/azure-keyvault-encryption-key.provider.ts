import { createHash } from "node:crypto";
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EncryptionKeyProvider } from "./encryption-key-provider.interface";

/**
 * Azure Key Vault encryption key provider.
 * Fetches the encryption key from Azure Key Vault at startup.
 *
 * Security benefits:
 * - Key is fetched at runtime, only exists in RAM
 * - Not exposed via environment variables
 * - Azure provides RBAC-based access control, audit logging via Azure Monitor
 * - Works seamlessly with Managed Identity (no credentials in env vars)
 * - Supports key rotation via Key Vault versioning
 *
 * Required environment variables:
 * - AZURE_KEYVAULT_URL: Key Vault URL (e.g., https://myvault.vault.azure.net)
 * - AZURE_ENCRYPTION_SECRET_NAME: Secret name in Key Vault
 *
 * Authentication (in order of preference):
 * 1. Managed Identity (when running in Azure)
 * 2. Environment credentials (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET)
 * 3. Azure CLI credentials (for local development)
 *
 * Secret format in Azure Key Vault:
 * - Plain text: 32-byte key encoded as base64 or hex
 */
@Injectable()
export class AzureKeyVaultEncryptionKeyProvider
    implements EncryptionKeyProvider
{
    readonly name = "azure";
    private readonly logger = new Logger(
        AzureKeyVaultEncryptionKeyProvider.name,
    );
    private readonly client: SecretClient;
    private readonly secretName: string;

    constructor(private readonly configService: ConfigService) {
        const vaultUrl = this.configService.get<string>("AZURE_KEYVAULT_URL");
        if (!vaultUrl) {
            throw new Error(
                "AZURE_KEYVAULT_URL is required when using Azure Key Vault encryption key source",
            );
        }

        this.secretName = this.configService.get<string>(
            "AZURE_ENCRYPTION_SECRET_NAME",
        ) as string;
        if (!this.secretName) {
            throw new Error(
                "AZURE_ENCRYPTION_SECRET_NAME is required when using Azure Key Vault encryption key source",
            );
        }

        // DefaultAzureCredential tries multiple auth methods in order:
        // 1. Environment credentials
        // 2. Managed Identity
        // 3. Azure CLI credentials
        // 4. VS Code credentials
        const credential = new DefaultAzureCredential();
        this.client = new SecretClient(vaultUrl, credential);
    }

    async getKey(): Promise<Buffer> {
        this.logger.log(
            `Fetching encryption key from Azure Key Vault: ${this.secretName}`,
        );

        try {
            const secret = await this.client.getSecret(this.secretName);
            const keyData = secret.value;

            if (!keyData) {
                throw new Error(`Secret ${this.secretName} has no value`);
            }

            // Decode the key (support base64 and hex)
            let keyBuffer: Buffer;
            if (keyData.length === 64 && /^[0-9a-fA-F]+$/.test(keyData)) {
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
                `Encryption key loaded from Azure Key Vault (fingerprint: ${this.fingerprint(keyBuffer)})`,
            );
            return keyBuffer;
        } catch (error: any) {
            if (error.code === "SecretNotFound") {
                throw new Error(
                    `Encryption key secret not found: ${this.secretName}. ` +
                        `Create it with: az keyvault secret set --vault-name <vault> --name ${this.secretName} --value $(openssl rand -base64 32)`,
                );
            }
            if (error.code === "Forbidden" || error.statusCode === 403) {
                throw new Error(
                    `Access denied to secret: ${this.secretName}. ` +
                        `Ensure the identity has 'Key Vault Secrets User' role on the Key Vault.`,
                );
            }
            throw new Error(
                `Failed to fetch encryption key from Azure Key Vault: ${error.message}`,
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
