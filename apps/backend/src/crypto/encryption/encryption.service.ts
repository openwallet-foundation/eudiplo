import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
    compactDecrypt,
    exportJWK,
    generateKeyPair,
    importJWK,
    JWK,
    jwtDecrypt,
} from "jose";
import { KeyUsageType } from "../key/entities/key-chain.entity";
import { KeyChainService } from "../key/key-chain.service";

/**
 * Service for handling encryption and decryption operations.
 */
@Injectable()
export class EncryptionService {
    constructor(private readonly keyChainService: KeyChainService) {}

    /**
     * Initializes the encryption keys for a given tenant.
     * Creates a key chain with an ECDH-ES encryption key.
     * @param tenantId - The ID of the tenant for which to initialize the keys.
     */
    async onTenantInit(tenantId: string): Promise<void> {
        const privateKey = await generateKeyPair("ECDH-ES", {
            crv: "P-256",
            extractable: true,
        }).then(async (secret) => exportJWK(secret.privateKey));

        privateKey.alg = "ECDH-ES";

        await this.keyChainService.createStandalone({
            tenantId,
            description: "Encryption key",
            usageType: KeyUsageType.Encrypt,
            privateKey,
        });
    }

    /**
     * Decrypts a JWE (JSON Web Encryption) response.
     * @param response - The encrypted JWE string.
     * @param tenantId - The ID of the tenant for which to decrypt the response.
     * @returns The decrypted payload.
     */
    async decryptJwe<T>(response: string, tenantId: string): Promise<T> {
        const keyChain = await this.keyChainService.findByUsageType(
            tenantId,
            KeyUsageType.Encrypt,
        );

        const privateEncryptionKey = (await importJWK(
            keyChain.activeJwk,
            "ECDH-ES",
        )) as CryptoKey;

        const res = await jwtDecrypt<T>(response, privateEncryptionKey);
        return res.payload;
    }

    /**
     * Decrypts a JWE response with a caller-supplied private encryption JWK.
     * Falls back to the tenant-wide encryption key when none is provided.
     */
    async decryptJweWithPrivateJwk<T>(
        response: string,
        tenantId: string,
        privateJwk?: JWK,
    ): Promise<T> {
        const jwk =
            privateJwk ?? (await this.getEncryptionPrivateJwk(tenantId));

        const privateEncryptionKey = (await importJWK(
            jwk,
            "ECDH-ES",
        )) as CryptoKey;

        const res = await jwtDecrypt<T>(response, privateEncryptionKey);
        return res.payload;
    }

    /**
     * Retrieves the full (private) encryption JWK for a tenant.
     * Used by ISO 18013-7 HPKE decryption — never expose this JWK externally.
     */
    async getEncryptionPrivateJwk(tenantId: string): Promise<JWK> {
        const keyChain = await this.keyChainService.findByUsageType(
            tenantId,
            KeyUsageType.Encrypt,
        );
        return keyChain.activeJwk;
    }

    /**
     * Retrieves the public encryption key for a given tenant.
     * @param tenantId - The ID of the tenant for which to retrieve the public key.
     * @returns The public encryption key as a JWK.
     */
    async getEncryptionPublicKey(tenantId: string): Promise<JWK> {
        const keyChain = await this.keyChainService.findByUsageType(
            tenantId,
            KeyUsageType.Encrypt,
        );

        // Return public key (without private key component 'd')
        const publicKey: JWK = { ...keyChain.activeJwk };
        delete publicKey.d;
        publicKey.kid = keyChain.id;
        publicKey.use = "enc";

        return publicKey;
    }

    /**
     * Generates a per-request ephemeral ECDH-ES keypair for OID4VP response encryption.
     */
    async generateEphemeralEncryptionKeyPair(): Promise<{
        publicJwk: JWK;
        privateJwk: JWK;
    }> {
        const keyPair = await generateKeyPair("ECDH-ES", {
            crv: "P-256",
            extractable: true,
        });

        const privateJwk = await exportJWK(keyPair.privateKey);
        const publicJwk = await exportJWK(keyPair.publicKey);

        const kid = randomUUID();
        privateJwk.alg = "ECDH-ES";
        privateJwk.use = "enc";
        privateJwk.kid = kid;
        publicJwk.alg = "ECDH-ES";
        publicJwk.use = "enc";
        publicJwk.kid = kid;

        return { publicJwk, privateJwk };
    }

    /**
     * Decrypts a JWE (JSON Web Encryption) compact token and returns the plaintext
     * parsed as JSON. Use this when the JWE payload is raw JSON (not a nested JWT).
     * @param jwe - The JWE compact serialization string.
     * @param tenantId - The ID of the tenant.
     * @returns The decrypted payload parsed as a JSON object.
     */
    async decryptJweToJson<T = Record<string, unknown>>(
        jwe: string,
        tenantId: string,
    ): Promise<T> {
        const keyChain = await this.keyChainService.findByUsageType(
            tenantId,
            KeyUsageType.Encrypt,
        );

        const privateEncryptionKey = (await importJWK(
            keyChain.activeJwk,
            "ECDH-ES",
        )) as CryptoKey;

        const { plaintext } = await compactDecrypt(jwe, privateEncryptionKey);
        return JSON.parse(new TextDecoder().decode(plaintext)) as T;
    }
}
