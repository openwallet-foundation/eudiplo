/**
 * Interface for encryption key providers.
 * Implementations fetch the encryption key from different sources at runtime.
 *
 * Security benefit: Keys fetched at runtime are only in RAM,
 * not exposed via environment variables that can be read with `env` command.
 */
export interface EncryptionKeyProvider {
    /**
     * Fetch the 256-bit encryption key.
     * Called once at application startup.
     * @returns 32-byte Buffer (256 bits) for AES-256-GCM
     */
    getKey(): Promise<Buffer>;

    /**
     * Name of the provider for logging/diagnostics.
     */
    readonly name: string;
}

/**
 * Configuration for encryption key source.
 */
export type EncryptionKeySource = "env" | "vault" | "aws" | "azure";

/**
 * Injection token for the encryption key provider.
 */
export const ENCRYPTION_KEY_PROVIDER = "ENCRYPTION_KEY_PROVIDER";
