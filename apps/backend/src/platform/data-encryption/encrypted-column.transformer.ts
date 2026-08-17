import { ValueTransformer } from "typeorm";
import { DataEncryptionService } from "./data-encryption.service";

/**
 * Singleton holder for the encryption service instance.
 * This is necessary because TypeORM transformers don't support dependency injection.
 */
let encryptionServiceInstance: DataEncryptionService | null = null;

/**
 * Initialize the encryption transformer with a DataEncryptionService instance.
 * Must be called during application bootstrap before any database operations.
 */
export function initializeEncryptionTransformer(
    service: DataEncryptionService,
): void {
    encryptionServiceInstance = service;
}

/**
 * Get the encryption service instance.
 * Throws if not initialized.
 */
function getEncryptionService(): DataEncryptionService {
    if (!encryptionServiceInstance) {
        throw new Error(
            "DataEncryptionService not initialized. Call initializeEncryptionTransformer() during bootstrap.",
        );
    }
    return encryptionServiceInstance;
}

/**
 * TypeORM column transformer for encrypting JSON data at rest.
 * Encrypts on write (to database) and decrypts on read (from database).
 *
 * Usage:
 * @Column("text", { transformer: EncryptedJsonTransformer })
 * sensitiveData: SomeType;
 */
export const EncryptedJsonTransformer: ValueTransformer = {
    /**
     * Transform value when writing to database.
     * Encrypts the JSON value.
     */
    to(value: unknown): string | null {
        if (value === null || value === undefined) {
            return null;
        }
        return getEncryptionService().encryptJson(value);
    },

    /**
     * Transform value when reading from database.
     * Decrypts the encrypted value back to JSON.
     */
    from(value: string | null): unknown {
        if (value === null || value === undefined) {
            return null;
        }

        const service = getEncryptionService();

        // Handle migration: if value is not encrypted, return as-is (parsed JSON)
        // This allows existing unencrypted data to be read during migration
        if (!service.isEncrypted(value)) {
            // Try to parse as JSON (for existing unencrypted data)
            try {
                return typeof value === "string" ? JSON.parse(value) : value;
            } catch {
                return value;
            }
        }

        return service.decryptJson(value);
    },
};

/**
 * TypeORM column transformer for encrypting string data at rest.
 * Use for non-JSON string values.
 *
 * Usage:
 * @Column("text", { transformer: EncryptedStringTransformer })
 * sensitiveString: string;
 */
export const EncryptedStringTransformer: ValueTransformer = {
    /**
     * Transform value when writing to database.
     */
    to(value: string | null): string | null {
        if (value === null || value === undefined) {
            return null;
        }
        return getEncryptionService().encrypt(value);
    },

    /**
     * Transform value when reading from database.
     */
    from(value: string | null): string | null {
        if (value === null || value === undefined) {
            return null;
        }

        const service = getEncryptionService();

        // Handle migration: if value is not encrypted, return as-is
        if (!service.isEncrypted(value)) {
            return value;
        }

        return service.decrypt(value);
    },
};
