import { hkdfSync } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EncryptionKeyProvider } from "./encryption-key-provider.interface";

/**
 * Environment-based encryption key provider.
 * Derives the encryption key from MASTER_SECRET using HKDF.
 *
 * WARNING: This provider is intended for development only.
 * In production, use 'vault', 'aws', or 'azure' to fetch keys at runtime.
 *
 * Security consideration: The key is derived from an environment variable,
 * which can be read by any process with access to the container.
 */
@Injectable()
export class EnvEncryptionKeyProvider implements EncryptionKeyProvider {
    readonly name = "env";
    private readonly logger = new Logger(EnvEncryptionKeyProvider.name);

    constructor(private readonly configService: ConfigService) {}

    async getKey(): Promise<Buffer> {
        const masterSecret = this.configService.get<string>("MASTER_SECRET");
        if (!masterSecret) {
            throw new Error(
                "MASTER_SECRET is required when using env encryption key source",
            );
        }

        this.logger.warn(
            "Using env-based encryption key derivation. " +
                "For production, use ENCRYPTION_KEY_SOURCE=vault|aws|azure " +
                "to fetch keys at runtime (keys only in RAM, not env vars).",
        );

        // Derive a 256-bit encryption key from MASTER_SECRET using HKDF
        return Buffer.from(
            hkdfSync(
                "sha256",
                masterSecret,
                "", // salt - empty for simplicity
                "eudiplo-encryption-at-rest", // info - context string
                32, // 256 bits
            ),
        );
    }
}
